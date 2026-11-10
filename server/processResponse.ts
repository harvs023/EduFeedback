import type { GoogleGenAI } from "@google/genai";
import type { Answer, CommentAnalysis, Survey, SurveyResponse } from "../src/types";
import { applyResults, commentSlots } from "../src/lib/commentSlots";
import { analyzeComment, geminiQuotaStatus } from "./sentiment";
import { adminDb } from "./firestoreAdmin";

/** Up to 3 comments at a time; results keep the original order. */
export async function analyzeAll(
  ai: GoogleGenAI | null,
  comments: { text: string; context: string }[]
): Promise<CommentAnalysis[]> {
  const results = new Array<CommentAnalysis>(comments.length);
  let next = 0;
  const worker = async () => {
    while (next < comments.length) {
      const i = next++;
      results[i] = await analyzeComment(ai, comments[i].text, comments[i].context);
    }
  };
  await Promise.all(Array.from({ length: Math.min(3, comments.length) }, worker));
  return results;
}

/**
 * When Gemini fails on some comments (busy, too many requests), the response stays "pending" and
 * only those comments are tried again after these waits: about 1, 3 and 5 minutes after Submit.
 * Only if all tries fail is the fallback result saved (labeled; the admin can re-run it).
 */
export const REQUEUE_WAITS_MS = [60_000, 120_000, 120_000];

export type ProcessOutcome =
  | "done"
  | "queued"
  | "quota_paused"
  | "not_pending"
  | "not_found"
  | "survey_missing"
  | "unavailable";

/** Kept in memory between tries: the Gemini results already obtained, so they are not asked again. */
const partialResults = new Map<string, CommentAnalysis[]>();
/** Responses with a try waiting or running, so a second request does not start a parallel one. */
const busy = new Set<string>();

/**
 * Analyzes a response saved as "pending" and saves the results into it. Only "pending" responses
 * are touched, so calling this twice (or for someone else's response) cannot change finished
 * results. Nothing about the respondent is read or sent: only the comments and the survey text.
 */
export async function processPendingResponse(
  getAI: () => GoogleGenAI | null,
  responseId: string,
  attempt = 0
): Promise<ProcessOutcome> {
  const db = adminDb();
  if (!db) return "unavailable";
  if (attempt === 0 && busy.has(responseId)) return "queued";
  busy.add(responseId);
  let keepBusy = false;
  try {
    const ref = db.collection("responses").doc(responseId);
    const snap = await ref.get();
    if (!snap.exists) return "not_found";
    const response = snap.data() as SurveyResponse;
    if (response.commentStatus !== "pending") return "not_pending";

    const surveySnap = await db.collection("surveys").doc(String(response.surveyId)).get();
    if (!surveySnap.exists) return "survey_missing";
    const survey = surveySnap.data() as Survey;

    const answers: Answer[] = Array.isArray(response.answers) ? response.answers : [];
    const slots = commentSlots(survey, answers);
    // Gemini's daily limit is used up: leave it pending; the sweep finishes it after the pause.
    if (slots.length > 0 && geminiQuotaStatus().paused) return "quota_paused";

    let update: Pick<SurveyResponse, "answers" | "commentStatus" | "sentimentAnalysis">;
    if (slots.length === 0) {
      update = { answers, commentStatus: "no_comment" };
    } else {
      // Ask Gemini only about comments without a Gemini result yet.
      const earlier = partialResults.get(responseId);
      const todo = slots
        .map((slot, i) => ({ slot, i }))
        .filter(({ i }) => !earlier || earlier[i]?.method !== "gemini");
      const fresh = await analyzeAll(
        getAI(),
        todo.map(({ slot }) => ({ text: slot.text, context: slot.context }))
      );
      const results = slots.map((_, i) => earlier?.[i] as CommentAnalysis);
      todo.forEach(({ i }, k) => (results[i] = fresh[k]));

      const someFailed = results.some((r) => r.method === "fallback");
      // The daily limit ran out during this try: no fallback labels; the sweep retries later.
      if (someFailed && geminiQuotaStatus().paused) return "quota_paused";
      if (someFailed && attempt < REQUEUE_WAITS_MS.length) {
        partialResults.set(responseId, results);
        keepBusy = true;
        const failed = results.filter((r) => r.method === "fallback").length;
        console.warn(
          `[Sentiment] ${failed} comment(s) fell back; trying again in ${REQUEUE_WAITS_MS[attempt] / 60000} min (try ${attempt + 2} of ${REQUEUE_WAITS_MS.length + 1}).`
        );
        setTimeout(() => {
          processPendingResponse(getAI, responseId, attempt + 1).catch((err) =>
            console.error("[Sentiment] Retry failed:", (err as Error)?.message || err)
          );
        }, REQUEUE_WAITS_MS[attempt]);
        return "queued";
      }
      update = applyResults(answers, slots, results);
    }

    // Save only if it is still pending (the admin may have re-run it meanwhile).
    return await db.runTransaction(async (tx) => {
      const current = await tx.get(ref);
      if (!current.exists || current.data()?.commentStatus !== "pending") return "not_pending" as const;
      tx.update(ref, {
        answers: update.answers,
        commentStatus: update.commentStatus,
        ...(update.sentimentAnalysis ? { sentimentAnalysis: update.sentimentAnalysis } : {}),
      });
      return "done" as const;
    });
  } finally {
    if (!keepBusy) {
      busy.delete(responseId);
      partialResults.delete(responseId);
    }
  }
}

/**
 * Finishes responses left "pending": at server start (e.g. it restarted during a retry) and by
 * the sweep every few minutes (e.g. after Gemini's daily limit reset). One at a time, so Gemini
 * is not flooded. Does nothing while the daily-limit pause is on.
 */
export async function resumePendingResponses(getAI: () => GoogleGenAI | null, quiet = false): Promise<void> {
  const db = adminDb();
  if (!db || geminiQuotaStatus().paused) return;
  const snap = await db.collection("responses").where("commentStatus", "==", "pending").get();
  if (snap.empty) return;
  if (!quiet) console.log(`[Sentiment] Finishing ${snap.size} response(s) still waiting for analysis.`);
  for (const d of snap.docs) {
    try {
      if ((await processPendingResponse(getAI, d.id)) === "quota_paused") break;
    } catch (err) {
      console.error("[Sentiment] Could not finish a pending response:", (err as Error)?.message || err);
    }
  }
}

import { Answer, CommentAnalysis, Survey, SurveyResponse } from "../types";
import { authFetch } from "./firebase";
import { applyResults, commentSlots, summarizeComments } from "./commentSlots";

export { summarizeComments };

const MAX_PER_REQUEST = 30;

export interface CommentToAnalyze {
  text: string;
  /** Survey title, section and question. Never the respondent's name or profile. */
  context: string;
}

/**
 * Sends comments to the server. Returns null if the service could not be reached, or did not
 * finish within timeoutMs (when given).
 */
export async function requestCommentAnalysis(
  comments: CommentToAnalyze[],
  timeoutMs?: number
): Promise<CommentAnalysis[] | null> {
  const results: CommentAnalysis[] = [];
  const controller = new AbortController();
  const timer = timeoutMs ? setTimeout(() => controller.abort(), timeoutMs) : null;
  try {
    for (let i = 0; i < comments.length; i += MAX_PER_REQUEST) {
      const res = await authFetch("/api/sentiment/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ comments: comments.slice(i, i + MAX_PER_REQUEST) }),
        signal: controller.signal,
      });
      const data = await res.json();
      if (!res.ok || !data?.success || !Array.isArray(data.results)) return null;
      results.push(...data.results);
    }
    return results;
  } catch (err) {
    console.warn("Sentiment analysis did not finish (unreachable or too slow):", err);
    return null;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/**
 * Analyzes every comment in a response. Never throws: if the service is down, the response is
 * still saved and marked "not_analyzed" so the admin can re-run it later.
 */
export async function analyzeResponse(
  survey: Survey,
  answers: Answer[],
  timeoutMs?: number
): Promise<Pick<SurveyResponse, "answers" | "commentStatus" | "sentimentAnalysis">> {
  const slots = commentSlots(survey, answers);
  if (slots.length === 0) return { answers, commentStatus: "no_comment" };

  const results = await requestCommentAnalysis(
    slots.map(({ text, context }) => ({ text, context })),
    timeoutMs
  );
  if (!results || results.length !== slots.length) return { answers, commentStatus: "not_analyzed" };
  return applyResults(answers, slots, results);
}

/**
 * Submit no longer waits for Gemini: the response is saved as "pending" (or "no_comment") and
 * the server analyzes it and saves the results itself.
 */
export function initialCommentStatus(survey: Survey, answers: Answer[]): "pending" | "no_comment" {
  return commentSlots(survey, answers).length > 0 ? "pending" : "no_comment";
}

/**
 * Asks the server to analyze a saved "pending" response. Does not wait for the answer, and keeps
 * going if the respondent closes the page. If it never arrives, the response stays "pending" and
 * the admin re-runs it.
 */
export function requestServerAnalysis(responseId: string): void {
  authFetch("/api/sentiment/process", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ responseId }),
    keepalive: true,
  }).catch((err) => console.warn("Could not ask the server to analyze the response:", err));
}

/** One saved result, identified by response, answer position and signature. */
export const resultKey = (responseId: string, answerIndex: number, analysis: CommentAnalysis) =>
  `${responseId}#${answerIndex}#${analysis.signature || "unsigned"}`;

const MAX_VERIFY_PER_REQUEST = 1000;

/**
 * Asks the server which saved results have a valid signature. Returns the keys (see resultKey)
 * of the valid ones, or null if the server could not be reached.
 */
export async function verifySavedResults(
  items: { key: string; text: string; analysis: CommentAnalysis }[]
): Promise<{ checked: string[]; valid: string[] } | null> {
  const checked: string[] = [];
  const valid: string[] = [];
  try {
    for (let i = 0; i < items.length; i += MAX_VERIFY_PER_REQUEST) {
      const chunk = items.slice(i, i + MAX_VERIFY_PER_REQUEST);
      const res = await authFetch("/api/sentiment/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: chunk.map(({ text, analysis }) => ({ text, analysis })) }),
      });
      const data = await res.json();
      if (!res.ok || !data?.success || !Array.isArray(data.valid)) return null;
      chunk.forEach((item, j) => {
        checked.push(item.key);
        if (data.valid[j] === true) valid.push(item.key);
      });
    }
    return { checked, valid };
  } catch (err) {
    console.warn("Could not check result signatures:", err);
    return null;
  }
}

/**
 * The responses as Analytics and the Sentiment Analysis screen may use them: any comment result
 * whose signature was not confirmed by the server is removed (flagged signatureFailed), and each
 * response's summary is recalculated from its confirmed results only. A stored summary is never
 * trusted, because the browser saved it.
 */
export function trustedResponses(responses: SurveyResponse[], validKeys: Set<string>): SurveyResponse[] {
  return responses.map((r) => {
    let changed = false;
    const answers = r.answers.map((a, i) => {
      if (!a.analysis || validKeys.has(resultKey(r.id, i, a.analysis))) return a;
      changed = true;
      const { analysis: _untrusted, ...rest } = a;
      return { ...rest, signatureFailed: true };
    });
    const confirmed = answers.map((a) => a.analysis).filter((a): a is CommentAnalysis => Boolean(a));
    return { ...r, answers: changed ? answers : r.answers, sentimentAnalysis: summarizeComments(confirmed) };
  });
}

/**
 * Responses whose comments should be re-run: saved before this version (no commentStatus, so the
 * old result cannot be trusted), never analyzed, handled by the fallback, or failed the signature
 * check (use on the output of trustedResponses).
 */
export function needsReanalysis(r: SurveyResponse): boolean {
  if (!r.commentStatus || r.commentStatus === "not_analyzed" || r.commentStatus === "pending") return true;
  if (r.answers.some((a) => a.signatureFailed)) return true;
  return r.answers.some((a) => a.analysis?.method === "fallback");
}

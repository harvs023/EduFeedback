import { Answer, CommentAnalysis, Polarity, Survey, SurveyResponse } from "../types";
import { authFetch } from "./firebase";

/** What the answer screen saves for an empty Paragraph answer. */
const EMPTY_PARAGRAPH = "No response";
const MAX_PER_REQUEST = 30;
/** A respondent waits at most this long after Submit; slower analysis is saved as "not_analyzed". */
export const SUBMIT_ANALYSIS_TIMEOUT_MS = 25000;

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

/** The Paragraph answers that have text, with the question context sent along. */
function commentSlots(survey: Survey, answers: Answer[]) {
  return answers
    .map((answer, index) => {
      const question = survey.questions[index];
      const text = (answer.answer || "").trim();
      if (!question || question.type !== "paragraph" || !text || text === EMPTY_PARAGRAPH) return null;
      const block = survey.topicBlocks?.find((b) => b.id === question.blockId);
      const context = [survey.title, block ? `Section: ${block.title}` : "", `Question: ${question.text}`]
        .filter(Boolean)
        .join(" | ");
      return { index, text, context };
    })
    .filter((slot): slot is { index: number; text: string; context: string } => slot !== null);
}

const mostCommon = <T,>(values: T[]): T | undefined => {
  const counts = new Map<T, number>();
  values.forEach((v) => counts.set(v, (counts.get(v) || 0) + 1));
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
};

/**
 * Response-level summary of the analyzable comments: the mean score, turned back into a polarity
 * with the same bands the prompt uses (Positive >= 0.25, Negative <= -0.25). Each comment keeps
 * its own result, which is what the thesis evaluates.
 */
export function summarizeComments(analyses: CommentAnalysis[]): SurveyResponse["sentimentAnalysis"] | undefined {
  const usable = analyses.filter((a) => a.analyzable && a.polarity && a.score !== null);
  if (usable.length === 0) return undefined;
  const mean = usable.reduce((sum, a) => sum + (a.score as number), 0) / usable.length;
  const polarity: Polarity = mean >= 0.25 ? "Positive" : mean <= -0.25 ? "Negative" : "Neutral";
  const suggestionShare = usable.filter((a) => a.isSuggestion).length / usable.length;
  const confidences = usable.map((a) => a.confidence).filter((c): c is number => c !== null);
  const strongest = [...usable].sort((a, b) => Math.abs(b.score as number) - Math.abs(a.score as number))[0];
  return {
    sentiment: suggestionShare > 0.5 ? "Constructive Suggestion" : polarity,
    polarity,
    score: Number(mean.toFixed(2)),
    language: mostCommon(usable.map((a) => a.language)) || "Other",
    aspects: [],
    sarcasmDetected: usable.some((a) => a.sarcasmDetected),
    confidence: confidences.length ? Number((confidences.reduce((s, c) => s + c, 0) / confidences.length).toFixed(2)) : null,
    emotion: strongest.emotion,
    method: usable.some((a) => a.method === "fallback") ? "fallback" : "gemini",
    model: usable.find((a) => a.method === "gemini")?.model ?? null,
    promptVersion: usable[0].promptVersion,
    commentCount: usable.length,
  };
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

  const updated = answers.map((a) => ({ ...a }));
  slots.forEach((slot, i) => {
    updated[slot.index] = { ...updated[slot.index], analysis: results[i] };
  });
  const summary = summarizeComments(results);
  return summary
    ? { answers: updated, commentStatus: "analyzed", sentimentAnalysis: summary }
    : { answers: updated, commentStatus: "not_analyzable" };
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
  if (!r.commentStatus || r.commentStatus === "not_analyzed") return true;
  if (r.answers.some((a) => a.signatureFailed)) return true;
  return r.answers.some((a) => a.analysis?.method === "fallback");
}

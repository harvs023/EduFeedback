import { Answer, CommentAnalysis, Polarity, Survey, SurveyResponse } from "../types";

/**
 * Comment handling shared by the browser and the server (no Firebase or network code here), so
 * both pick the same comments, send the same context and summarize results the same way.
 */

/** What the answer screen saves for an empty Paragraph answer. */
export const EMPTY_PARAGRAPH = "No response";

/** The Paragraph answers that have text, with the question context sent along. */
export function commentSlots(survey: Pick<Survey, "title" | "questions" | "topicBlocks">, answers: Answer[]) {
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

/** Puts the results (same order as commentSlots) into the answers and sets the response status. */
export function applyResults(
  answers: Answer[],
  slots: { index: number }[],
  results: CommentAnalysis[]
): Pick<SurveyResponse, "answers" | "commentStatus" | "sentimentAnalysis"> {
  const updated = answers.map((a) => ({ ...a }));
  slots.forEach((slot, i) => {
    updated[slot.index] = { ...updated[slot.index], analysis: results[i] };
  });
  const summary = summarizeComments(results);
  return summary
    ? { answers: updated, commentStatus: "analyzed", sentimentAnalysis: summary }
    : { answers: updated, commentStatus: "not_analyzable" };
}

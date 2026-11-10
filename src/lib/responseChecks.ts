import { Survey, SurveyResponse } from "../types";

/**
 * Automatic warnings on responses (plan step 8). A warning never removes a response: it is still
 * counted, the survey owner sees why it looks odd and may flag it, and only the admin can
 * exclude it. Thresholds live here.
 */

/** "Same rating on everything" needs at least this many rated questions. */
export const SAME_RATING_MIN_QUESTIONS = 5;
/** Very high average ratings together with a strongly negative comment (or the reverse). */
const MISMATCH_HIGH_AVERAGE = 4.5;
const MISMATCH_LOW_AVERAGE = 1.5;
const MISMATCH_MIN_RATINGS = 2;
/** Gemini's score goes from -1 (very negative) to 1 (very positive). */
const STRONG_SCORE = 0.5;

export const REASONS = {
  nonsense: "Nonsense or joke comment",
  sameRating: "Same rating on every question",
  mismatch: "Ratings and comment strongly disagree",
} as const;

/** Extra reasons the owner can pick when flagging by hand. */
export const MANUAL_REASONS = ["Looks like a test or duplicate answer", "Offensive or inappropriate content", "Other"] as const;

/** Honest "no comment" answers: not nonsense, even though Gemini cannot analyze them. */
const HONEST_EMPTY = new Set([
  "", "-", "--", ".", "..", "...", "n/a", "na", "none", "none po", "nothing", "no comment", "no comments",
  "wala", "wala po", "wala naman", "wala naman po", "walang comment", "walang komento", "no", "nope",
]);

const isHonestEmpty = (text: string) =>
  HONEST_EMPTY.has(text.trim().toLowerCase().replace(/[.!]+$/, "").replace(/\s+/g, " "));

/** The warnings for one response, in plain words (empty = nothing odd). */
export function checkResponse(survey: Survey, response: SurveyResponse): string[] {
  const reasons: string[] = [];
  const ratings: number[] = [];
  const comments: { score: number | null; polarity: string | null }[] = [];

  survey.questions.forEach((q, i) => {
    const a = response.answers[i];
    if (!a) return;
    if (q.type === "rating" && typeof a.ratingValue === "number") ratings.push(a.ratingValue);
    if (q.type === "paragraph" && a.analysis) {
      if (!a.analysis.analyzable && !isHonestEmpty(a.answer || "")) {
        if (!reasons.includes(REASONS.nonsense)) reasons.push(REASONS.nonsense);
      } else if (a.analysis.analyzable) {
        comments.push({ score: a.analysis.score, polarity: a.analysis.polarity });
      }
    }
  });

  if (ratings.length >= SAME_RATING_MIN_QUESTIONS && ratings.every((v) => v === ratings[0])) {
    reasons.push(REASONS.sameRating);
  }

  if (ratings.length >= MISMATCH_MIN_RATINGS) {
    const average = ratings.reduce((s, v) => s + v, 0) / ratings.length;
    const strongNegative = comments.some((c) => c.polarity === "Negative" && c.score !== null && c.score <= -STRONG_SCORE);
    const strongPositive = comments.some((c) => c.polarity === "Positive" && c.score !== null && c.score >= STRONG_SCORE);
    if ((average >= MISMATCH_HIGH_AVERAGE && strongNegative) || (average <= MISMATCH_LOW_AVERAGE && strongPositive)) {
      reasons.push(REASONS.mismatch);
    }
  }
  return reasons;
}

/** Responses the owner should look at: those with warnings, plus any already flagged or decided. */
export function responsesToCheck(survey: Survey, responses: SurveyResponse[]) {
  return responses
    .map((r) => ({ response: r, warnings: checkResponse(survey, r) }))
    .filter((x) => x.warnings.length > 0 || x.response.review);
}

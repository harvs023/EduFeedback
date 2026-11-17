import type { Survey } from "../types";
import { getSurveyAvailability } from "./surveyReview";

/** A survey needs at least this many responses to be "trending". */
export const TRENDING_MIN_RESPONSES = 10;
/** How many trending surveys are shown. */
export const TRENDING_COUNT = 3;

export interface TrendingSurvey {
  survey: Survey;
  /** Responses per day since the survey opened (rounded to 1 decimal). */
  perDay: number;
}

/** When the survey started taking answers: its opening date, otherwise when it was created. null = unknown. */
function startedAt(s: Survey): number | null {
  const open = s.openDate ? Date.parse(s.openDate) : NaN;
  if (Number.isFinite(open)) return open;
  if (typeof s.createdAtTimestamp === "number" && s.createdAtTimestamp > 0) return s.createdAtTimestamp;
  const created = s.created ? Date.parse(s.created) : NaN;
  return Number.isFinite(created) ? created : null;
}

/**
 * "Trending": the open surveys with the most responses per day since they opened, among those
 * with at least TRENDING_MIN_RESPONSES responses. Uses only each survey's response counter, which
 * everyone may see; no results are shown. Surveys with no known start date are left out.
 */
export function trendingSurveys(surveys: Survey[], now: number = Date.now()): TrendingSurvey[] {
  const DAY = 24 * 60 * 60 * 1000;
  return surveys
    .filter((s) => getSurveyAvailability(s, now) === "open" && (s.responses || 0) >= TRENDING_MIN_RESPONSES)
    .map((s) => {
      const start = startedAt(s);
      if (start === null) return null;
      const days = Math.max(1, (now - start) / DAY);
      return { survey: s, perDay: Math.round(((s.responses || 0) / days) * 10) / 10 };
    })
    .filter((x): x is TrendingSurvey => x !== null)
    .sort((a, b) => b.perDay - a.perDay)
    .slice(0, TRENDING_COUNT);
}

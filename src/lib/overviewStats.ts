import type { AcademicYearTerms, Survey, SurveyResponse, UserProfile } from "../types";
import {
  type PeriodSpec,
  type SampleLevel,
  type SentimentCounts,
  inPeriod,
  responseTime,
  responsesForSurvey,
  sampleLevel,
  surveyStats,
  type SurveyStats,
} from "./analytics";
import { countEligibleUsers, eligibilityCutoff } from "./surveyReview";

/**
 * Numbers for the Analytics summary page (all surveys the viewer may see, one period).
 *
 * Combined figures follow one rule: for each response, the respondent's own average over the
 * survey's rating questions counts once; combined means are the mean of those. Whole survey
 * averages are never averaged with each other. These are descriptive figures; the surveys have
 * different questions, respondents and dates (state this as a limitation).
 */

export interface GroupRow {
  key: string;
  label: string;
  surveys: number;
  n: number;
  level: SampleLevel;
  average: number | null;
}

export interface SurveyRow {
  survey: Survey;
  stats: SurveyStats;
}

export interface OverviewNumbers {
  rows: SurveyRow[];
  surveysWithResponses: number;
  responses: number;
  /** Overall mean of respondents' own survey averages, with how many such averages. */
  overall: { average: number | null; n: number; level: SampleLevel };
  /** Share of all rating answers that are 4 or 5. */
  favorable: { percent: number | null; answers: number };
  /** How many rating answers were 1, 2, 3, 4 and 5. */
  distribution: number[];
  sentiment: SentimentCounts;
  categories: GroupRow[];
  months: { month: string; label: string; count: number }[];
  /** Responses vs eligible people, only for "All time" (null otherwise or when unknown). */
  participation: { responses: number; eligible: number; percent: number; live: boolean } | null;
}

const mean = (v: number[]) => (v.length ? v.reduce((s, x) => s + x, 0) / v.length : null);

function respondentAverages(survey: Survey, responses: SurveyResponse[]): number[] {
  const ratingIdx = survey.questions.map((q, i) => (q.type === "rating" ? i : -1)).filter((i) => i >= 0);
  const out: number[] = [];
  for (const r of responses) {
    const values = ratingIdx.map((i) => r.answers[i]?.ratingValue).filter((v): v is number => typeof v === "number" && v >= 1 && v <= 5);
    if (values.length) out.push(values.reduce((s, x) => s + x, 0) / values.length);
  }
  return out;
}

export function overviewNumbers(
  surveys: Survey[],
  responses: SurveyResponse[],
  period: PeriodSpec,
  calendar: AcademicYearTerms[],
  users: UserProfile[]
): OverviewNumbers {
  const sentiment: SentimentCounts = { analyzed: 0, positive: 0, neutral: 0, negative: 0, fallback: 0, notAnalyzable: 0, pending: 0 };
  const distribution = [0, 0, 0, 0, 0];
  const allAverages: number[] = [];
  const cats = new Map<string, { averages: number[]; n: number; surveys: number }>();
  const monthCounts = new Map<string, number>();
  const rows: SurveyRow[] = [];
  let total = 0;
  let surveysWithResponses = 0;
  let eligibleSum = 0;
  let eligibleResponses = 0;
  let allLive = true;

  for (const survey of surveys) {
    const own = responsesForSurvey(responses, survey).filter((r) => inPeriod(r, period, calendar));
    const live = users.length > 0 ? countEligibleUsers(survey, users, eligibilityCutoff(survey)) : undefined;
    const stats = surveyStats(survey, own, live);
    rows.push({ survey, stats });
    if (own.length === 0) continue;

    surveysWithResponses++;
    total += own.length;
    (Object.keys(sentiment) as (keyof SentimentCounts)[]).forEach((k) => (sentiment[k] += stats.sentiment[k]));
    for (const q of stats.questions) {
      if (q.type !== "rating") continue;
      q.counts.forEach((c) => {
        if (c.value >= 1 && c.value <= 5) distribution[c.value - 1] += c.count;
      });
    }
    const averages = respondentAverages(survey, own);
    allAverages.push(...averages);

    const cat = survey.cat || "Uncategorized";
    const entry = cats.get(cat) || { averages: [], n: 0, surveys: 0 };
    entry.averages.push(...averages);
    entry.n += own.length;
    entry.surveys++;
    cats.set(cat, entry);

    for (const r of own) {
      const t = responseTime(r);
      if (t === null) continue;
      const d = new Date(t);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      monthCounts.set(key, (monthCounts.get(key) || 0) + 1);
    }

    if (stats.participation) {
      eligibleSum += stats.participation.eligible;
      eligibleResponses += own.length;
      if (!stats.participation.live) allLive = false;
    }
  }

  const ratingAnswers = distribution.reduce((s, x) => s + x, 0);
  const months = [...monthCounts.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-18)
    .map(([month, count]) => {
      const [y, m] = month.split("-").map(Number);
      return { month, count, label: new Date(y, m - 1, 1).toLocaleDateString("en-US", { month: "short", year: "2-digit" }) };
    });

  return {
    rows,
    surveysWithResponses,
    responses: total,
    overall: { average: mean(allAverages), n: allAverages.length, level: sampleLevel(allAverages.length) },
    favorable: { percent: ratingAnswers ? ((distribution[3] + distribution[4]) / ratingAnswers) * 100 : null, answers: ratingAnswers },
    distribution,
    sentiment,
    categories: [...cats.entries()]
      .map(([label, c]) => ({ key: label, label, surveys: c.surveys, n: c.n, level: sampleLevel(c.n), average: mean(c.averages) }))
      .sort((a, b) => (b.average ?? 0) - (a.average ?? 0)),
    months,
    participation:
      period.kind === "all" && eligibleSum > 0 && eligibleResponses <= eligibleSum
        ? { responses: eligibleResponses, eligible: eligibleSum, percent: (eligibleResponses / eligibleSum) * 100, live: allLive }
        : null,
  };
}

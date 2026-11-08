import { AcademicYearTerms, CommentAnalysis, Polarity, Question, Survey, SurveyResponse } from "../types";
import { formatSchoolYear, termFor } from "./schoolYear";

/**
 * Analytics calculations (plan step 7). No screen code here, so every number can be checked
 * on its own. Responses passed in must already be the trusted ones (see trustedResponses).
 */

// ---------------------------------------------------------------- sample-size rule

/** Below this many responses, no numbers are shown at all. */
export const MIN_RESPONSES = 5;
/** From MIN_RESPONSES up to this, numbers show with a "small sample" caution. */
export const NORMAL_RESPONSES = 30;

export type SampleLevel = "insufficient" | "small" | "normal";

export function sampleLevel(n: number): SampleLevel {
  if (n < MIN_RESPONSES) return "insufficient";
  if (n < NORMAL_RESPONSES) return "small";
  return "normal";
}

// ---------------------------------------------------------------- rating interpretation

/**
 * The equal-interval verbal interpretation commonly used for 1-5 scales in Philippine research
 * (interval width 0.8). Every rating question in this app uses 1-5.
 */
export const RATING_BANDS: { min: number; label: string }[] = [
  { min: 4.21, label: "Outstanding" },
  { min: 3.41, label: "Very Good" },
  { min: 2.61, label: "Satisfactory" },
  { min: 1.81, label: "Fair" },
  { min: 1.0, label: "Poor" },
];

export function interpretRating(average: number): string {
  const rounded = Math.round(average * 100) / 100;
  return RATING_BANDS.find((b) => rounded >= b.min)?.label || "Poor";
}

// ---------------------------------------------------------------- periods

export type PeriodKind = "all" | "year" | "semester" | "month" | "custom";

export type PeriodSpec =
  | { kind: "all" }
  | { kind: "year"; schoolYear: string }
  | { kind: "semester"; schoolYear: string; term: "1st Sem" | "2nd Sem" }
  | { kind: "month"; month: string } // "2026-09"
  | { kind: "custom"; from: number; to: number };

/** When a response was submitted. Older responses may only have the date text. */
export function responseTime(r: SurveyResponse): number | null {
  if (typeof r.timestamp === "number" && r.timestamp > 0) return r.timestamp;
  const parsed = Date.parse(r.date || "");
  return Number.isNaN(parsed) ? null : parsed;
}

function monthKey(timestamp: number): string {
  const d = new Date(timestamp);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function periodKey(p: PeriodSpec): string {
  switch (p.kind) {
    case "all":
      return "all";
    case "year":
      return `year:${p.schoolYear}`;
    case "semester":
      return `sem:${p.schoolYear}:${p.term}`;
    case "month":
      return `month:${p.month}`;
    case "custom":
      return `custom:${p.from}:${p.to}`;
  }
}

export function periodLabel(p: PeriodSpec): string {
  switch (p.kind) {
    case "all":
      return "All time";
    case "year":
      return formatSchoolYear(p.schoolYear);
    case "semester":
      return `${p.term}, ${formatSchoolYear(p.schoolYear)}`;
    case "month": {
      const [y, m] = p.month.split("-").map(Number);
      return new Date(y, m - 1, 1).toLocaleDateString("en-US", { month: "long", year: "numeric" });
    }
    case "custom": {
      const f = (t: number) => new Date(t).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
      return `${f(p.from)} – ${f(p.to)}`;
    }
  }
}

export function inPeriod(r: SurveyResponse, p: PeriodSpec, calendar: AcademicYearTerms[]): boolean {
  if (p.kind === "all") return true;
  const t = responseTime(r);
  if (t === null) return false;
  switch (p.kind) {
    case "year":
      return termFor(t, calendar).schoolYear === p.schoolYear;
    case "semester": {
      const info = termFor(t, calendar);
      return info.source === "calendar" && info.schoolYear === p.schoolYear && info.term === p.term;
    }
    case "month":
      return monthKey(t) === p.month;
    case "custom":
      return t >= p.from && t <= p.to;
  }
}

/**
 * The choices for one kind of period, newest first. School years come from the calendar and from
 * the responses; semesters only from the calendar (no calendar = no semesters); months from the
 * responses. Custom periods are typed in, so they have no list.
 */
export function periodOptions(
  kind: PeriodKind,
  responses: SurveyResponse[],
  calendar: AcademicYearTerms[]
): PeriodSpec[] {
  const times = responses.map(responseTime).filter((t): t is number => t !== null);
  if (kind === "all") return [{ kind: "all" }];
  if (kind === "year") {
    const years = new Set<string>(calendar.map((y) => y.schoolYear));
    times.forEach((t) => years.add(termFor(t, calendar).schoolYear));
    return [...years].sort().reverse().map((schoolYear) => ({ kind: "year", schoolYear }));
  }
  if (kind === "semester") {
    return [...calendar]
      .sort((a, b) => b.sem1Start - a.sem1Start)
      .flatMap((y) => [
        { kind: "semester" as const, schoolYear: y.schoolYear, term: "2nd Sem" as const },
        { kind: "semester" as const, schoolYear: y.schoolYear, term: "1st Sem" as const },
      ]);
  }
  if (kind === "month") {
    const months = new Set<string>(times.map(monthKey));
    if (months.size === 0) months.add(monthKey(Date.now()));
    return [...months].sort().reverse().map((month) => ({ kind: "month", month }));
  }
  return [];
}

/** The period just before this one in the same list (lists are newest first), if any. */
export function previousPeriod(p: PeriodSpec, options: PeriodSpec[]): PeriodSpec | null {
  const i = options.findIndex((o) => periodKey(o) === periodKey(p));
  return i >= 0 && i + 1 < options.length ? options[i + 1] : null;
}

// ---------------------------------------------------------------- per-survey statistics

const EMPTY_ANSWERS = new Set(["", "No response", "No rating", "None selected"]);

export interface SentimentCounts {
  /** Comments with a confirmed, analyzable result. Percentages are of this number. */
  analyzed: number;
  positive: number;
  neutral: number;
  negative: number;
  /** How many of `analyzed` were labeled by the fallback word list. */
  fallback: number;
  /** Jokes / nonsense / empty: confirmed as not analyzable. */
  notAnalyzable: number;
  /** Comments with no confirmed result yet (service was down, or needs a re-run). */
  pending: number;
}

export type QuestionResult =
  | { type: "rating"; question: Question; index: number; answered: number; average: number | null; counts: { value: number; count: number }[] }
  | { type: "choice"; question: Question; index: number; answered: number; multi: boolean; counts: { option: string; count: number }[] }
  | {
      type: "paragraph";
      question: Question;
      index: number;
      comments: { text: string; analysis: CommentAnalysis | null; time: number | null }[];
      sentiment: SentimentCounts;
    };

export interface SurveyStats {
  responses: number;
  level: SampleLevel;
  /** Mean of each respondent's own average rating, so every person counts once. */
  averageRating: number | null;
  ratingRespondents: number;
  /**
   * null when no eligible count is known. `live` = counted from today's user list (admin);
   * otherwise it is the count saved when the survey was approved. `percent` is null when there are
   * more responses than that count (people became eligible after approval).
   */
  participation: { eligible: number; percent: number | null; live: boolean } | null;
  sentiment: SentimentCounts;
  questions: QuestionResult[];
}

const emptyCounts = (): SentimentCounts => ({
  analyzed: 0,
  positive: 0,
  neutral: 0,
  negative: 0,
  fallback: 0,
  notAnalyzable: 0,
  pending: 0,
});

function addComment(counts: SentimentCounts, analysis: CommentAnalysis | null | undefined) {
  if (!analysis) {
    counts.pending++;
    return;
  }
  if (!analysis.analyzable || !analysis.polarity) {
    counts.notAnalyzable++;
    return;
  }
  counts.analyzed++;
  if (analysis.method === "fallback") counts.fallback++;
  const key = analysis.polarity.toLowerCase() as Lowercase<Polarity>;
  counts[key]++;
}

/** Which of the question's options a saved checkbox answer contains ("A, B" joined text). */
function selectedOptions(answer: string, options: string[]): string[] {
  return options.filter(
    (o) => answer === o || answer.startsWith(`${o}, `) || answer.endsWith(`, ${o}`) || answer.includes(`, ${o}, `)
  );
}

/** liveEligible: the eligible count from today's user list, when the viewer may read it (admin). */
export function surveyStats(survey: Survey, responses: SurveyResponse[], liveEligible?: number): SurveyStats {
  const sentiment = emptyCounts();
  const respondentAverages: number[] = [];

  const questions: QuestionResult[] = survey.questions.map((question, index) => {
    if (question.type === "rating") {
      const min = question.min ?? 1;
      const max = question.max ?? 5;
      const counts = Array.from({ length: max - min + 1 }, (_, i) => ({ value: min + i, count: 0 }));
      let sum = 0;
      let answered = 0;
      for (const r of responses) {
        const v = r.answers[index]?.ratingValue;
        if (typeof v !== "number" || v < min || v > max) continue;
        counts[v - min].count++;
        sum += v;
        answered++;
      }
      return { type: "rating", question, index, answered, average: answered ? sum / answered : null, counts };
    }
    if (question.type === "multiple" || question.type === "checkbox") {
      const options = question.options || [];
      const counts = options.map((option) => ({ option, count: 0 }));
      let answered = 0;
      for (const r of responses) {
        const text = (r.answers[index]?.answer || "").trim();
        if (EMPTY_ANSWERS.has(text)) continue;
        const picked = question.type === "checkbox" ? selectedOptions(text, options) : options.filter((o) => o === text);
        if (picked.length === 0) continue;
        answered++;
        picked.forEach((o) => counts[options.indexOf(o)].count++);
      }
      return { type: "choice", question, index, answered, multi: question.type === "checkbox", counts };
    }
    const own = emptyCounts();
    const comments: { text: string; analysis: CommentAnalysis | null; time: number | null }[] = [];
    for (const r of responses) {
      const a = r.answers[index];
      const text = (a?.answer || "").trim();
      if (!a || EMPTY_ANSWERS.has(text)) continue;
      comments.push({ text, analysis: a.analysis || null, time: responseTime(r) });
      addComment(own, a.analysis);
      addComment(sentiment, a.analysis);
    }
    comments.sort((x, y) => (y.time ?? 0) - (x.time ?? 0));
    return { type: "paragraph", question, index, comments, sentiment: own };
  });

  for (const r of responses) {
    const values = survey.questions
      .map((q, i) => (q.type === "rating" ? r.answers[i]?.ratingValue : undefined))
      .filter((v): v is number => typeof v === "number");
    if (values.length) respondentAverages.push(values.reduce((s, v) => s + v, 0) / values.length);
  }

  const live = typeof liveEligible === "number";
  const eligible = live ? liveEligible : survey.eligibleCount || 0;
  return {
    responses: responses.length,
    level: sampleLevel(responses.length),
    averageRating: respondentAverages.length
      ? respondentAverages.reduce((s, v) => s + v, 0) / respondentAverages.length
      : null,
    ratingRespondents: respondentAverages.length,
    participation:
      eligible > 0
        ? { eligible, live, percent: responses.length <= eligible ? (responses.length / eligible) * 100 : null }
        : null,
    sentiment,
    questions,
  };
}

export function percent(part: number, whole: number): number {
  return whole > 0 ? (part / whole) * 100 : 0;
}

/** Responses that belong to a survey (ids are compared as text; older data mixed numbers and text). */
export function responsesForSurvey(responses: SurveyResponse[], survey: Survey): SurveyResponse[] {
  const id = String(survey.id);
  return responses.filter((r) => String(r.surveyId) === id || r.surveyIdStr === id);
}

/** Surveys that can have results: everything that went live, not drafts or ones under review. */
export function analyzableSurveys(surveys: Survey[], viewerEmail: string, isAdmin: boolean): Survey[] {
  const me = viewerEmail.trim().toLowerCase();
  return surveys
    .filter((s) => ["published", "scheduled", "archived"].includes(s.status))
    .filter((s) => isAdmin || (s.owner || "").trim().toLowerCase() === me)
    .sort((a, b) => (b.createdAtTimestamp || 0) - (a.createdAtTimestamp || 0));
}

// ---------------------------------------------------------------- CSV export

function csvCell(value: unknown): string {
  const text = value === null || value === undefined ? "" : String(value);
  return `"${text.replace(/"/g, '""')}"`;
}

/**
 * One row per response. Anonymous responses never carry a name. Comment labels come only from
 * confirmed results; fallback labels are marked.
 */
export function responsesCsv(survey: Survey, responses: SurveyResponse[], calendar: AcademicYearTerms[]): string {
  const header = ["Submitted", "School year", "Semester", "Respondent"];
  survey.questions.forEach((q, i) => {
    header.push(`Q${i + 1}: ${q.text}`);
    if (q.type === "paragraph") header.push(`Q${i + 1} sentiment`);
  });
  const rows = responses.map((r) => {
    const t = responseTime(r);
    const info = t !== null ? termFor(t, calendar) : null;
    const row: unknown[] = [
      t !== null ? new Date(t).toLocaleString("en-US") : r.date,
      info?.schoolYear || "",
      info?.term || "Not in calendar",
      r.isAnonymous ? "Anonymous" : r.userName || "",
    ];
    survey.questions.forEach((q, i) => {
      const a = r.answers[i];
      row.push(q.type === "rating" ? a?.ratingValue ?? "" : a?.answer ?? "");
      if (q.type === "paragraph") {
        const an = a?.analysis;
        row.push(
          !an ? (a && !EMPTY_ANSWERS.has((a.answer || "").trim()) ? "Not analyzed" : "")
          : !an.analyzable || !an.polarity ? "Not analyzable"
          : an.method === "fallback" ? `${an.polarity} (fallback word list)`
          : an.polarity
        );
      }
    });
    return row;
  });
  return [header, ...rows].map((row) => row.map(csvCell).join(",")).join("\r\n");
}

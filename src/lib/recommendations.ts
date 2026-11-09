import { Survey, SurveyResponse } from "../types";
import {
  MIN_RESPONSES,
  SentimentCounts,
  interpretRating,
  onlyQuestions,
  percent,
  sampleLevel,
  surveyStats,
} from "./analytics";

/**
 * Layer 1 recommendations (plan step 7b): fixed rules and fill-in-the-blank sentences, no AI.
 * Every label comes with the numbers it is based on. All thresholds live here.
 */

/** Average at or below this (Fair or Poor on the 1-5 interpretation scale) = needs attention. */
export const NEEDS_ATTENTION_AVERAGE = 2.6;
/** This share of negative comments or more = needs attention (set by the researcher). */
export const NEEDS_ATTENTION_NEGATIVE_PCT = 40;
/** Average at or above this (Outstanding) = strength, together with STRENGTH_POSITIVE_PCT. */
export const STRENGTH_AVERAGE = 4.21;
/** This share of positive comments or more, with a high average = strength (set by the researcher). */
export const STRENGTH_POSITIVE_PCT = 60;
/** A drop of this much or more vs the previous period = getting worse (set by the researcher). */
export const GETTING_WORSE_DROP = 0.5;
/** A rise of this much or more vs the previous period = improving (same size as the drop). */
export const IMPROVING_RISE = 0.5;
/**
 * From this average up (Very Good or better), many negative comments are "mixed signals" (ratings
 * and comments disagree) instead of "needs attention".
 */
export const MIXED_MIN_AVERAGE = 3.41;
/** The comment-percentage rules apply only from this many analyzed comments in a topic. */
export const MIN_COMMENTS_FOR_PERCENT = 5;
/** A word must appear in at least this many negative comments to be listed. */
const MIN_WORD_COMMENTS = 2;
const MAX_WORDS = 5;

export type TopicLabel = "needs_attention" | "getting_worse" | "mixed_signals" | "improving" | "strength";

export interface TopicInsight {
  blockId: string | null;
  title: string;
  /** People who gave at least one rating in this topic. */
  ratingN: number;
  average: number | null;
  sentiment: SentimentCounts;
  /** Whether the comment percentages are used (enough analyzed comments). */
  commentsCount: boolean;
  previous: { label: string; average: number | null; ratingN: number } | null;
  /** Words that come up in several negative comments (from Gemini's keywords for each comment). */
  negativeWords: { word: string; comments: number }[];
  labels: TopicLabel[];
  /** False when this topic has fewer than MIN_RESPONSES ratings and no usable comments. */
  enough: boolean;
}

export interface Recommendation {
  label: TopicLabel;
  /** The topic block it is about (null = the whole survey, when it has no blocks). */
  blockId: string | null;
  topic: string;
  sentence: string;
  evidence: string;
  nextStep: string;
}

const fmt = (v: number) => v.toFixed(2);
const pctText = (v: number) => `${Math.round(v)}%`;

/** The questions of a survey grouped by topic block. Surveys without blocks are one group. */
function groups(survey: Survey): { blockId: string | null; title: string; indexes: number[] }[] {
  const blocks = survey.topicBlocks || [];
  if (blocks.length === 0) {
    return [{ blockId: null, title: "All questions", indexes: survey.questions.map((_, i) => i) }];
  }
  return blocks
    .map((b) => ({
      blockId: b.id,
      title: b.title,
      indexes: survey.questions.map((q, i) => (q.blockId === b.id ? i : -1)).filter((i) => i >= 0),
    }))
    .filter((g) => g.indexes.length > 0);
}

function negativeWords(survey: Survey, responses: SurveyResponse[], indexes: number[]) {
  const counts = new Map<string, number>();
  for (const r of responses) {
    for (const i of indexes) {
      if (survey.questions[i]?.type !== "paragraph") continue;
      const a = r.answers[i]?.analysis;
      if (!a || a.polarity !== "Negative") continue;
      const words = new Set((a.keywords || []).map((k) => k.trim().toLowerCase()).filter((k) => k.length >= 3));
      words.forEach((w) => counts.set(w, (counts.get(w) || 0) + 1));
    }
  }
  return [...counts.entries()]
    .filter(([, n]) => n >= MIN_WORD_COMMENTS)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, MAX_WORDS)
    .map(([word, comments]) => ({ word, comments }));
}

/**
 * Topic results for one period. `previous` is the period just before (same kind), used only for
 * "getting worse"; pass null for All time or custom dates.
 */
export function topicInsights(
  survey: Survey,
  responses: SurveyResponse[],
  previous: { label: string; responses: SurveyResponse[] } | null
): TopicInsight[] {
  return groups(survey).map((g) => {
    const stats = onlyQuestions(survey, responses, g.indexes);
    const prevStats = previous ? onlyQuestions(survey, previous.responses, g.indexes) : null;
    const average = stats.ratingRespondents >= MIN_RESPONSES ? stats.averageRating : null;
    const s = stats.sentiment;
    const commentsCount = s.analyzed >= MIN_COMMENTS_FOR_PERCENT;
    const negPct = percent(s.negative, s.analyzed);
    const posPct = percent(s.positive, s.analyzed);
    const prevAverage =
      prevStats && prevStats.ratingRespondents >= MIN_RESPONSES ? prevStats.averageRating : null;

    const manyNegative = commentsCount && negPct >= NEEDS_ATTENTION_NEGATIVE_PCT;
    const goodRating = average !== null && average >= MIXED_MIN_AVERAGE;
    const labels: TopicLabel[] = [];
    if ((average !== null && average <= NEEDS_ATTENTION_AVERAGE) || (manyNegative && !goodRating)) {
      labels.push("needs_attention");
    }
    if (manyNegative && goodRating) labels.push("mixed_signals");
    if (average !== null && prevAverage !== null && prevAverage - average >= GETTING_WORSE_DROP - 1e-9) {
      labels.push("getting_worse");
    }
    if (average !== null && prevAverage !== null && average - prevAverage >= IMPROVING_RISE - 1e-9) {
      labels.push("improving");
    }
    // Strength: an Outstanding average, and (when there are enough comments) mostly positive comments.
    if (
      !labels.includes("needs_attention") &&
      !labels.includes("mixed_signals") &&
      average !== null &&
      average >= STRENGTH_AVERAGE &&
      (!commentsCount || posPct >= STRENGTH_POSITIVE_PCT)
    ) {
      labels.push("strength");
    }

    return {
      blockId: g.blockId,
      title: g.title,
      ratingN: stats.ratingRespondents,
      average,
      sentiment: s,
      commentsCount,
      previous: previous && prevStats ? { label: previous.label, average: prevAverage, ratingN: prevStats.ratingRespondents } : null,
      negativeWords: negativeWords(survey, responses, g.indexes),
      labels,
      enough: average !== null || commentsCount,
    };
  });
}

function fallbackNote(s: SentimentCounts): string {
  return s.fallback > 0
    ? ` (${s.analyzed} comments, ${s.fallback} labeled by the fallback word list)`
    : ` (${s.analyzed} comment${s.analyzed === 1 ? "" : "s"})`;
}

/** Fill-in-the-blank sentences for every label, most urgent first. */
export function recommendationsFor(insights: TopicInsight[]): Recommendation[] {
  const out: Recommendation[] = [];
  const order: TopicLabel[] = ["needs_attention", "getting_worse", "mixed_signals", "improving", "strength"];
  for (const label of order) {
    for (const t of insights) {
      if (!t.labels.includes(label)) continue;
      const s = t.sentiment;
      const ratingPart =
        t.average !== null ? `average rating ${fmt(t.average)} (${interpretRating(t.average)}) from ${t.ratingN} responses` : "";
      const words = t.negativeWords.map((w) => w.word);
      const wordsPart = words.length ? ` Common words in negative comments: ${words.join(", ")}.` : "";

      if (label === "needs_attention") {
        const parts: string[] = [];
        if (t.average !== null) parts.push(ratingPart);
        if (t.commentsCount) parts.push(`${pctText(percent(s.negative, s.analyzed))} of its comments are negative${fallbackNote(s)}`);
        out.push({
          label,
          blockId: t.blockId,
          topic: t.title,
          sentence: `${t.title} needs attention: ${parts.join(", and ")}.`,
          evidence: (
            (t.commentsCount
              ? ""
              : s.analyzed > 0
              ? `Only ${s.analyzed} analyzed comment(s), too few to judge by comments.`
              : "No comments in this topic; judged by ratings only.") + wordsPart
          ).trim(),
          nextStep: words.length
            ? `Read the negative comments about ${t.title} first; they most often mention ${words.slice(0, 3).join(", ")}.`
            : `Read the negative comments and low ratings about ${t.title} to find the cause.`,
        });
      } else if (label === "getting_worse" && t.previous && t.previous.average !== null && t.average !== null) {
        out.push({
          label,
          blockId: t.blockId,
          topic: t.title,
          sentence: `${t.title} is getting worse: the average dropped from ${fmt(t.previous.average)} in ${t.previous.label} to ${fmt(t.average)} (${t.ratingN} responses now, ${t.previous.ratingN} before).`,
          evidence: `The two periods have different respondents, since each person answers once.${wordsPart}`,
          nextStep: `Find out what changed for ${t.title} since ${t.previous.label}.`,
        });
      } else if (label === "mixed_signals" && t.average !== null) {
        out.push({
          label,
          blockId: t.blockId,
          topic: t.title,
          sentence: `${t.title} has mixed signals: ${ratingPart}, but ${pctText(percent(s.negative, s.analyzed))} of its comments are negative${fallbackNote(s)}.`,
          evidence: `Ratings and comments disagree.${wordsPart}`,
          nextStep: words.length
            ? `Read the negative comments about ${t.title} to see what the ratings miss; they most often mention ${words.slice(0, 3).join(", ")}.`
            : `Read the negative comments about ${t.title} to see what the ratings miss.`,
        });
      } else if (label === "improving" && t.previous && t.previous.average !== null && t.average !== null) {
        out.push({
          label,
          blockId: t.blockId,
          topic: t.title,
          sentence: `${t.title} is improving: the average rose from ${fmt(t.previous.average)} in ${t.previous.label} to ${fmt(t.average)} (${t.ratingN} responses now, ${t.previous.ratingN} before).`,
          evidence: "The two periods have different respondents, since each person answers once.",
          nextStep: `Find out what helped ${t.title} since ${t.previous.label} and keep doing it.`,
        });
      } else if (label === "strength" && t.average !== null) {
        out.push({
          label,
          blockId: t.blockId,
          topic: t.title,
          sentence: `${t.title} is a strength: ${ratingPart}${
            t.commentsCount ? `, and ${pctText(percent(s.positive, s.analyzed))} of its comments are positive${fallbackNote(s)}` : ""
          }.`,
          evidence: t.commentsCount ? "" : "Judged by ratings only (too few analyzed comments in this topic).",
          nextStep: `Keep what is working in ${t.title} and share it as a good practice.`,
        });
      }
    }
  }
  return out;
}

/** The plain-language summary at the top: what can be concluded from this period. */
export function summaryFor(
  survey: Survey,
  responses: SurveyResponse[],
  periodLabel: string,
  insights: TopicInsight[]
): string[] {
  const stats = surveyStats(survey, responses);
  if (sampleLevel(stats.responses) === "insufficient") return [];
  const lines: string[] = [];
  const parts: string[] = [];
  if (stats.averageRating !== null) {
    parts.push(`the overall rating is ${fmt(stats.averageRating)} (${interpretRating(stats.averageRating)})`);
  }
  const s = stats.sentiment;
  if (s.analyzed > 0) {
    parts.push(
      `comments are ${pctText(percent(s.positive, s.analyzed))} positive, ${pctText(percent(s.neutral, s.analyzed))} neutral and ${pctText(
        percent(s.negative, s.analyzed)
      )} negative${fallbackNote(s)}`
    );
  }
  lines.push(
    `Based on ${stats.responses} responses in ${periodLabel}${parts.length ? `, ${parts.join("; ")}` : ""}.`
  );

  const named = (label: TopicLabel) => insights.filter((t) => t.labels.includes(label)).map((t) => t.title);
  const attention = named("needs_attention");
  const worse = named("getting_worse");
  const strengths = named("strength");
  const mixed = named("mixed_signals");
  const improving = named("improving");
  // A survey without topic blocks has one group ("All questions"): talk about the survey instead.
  const hasTopics = (survey.topicBlocks || []).length > 0;

  if (attention.length) lines.push(hasTopics ? `Needs attention: ${attention.join(", ")}.` : "Overall, the results need attention.");
  if (worse.length) lines.push(hasTopics ? `Getting worse since the previous period: ${worse.join(", ")}.` : "Results are getting worse since the previous period.");
  if (mixed.length) lines.push(hasTopics ? `Mixed signals (good ratings, many negative comments): ${mixed.join(", ")}.` : "Mixed signals: good ratings, but many negative comments.");
  if (improving.length) lines.push(hasTopics ? `Improving since the previous period: ${improving.join(", ")}.` : "Results are improving since the previous period.");
  if (strengths.length) lines.push(hasTopics ? `Strengths: ${strengths.join(", ")}.` : "Overall, the results are a strength.");
  if (!attention.length && !worse.length && !strengths.length && !mixed.length && !improving.length) {
    lines.push("No topic stands out as a clear strength or problem in this period.");
  }
  return lines;
}

import type { AcademicYearTerms, CommentAnalysis, Polarity, Survey, SurveyResponse, Topic } from "../types";
import { OTHER_TOPIC_ID, sortTopics } from "./topicBlocks";
import {
  type PeriodSpec,
  type SampleLevel,
  type SentimentCounts,
  inPeriod,
  responsesForSurvey,
  sampleLevel,
} from "./analytics";
import { sampleSd } from "./resultsTable";

/**
 * Results per topic across all surveys (admin overview, plan step P part B).
 *
 * Surveys are still never averaged as whole surveys. Only rating answers under the same topic are
 * combined: for each response, the respondent's own average over that topic's rating questions in
 * that survey counts once; the topic mean is the mean of those. Comments are counted per comment.
 * Combining different surveys mixes different respondents and times, so these are descriptive
 * figures only (state this as a limitation).
 */

const EMPTY_ANSWERS = new Set(["", "No response", "No rating", "None selected"]);

/** One question under a topic, with its own figures (rating: mean of its 1-5 answers; comment: count). */
export interface TopicQuestion {
  text: string;
  type: "rating" | "paragraph";
  /** Block title in the survey (what respondents saw as the section heading). */
  blockTitle: string;
  /** Rating: answers given; comment: comments written. */
  n: number;
  average: number | null;
  /** Sample standard deviation of the 1-5 answers (rating questions with 2+ answers). */
  sd: number | null;
}

export interface TopicSurveyPart {
  surveyId: string;
  surveyTitle: string;
  /** Responses in the period that answered at least one question of this topic. */
  n: number;
  average: number | null;
  questions: TopicQuestion[];
}

export interface TopicRow {
  topicId: string;
  topicName: string;
  retired: boolean;
  /** Surveys that have this topic and at least one counted response in the period. */
  surveys: number;
  /** Responses (one per person per survey) that answered at least one question of this topic. */
  n: number;
  level: SampleLevel;
  /** Mean of each respondent's own average over this topic's rating questions. */
  average: number | null;
  ratingRespondents: number;
  sentiment: SentimentCounts;
  parts: TopicSurveyPart[];
}

const empty = (): SentimentCounts => ({ analyzed: 0, positive: 0, neutral: 0, negative: 0, fallback: 0, notAnalyzable: 0, pending: 0 });

function addComment(c: SentimentCounts, a: CommentAnalysis | null | undefined) {
  if (!a) {
    c.pending++;
    return;
  }
  if (!a.analyzable || !a.polarity) {
    c.notAnalyzable++;
    return;
  }
  c.analyzed++;
  if (a.method === "fallback") c.fallback++;
  c[a.polarity.toLowerCase() as Lowercase<Polarity>]++;
}

const mean = (values: number[]) => (values.length ? values.reduce((s, v) => s + v, 0) / values.length : null);

/**
 * One row per topic used by any of the given surveys (Other included), for responses in `period`.
 * Surveys without topic blocks (made before topic blocks existed) are not included.
 */
export function topicsAcrossSurveys(
  surveys: Survey[],
  responses: SurveyResponse[],
  topics: Topic[],
  period: PeriodSpec,
  calendar: AcademicYearTerms[]
): TopicRow[] {
  const acc = new Map<string, { averages: number[]; n: number; sentiment: SentimentCounts; parts: TopicSurveyPart[] }>();

  for (const survey of surveys) {
    const blocks = survey.topicBlocks || [];
    if (blocks.length === 0) continue;
    const surveyResponses = responsesForSurvey(responses, survey).filter((r) => inPeriod(r, period, calendar));
    if (surveyResponses.length === 0) continue;

    // Question indexes per topic (several blocks of one survey may share a topic).
    const byTopic = new Map<string, { rating: number[]; paragraph: number[]; blockOf: Map<number, string> }>();
    for (const block of blocks) {
      if (!block.topicId) continue;
      const entry = byTopic.get(block.topicId) || { rating: [], paragraph: [], blockOf: new Map<number, string>() };
      survey.questions.forEach((q, i) => {
        if (q.blockId !== block.id) return;
        if (q.type === "rating") entry.rating.push(i);
        if (q.type === "paragraph") entry.paragraph.push(i);
        if (q.type === "rating" || q.type === "paragraph") entry.blockOf.set(i, block.title);
      });
      byTopic.set(block.topicId, entry);
    }

    byTopic.forEach((idx, topicId) => {
      const row = acc.get(topicId) || { averages: [], n: 0, sentiment: empty(), parts: [] };
      const surveyAverages: number[] = [];
      let n = 0;
      for (const r of surveyResponses) {
        const values = idx.rating
          .map((i) => r.answers[i]?.ratingValue)
          .filter((v): v is number => typeof v === "number" && v >= 1 && v <= 5);
        let answered = values.length > 0;
        for (const i of idx.paragraph) {
          const a = r.answers[i];
          const text = (a?.answer || "").trim();
          if (!a || EMPTY_ANSWERS.has(text)) continue;
          answered = true;
          addComment(row.sentiment, a.analysis);
        }
        if (values.length) surveyAverages.push(values.reduce((s, v) => s + v, 0) / values.length);
        if (answered) n++;
      }
      if (n === 0) return;
      row.averages.push(...surveyAverages);
      row.n += n;
      const questions: TopicQuestion[] = [...idx.rating, ...idx.paragraph]
        .sort((a, b) => a - b)
        .map((i) => {
          const q = survey.questions[i];
          if (q.type === "rating") {
            const values = surveyResponses
              .map((r) => r.answers[i]?.ratingValue)
              .filter((v): v is number => typeof v === "number" && v >= 1 && v <= 5);
            return {
              text: q.text,
              type: "rating" as const,
              blockTitle: idx.blockOf.get(i) || "",
              n: values.length,
              average: mean(values),
              sd: sampleSd(values),
            };
          }
          const comments = surveyResponses.filter((r) => !EMPTY_ANSWERS.has((r.answers[i]?.answer || "").trim())).length;
          return { text: q.text, type: "paragraph" as const, blockTitle: idx.blockOf.get(i) || "", n: comments, average: null, sd: null };
        });
      row.parts.push({ surveyId: String(survey.id), surveyTitle: survey.title, n, average: mean(surveyAverages), questions });
      acc.set(topicId, row);
    });
  }

  const known = sortTopics(topics);
  const ids = [...known.map((t) => t.id).filter((id) => acc.has(id)), ...[...acc.keys()].filter((id) => !known.some((t) => t.id === id))];
  return ids.map((topicId) => {
    const row = acc.get(topicId)!;
    const topic = known.find((t) => t.id === topicId);
    return {
      topicId,
      topicName: topic?.name || (topicId === OTHER_TOPIC_ID ? "Other" : "(deleted topic)"),
      retired: topic?.status === "retired",
      surveys: row.parts.length,
      n: row.n,
      level: sampleLevel(row.n),
      average: mean(row.averages),
      ratingRespondents: row.averages.length,
      sentiment: row.sentiment,
      parts: row.parts.sort((a, b) => b.n - a.n),
    };
  });
}

/** CSV of every question under every topic (topic, survey, block, question, n, mean), for the paper. */
export function topicQuestionsCsv(rows: TopicRow[], periodName: string, interpret: (avg: number) => string, minN: number): string {
  const cell = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const header = ["Period", "Topic", "Survey", "Block", "Question", "Type", "n", "Mean", "SD", "Interpretation"];
  const lines: string[] = [];
  for (const r of rows) {
    for (const p of r.parts) {
      for (const q of p.questions) {
        const show = q.type === "rating" && q.average !== null && q.n >= minN;
        lines.push(
          [
            periodName,
            r.topicName,
            p.surveyTitle,
            q.blockTitle,
            q.text,
            q.type === "rating" ? "Rating" : "Comment",
            q.n,
            show ? q.average!.toFixed(2) : "",
            show && q.sd !== null ? q.sd.toFixed(2) : "",
            show ? interpret(q.average!) : "",
          ]
            .map(cell)
            .join(",")
        );
      }
    }
  }
  return [header.map(cell).join(","), ...lines].join("\n");
}

/** CSV of the topic table, for the paper. */
export function topicTableCsv(rows: TopicRow[], periodName: string, interpret: (avg: number) => string): string {
  const cell = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const pct = (part: number, whole: number) => (whole > 0 ? ((part / whole) * 100).toFixed(1) : "");
  const header = ["Period", "Topic", "Surveys", "n", "Mean rating", "Interpretation", "Positive %", "Neutral %", "Negative %", "Comments analyzed", "Note"];
  const lines = rows.map((r) => {
    const enough = r.level !== "insufficient";
    const s = r.sentiment;
    return [
      periodName,
      r.topicName,
      r.surveys,
      r.n,
      enough && r.average !== null ? r.average.toFixed(2) : "",
      enough && r.average !== null ? interpret(r.average) : "",
      enough ? pct(s.positive, s.analyzed) : "",
      enough ? pct(s.neutral, s.analyzed) : "",
      enough ? pct(s.negative, s.analyzed) : "",
      s.analyzed,
      r.level === "insufficient" ? "Not enough responses" : r.level === "small" ? "Small sample" : "",
    ]
      .map(cell)
      .join(",");
  });
  return [header.map(cell).join(","), ...lines].join("\n");
}

import { CommentAnalysis, Survey, SurveyResponse } from "../types";
import { csvRecords, toCsv } from "./csv";

/**
 * Sentiment evaluation for the thesis (plan step 6c). Part 1: choose a random, repeatable sample
 * of Gemini-labeled comments and export two files:
 * - the labeling sheet for the human labelers (no Gemini labels, so they label blind);
 * - the answer key for the researchers only (Gemini's labels, tuning/test set, model and prompt
 *   versions). The key freezes the sample: later steps read these files, not the live database.
 */

export const DEFAULT_SAMPLE_SIZE = 300;
/** Share of the sample used for tuning the prompt; the rest is the test set, used once. */
export const TUNING_SHARE = 0.2;

export const LABEL_VALUES = ["Positive", "Neutral", "Negative", "Not analyzable"] as const;
export type HumanLabel = (typeof LABEL_VALUES)[number];

export interface EvaluationItem {
  /** "<responseId>:<answer index>". Not linked to any person. */
  id: string;
  surveyTitle: string;
  section: string;
  question: string;
  text: string;
  analysis: CommentAnalysis;
}

export interface EvaluationPool {
  items: EvaluationItem[];
  /** Left out: labeled by the fallback word list (only Gemini results are evaluated). */
  fallback: number;
  /** Left out: no confirmed result yet (pending, not analyzed, or failed signature). */
  unconfirmed: number;
}

const EMPTY = new Set(["", "No response"]);

/** Every comment with a confirmed Gemini result. Use the trusted responses (signatures checked). */
export function evaluationPool(responses: SurveyResponse[], surveys: Survey[]): EvaluationPool {
  const byId = new Map(surveys.map((s) => [String(s.id), s]));
  const items: EvaluationItem[] = [];
  let fallback = 0;
  let unconfirmed = 0;
  for (const r of responses) {
    const survey = byId.get(String(r.surveyId));
    r.answers.forEach((a, i) => {
      const question = survey?.questions[i];
      const text = (a.answer || "").trim();
      if (question && question.type !== "paragraph") return;
      if (!question && !a.analysis && !a.signatureFailed) return;
      if (EMPTY.has(text)) return;
      if (!a.analysis) {
        unconfirmed++;
        return;
      }
      if (a.analysis.method !== "gemini") {
        fallback++;
        return;
      }
      const block = survey?.topicBlocks?.find((b) => b.id === question?.blockId);
      items.push({
        id: `${r.id}:${i}`,
        surveyTitle: survey?.title || r.surveyTitle || "",
        section: block?.title || "",
        question: question?.text || a.question || "",
        text,
        analysis: a.analysis,
      });
    });
  }
  items.sort((x, y) => (x.id < y.id ? -1 : x.id > y.id ? 1 : 0));
  return { items, fallback, unconfirmed };
}

/** Small seeded random number generator (mulberry32): the same seed always gives the same order. */
function seededRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface SampledItem extends EvaluationItem {
  set: "tuning" | "test";
}

/**
 * A random sample in random order (so labelers do not see comments grouped by survey). The first
 * TUNING_SHARE of the shuffled sample is the tuning set, the rest the test set.
 */
export function drawSample(pool: EvaluationItem[], size: number, seed: number): SampledItem[] {
  const random = seededRandom(seed);
  const shuffled = [...pool];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  const sample = shuffled.slice(0, Math.max(0, Math.min(size, shuffled.length)));
  const tuning = Math.round(sample.length * TUNING_SHARE);
  return sample.map((item, i) => ({ ...item, set: i < tuning ? "tuning" : "test" }));
}


/** For the labelers: context and comment, empty answer columns, no Gemini labels. */
export function labelingSheetCsv(sample: SampledItem[]): string {
  return toCsv([
    ["Item ID", "Survey", "Section", "Question", "Comment", "Polarity", "Sarcastic", "Notes"],
    ...sample.map((s) => [s.id, s.surveyTitle, s.section, s.question, s.text, "", "", ""]),
  ]);
}

export const geminiLabel = (a: CommentAnalysis): HumanLabel =>
  a.analyzable && a.polarity ? a.polarity : "Not analyzable";

/** For the researchers only: the frozen sample with Gemini's labels. Never give it to labelers. */
export function answerKeyCsv(
  sample: SampledItem[],
  seed: number,
  leftOut: { fallback: number; unconfirmed: number; source: string }
): string {
  return toCsv([
    [
      "Item ID", "Set", "Gemini polarity", "Gemini sarcastic", "Model", "Model version", "Prompt version",
      "Analyzed at", "Seed", "Source", "Left out (fallback)", "Left out (no result)", "Comment",
    ],
    ...sample.map((s) => [
      s.id,
      s.set,
      geminiLabel(s.analysis),
      s.analysis.sarcasmDetected ? "Yes" : "No",
      s.analysis.model || "",
      s.analysis.modelVersion || "",
      s.analysis.promptVersion,
      new Date(s.analysis.analyzedAt).toISOString(),
      seed,
      leftOut.source,
      leftOut.fallback,
      leftOut.unconfirmed,
      s.text,
    ]),
  ]);
}

// ---------------------------------------------------------------- uploaded comments (option B)

/** Most comments one upload may hold (each one is sent to Gemini once). */
export const MAX_UPLOAD_COMMENTS = 1000;
const MAX_UPLOAD_COMMENT_CHARS = 2000;

export interface UploadedComment {
  /** "U0001", "U0002", ... in file order. */
  id: string;
  surveyTitle: string;
  section: string;
  question: string;
  text: string;
}

/** The file researchers fill in to upload their own comments. */
export function uploadTemplateCsv(): string {
  return toCsv([
    ["Comment", "Survey", "Section", "Question"],
    ["Ang galing magturo ni sir, malinaw ang explanation.", "Faculty Evaluation", "Teaching", "Comments about the teacher"],
    ["Sobrang init sa room, sira ang aircon.", "Facilities Survey", "Classrooms", "What can be improved?"],
  ]);
}

/**
 * Reads an uploaded comments file. Needs a "Comment" column; "Survey", "Section" and "Question"
 * are optional context (the same context Gemini gets for survey comments).
 */
export function readUploadedComments(text: string): { comments: UploadedComment[]; problem: string | null; skipped: number } {
  const { headers, records } = csvRecords(text);
  if (!headers.includes("comment")) {
    return { comments: [], skipped: 0, problem: 'The file needs a column named "Comment". Download the template to see the format.' };
  }
  const usable = records.filter((r) => r["comment"]);
  const skipped = records.length - usable.length;
  if (usable.length === 0) return { comments: [], skipped, problem: "The file has no comments." };
  if (usable.length > MAX_UPLOAD_COMMENTS) {
    return { comments: [], skipped, problem: `The file has ${usable.length} comments; the most is ${MAX_UPLOAD_COMMENTS}.` };
  }
  return {
    skipped,
    problem: null,
    comments: usable.map((r, i) => ({
      id: `U${String(i + 1).padStart(4, "0")}`,
      surveyTitle: r["survey"] || "",
      section: r["section"] || "",
      question: r["question"] || "",
      text: r["comment"].slice(0, MAX_UPLOAD_COMMENT_CHARS),
    })),
  };
}

/** The same context text survey comments get (title | Section | Question). */
export function uploadContext(c: UploadedComment): string {
  return [c.surveyTitle, c.section ? `Section: ${c.section}` : "", c.question ? `Question: ${c.question}` : ""]
    .filter(Boolean)
    .join(" | ");
}

/** Uploaded comments with their Gemini results, as a pool like evaluationPool gives. */
export function uploadedPool(comments: UploadedComment[], results: (CommentAnalysis | null)[]): EvaluationPool {
  const items: EvaluationItem[] = [];
  let fallback = 0;
  let unconfirmed = 0;
  comments.forEach((c, i) => {
    const analysis = results[i];
    if (!analysis) unconfirmed++;
    else if (analysis.method !== "gemini") fallback++;
    else items.push({ id: c.id, surveyTitle: c.surveyTitle, section: c.section, question: c.question, text: c.text, analysis });
  });
  return { items, fallback, unconfirmed };
}

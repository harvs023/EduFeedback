import { EvaluationRun } from "../types";
import { csvRecords } from "./csv";
import { HumanLabel, LABEL_VALUES } from "./evaluation";
import { KeyItem, YesNo, normalizeLabel, normalizeYesNo } from "./agreement";

/**
 * Sentiment evaluation, part 3 (plan step 6c): Gemini's labels (from the answer key) against the
 * final human labels (the third person's sheet). Accuracy and macro-F1 use the three polarity
 * labels the thesis evaluates; comments the humans called "Not analyzable" are reported apart.
 */

export const POLARITIES = ["Positive", "Neutral", "Negative"] as const;
type Polarity3 = (typeof POLARITIES)[number];

export interface FinalRow {
  id: string;
  polarity: HumanLabel | null;
  sarcastic: YesNo | null;
}

export function readFinalSheet(text: string): { rows: FinalRow[]; problem: string | null } {
  const { headers, records } = csvRecords(text);
  if (!headers.includes("item id") || !headers.includes("final polarity")) {
    return { rows: [], problem: "This does not look like the final-label sheet (it needs Item ID and Final polarity columns)." };
  }
  const rows = records
    .filter((r) => r["item id"])
    .map((r) => ({
      id: r["item id"],
      polarity: normalizeLabel(r["final polarity"] || ""),
      sarcastic: normalizeYesNo(r["final sarcastic"] || ""),
    }));
  return rows.length ? { rows, problem: null } : { rows, problem: "The sheet has no rows." };
}

export type EvalSet = "test" | "tuning" | "all";

export interface ClassScore {
  label: Polarity3;
  /** How many comments the humans gave this label. */
  support: number;
  precision: number | null;
  recall: number | null;
  f1: number | null;
}

export interface EvaluationResult {
  set: EvalSet;
  /** Comments with a valid final polarity of Positive / Neutral / Negative in this set. */
  n: number;
  correct: number;
  accuracy: number | null;
  macroF1: number | null;
  perClass: ClassScore[];
  /** confusion[i][j]: humans said POLARITIES[i], Gemini said LABEL_VALUES[j] (4 columns). */
  confusion: number[][];
  /** Comments the humans called "Not analyzable", and how many Gemini also called that. */
  humanNotAnalyzable: { n: number; geminiAgreed: number };
  sarcasm: {
    n: number;
    humanYes: number;
    geminiYes: number;
    bothYes: number;
    accuracy: number | null;
    precision: number | null;
    recall: number | null;
    f1: number | null;
  };
  /** Problems with the final sheet, listed by Item ID. */
  problems: string[];
  modelVersions: string[];
  promptVersions: string[];
  seed: string;
  source: string;
  leftOutFallback: string;
  leftOutNoResult: string;
}

const ratio = (a: number, b: number) => (b > 0 ? a / b : null);
const f1Of = (p: number | null, r: number | null) => (p === null || r === null ? null : p + r === 0 ? 0 : (2 * p * r) / (p + r));
const unique = (values: string[]) => [...new Set(values.filter(Boolean))];

export function evaluate(key: KeyItem[], finals: FinalRow[], set: EvalSet): EvaluationResult {
  const byId = new Map(finals.map((f) => [f.id, f]));
  const problems: string[] = [];
  key.forEach((k) => {
    const f = byId.get(k.id);
    if (!f) problems.push(`${k.id}: missing from the final-label sheet`);
    else {
      if (!f.polarity) problems.push(`${k.id}: Final polarity is empty or not a valid label`);
      if (!f.sarcastic) problems.push(`${k.id}: Final sarcastic is empty or not Yes / No`);
    }
  });

  const items = key.filter((k) => set === "all" || k.set === set);
  const confusion = POLARITIES.map(() => new Array<number>(LABEL_VALUES.length).fill(0));
  const humanNA = { n: 0, geminiAgreed: 0 };
  const sarc = { n: 0, humanYes: 0, geminiYes: 0, bothYes: 0, same: 0 };
  let n = 0;
  let correct = 0;

  for (const k of items) {
    const f = byId.get(k.id);
    if (f?.sarcastic) {
      sarc.n++;
      const h = f.sarcastic === "Yes";
      const g = k.geminiSarcastic === "Yes";
      if (h) sarc.humanYes++;
      if (g) sarc.geminiYes++;
      if (h && g) sarc.bothYes++;
      if (h === g) sarc.same++;
    }
    if (!f?.polarity) continue;
    if (f.polarity === "Not analyzable") {
      humanNA.n++;
      if (k.geminiPolarity === "Not analyzable") humanNA.geminiAgreed++;
      continue;
    }
    n++;
    confusion[POLARITIES.indexOf(f.polarity)][LABEL_VALUES.indexOf(k.geminiPolarity)]++;
    if (f.polarity === k.geminiPolarity) correct++;
  }

  // Precision counts every comment Gemini gave the label (within the three human labels);
  // recall counts every comment the humans gave it. Gemini's "Not analyzable" is always a miss.
  const perClass: ClassScore[] = POLARITIES.map((label, i) => {
    const j = LABEL_VALUES.indexOf(label);
    const tp = confusion[i][j];
    const support = confusion[i].reduce((s, v) => s + v, 0);
    const predicted = confusion.reduce((s, row) => s + row[j], 0);
    // Never predicted but present in the human labels = precision 0 (not skipped), so macro-F1
    // cannot look better by leaving a label out.
    const precision = predicted > 0 ? tp / predicted : support > 0 ? 0 : null;
    const recall = ratio(tp, support);
    return { label, support, precision, recall, f1: f1Of(precision, recall) };
  });
  const scored = perClass.filter((c) => c.support > 0 && c.f1 !== null);
  const macroF1 = scored.length ? scored.reduce((s, c) => s + (c.f1 as number), 0) / scored.length : null;

  const sp = ratio(sarc.bothYes, sarc.geminiYes);
  const sr = ratio(sarc.bothYes, sarc.humanYes);
  return {
    set,
    n,
    correct,
    accuracy: ratio(correct, n),
    macroF1,
    perClass,
    confusion,
    humanNotAnalyzable: humanNA,
    sarcasm: {
      n: sarc.n,
      humanYes: sarc.humanYes,
      geminiYes: sarc.geminiYes,
      bothYes: sarc.bothYes,
      accuracy: ratio(sarc.same, sarc.n),
      precision: sp,
      recall: sr,
      f1: f1Of(sp, sr),
    },
    problems,
    modelVersions: unique(key.map((k) => k.modelVersion || k.model)),
    promptVersions: unique(key.map((k) => k.promptVersion)),
    seed: key[0]?.seed || "",
    source: key[0]?.source || "",
    leftOutFallback: key[0]?.leftOutFallback || "",
    leftOutNoResult: key[0]?.leftOutNoResult || "",
  };
}

/** The most common mistakes in plain words, e.g. "Negative called Neutral: 9 comments". */
export function commonMistakes(result: EvaluationResult): { text: string; n: number }[] {
  const out: { text: string; n: number }[] = [];
  POLARITIES.forEach((human, i) =>
    LABEL_VALUES.forEach((gemini, j) => {
      if (human === gemini) return;
      const n = result.confusion[i][j];
      if (n > 0) out.push({ text: `${human} called ${gemini}`, n });
    })
  );
  return out.sort((a, b) => b.n - a.n);
}

/** A result ready to save (Firestore cannot hold lists inside lists, so rows are keyed by label). */
export function toEvaluationRun(
  r: EvaluationResult,
  meta: { savedBy: string; answerKey: string; finalSheet: string }
): EvaluationRun {
  const savedAt = Date.now();
  return {
    id: `run_${savedAt}`,
    savedAt,
    savedBy: meta.savedBy.trim().toLowerCase(),
    set: r.set,
    n: r.n,
    correct: r.correct,
    accuracy: r.accuracy,
    macroF1: r.macroF1,
    perClass: r.perClass.map((c) => ({ ...c })),
    confusionRows: Object.fromEntries(POLARITIES.map((p, i) => [p, [...r.confusion[i]]])),
    humanNotAnalyzable: { ...r.humanNotAnalyzable },
    sarcasm: { ...r.sarcasm },
    modelVersions: r.modelVersions,
    promptVersions: r.promptVersions,
    seed: r.seed,
    source: r.source,
    leftOutFallback: r.leftOutFallback,
    leftOutNoResult: r.leftOutNoResult,
    files: { answerKey: meta.answerKey, finalSheet: meta.finalSheet },
  };
}

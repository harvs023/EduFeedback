import { csvRecords, toCsv } from "./csv";
import { HumanLabel, LABEL_VALUES } from "./evaluation";

/**
 * Sentiment evaluation, part 2 (plan step 6c): agreement between the two human labelers.
 * Reads the answer key and both labelers' sheets (files, not the database), checks them,
 * computes Cohen's kappa, lists disagreements and builds the final-label sheet for the third
 * person. Gemini's labels are never put in front of the labelers or the third person.
 */

export type YesNo = "Yes" | "No";

export interface KeyItem {
  id: string;
  set: "tuning" | "test";
  geminiPolarity: HumanLabel;
  geminiSarcastic: YesNo;
  model: string;
  modelVersion: string;
  promptVersion: string;
  seed: string;
  source: string;
  /** "" in answer keys made before these columns existed. */
  leftOutFallback: string;
  leftOutNoResult: string;
}

export interface SheetRow {
  id: string;
  survey: string;
  section: string;
  question: string;
  comment: string;
  polarity: HumanLabel | null;
  sarcastic: YesNo | null;
  /** What was typed, when it is not a valid label. */
  badPolarity?: string;
  badSarcastic?: string;
}

/** Accepts any capitalization and a few common spellings. */
export function normalizeLabel(raw: string): HumanLabel | null {
  const v = raw.trim().toLowerCase().replace(/[\s_-]+/g, " ");
  if (!v) return null;
  if (["positive", "pos", "p"].includes(v)) return "Positive";
  if (["neutral", "neu"].includes(v)) return "Neutral";
  if (["negative", "neg"].includes(v)) return "Negative";
  if (["not analyzable", "not analysable", "na", "n/a", "not a comment"].includes(v)) return "Not analyzable";
  return null;
}

export function normalizeYesNo(raw: string): YesNo | null {
  const v = raw.trim().toLowerCase();
  if (["yes", "y", "true", "1", "oo"].includes(v)) return "Yes";
  if (["no", "n", "false", "0", "hindi"].includes(v)) return "No";
  return null;
}

export function readAnswerKey(text: string): { items: KeyItem[]; problem: string | null } {
  const { headers, records } = csvRecords(text);
  if (!headers.includes("item id") || !headers.includes("gemini polarity") || !headers.includes("set")) {
    return { items: [], problem: "This does not look like an answer key (it needs Item ID, Set and Gemini polarity columns)." };
  }
  const items = records
    .filter((r) => r["item id"])
    .map((r) => ({
      id: r["item id"],
      set: (r["set"] === "tuning" ? "tuning" : "test") as KeyItem["set"],
      geminiPolarity: normalizeLabel(r["gemini polarity"]) || "Not analyzable",
      geminiSarcastic: normalizeYesNo(r["gemini sarcastic"]) || "No",
      model: r["model"] || "",
      modelVersion: r["model version"] || "",
      promptVersion: r["prompt version"] || "",
      seed: r["seed"] || "",
      source: r["source"] || "",
      leftOutFallback: r["left out (fallback)"] || "",
      leftOutNoResult: r["left out (no result)"] || "",
    }));
  return items.length ? { items, problem: null } : { items, problem: "The answer key has no rows." };
}

export function readLabelerSheet(text: string): { rows: SheetRow[]; problem: string | null } {
  const { headers, records } = csvRecords(text);
  if (!headers.includes("item id") || !headers.includes("polarity")) {
    return { rows: [], problem: "This does not look like a labeling sheet (it needs Item ID and Polarity columns)." };
  }
  const rows = records
    .filter((r) => r["item id"])
    .map((r) => {
      const polarity = normalizeLabel(r["polarity"] || "");
      const sarcastic = normalizeYesNo(r["sarcastic"] || "");
      return {
        id: r["item id"],
        survey: r["survey"] || "",
        section: r["section"] || "",
        question: r["question"] || "",
        comment: r["comment"] || "",
        polarity,
        sarcastic,
        ...(!polarity ? { badPolarity: r["polarity"] || "" } : {}),
        ...(!sarcastic ? { badSarcastic: r["sarcastic"] || "" } : {}),
      };
    });
  return rows.length ? { rows, problem: null } : { rows, problem: "The sheet has no rows." };
}

// ---------------------------------------------------------------- Cohen's kappa

export interface KappaResult {
  n: number;
  /** Share of items where both gave the same label (0-1). */
  observed: number;
  /** Agreement expected by chance from each labeler's label mix (0-1). */
  expected: number;
  /** null when it cannot be computed (no items, or both always used one and the same label). */
  kappa: number | null;
  /** counts[a][b] = items labeler 1 called a and labeler 2 called b. */
  counts: number[][];
  categories: string[];
}

export function cohenKappa<T extends string>(pairs: [T, T][], categories: readonly T[]): KappaResult {
  const k = categories.length;
  const counts = Array.from({ length: k }, () => new Array<number>(k).fill(0));
  for (const [a, b] of pairs) counts[categories.indexOf(a)][categories.indexOf(b)]++;
  const n = pairs.length;
  if (n === 0) return { n, observed: 0, expected: 0, kappa: null, counts, categories: [...categories] };
  const observed = categories.reduce((sum, _, i) => sum + counts[i][i], 0) / n;
  const expected = categories.reduce((sum, _, i) => {
    const row = counts[i].reduce((s, v) => s + v, 0) / n;
    const col = counts.reduce((s, r) => s + r[i], 0) / n;
    return sum + row * col;
  }, 0);
  const kappa = expected >= 1 ? null : (observed - expected) / (1 - expected);
  return { n, observed, expected, kappa, counts, categories: [...categories] };
}

/** Landis & Koch (1977), the usual wording for kappa in research papers. */
export function kappaMeaning(kappa: number | null): string {
  if (kappa === null) return "cannot be computed";
  if (kappa < 0) return "poor (less than chance)";
  if (kappa <= 0.2) return "slight";
  if (kappa <= 0.4) return "fair";
  if (kappa <= 0.6) return "moderate";
  if (kappa <= 0.8) return "substantial";
  return "almost perfect";
}

// ---------------------------------------------------------------- comparing the two sheets

export interface SheetCheck {
  /** Key items missing from a sheet. */
  missing1: string[];
  missing2: string[];
  /** Rows in a sheet that are not in the key. */
  extra1: string[];
  extra2: string[];
  /** Invalid or empty labels, as "U0012: Polarity is empty". */
  invalid: string[];
}

export interface Disagreement {
  id: string;
  comment: string;
  labeler1: { polarity: HumanLabel; sarcastic: YesNo };
  labeler2: { polarity: HumanLabel; sarcastic: YesNo };
  polarityDiffers: boolean;
  sarcasmDiffers: boolean;
}

export interface AgreementResult {
  check: SheetCheck;
  /** Items both labelers labeled validly; kappa uses only these. */
  complete: number;
  polarity: KappaResult;
  sarcasm: KappaResult;
  disagreements: Disagreement[];
}

export function compareLabelers(key: KeyItem[], sheet1: SheetRow[], sheet2: SheetRow[]): AgreementResult {
  const byId1 = new Map(sheet1.map((r) => [r.id, r]));
  const byId2 = new Map(sheet2.map((r) => [r.id, r]));
  const keyIds = new Set(key.map((k) => k.id));
  const check: SheetCheck = {
    missing1: key.filter((k) => !byId1.has(k.id)).map((k) => k.id),
    missing2: key.filter((k) => !byId2.has(k.id)).map((k) => k.id),
    extra1: sheet1.filter((r) => !keyIds.has(r.id)).map((r) => r.id),
    extra2: sheet2.filter((r) => !keyIds.has(r.id)).map((r) => r.id),
    invalid: [],
  };
  const describe = (who: string, r: SheetRow) => {
    if (!r.polarity) check.invalid.push(`${r.id} (${who}): Polarity ${r.badPolarity ? `"${r.badPolarity}" is not a valid label` : "is empty"}`);
    if (!r.sarcastic) check.invalid.push(`${r.id} (${who}): Sarcastic ${r.badSarcastic ? `"${r.badSarcastic}" is not Yes or No` : "is empty"}`);
  };

  const polarityPairs: [HumanLabel, HumanLabel][] = [];
  const sarcasmPairs: [YesNo, YesNo][] = [];
  const disagreements: Disagreement[] = [];
  for (const k of key) {
    const a = byId1.get(k.id);
    const b = byId2.get(k.id);
    if (a) describe("Labeler 1", a);
    if (b) describe("Labeler 2", b);
    if (!a?.polarity || !a.sarcastic || !b?.polarity || !b.sarcastic) continue;
    polarityPairs.push([a.polarity, b.polarity]);
    sarcasmPairs.push([a.sarcastic, b.sarcastic]);
    const polarityDiffers = a.polarity !== b.polarity;
    const sarcasmDiffers = a.sarcastic !== b.sarcastic;
    if (polarityDiffers || sarcasmDiffers) {
      disagreements.push({
        id: k.id,
        comment: a.comment || b.comment,
        labeler1: { polarity: a.polarity, sarcastic: a.sarcastic },
        labeler2: { polarity: b.polarity, sarcastic: b.sarcastic },
        polarityDiffers,
        sarcasmDiffers,
      });
    }
  }
  return {
    check,
    complete: polarityPairs.length,
    polarity: cohenKappa(polarityPairs, LABEL_VALUES),
    sarcasm: cohenKappa(sarcasmPairs, ["Yes", "No"] as const),
    disagreements,
  };
}

/**
 * For the third person: both labelers' choices (never Gemini's), with the Final columns already
 * filled where the labelers agreed and left empty where they did not. The comment text comes
 * from the labelers' sheet, so names blanked there stay blanked.
 */
export function finalLabelSheetCsv(key: KeyItem[], sheet1: SheetRow[], sheet2: SheetRow[]): string {
  const byId1 = new Map(sheet1.map((r) => [r.id, r]));
  const byId2 = new Map(sheet2.map((r) => [r.id, r]));
  return toCsv([
    [
      "Item ID", "Survey", "Section", "Question", "Comment",
      "Labeler 1 polarity", "Labeler 2 polarity", "Labeler 1 sarcastic", "Labeler 2 sarcastic",
      "Agreed", "Final polarity", "Final sarcastic", "Notes",
    ],
    ...key.map((k) => {
      const a = byId1.get(k.id);
      const b = byId2.get(k.id);
      const ctx = a || b;
      const samePolarity = !!a?.polarity && a.polarity === b?.polarity;
      const sameSarcasm = !!a?.sarcastic && a.sarcastic === b?.sarcastic;
      return [
        k.id, ctx?.survey || "", ctx?.section || "", ctx?.question || "", ctx?.comment || "",
        a?.polarity || "", b?.polarity || "", a?.sarcastic || "", b?.sarcastic || "",
        samePolarity && sameSarcasm ? "Yes" : "No",
        samePolarity ? a!.polarity : "",
        sameSarcasm ? a!.sarcastic : "",
        "",
      ];
    }),
  ]);
}

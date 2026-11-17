import type { Survey } from "../types";
import { MIN_RESPONSES, RATING_BANDS, type QuestionResult, interpretRating } from "./analytics";

/**
 * Thesis-style results table for one survey and period: Mean, SD, verbal interpretation and rank
 * per rating question, grouped by topic block. Descriptive statistics only.
 */

/** Sample standard deviation (like Excel STDEV.S); null with fewer than 2 values. */
export function sampleSd(values: number[]): number | null {
  if (values.length < 2) return null;
  const m = values.reduce((s, v) => s + v, 0) / values.length;
  return Math.sqrt(values.reduce((s, v) => s + (v - m) ** 2, 0) / (values.length - 1));
}

/** Sample SD from "how many chose each value" counts. */
export function sdFromCounts(counts: { value: number; count: number }[]): number | null {
  const n = counts.reduce((s, c) => s + c.count, 0);
  if (n < 2) return null;
  const m = counts.reduce((s, c) => s + c.value * c.count, 0) / n;
  return Math.sqrt(counts.reduce((s, c) => s + c.count * (c.value - m) ** 2, 0) / (n - 1));
}

export interface ResultsItem {
  number: number;
  text: string;
  n: number;
  /** null when fewer than MIN_RESPONSES answered (no numbers shown). */
  mean: number | null;
  sd: number | null;
  interpretation: string;
  rank: number | null;
}

export interface ResultsGroup {
  title: string;
  items: ResultsItem[];
}

export interface ResultsTable {
  groups: ResultsGroup[];
  /** Mean of the item means (items with enough answers), as thesis tables usually report it. */
  overall: number | null;
  itemCount: number;
}

export function buildResultsTable(survey: Survey, questions: QuestionResult[]): ResultsTable {
  const ratings = questions.filter((q): q is Extract<QuestionResult, { type: "rating" }> => q.type === "rating");
  const items = ratings.map((q, i) => {
    const enough = q.answered >= MIN_RESPONSES && q.average !== null;
    const valid = q.counts.filter((c) => c.value >= 1 && c.value <= 5);
    return {
      blockId: q.question.blockId,
      item: {
        number: i + 1,
        text: q.question.text,
        n: q.answered,
        mean: enough ? q.average : null,
        sd: enough ? sdFromCounts(valid) : null,
        interpretation: enough && q.average !== null ? interpretRating(q.average) : "Not enough answers",
        rank: null,
      } as ResultsItem,
    };
  });

  // Rank by mean (highest = 1); equal means (to 2 decimals) share the same rank, e.g. 1, 2, 2, 4.
  const ranked = items.map((x) => x.item).filter((x) => x.mean !== null);
  const rounded = (v: number) => Math.round(v * 100);
  for (const x of ranked) {
    x.rank = 1 + ranked.filter((y) => rounded(y.mean as number) > rounded(x.mean as number)).length;
  }

  const blocks = survey.topicBlocks || [];
  const groups: ResultsGroup[] = [];
  for (const b of blocks) {
    const inBlock = items.filter((x) => x.blockId === b.id).map((x) => x.item);
    if (inBlock.length) groups.push({ title: b.title, items: inBlock });
  }
  const rest = items.filter((x) => !blocks.some((b) => b.id === x.blockId)).map((x) => x.item);
  if (rest.length) groups.push({ title: blocks.length ? "Other questions" : "", items: rest });

  const means = ranked.map((x) => x.mean as number);
  return {
    groups,
    overall: means.length ? means.reduce((s, v) => s + v, 0) / means.length : null,
    itemCount: ratings.length,
  };
}

export const SCALE_NOTE = RATING_BANDS.map((b, i) => {
  const upper = i === 0 ? 5 : RATING_BANDS[i - 1].min - 0.01;
  return `${b.min.toFixed(2)}-${upper.toFixed(2)} ${b.label}`;
}).join(" · ");

const fmt = (v: number | null) => (v === null ? "" : v.toFixed(2));

/** Rows for copy / CSV: header + one row per item, group rows, overall row. */
function tableRows(t: ResultsTable): string[][] {
  const rows: string[][] = [["#", "Item", "n", "Mean", "SD", "Verbal interpretation", "Rank"]];
  for (const g of t.groups) {
    if (g.title) rows.push(["", g.title, "", "", "", "", ""]);
    for (const x of g.items) {
      rows.push([String(x.number), x.text, String(x.n), fmt(x.mean), fmt(x.sd), x.interpretation, x.rank === null ? "" : String(x.rank)]);
    }
  }
  rows.push(["", "Overall (mean of item means)", "", fmt(t.overall), "", t.overall === null ? "" : interpretRating(t.overall), ""]);
  return rows;
}

/** Tab-separated text: pastes as a table into Word or Excel. */
export function resultsTableTsv(t: ResultsTable, caption: string): string {
  const clean = (v: string) => v.replace(/[\t\r\n]+/g, " ");
  return [caption, ...tableRows(t).map((r) => r.map(clean).join("\t")), `Scale: ${SCALE_NOTE}`].join("\n");
}

export function resultsTableCsv(t: ResultsTable, caption: string): string {
  const cell = (v: string) => `"${v.replace(/"/g, '""')}"`;
  return [cell(caption), ...tableRows(t).map((r) => r.map(cell).join(",")), cell(`Scale: ${SCALE_NOTE}`)].join("\n");
}

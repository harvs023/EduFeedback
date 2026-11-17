import { useState } from "react";
import { Check, Copy, Download, Table2 } from "lucide-react";
import type { Survey } from "../../types";
import type { QuestionResult } from "../../lib/analytics";
import { SCALE_NOTE, buildResultsTable, resultsTableCsv, resultsTableTsv } from "../../lib/resultsTable";
import { interpretRating } from "../../lib/analytics";

const fmt = (v: number | null) => (v === null ? "–" : v.toFixed(2));

/**
 * "Results table (rating questions)": Mean, SD, verbal interpretation and rank per item, grouped by
 * topic block, for the chosen period. Copy pastes as a table into Word or Excel; CSV for the paper.
 */
export function ResultsTableCard({
  survey,
  questions,
  periodName,
  n,
}: {
  survey: Survey;
  questions: QuestionResult[];
  periodName: string;
  /** Responses in the period. */
  n: number;
}) {
  const [copied, setCopied] = useState(false);
  const table = buildResultsTable(survey, questions);
  if (table.itemCount === 0) return null;
  const caption = `Table: ${survey.title} · ${periodName} (n = ${n})`;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(resultsTableTsv(table, caption));
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  };

  const download = () => {
    const blob = new Blob(["﻿" + resultsTableCsv(table, caption)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${survey.title.replace(/[^a-z0-9]+/gi, "_").slice(0, 50)}_results_table_${periodName.replace(/[^a-z0-9]+/gi, "_")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const btn =
    "inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer";

  return (
    <section className="p-4 sm:p-5 rounded-2xl bg-white border border-slate-200 space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="flex items-center gap-2 text-sm font-bold text-slate-900">
            <Table2 className="w-4 h-4 text-indigo-600" /> Results table (rating questions)
          </h3>
          <p className="text-xs text-slate-500">{caption}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={copy} className={btn} title="Copy as a table for Word or Excel">
            {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
            {copied ? "Copied" : "Copy table"}
          </button>
          <button type="button" onClick={download} className={btn}>
            <Download className="w-4 h-4" /> Export table (CSV)
          </button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="text-left text-[11px] uppercase tracking-wide text-slate-500 border-b border-slate-200">
              <th className="py-2 pr-2 w-8">#</th>
              <th className="py-2 pr-3">Item</th>
              <th className="py-2 pr-3 text-right">n</th>
              <th className="py-2 pr-3 text-right">Mean</th>
              <th className="py-2 pr-3 text-right">SD</th>
              <th className="py-2 pr-3">Verbal interpretation</th>
              <th className="py-2 text-right">Rank</th>
            </tr>
          </thead>
          <tbody>
            {table.groups.map((g, gi) => [
              g.title ? (
                <tr key={`g${gi}`} className="bg-slate-50">
                  <td colSpan={7} className="py-1.5 px-2 text-xs font-bold text-slate-700">
                    {g.title}
                  </td>
                </tr>
              ) : null,
              ...g.items.map((x) => (
                <tr key={x.number} className="border-b border-slate-100 align-top">
                  <td className="py-2 pr-2 text-slate-500 tabular-nums">{x.number}</td>
                  <td className="py-2 pr-3 text-slate-800">{x.text}</td>
                  <td className="py-2 pr-3 text-right tabular-nums text-slate-600">{x.n}</td>
                  <td className="py-2 pr-3 text-right tabular-nums font-semibold text-slate-900">{fmt(x.mean)}</td>
                  <td className="py-2 pr-3 text-right tabular-nums text-slate-700">{fmt(x.sd)}</td>
                  <td className={`py-2 pr-3 ${x.mean === null ? "text-slate-400" : "text-slate-700"}`}>{x.interpretation}</td>
                  <td className="py-2 text-right tabular-nums text-slate-700">{x.rank ?? "–"}</td>
                </tr>
              )),
            ])}
            <tr className="border-t-2 border-slate-300 font-semibold">
              <td />
              <td className="py-2 pr-3 text-slate-900">Overall (mean of item means)</td>
              <td />
              <td className="py-2 pr-3 text-right tabular-nums text-slate-900">{fmt(table.overall)}</td>
              <td className="py-2 pr-3 text-right text-slate-400">–</td>
              <td className="py-2 pr-3 text-slate-700">{table.overall === null ? "–" : interpretRating(table.overall)}</td>
              <td />
            </tr>
          </tbody>
        </table>
      </div>

      <p className="text-[11px] text-slate-500">
        Scale: {SCALE_NOTE}. SD = sample standard deviation. Items with fewer than 5 answers show no numbers and no rank;
        equal means share a rank. The overall row averages the item means, so it can differ slightly from the "Average
        rating" card, which counts each respondent's own average once. Descriptive statistics only.
      </p>
    </section>
  );
}

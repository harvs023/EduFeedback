import React from "react";
import { Gauge, Info, Trash2 } from "lucide-react";
import { EvaluationRun } from "../types";

interface Props {
  runs: EvaluationRun[];
  loading: boolean;
  error: string | null;
  onDelete: (run: EvaluationRun) => void;
}

const pct = (v: number | null) => (v === null ? "—" : `${(v * 100).toFixed(1)}%`);
const dec = (v: number | null) => (v === null ? "—" : v.toFixed(2));
const when = (t: number) => new Date(t).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
const setName = { test: "Test set", tuning: "Tuning set", all: "All sampled" } as const;

/**
 * The only place an accuracy number is shown: the latest saved test-set evaluation, with n,
 * date, model and prompt version. Before any test-set run is saved it says so honestly.
 */
export const MeasuredAccuracy: React.FC<Props> = ({ runs, loading, error, onDelete }) => {
  const latestTest = runs.find((r) => r.set === "test");
  return (
    <div className="space-y-3">
      {latestTest ? (
        <div className="p-5 rounded-2xl bg-white border border-indigo-200 space-y-2">
          <p className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wide text-indigo-700">
            <Gauge className="w-4 h-4" />
            Measured accuracy (test set)
          </p>
          <p className="text-2xl font-extrabold text-slate-900">
            {pct(latestTest.accuracy)}
            <span className="ml-3 text-sm font-semibold text-slate-600">macro-F1 {dec(latestTest.macroF1)}</span>
          </p>
          <p className="text-xs text-slate-600">
            Gemini matched the final human label on {latestTest.correct} of {latestTest.n} test comments. Measured{" "}
            {when(latestTest.savedAt)} · Gemini {latestTest.modelVersions.join(", ") || "version not recorded"} · prompt{" "}
            {latestTest.promptVersions.join(", ") || "not recorded"} · seed {latestTest.seed || "not recorded"}.
          </p>
          {latestTest.n < 30 && (
            <p className="text-[11px] text-amber-800">Small sample (n = {latestTest.n}): read with caution.</p>
          )}
        </div>
      ) : (
        <div className="p-4 rounded-2xl bg-blue-50 border border-blue-200 text-xs text-blue-900 flex items-start gap-2">
          <Info className="w-4 h-4 shrink-0 mt-0.5" />
          <span>
            {loading
              ? "Checking for saved evaluation results..."
              : "Accuracy has not been measured yet. It is measured with the evaluation below (human labels, Cohen's kappa, accuracy, macro-F1 and a confusion matrix) and appears here once a test-set result is saved."}
          </span>
        </div>
      )}
      {error && <p className="text-xs text-rose-700">{error}</p>}

      {runs.length > 0 && (
        <details className="text-xs">
          <summary className="cursor-pointer font-semibold text-slate-600">Saved evaluation results ({runs.length})</summary>
          <ul className="mt-2 divide-y divide-slate-100 border border-slate-200 rounded-xl bg-white">
            {runs.map((r) => (
              <li key={r.id} className="px-3 py-2 flex items-start justify-between gap-3">
                <div className="min-w-0 text-slate-700">
                  <p>
                    <strong>{setName[r.set]}</strong>: accuracy {pct(r.accuracy)}, macro-F1 {dec(r.macroF1)}, n = {r.n}
                  </p>
                  <p className="text-[11px] text-slate-500 truncate">
                    {when(r.savedAt)} · {r.files.answerKey} + {r.files.finalSheet}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onDelete(r)}
                  title="Delete this saved result"
                  className="p-1.5 rounded-lg text-rose-600 hover:bg-rose-50 cursor-pointer shrink-0"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </li>
            ))}
          </ul>
          <p className="mt-1 text-[11px] text-slate-500">
            Saved results cannot be edited. To correct one, save a new run and delete the wrong one.
          </p>
        </details>
      )}
    </div>
  );
};

export default MeasuredAccuracy;

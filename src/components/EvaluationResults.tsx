import React, { useMemo, useState } from "react";
import { CheckCircle2, FileUp, Save, Target } from "lucide-react";
import { getFirebaseAuth } from "../lib/firebase";
import { EvaluationRun } from "../types";
import { KeyItem, readAnswerKey } from "../lib/agreement";
import { LABEL_VALUES } from "../lib/evaluation";
import {
  EvalSet,
  EvaluationResult,
  FinalRow,
  POLARITIES,
  commonMistakes,
  evaluate,
  readFinalSheet,
  toEvaluationRun,
} from "../lib/evaluationResults";

interface Loaded<T> {
  name: string;
  data: T[];
  problem: string | null;
}

const pct = (v: number | null) => (v === null ? "—" : `${(v * 100).toFixed(1)}%`);
const dec = (v: number | null) => (v === null ? "—" : v.toFixed(2));

function Picker({ label, hint, loaded, onFile }: { label: string; hint: string; loaded: Loaded<unknown> | null; onFile: (f: File) => void }) {
  return (
    <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-1.5 min-w-0">
      <p className="text-xs font-bold text-slate-800">{label}</p>
      <p className="text-[11px] text-slate-500">{hint}</p>
      <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer">
        <FileUp className="w-4 h-4" />
        {loaded ? "Replace file" : "Choose CSV"}
        <input
          type="file"
          accept=".csv,text/csv"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onFile(f);
            e.target.value = "";
          }}
        />
      </label>
      {loaded && (
        <p className={`text-[11px] truncate ${loaded.problem ? "text-rose-700" : "text-emerald-700"}`}>
          {loaded.problem ? loaded.problem : `${loaded.name}: ${loaded.data.length} rows`}
        </p>
      )}
    </div>
  );
}

function Metric({ label, value, help }: { label: string; value: string; help: string }) {
  return (
    <div className="p-4 rounded-2xl bg-white border border-slate-200">
      <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-extrabold text-slate-900">{value}</p>
      <p className="mt-1 text-xs text-slate-500">{help}</p>
    </div>
  );
}

function Results({ r }: { r: EvaluationResult }) {
  const mistakes = commonMistakes(r);
  const setName = r.set === "all" ? "all sampled comments" : `the ${r.set} set`;
  return (
    <div className="space-y-4">
      <div className="p-4 rounded-2xl bg-indigo-50/60 border border-indigo-100 text-sm text-slate-800 space-y-1">
        <p className="text-[11px] font-bold uppercase tracking-wide text-indigo-700">In plain words</p>
        {r.n === 0 ? (
          <p>No comments with a final Positive / Neutral / Negative label in {setName}.</p>
        ) : (
          <>
            <p>
              Gemini gave the same polarity as the final human label for <strong>{r.correct}</strong> of {r.n} comments in{" "}
              {setName} ({pct(r.accuracy)}).
            </p>
            {mistakes.length > 0 && (
              <p>
                Most common mistakes: {mistakes.slice(0, 3).map((m) => `${m.text} (${m.n})`).join(", ")}.
              </p>
            )}
          </>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Metric label="Accuracy" value={pct(r.accuracy)} help="Share of comments where Gemini's polarity matched the final human label." />
        <Metric
          label="Macro-F1"
          value={dec(r.macroF1)}
          help="The average F1 of Positive, Neutral and Negative. Fairer than accuracy when one label is much more common. 1.00 is perfect."
        />
        <Metric label="Comments (n)" value={String(r.n)} help={`With a final Positive / Neutral / Negative label in ${setName}.`} />
      </div>

      <div className="space-y-2">
        <h4 className="text-sm font-bold text-slate-800">Per label</h4>
        <div className="overflow-x-auto border border-slate-200 rounded-2xl bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wide text-slate-500 border-b border-slate-100">
                <th className="px-4 py-2 font-bold">Label</th>
                <th className="px-4 py-2 font-bold">Human count</th>
                <th className="px-4 py-2 font-bold">Precision</th>
                <th className="px-4 py-2 font-bold">Recall</th>
                <th className="px-4 py-2 font-bold">F1</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {r.perClass.map((c) => (
                <tr key={c.label}>
                  <td className="px-4 py-2 font-semibold text-slate-800">{c.label}</td>
                  <td className="px-4 py-2 tabular-nums">{c.support}</td>
                  <td className="px-4 py-2 tabular-nums">{dec(c.precision)}</td>
                  <td className="px-4 py-2 tabular-nums">{dec(c.recall)}</td>
                  <td className="px-4 py-2 tabular-nums">{dec(c.f1)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-[11px] text-slate-500">
          Precision: when Gemini said this label, how often the humans agreed. Recall: of the comments the humans gave this
          label, how many Gemini found. F1 combines the two. A Gemini "Not analyzable" on a comment the humans labeled
          counts as a miss.
        </p>
      </div>

      <div className="space-y-1 text-xs text-slate-700">
        <p className="font-semibold">Where Gemini differed from the humans:</p>
        {mistakes.length === 0 ? (
          <p className="text-slate-500">Nowhere.</p>
        ) : (
          <ul className="space-y-0.5">
            {mistakes.map((m) => (
              <li key={m.text} className="flex justify-between gap-3 max-w-sm">
                <span>Humans: {m.text.replace(" called ", ", Gemini: ")}</span>
                <span className="tabular-nums text-slate-600">
                  {m.n} comment{m.n === 1 ? "" : "s"}
                </span>
              </li>
            ))}
          </ul>
        )}
        <details>
          <summary className="cursor-pointer font-semibold text-slate-500">Show the confusion matrix (for your paper)</summary>
          <div className="overflow-x-auto mt-2">
            <table className="text-xs">
              <thead>
                <tr className="text-slate-500">
                  <th className="px-2 py-1 text-left font-semibold">Humans ↓ / Gemini →</th>
                  {LABEL_VALUES.map((c) => (
                    <th key={c} className="px-2 py-1 font-semibold whitespace-nowrap">
                      {c}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {POLARITIES.map((row, i) => (
                  <tr key={row}>
                    <td className="px-2 py-1 font-semibold whitespace-nowrap">{row}</td>
                    {r.confusion[i].map((v, j) => (
                      <td
                        key={j}
                        className={`px-2 py-1 text-center tabular-nums ${LABEL_VALUES[j] === row ? "bg-indigo-50 font-bold text-indigo-900" : ""}`}
                      >
                        {v}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-1 text-[11px] text-slate-500">Rows are the final human labels, columns Gemini's. The shaded cells are correct.</p>
        </details>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs text-slate-700">
        <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
          <p className="font-bold text-slate-800">Not analyzable (reported apart)</p>
          <p>
            The humans called {r.humanNotAnalyzable.n} comment{r.humanNotAnalyzable.n === 1 ? "" : "s"} not analyzable; Gemini
            also did for {r.humanNotAnalyzable.geminiAgreed}.
          </p>
        </div>
        <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
          <p className="font-bold text-slate-800">Sarcasm</p>
          <p>
            Humans marked {r.sarcasm.humanYes} of {r.sarcasm.n} as sarcastic; Gemini marked {r.sarcasm.geminiYes}; both agreed
            on {r.sarcasm.bothYes}. Agreement {pct(r.sarcasm.accuracy)}; for sarcastic comments: precision{" "}
            {dec(r.sarcasm.precision)}, recall {dec(r.sarcasm.recall)}, F1 {dec(r.sarcasm.f1)}.
          </p>
          {r.sarcasm.humanYes < 10 && (
            <p className="text-[11px] text-amber-800">Very few sarcastic comments: read these sarcasm numbers with caution.</p>
          )}
        </div>
      </div>

      <div className="p-3 rounded-xl bg-white border border-slate-200 text-xs text-slate-600 space-y-0.5">
        <p className="font-bold text-slate-800">For the paper</p>
        <p>Model version: {r.modelVersions.join(", ") || "not recorded"} · Prompt: {r.promptVersions.join(", ") || "not recorded"}</p>
        <p>
          Source: {r.source || "not recorded"} · Seed: {r.seed || "not recorded"} · Left out before sampling: fallback{" "}
          {r.leftOutFallback || "not recorded"}, no result {r.leftOutNoResult || "not recorded"}
        </p>
        <p>Computed {new Date().toLocaleString("en-US")}</p>
      </div>
    </div>
  );
}

/** Plan step 6c, part 3: Gemini against the final human labels. */
export const EvaluationResults: React.FC<{ onSave?: (run: EvaluationRun) => Promise<void> }> = ({ onSave }) => {
  const [key, setKey] = useState<Loaded<KeyItem> | null>(null);
  const [finals, setFinals] = useState<Loaded<FinalRow> | null>(null);
  const [set, setSet] = useState<EvalSet>("test");
  const [showAll, setShowAll] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<{ ok: boolean; text: string } | null>(null);

  const load = async (slot: "key" | "final", file: File) => {
    const text = await file.text();
    setSaveMessage(null);
    if (slot === "key") {
      const { items, problem } = readAnswerKey(text);
      setKey({ name: file.name, data: items, problem });
    } else {
      const { rows, problem } = readFinalSheet(text);
      setFinals({ name: file.name, data: rows, problem });
    }
  };

  const ready = key && finals && !key.problem && !finals.problem;
  const result = useMemo(() => (ready ? evaluate(key!.data, finals!.data, set) : null), [ready, key, finals, set]);

  return (
    <div className="bg-white p-6 sm:p-8 rounded-3xl border border-slate-200 shadow-xs space-y-5">
      <div className="space-y-1">
        <h2 className="font-serif text-lg font-bold text-slate-900 flex items-center gap-2">
          <Target className="w-5 h-5 text-indigo-600" />
          Evaluation step 3 of 3: Gemini against the final human labels
        </h2>
        <p className="text-xs text-slate-500">
          Upload the answer key and the third person's finished final-label sheet. Use the <strong>test set</strong> for the
          numbers in your paper; the tuning set is only for improving the prompt.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <Picker label="Answer key" hint="The researchers-only file from step 1." loaded={key} onFile={(f) => load("key", f)} />
        <Picker label="Final-label sheet" hint="From step 2, filled in by the third person (CSV UTF-8)." loaded={finals} onFile={(f) => load("final", f)} />
      </div>

      {result && (
        <>
          {result.problems.length > 0 && (
            <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 space-y-1.5">
              <p className="text-sm font-bold text-amber-900">
                {result.problems.length} problem{result.problems.length === 1 ? "" : "s"} in the final-label sheet
              </p>
              <ul className="text-xs text-amber-900 list-disc pl-5 space-y-0.5">
                {(showAll ? result.problems : result.problems.slice(0, 12)).map((p, i) => (
                  <li key={i}>{p}</li>
                ))}
              </ul>
              {result.problems.length > 12 && (
                <button type="button" onClick={() => setShowAll((v) => !v)} className="text-xs font-semibold text-amber-900 underline cursor-pointer">
                  {showAll ? "Show fewer" : `Show all ${result.problems.length}`}
                </button>
              )}
              <p className="text-[11px] text-amber-800">These comments are left out below. Fill them in and upload again for final numbers.</p>
            </div>
          )}

          <div className="flex flex-wrap gap-1.5">
            {(
              [
                { id: "test", label: "Test set (for the paper)" },
                { id: "tuning", label: "Tuning set" },
                { id: "all", label: "All" },
              ] as const
            ).map((o) => (
              <button
                key={o.id}
                type="button"
                onClick={() => setSet(o.id)}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold border cursor-pointer ${
                  set === o.id ? "bg-indigo-600 text-white border-indigo-600" : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                }`}
              >
                {o.label}
              </button>
            ))}
          </div>

          <Results r={result} />

          {onSave && (
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                disabled={saving || result.problems.length > 0 || result.n === 0}
                onClick={async () => {
                  setSaving(true);
                  setSaveMessage(null);
                  try {
                    await onSave(
                      toEvaluationRun(result, {
                        savedBy: getFirebaseAuth()?.currentUser?.email || "",
                        answerKey: key!.name,
                        finalSheet: finals!.name,
                      })
                    );
                    setSaveMessage({
                      ok: true,
                      text:
                        result.set === "test"
                          ? "Saved. The Measured accuracy card at the top now shows this result."
                          : "Saved. Only test-set results appear in the Measured accuracy card.",
                    });
                  } catch {
                    setSaveMessage({
                      ok: false,
                      text: "Could not save. Make sure the evaluation_runs rule is pasted into the Firebase Console, then try again.",
                    });
                  } finally {
                    setSaving(false);
                  }
                }}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 disabled:opacity-50 cursor-pointer"
              >
                <Save className="w-4 h-4" />
                {saving ? "Saving..." : `Save these results (${result.set === "all" ? "all" : `${result.set} set`})`}
              </button>
              {result.problems.length > 0 && (
                <span className="text-xs text-amber-800">Fix the problems in the final-label sheet before saving.</span>
              )}
              {saveMessage && (
                <span className={`inline-flex items-center gap-1 text-xs ${saveMessage.ok ? "text-emerald-700" : "text-rose-700"}`}>
                  {saveMessage.ok && <CheckCircle2 className="w-4 h-4" />}
                  {saveMessage.text}
                </span>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default EvaluationResults;

import React, { useMemo, useState } from "react";
import { CheckCircle2, Download, FileUp, Users } from "lucide-react";
import {
  KappaResult,
  KeyItem,
  SheetRow,
  compareLabelers,
  finalLabelSheetCsv,
  kappaMeaning,
  readAnswerKey,
  readLabelerSheet,
} from "../lib/agreement";

type Slot = "key" | "one" | "two";

interface Loaded<T> {
  name: string;
  data: T[];
  problem: string | null;
}

const LIST_LIMIT = 12;

function download(name: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

const pct = (v: number) => `${Math.round(v * 1000) / 10}%`;

function FilePicker({
  label,
  hint,
  loaded,
  onFile,
}: {
  label: string;
  hint: string;
  loaded: Loaded<unknown> | null;
  onFile: (f: File) => void;
}) {
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

/**
 * The agreement table in plain words: how many they agreed on (with a bar), what they agreed
 * on, and which pairs of labels they mixed up most (both directions counted together).
 */
function AgreementSummary({ result }: { result: KappaResult }) {
  const agreed = result.categories.reduce((sum, _, i) => sum + result.counts[i][i], 0);
  const agreedBy = result.categories
    .map((c, i) => ({ label: c, n: result.counts[i][i] }))
    .filter((x) => x.n > 0);
  const mixups: { pair: string; n: number }[] = [];
  result.categories.forEach((a, i) =>
    result.categories.forEach((b, j) => {
      if (j <= i) return;
      const n = result.counts[i][j] + result.counts[j][i];
      if (n > 0) mixups.push({ pair: `${a} vs ${b}`, n });
    })
  );
  mixups.sort((x, y) => y.n - x.n);
  const share = result.n > 0 ? agreed / result.n : 0;
  return (
    <div className="space-y-2 text-xs text-slate-700">
      <div className="space-y-1">
        <p>
          Agreed on <strong>{agreed}</strong> of {result.n} comments ({pct(share)}). By chance alone you would expect about{" "}
          {pct(result.expected)}.
        </p>
        <div className="h-2.5 w-full rounded-full bg-slate-100 overflow-hidden">
          <div className="h-full rounded-full bg-indigo-500" style={{ width: `${share * 100}%` }} />
        </div>
      </div>
      {agreedBy.length > 0 && (
        <p>
          <span className="font-semibold">Where they agreed:</span> {agreedBy.map((x) => `${x.label} ${x.n}`).join(" · ")}
        </p>
      )}
      <div>
        <p className="font-semibold">Where they disagreed:</p>
        {mixups.length === 0 ? (
          <p className="text-slate-500">Nowhere.</p>
        ) : (
          <ul className="mt-0.5 space-y-0.5">
            {mixups.map((m) => (
              <li key={m.pair} className="flex justify-between gap-3 max-w-sm">
                <span>{m.pair}</span>
                <span className="tabular-nums text-slate-600">
                  {m.n} comment{m.n === 1 ? "" : "s"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function KappaCard({ title, result }: { title: string; result: KappaResult }) {
  return (
    <div className="p-4 rounded-2xl bg-white border border-slate-200 space-y-2">
      <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">{title}</p>
      <p className="text-2xl font-extrabold text-slate-900">
        κ = {result.kappa === null ? "—" : result.kappa.toFixed(2)}
        <span className="ml-2 text-sm font-semibold text-slate-600">{kappaMeaning(result.kappa)} agreement</span>
      </p>
      <AgreementSummary result={result} />
      <details className="text-xs">
        <summary className="cursor-pointer font-semibold text-slate-500">Show as a table (for your paper)</summary>
        <div className="overflow-x-auto mt-2">
          <table className="text-xs">
            <thead>
              <tr className="text-slate-500">
                <th className="px-2 py-1 text-left font-semibold">Labeler 1 ↓ / Labeler 2 →</th>
                {result.categories.map((c) => (
                  <th key={c} className="px-2 py-1 font-semibold whitespace-nowrap">
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {result.categories.map((row, i) => (
                <tr key={row}>
                  <td className="px-2 py-1 font-semibold text-slate-700 whitespace-nowrap">{row}</td>
                  {result.counts[i].map((v, j) => (
                    <td
                      key={j}
                      className={`px-2 py-1 text-center tabular-nums ${i === j ? "bg-indigo-50 font-bold text-indigo-900" : "text-slate-700"}`}
                    >
                      {v}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-1 text-[11px] text-slate-500">
          Rows are Labeler 1's labels, columns Labeler 2's. The shaded diagonal is where they agreed.
        </p>
      </details>
      {result.kappa === null && result.n > 0 && (
        <p className="text-[11px] text-slate-500">
          Kappa cannot be computed when both labelers used only one and the same label for every item.
        </p>
      )}
    </div>
  );
}

/** Plan step 6c, part 2: agreement between the two labelers and the sheet for the third person. */
export const EvaluationAgreement: React.FC = () => {
  const [key, setKey] = useState<Loaded<KeyItem> | null>(null);
  const [one, setOne] = useState<Loaded<SheetRow> | null>(null);
  const [two, setTwo] = useState<Loaded<SheetRow> | null>(null);

  const load = async (slot: Slot, file: File) => {
    const text = await file.text();
    if (slot === "key") {
      const { items, problem } = readAnswerKey(text);
      setKey({ name: file.name, data: items, problem });
    } else {
      const { rows, problem } = readLabelerSheet(text);
      (slot === "one" ? setOne : setTwo)({ name: file.name, data: rows, problem });
    }
  };

  const ready = key && one && two && !key.problem && !one.problem && !two.problem;
  const result = useMemo(
    () => (ready ? compareLabelers(key!.data, one!.data, two!.data) : null),
    [ready, key, one, two]
  );
  const check = result?.check;
  const problems = check
    ? [
        ...check.missing1.map((id) => `${id}: missing from Labeler 1's sheet`),
        ...check.missing2.map((id) => `${id}: missing from Labeler 2's sheet`),
        ...check.extra1.map((id) => `${id}: in Labeler 1's sheet but not in the answer key`),
        ...check.extra2.map((id) => `${id}: in Labeler 2's sheet but not in the answer key`),
        ...check.invalid,
      ]
    : [];
  const [showAll, setShowAll] = useState(false);

  return (
    <div className="bg-white p-6 sm:p-8 rounded-3xl border border-slate-200 shadow-xs space-y-5">
      <div className="space-y-1">
        <h2 className="font-serif text-lg font-bold text-slate-900 flex items-center gap-2">
          <Users className="w-5 h-5 text-indigo-600" />
          Evaluation step 2 of 3: agreement between the labelers
        </h2>
        <p className="text-xs text-slate-500">
          Upload the answer key and both finished labeling sheets. Files are read on this page only; nothing is saved.
          Gemini's labels are not shown here.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <FilePicker label="Answer key" hint="The researchers-only file from step 1." loaded={key} onFile={(f) => load("key", f)} />
        <FilePicker label="Labeler 1's sheet" hint="Saved as CSV UTF-8." loaded={one} onFile={(f) => load("one", f)} />
        <FilePicker label="Labeler 2's sheet" hint="Saved as CSV UTF-8." loaded={two} onFile={(f) => load("two", f)} />
      </div>

      {result && (
        <>
          {problems.length > 0 ? (
            <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 space-y-1.5">
              <p className="text-sm font-bold text-amber-900">
                {problems.length} problem{problems.length === 1 ? "" : "s"} to fix in the sheets
              </p>
              <ul className="text-xs text-amber-900 list-disc pl-5 space-y-0.5">
                {(showAll ? problems : problems.slice(0, LIST_LIMIT)).map((p, i) => (
                  <li key={i}>{p}</li>
                ))}
              </ul>
              {problems.length > LIST_LIMIT && (
                <button type="button" onClick={() => setShowAll((v) => !v)} className="text-xs font-semibold text-amber-900 underline cursor-pointer">
                  {showAll ? "Show fewer" : `Show all ${problems.length}`}
                </button>
              )}
              <p className="text-[11px] text-amber-800">
                Agreement below uses only the {result.complete} items both labelers labeled correctly. Fix the sheets and
                upload them again for the final numbers.
              </p>
            </div>
          ) : (
            <p className="flex items-center gap-1.5 text-xs font-semibold text-emerald-700">
              <CheckCircle2 className="w-4 h-4" />
              Both sheets are complete: {result.complete} items, every label valid.
            </p>
          )}

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <KappaCard title="Polarity" result={result.polarity} />
            <KappaCard title="Sarcastic" result={result.sarcasm} />
          </div>
          <p className="text-[11px] text-slate-500">
            Cohen's kappa measures agreement beyond chance (1 = perfect, 0 = chance level). Meanings follow Landis and Koch
            (1977): 0.41–0.60 moderate, 0.61–0.80 substantial, 0.81–1.00 almost perfect. Polarity uses four labels:
            Positive, Neutral, Negative, Not analyzable.
          </p>

          <div className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-bold text-slate-800">Disagreements ({result.disagreements.length})</h3>
              <button
                type="button"
                onClick={() => download("final-labels-for-third-person.csv", finalLabelSheetCsv(key!.data, one!.data, two!.data))}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 cursor-pointer"
              >
                <Download className="w-4 h-4" />
                Final-label sheet (for the third person)
              </button>
            </div>
            {result.disagreements.length === 0 ? (
              <p className="text-sm text-slate-500">The labelers agreed on every item.</p>
            ) : (
              <ul className="divide-y divide-slate-100 border border-slate-200 rounded-2xl">
                {result.disagreements.slice(0, 50).map((d) => (
                  <li key={d.id} className="px-4 py-2.5 space-y-1">
                    <p className="text-[11px] font-bold text-slate-500">{d.id}</p>
                    <p className="text-sm text-slate-800 break-words">{d.comment || "(comment not in the sheet)"}</p>
                    <p className="text-xs text-slate-600">
                      {d.polarityDiffers && (
                        <span className="mr-3">
                          Polarity: <strong>{d.labeler1.polarity}</strong> vs <strong>{d.labeler2.polarity}</strong>
                        </span>
                      )}
                      {d.sarcasmDiffers && (
                        <span>
                          Sarcastic: <strong>{d.labeler1.sarcastic}</strong> vs <strong>{d.labeler2.sarcastic}</strong>
                        </span>
                      )}
                    </p>
                  </li>
                ))}
              </ul>
            )}
            {result.disagreements.length > 50 && (
              <p className="text-xs text-slate-500">Showing 50; the final-label sheet has all of them.</p>
            )}
            <p className="text-[11px] text-slate-500">
              In the final-label sheet, rows where the labelers agreed are already filled in. The third person fills the
              empty Final polarity / Final sarcastic cells, saves as CSV UTF-8, and you upload it in step 3.
            </p>
          </div>
        </>
      )}
    </div>
  );
};

export default EvaluationAgreement;

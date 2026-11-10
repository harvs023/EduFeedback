import React, { useMemo, useState } from "react";
import { ClipboardCheck, Database, Download, FileKey, FileText, Loader2, Play, RotateCcw, Upload } from "lucide-react";
import { CommentAnalysis, Survey, SurveyResponse } from "../types";
import {
  DEFAULT_SAMPLE_SIZE,
  EvaluationPool,
  TUNING_SHARE,
  UploadedComment,
  answerKeyCsv,
  drawSample,
  evaluationPool,
  labelingSheetCsv,
  readUploadedComments,
  uploadContext,
  uploadTemplateCsv,
  uploadedPool,
} from "../lib/evaluation";
import { requestCommentAnalysis } from "../lib/sentiment";
import labelingGuide from "../../docs/labeling-guide-v1.md?raw";

interface Props {
  /** Trusted responses only (signatures checked). */
  responses: SurveyResponse[];
  surveys: Survey[];
}

type Source = "edufeedback" | "upload";

/** Comments sent per request, so progress can be shown. */
const BATCH = 30;

const todaySeed = () => {
  const d = new Date();
  return Number(`${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`);
};

function download(name: string, text: string, type: string) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

const secondaryButton =
  "inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 cursor-pointer";

/** Plan step 6c, part 1: choose the comments, then export the labeling sheet, answer key and guide. */
export const EvaluationPanel: React.FC<Props> = ({ responses, surveys }) => {
  const [source, setSource] = useState<Source>("edufeedback");
  const [size, setSize] = useState(DEFAULT_SAMPLE_SIZE);
  const [seed, setSeed] = useState(todaySeed());

  // Uploaded comments and their Gemini results (kept on this page only, never saved).
  const [fileName, setFileName] = useState("");
  const [uploaded, setUploaded] = useState<UploadedComment[]>([]);
  const [results, setResults] = useState<(CommentAnalysis | null)[]>([]);
  const [uploadProblem, setUploadProblem] = useState<string | null>(null);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [runProblem, setRunProblem] = useState<string | null>(null);

  const systemPool = useMemo(() => evaluationPool(responses, surveys), [responses, surveys]);
  const filePool = useMemo(() => uploadedPool(uploaded, results), [uploaded, results]);
  const analyzedAll = uploaded.length > 0 && results.length === uploaded.length && results.every((r) => r);
  const pool: EvaluationPool = source === "edufeedback" ? systemPool : filePool;

  const sample = useMemo(() => drawSample(pool.items, size, seed), [pool, size, seed]);
  const tuning = sample.filter((s) => s.set === "tuning").length;
  const ready = sample.length > 0 && Number.isInteger(seed) && seed > 0 && (source === "edufeedback" || analyzedAll);

  const handleFile = async (file: File | undefined) => {
    setUploadProblem(null);
    setRunProblem(null);
    setResults([]);
    setUploaded([]);
    setFileName(file?.name || "");
    if (!file) return;
    const { comments, problem, skipped } = readUploadedComments(await file.text());
    if (problem) {
      setUploadProblem(problem);
      return;
    }
    setUploaded(comments);
    if (skipped > 0) setUploadProblem(`${skipped} row(s) without a comment were skipped.`);
  };

  /** Sends the comments that have no Gemini result yet (all of them the first time). */
  const runGemini = async () => {
    const todo = uploaded.map((_, i) => i).filter((i) => !results[i] || results[i]?.method !== "gemini");
    if (todo.length === 0) return;
    setRunProblem(null);
    const next = uploaded.map((_, i) => results[i] ?? null);
    setProgress({ done: 0, total: todo.length });
    for (let k = 0; k < todo.length; k += BATCH) {
      const chunk = todo.slice(k, k + BATCH);
      const got = await requestCommentAnalysis(
        chunk.map((i) => ({ text: uploaded[i].text, context: uploadContext(uploaded[i]) }))
      );
      if (!got) {
        setRunProblem("The analysis service could not be reached. The comments done so far are kept; press the button again to continue.");
        break;
      }
      chunk.forEach((i, j) => (next[i] = got[j]));
      setResults([...next]);
      setProgress({ done: Math.min(k + BATCH, todo.length), total: todo.length });
    }
    setProgress(null);
  };

  const input =
    "w-32 px-3 py-2 rounded-xl border border-slate-200 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-200";
  const done = results.filter(Boolean).length;
  const needsRun = uploaded.length > 0 && (!analyzedAll || filePool.fallback > 0);

  return (
    <div className="bg-white p-6 sm:p-8 rounded-3xl border border-slate-200 shadow-xs space-y-5">
      <div className="space-y-1">
        <h2 className="font-serif text-lg font-bold text-slate-900 flex items-center gap-2">
          <ClipboardCheck className="w-5 h-5 text-indigo-600" />
          Evaluation (thesis)
        </h2>
        <p className="text-xs text-slate-500">
          Step 1 of 3: choose the comments and export them for two human labelers. Their labels are later compared with
          Gemini's. No accuracy is shown anywhere until that comparison is done.
        </p>
      </div>

      {/* Source */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {(
          [
            { id: "edufeedback", icon: Database, title: "Comments in EduFeedback", text: "Comments respondents typed into your surveys (already labeled by Gemini when submitted)." },
            { id: "upload", icon: Upload, title: "Upload a comments file", text: "Your own set of comments (CSV). Each comment is sent to Gemini once on this page." },
          ] as const
        ).map((o) => (
          <button
            key={o.id}
            type="button"
            onClick={() => setSource(o.id)}
            className={`text-left p-3 rounded-xl border cursor-pointer ${
              source === o.id ? "bg-indigo-50 border-indigo-300 ring-1 ring-indigo-200" : "bg-white border-slate-200 hover:bg-slate-50"
            }`}
          >
            <span className="flex items-center gap-2 text-sm font-bold text-slate-900">
              <o.icon className="w-4 h-4 text-indigo-600" />
              {o.title}
            </span>
            <span className="block text-[11px] text-slate-500 mt-0.5">{o.text}</span>
          </button>
        ))}
      </div>

      {/* Upload */}
      {source === "upload" && (
        <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <label className={`${secondaryButton} ${progress ? "pointer-events-none opacity-50" : ""}`}>
              <Upload className="w-4 h-4" />
              {fileName ? "Choose another file" : "Choose CSV file"}
              <input
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={(e) => {
                  handleFile(e.target.files?.[0]);
                  e.target.value = "";
                }}
              />
            </label>
            <button
              type="button"
              onClick={() => download("comments-upload-template.csv", uploadTemplateCsv(), "text/csv;charset=utf-8")}
              className={secondaryButton}
            >
              <Download className="w-4 h-4" />
              Template
            </button>
            {fileName && <span className="text-xs text-slate-600 truncate">{fileName}: {uploaded.length} comments</span>}
          </div>
          <p className="text-[11px] text-slate-500">
            Columns: <strong>Comment</strong> (required), Survey, Section, Question (optional context, like what Gemini sees
            for survey comments). Save from Excel as <strong>CSV UTF-8</strong>. Blank out names before uploading.
          </p>
          {uploadProblem && <p className="text-xs text-amber-800">{uploadProblem}</p>}

          {uploaded.length > 0 && (
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={runGemini}
                  disabled={!!progress || !needsRun}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 disabled:opacity-50 cursor-pointer"
                >
                  {progress ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : done > 0 ? (
                    <RotateCcw className="w-4 h-4" />
                  ) : (
                    <Play className="w-4 h-4" />
                  )}
                  {progress
                    ? `Analyzing ${progress.done} of ${progress.total}...`
                    : done === 0
                    ? `Analyze ${uploaded.length} comments with Gemini`
                    : needsRun
                    ? "Try again for the ones not labeled by Gemini"
                    : "All labeled by Gemini"}
                </button>
                {done > 0 && (
                  <span className="text-xs text-slate-600">
                    {filePool.items.length} labeled by Gemini
                    {filePool.fallback > 0 && `, ${filePool.fallback} by the fallback word list`}
                    {filePool.unconfirmed > 0 && `, ${filePool.unconfirmed} not done yet`}.
                  </span>
                )}
              </div>
              {runProblem && <p className="text-xs text-rose-700">{runProblem}</p>}
              <p className="text-[11px] text-slate-500">
                Results stay on this page only. Download the answer key right after, because it is the record of these
                results.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Counts */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
        <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
          <div className="text-lg font-bold text-slate-900">{pool.items.length}</div>
          <div className="text-slate-500">Comments with a Gemini label (can be sampled)</div>
        </div>
        <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
          <div className="text-lg font-bold text-slate-900">{pool.fallback}</div>
          <div className="text-slate-500">Left out: labeled by the fallback word list</div>
        </div>
        <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
          <div className="text-lg font-bold text-slate-900">{pool.unconfirmed}</div>
          <div className="text-slate-500">Left out: no Gemini result yet</div>
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-4">
        <label className="block space-y-1">
          <span className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Sample size</span>
          <input
            type="number"
            min={1}
            value={size}
            onChange={(e) => setSize(Math.max(1, Math.floor(Number(e.target.value) || 0)))}
            className={input}
          />
        </label>
        <label className="block space-y-1">
          <span className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Seed</span>
          <input
            type="number"
            min={1}
            value={seed}
            onChange={(e) => setSeed(Math.floor(Number(e.target.value) || 0))}
            className={input}
          />
        </label>
        <p className="text-xs text-slate-600 pb-2">
          {sample.length} comments: {tuning} tuning ({Math.round(TUNING_SHARE * 100)}%), {sample.length - tuning} test.
          {size > pool.items.length && pool.items.length > 0 && ` Only ${pool.items.length} are available.`}
        </p>
      </div>
      <p className="text-[11px] text-slate-500">
        The same seed always picks the same comments in the same order. Write the seed down for your paper.
      </p>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={!ready}
          onClick={() => download(`labeling-sheet_seed-${seed}.csv`, labelingSheetCsv(sample), "text/csv;charset=utf-8")}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 disabled:opacity-50 cursor-pointer"
        >
          <Download className="w-4 h-4" />
          Labeling sheet (for labelers)
        </button>
        <button
          type="button"
          disabled={!ready}
          onClick={() => download(`answer-key_seed-${seed}.csv`, answerKeyCsv(sample, seed, {
                fallback: pool.fallback,
                unconfirmed: pool.unconfirmed,
                source: source === "edufeedback" ? "EduFeedback comments" : `Uploaded file ${fileName}`,
              }), "text/csv;charset=utf-8")}
          className={secondaryButton}
        >
          <FileKey className="w-4 h-4" />
          Answer key (researchers only)
        </button>
        <button
          type="button"
          onClick={() => download("labeling-guide-v1.md", labelingGuide, "text/markdown;charset=utf-8")}
          className={secondaryButton}
        >
          <FileText className="w-4 h-4" />
          Labeling guide
        </button>
      </div>
      {source === "upload" && uploaded.length > 0 && !analyzedAll && (
        <p className="text-[11px] text-amber-800">Analyze every uploaded comment first; then the downloads unlock.</p>
      )}

      <ol className="text-xs text-slate-600 space-y-1 list-decimal pl-5">
        <li>Download the labeling sheet and the answer key with the same seed. Keep the answer key to yourselves.</li>
        <li>In the labeling sheet, replace any names in the Comment column with [NAME] (Excel: Find &amp; Replace).</li>
        <li>Send the same cleaned sheet and the labeling guide to both labelers. They label alone.</li>
        <li>Steps 2 and 3 (agreement, final labels, accuracy) come next; keep all files.</li>
      </ol>
    </div>
  );
};

export default EvaluationPanel;

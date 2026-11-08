import React, { useEffect, useMemo, useState } from "react";
import { CommentAnalysis, Survey, SurveyResponse } from "../types";
import { authFetch } from "../lib/firebase";
import { useConfirm } from "./ConfirmDialog";
import { needsReanalysis, requestCommentAnalysis } from "../lib/sentiment";
import { AlertTriangle, BrainCircuit, Info, Loader2, RefreshCw, Sparkles } from "lucide-react";

const LOW_CONFIDENCE = 0.6;

interface SentimentAnalysisViewProps {
  responses: SurveyResponse[];
  surveys: Survey[];
  /** Server signature check of the saved results. */
  signatureCheck: "checking" | "done" | "unavailable";
  /** Re-runs comments that were never analyzed or that the fallback handled. */
  onReanalyze: (onProgress: (done: number, total: number) => void) => Promise<{ updated: number; failed: number }>;
}

interface ServiceInfo {
  geminiConfigured: boolean;
  sentimentModel: string;
  promptVersion: string;
  promptReady: boolean;
  signingReady: boolean;
  serverSaveReady?: boolean;
}

const POLARITY_STYLE: Record<string, string> = {
  Positive: "bg-emerald-50 text-emerald-700 border-emerald-200",
  Neutral: "bg-slate-100 text-slate-700 border-slate-300",
  Negative: "bg-rose-50 text-rose-700 border-rose-200",
};

const pct = (n: number, total: number) => (total > 0 ? Math.round((n / total) * 100) : 0);

/** One comment's result, used by the "Try a comment" box and the review lists. */
const ResultBadges: React.FC<{ a: CommentAnalysis }> = ({ a }) => (
  <div className="flex items-center gap-1.5 flex-wrap text-[10px] font-bold">
    {a.analyzable && a.polarity ? (
      <span className={`px-2 py-0.5 rounded-md border ${POLARITY_STYLE[a.polarity]}`}>{a.polarity}</span>
    ) : (
      <span className="px-2 py-0.5 rounded-md border bg-slate-50 text-slate-500 border-slate-200">Not analyzable</span>
    )}
    {a.isSuggestion && (
      <span className="px-2 py-0.5 rounded-md border bg-blue-50 text-blue-700 border-blue-200">Suggestion</span>
    )}
    {a.sarcasmDetected && (
      <span className="px-2 py-0.5 rounded-md border bg-amber-50 text-amber-800 border-amber-200">Sarcasm</span>
    )}
    {a.method === "fallback" ? (
      <span className="px-2 py-0.5 rounded-md border bg-orange-50 text-orange-800 border-orange-300">
        Fallback (word list)
      </span>
    ) : (
      <span className="px-2 py-0.5 rounded-md border bg-indigo-50 text-indigo-700 border-indigo-200">
        Gemini{a.modelVersion ? ` ${a.modelVersion}` : ""} · confidence{" "}
        {a.confidence !== null ? `${Math.round(a.confidence * 100)}%` : "—"}
      </span>
    )}
  </div>
);

export const SentimentAnalysisView: React.FC<SentimentAnalysisViewProps> = ({
  responses,
  surveys,
  signatureCheck,
  onReanalyze,
}) => {
  const { confirm, confirmDialog } = useConfirm();
  const [info, setInfo] = useState<ServiceInfo | null>(null);
  const [tryText, setTryText] = useState("");
  const [tryContext, setTryContext] = useState("");
  const [tryResult, setTryResult] = useState<CommentAnalysis | null>(null);
  const [tryError, setTryError] = useState<string | null>(null);
  const [isTrying, setIsTrying] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [rerunMessage, setRerunMessage] = useState<string | null>(null);

  useEffect(() => {
    authFetch("/api/health")
      .then((r) => r.json())
      .then((d) => setInfo(d))
      .catch(() => setInfo(null));
  }, []);

  const surveyTitle = (id: string | number) => surveys.find((s) => String(s.id) === String(id))?.title || "Unknown survey";

  // Every analyzed comment, with its survey. Respondent names are never shown here.
  const comments = useMemo(
    () =>
      responses.flatMap((r) =>
        r.answers
          .filter((a) => a.analysis)
          .map((a) => ({ text: a.answer, analysis: a.analysis as CommentAnalysis, surveyId: r.surveyId }))
      ),
    [responses]
  );

  const stats = useMemo(() => {
    const analyzable = comments.filter((c) => c.analysis.analyzable && c.analysis.polarity);
    const count = (p: string) => analyzable.filter((c) => c.analysis.polarity === p).length;
    return {
      total: comments.length,
      analyzable: analyzable.length,
      positive: count("Positive"),
      neutral: count("Neutral"),
      negative: count("Negative"),
      notAnalyzable: comments.length - analyzable.length,
      suggestions: analyzable.filter((c) => c.analysis.isSuggestion).length,
      sarcasm: analyzable.filter((c) => c.analysis.sarcasmDetected).length,
      fallback: comments.filter((c) => c.analysis.method === "fallback").length,
      lowConfidence: analyzable.filter(
        (c) => c.analysis.method === "gemini" && c.analysis.confidence !== null && c.analysis.confidence < LOW_CONFIDENCE
      ),
      noComment: responses.filter((r) => r.commentStatus === "no_comment").length,
    };
  }, [comments, responses]);

  const toRerun = responses.filter(needsReanalysis).length;
  const waiting = responses.filter((r) => r.commentStatus === "pending").length;
  const failedSignatures = responses.reduce((n, r) => n + r.answers.filter((a) => a.signatureFailed).length, 0);
  const fallbackComments = comments.filter((c) => c.analysis.method === "fallback");

  const handleTry = async () => {
    if (!tryText.trim()) return;
    setIsTrying(true);
    setTryError(null);
    setTryResult(null);
    const results = await requestCommentAnalysis([{ text: tryText.trim(), context: tryContext.trim() }]);
    setIsTrying(false);
    if (results && results[0]) setTryResult(results[0]);
    else setTryError("The analysis service could not be reached. Please try again.");
  };

  const handleRerun = async () => {
    const ok = await confirm({
      title: `Re-run ${toRerun} response${toRerun === 1 ? "" : "s"}?`,
      message:
        "Their current results (old, fallback or not analyzed) will be replaced by new Gemini results. The old results are kept as history on each response. Results Gemini already produced are never re-run. During your final evaluation, only do this if you mean to.",
      confirmLabel: "Re-run",
    });
    if (!ok) return;
    setRerunMessage(null);
    setProgress({ done: 0, total: toRerun });
    const { updated, failed } = await onReanalyze((done, total) => setProgress({ done, total }));
    setProgress(null);
    setRerunMessage(
      `Re-ran ${updated} response${updated === 1 ? "" : "s"}.` +
        (failed > 0 ? ` ${failed} could not be re-run (service unavailable or survey deleted); try again later.` : "")
    );
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-12">
      {confirmDialog}
      {/* Header + honest explanation */}
      <div className="bg-white p-6 sm:p-8 rounded-3xl border border-slate-200 shadow-xs space-y-4">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-50 text-indigo-700 text-xs font-bold uppercase tracking-wider border border-indigo-200">
          <BrainCircuit className="w-3.5 h-3.5" />
          <span>Sentiment Analysis</span>
        </div>
        <h1 className="font-serif text-2xl sm:text-3xl font-extrabold text-slate-900">How survey comments are analyzed</h1>
        <div className="text-xs sm:text-sm text-slate-600 leading-relaxed space-y-2">
          <p>
            Each comment is sent to <strong>Google Gemini</strong> with fixed written instructions, and Gemini sorts it
            as <strong>Positive</strong>, <strong>Neutral</strong> or <strong>Negative</strong>. This is{" "}
            <strong>zero-shot classification</strong>: Gemini uses its general language knowledge. No model was trained
            on this school's data.
          </p>
          <p>
            Only the comment text and the survey, section and question it belongs to are sent. The respondent's name,
            email and profile are never sent.
          </p>
          <p>
            If Gemini is unavailable, a simple <strong>word list</strong> is used instead. Those results are less
            accurate, are marked <strong>Fallback</strong> everywhere, and can be re-run below.
          </p>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
            <div className="text-slate-500">Model (fixed)</div>
            <div className="font-bold text-slate-900 break-all">{info?.sentimentModel || "—"}</div>
          </div>
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
            <div className="text-slate-500">Instructions</div>
            <div className="font-bold text-slate-900">Prompt {info?.promptVersion || "—"}</div>
          </div>
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
            <div className="text-slate-500">Randomness</div>
            <div className="font-bold text-slate-900">Temperature 0</div>
          </div>
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
            <div className="text-slate-500">Service</div>
            <div className={`font-bold ${info?.geminiConfigured && info?.promptReady ? "text-emerald-700" : "text-rose-700"}`}>
              {!info
                ? "Checking..."
                : !info.geminiConfigured
                ? "Gemini key missing"
                : !info.promptReady
                ? "Prompt file missing"
                : !info.signingReady
                ? "Signing secret missing"
                : !info.serverSaveReady
                ? "Service account key missing"
                : "Ready"}
            </div>
          </div>
        </div>
      </div>

      {/* Overview */}
      <div className="bg-white p-6 sm:p-8 rounded-3xl border border-slate-200 shadow-xs space-y-4">
        <h2 className="font-serif text-lg font-bold text-slate-900">All analyzed comments</h2>
        {stats.total === 0 ? (
          <p className="text-xs text-slate-500">No comments have been analyzed yet.</p>
        ) : (
          <>
            <div className="grid grid-cols-3 gap-2.5">
              {(["positive", "neutral", "negative"] as const).map((key) => {
                const label = key[0].toUpperCase() + key.slice(1);
                return (
                  <div key={key} className={`p-4 rounded-2xl border ${POLARITY_STYLE[label]}`}>
                    <div className="text-2xl font-extrabold">{pct(stats[key], stats.analyzable)}%</div>
                    <div className="text-xs font-bold">
                      {label} ({stats[key]})
                    </div>
                  </div>
                );
              })}
            </div>
            <p className="text-[11px] text-slate-500">
              Percentages are out of {stats.analyzable} analyzable comment{stats.analyzable === 1 ? "" : "s"}.
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                <div className="font-bold text-slate-900">{stats.notAnalyzable}</div>
                <div className="text-slate-500">Not analyzable (empty, joke, nonsense)</div>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                <div className="font-bold text-slate-900">{stats.suggestions}</div>
                <div className="text-slate-500">Suggestions</div>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                <div className="font-bold text-slate-900">{stats.sarcasm}</div>
                <div className="text-slate-500">Sarcasm detected</div>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                <div className="font-bold text-slate-900">{stats.noComment}</div>
                <div className="text-slate-500">Responses with no comment (ratings only)</div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Needs attention: fallback / never analyzed */}
      <div className="bg-white p-6 sm:p-8 rounded-3xl border border-slate-200 shadow-xs space-y-4">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h2 className="font-serif text-lg font-bold text-slate-900">Needs a re-run ({toRerun})</h2>
            <p className="text-xs text-slate-500 mt-1">
              Responses analyzed by the fallback word list, not analyzed because the service was down, saved before this
              version, or whose result failed the signature check. Re-running sends them to Gemini again and replaces the old results.
            </p>
            {waiting > 0 && (
              <p className="text-xs text-amber-800 mt-1">
                {waiting} of these {waiting === 1 ? "is" : "are"} still waiting for the server. It normally finishes within a
                minute; if Gemini is busy it tries again for about 5 minutes. Reload the page first; re-run only the ones
                that stay waiting longer than that.
              </p>
            )}
          </div>
          <button
            type="button"
            disabled={toRerun === 0 || progress !== null}
            onClick={handleRerun}
            className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl flex items-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {progress ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            <span>{progress ? `Re-running ${progress.done} of ${progress.total}...` : "Re-run with Gemini"}</span>
          </button>
        </div>
        {signatureCheck === "checking" && (
          <p className="text-[11px] text-slate-500">Checking result signatures...</p>
        )}
        {signatureCheck === "unavailable" && (
          <p className="text-[11px] font-semibold text-rose-700">
            Could not reach the server to check result signatures, so no results are counted yet. Reload to try again.
          </p>
        )}
        {failedSignatures > 0 && (
          <p className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-[11px] font-semibold text-rose-800">
            {failedSignatures} result{failedSignatures === 1 ? "" : "s"} failed the signature check: changed outside the
            server, saved without a signature, or signed with a different secret. They are not counted anywhere until
            re-run.
          </p>
        )}
        {progress && (
          <p className="text-[11px] text-slate-500">
            This goes slowly on purpose (about one response every 2 seconds) to stay within the usage limit. Please keep
            this page open.
          </p>
        )}
        {rerunMessage && <p className="text-xs font-semibold text-slate-700">{rerunMessage}</p>}
        {fallbackComments.length > 0 && (
          <div className="space-y-2">
            {fallbackComments.slice(0, 30).map((c, i) => (
              <div key={i} className="p-3 rounded-xl bg-orange-50/40 border border-orange-200 space-y-1.5">
                <p className="text-xs text-slate-800">"{c.text}"</p>
                <p className="text-[10px] text-slate-500">{surveyTitle(c.surveyId)}</p>
                <ResultBadges a={c.analysis} />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Low confidence */}
      <div className="bg-white p-6 sm:p-8 rounded-3xl border border-slate-200 shadow-xs space-y-4">
        <div>
          <h2 className="font-serif text-lg font-bold text-slate-900">
            Low-confidence results ({stats.lowConfidence.length})
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Gemini was less than {Math.round(LOW_CONFIDENCE * 100)}% sure. These are worth reading yourself.
          </p>
        </div>
        {stats.lowConfidence.length === 0 ? (
          <p className="text-xs text-slate-500">None.</p>
        ) : (
          <div className="space-y-2">
            {stats.lowConfidence.slice(0, 50).map((c, i) => (
              <div key={i} className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-1.5">
                <p className="text-xs text-slate-800">"{c.text}"</p>
                <p className="text-[10px] text-slate-500">
                  {surveyTitle(c.surveyId)} · Why: {c.analysis.reason || "—"}
                </p>
                <ResultBadges a={c.analysis} />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Try a comment */}
      <div className="bg-white p-6 sm:p-8 rounded-3xl border border-slate-200 shadow-xs space-y-4">
        <div>
          <h2 className="font-serif text-lg font-bold text-slate-900 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-indigo-600" /> Try a comment
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Uses the same model and instructions as real responses. Nothing is saved. Each try uses a little of the
            Gemini usage limit.
          </p>
        </div>
        <textarea
          rows={3}
          maxLength={2000}
          value={tryText}
          onChange={(e) => setTryText(e.target.value)}
          placeholder="e.g. Ang bait ni sir pero sobrang bilis magturo, di namin masundan."
          className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm focus:outline-hidden focus:border-indigo-400"
        />
        <input
          type="text"
          maxLength={200}
          value={tryContext}
          onChange={(e) => setTryContext(e.target.value)}
          placeholder="Optional context, e.g. Course evaluation | Question: Comments about the teacher"
          className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-hidden focus:border-indigo-400"
        />
        <button
          type="button"
          disabled={isTrying || !tryText.trim()}
          onClick={handleTry}
          className="px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl flex items-center gap-2 cursor-pointer disabled:opacity-50"
        >
          {isTrying ? <Loader2 className="w-4 h-4 animate-spin" /> : <BrainCircuit className="w-4 h-4" />}
          <span>{isTrying ? "Analyzing..." : "Analyze"}</span>
        </button>
        {tryError && (
          <p className="text-xs font-semibold text-rose-700 flex items-center gap-1.5">
            <AlertTriangle className="w-4 h-4" /> {tryError}
          </p>
        )}
        {tryResult && (
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2 text-xs">
            <ResultBadges a={tryResult} />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1 text-slate-700">
              <div>Display label: <strong>{tryResult.sentiment || "—"}</strong></div>
              <div>Score: <strong>{tryResult.score ?? "—"}</strong></div>
              <div>Language: <strong>{tryResult.language}</strong></div>
              <div>Emotion: <strong>{tryResult.emotion}</strong></div>
              <div className="sm:col-span-2">Keywords: <strong>{tryResult.keywords.join(", ") || "—"}</strong></div>
              {tryResult.englishTranslation && (
                <div className="sm:col-span-2">English: <em>{tryResult.englishTranslation}</em></div>
              )}
              <div className="sm:col-span-2">Why: {tryResult.reason || "—"}</div>
              <div className="sm:col-span-2 text-[11px] text-slate-500">
                {tryResult.method === "gemini"
                  ? `Model ${tryResult.model} (version ${tryResult.modelVersion || "not reported"})`
                  : "Word-list fallback"}{" "}
                · prompt{" "}
                {tryResult.promptVersion}
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="p-4 rounded-2xl bg-blue-50 border border-blue-200 text-xs text-blue-900 flex items-start gap-2">
        <Info className="w-4 h-4 shrink-0 mt-0.5" />
        <span>
          Accuracy has not been measured yet. The evaluation (human labels, Cohen's kappa, accuracy, macro-F1 and a
          confusion matrix) is a later step.
        </span>
      </div>
    </div>
  );
};

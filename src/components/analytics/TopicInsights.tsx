import React, { useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, Copy, Lightbulb, Loader2, Shuffle, Sparkles, TrendingDown, TrendingUp } from "lucide-react";
import { authFetch } from "../../lib/firebase";
import { Survey, SurveyResponse } from "../../types";
import { interpretRating, percent } from "../../lib/analytics";
import {
  GETTING_WORSE_DROP,
  IMPROVING_RISE,
  MIN_COMMENTS_FOR_PERCENT,
  MIXED_MIN_AVERAGE,
  NEEDS_ATTENTION_AVERAGE,
  NEEDS_ATTENTION_NEGATIVE_PCT,
  STRENGTH_AVERAGE,
  STRENGTH_POSITIVE_PCT,
  Recommendation,
  TopicLabel,
  recommendationsFor,
  summaryFor,
  topicInsights,
} from "../../lib/recommendations";
import { SENTIMENT_COLORS, fmtPct } from "./AnalyticsParts";

interface Props {
  survey: Survey;
  /** Responses in the chosen period. */
  responses: SurveyResponse[];
  periodLabel: string;
  /** The period just before (same kind), for "getting worse"; null for All time and custom dates. */
  previous: { label: string; responses: SurveyResponse[] } | null;
}

const LABELS: Record<TopicLabel, { text: string; icon: typeof AlertTriangle; className: string }> = {
  needs_attention: { text: "Needs attention", icon: AlertTriangle, className: "bg-red-50 text-red-800 border-red-200" },
  getting_worse: { text: "Getting worse", icon: TrendingDown, className: "bg-amber-50 text-amber-900 border-amber-200" },
  mixed_signals: { text: "Mixed signals", icon: Shuffle, className: "bg-violet-50 text-violet-800 border-violet-200" },
  improving: { text: "Improving", icon: TrendingUp, className: "bg-sky-50 text-sky-800 border-sky-200" },
  strength: { text: "Strength", icon: CheckCircle2, className: "bg-blue-50 text-blue-800 border-blue-200" },
};

interface Wording {
  /** By position in the recommendations list. */
  items: { suggestion: string | null; problem?: string }[];
  generatedAt: number;
  modelVersion: string | null;
  promptVersion: string;
}

/** Up to 3 recent negative comments of a finding's topic (text only), for the AI wording. */
function exampleComments(survey: Survey, responses: SurveyResponse[], r: Recommendation): string[] {
  if (r.label !== "needs_attention" && r.label !== "mixed_signals") return [];
  const indexes = survey.questions
    .map((q, i) => (q.type === "paragraph" && (r.blockId === null || q.blockId === r.blockId) ? i : -1))
    .filter((i) => i >= 0);
  return [...responses]
    .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0))
    .flatMap((resp) => indexes.map((i) => resp.answers[i]))
    .filter((a) => a?.analysis?.polarity === "Negative")
    .map((a) => (a!.answer || "").trim())
    .filter(Boolean)
    .slice(0, 3);
}

function LabelChip({ label }: { label: TopicLabel }) {
  const { text, icon: Icon, className } = LABELS[label];
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[11px] font-bold ${className}`}>
      <Icon className="w-3.5 h-3.5" />
      {text}
    </span>
  );
}

export const TopicInsights: React.FC<Props> = ({ survey, responses, periodLabel, previous }) => {
  const insights = useMemo(() => topicInsights(survey, responses, previous), [survey, responses, previous]);
  const recommendations = useMemo(() => recommendationsFor(insights), [insights]);
  const summary = useMemo(() => summaryFor(survey, responses, periodLabel, insights), [survey, responses, periodLabel, insights]);
  const hasTopics = (survey.topicBlocks || []).length > 0;

  // Optional AI wording: shown, never saved; cleared whenever the findings change.
  const [wording, setWording] = useState<Wording | null>(null);
  const [wordingBusy, setWordingBusy] = useState(false);
  const [wordingError, setWordingError] = useState<string | null>(null);
  const [copied, setCopied] = useState<number | null>(null);
  useEffect(() => {
    setWording(null);
    setWordingError(null);
  }, [recommendations]);

  const askWording = async () => {
    setWordingBusy(true);
    setWordingError(null);
    try {
      const res = await authFetch("/api/recommendations/wording", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          surveyTitle: survey.title,
          period: periodLabel,
          findings: recommendations.map((r) => ({
            label: LABELS[r.label].text,
            topic: r.topic,
            sentence: r.sentence,
            evidence: r.evidence,
            comments: exampleComments(survey, responses, r),
          })),
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.success) throw new Error(data?.error || "Could not get AI wording now.");
      setWording({
        items: data.items,
        generatedAt: data.generatedAt,
        modelVersion: data.modelVersion,
        promptVersion: data.promptVersion,
      });
    } catch (err: any) {
      setWordingError(err?.message || "Could not get AI wording now.");
    } finally {
      setWordingBusy(false);
    }
  };

  const copy = async (i: number, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(i);
      setTimeout(() => setCopied((c) => (c === i ? null : c)), 1500);
    } catch {
      setWordingError("Could not copy. Select the text and copy it instead.");
    }
  };

  return (
    <div className="space-y-5">
      {/* Summary */}
      <div className="p-5 rounded-2xl bg-indigo-50/60 border border-indigo-100 space-y-2">
        <p className="text-[11px] font-bold uppercase tracking-wide text-indigo-700">Summary · {periodLabel}</p>
        {summary.map((line, i) => (
          <p key={i} className={i === 0 ? "text-sm text-slate-800" : "text-sm font-semibold text-slate-900"}>
            {line}
          </p>
        ))}
      </div>

      {/* Recommendations */}
      <div className="p-5 rounded-2xl bg-white border border-slate-200 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Lightbulb className="w-4 h-4 text-indigo-600" />
            <h3 className="text-sm font-bold text-slate-800">Recommendations</h3>
          </div>
          {recommendations.length > 0 && (
            <button
              type="button"
              onClick={askWording}
              disabled={wordingBusy}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white border border-violet-200 text-xs font-semibold text-violet-800 hover:bg-violet-50 disabled:opacity-60 cursor-pointer"
            >
              {wordingBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              {wording ? "New AI-suggested wording" : "AI-suggested wording"}
            </button>
          )}
        </div>
        {wordingError && (
          <p className="px-3 py-2 rounded-xl bg-rose-50 border border-rose-100 text-xs text-rose-700">{wordingError}</p>
        )}
        {wording && (
          <p className="text-[11px] text-slate-500">
            AI-suggested wording by Gemini {wording.modelVersion || ""} (prompt {wording.promptVersion}),{" "}
            {new Date(wording.generatedAt).toLocaleString("en-US")}. It only rewords the findings; the rule-based text above
            each one is the official result. Not saved.
          </p>
        )}
        {recommendations.length === 0 ? (
          <p className="text-sm text-slate-500">
            Nothing to flag in this period: no {hasTopics ? "topic" : "result"} met the rules for a strength or a problem.
          </p>
        ) : (
          <ul className="space-y-3">
            {recommendations.map((r, i) => (
              <li key={i} className="p-3 rounded-xl border border-slate-100 bg-slate-50/60 space-y-1.5">
                <LabelChip label={r.label} />
                <p className="text-sm font-semibold text-slate-900">{r.sentence}</p>
                {r.evidence && <p className="text-xs text-slate-600">{r.evidence}</p>}
                <p className="text-xs text-slate-700">
                  <span className="font-bold">Suggested next step:</span> {r.nextStep}
                </p>
                {wording?.items[i] &&
                  (wording.items[i].suggestion ? (
                    <div className="mt-1 p-2.5 rounded-lg bg-violet-50 border border-violet-100 space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-violet-700">
                          <Sparkles className="w-3 h-3" />
                          AI-suggested wording
                        </span>
                        <button
                          type="button"
                          onClick={() => copy(i, wording.items[i].suggestion as string)}
                          className="inline-flex items-center gap-1 text-[11px] font-semibold text-violet-700 hover:underline cursor-pointer"
                        >
                          <Copy className="w-3 h-3" />
                          {copied === i ? "Copied" : "Copy"}
                        </button>
                      </div>
                      <p className="text-xs text-slate-800">{wording.items[i].suggestion}</p>
                    </div>
                  ) : (
                    <p className="mt-1 text-[11px] text-slate-500 italic">{wording.items[i].problem}</p>
                  ))}
              </li>
            ))}
          </ul>
        )}
        <details className="text-xs text-slate-500">
          <summary className="cursor-pointer font-semibold">How these are decided</summary>
          <ul className="mt-2 space-y-1 list-disc pl-5">
            <li>
              Needs attention: average {NEEDS_ATTENTION_AVERAGE.toFixed(2)} or lower (Fair or Poor), or{" "}
              {NEEDS_ATTENTION_NEGATIVE_PCT}% or more negative comments while the average is below {MIXED_MIN_AVERAGE.toFixed(2)}.
            </li>
            <li>
              Mixed signals: average {MIXED_MIN_AVERAGE.toFixed(2)} or higher (Very Good or better), but{" "}
              {NEEDS_ATTENTION_NEGATIVE_PCT}% or more negative comments.
            </li>
            <li>
              Improving: the average rose by {IMPROVING_RISE} or more since the previous period of the same kind.
            </li>
            <li>
              Strength: average {STRENGTH_AVERAGE.toFixed(2)} or higher (Outstanding), and {STRENGTH_POSITIVE_PCT}% or more
              positive comments.
            </li>
            <li>
              Getting worse: the average dropped by {GETTING_WORSE_DROP} or more since the previous period of the same kind
              (not available for All time or custom dates).
            </li>
            <li>
              Comment percentages are used only when a topic has at least {MIN_COMMENTS_FOR_PERCENT} analyzed comments, and
              a topic's average only with at least 5 ratings.
            </li>
            <li>The rating cut-offs follow the common 1–5 interpretation scale; the comment percentages and the 0.5 drop are set by the researcher.</li>
            <li>Fixed rules, no AI. Common words come from the keywords Gemini picked for each negative comment.</li>
          </ul>
        </details>
      </div>

      {/* By topic */}
      {hasTopics && (
        <div className="space-y-2">
          <h3 className="text-sm font-bold text-slate-800">By topic · {periodLabel}</h3>
          <ul className="divide-y divide-slate-100 border border-slate-200 rounded-2xl bg-white">
            {insights.map((t) => {
              const s = t.sentiment;
              return (
                <li key={t.blockId || t.title} className="px-4 py-3 space-y-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-bold text-slate-900">{t.title}</span>
                    {t.labels.map((l) => (
                      <LabelChip key={l} label={l} />
                    ))}
                  </div>
                  <div className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-slate-700">
                    <span>
                      Rating:{" "}
                      {t.average !== null ? (
                        <>
                          <strong>{t.average.toFixed(2)}</strong> {interpretRating(t.average)} (n = {t.ratingN})
                        </>
                      ) : t.ratingN > 0 ? (
                        <span className="text-slate-500">only {t.ratingN} rating(s), need 5</span>
                      ) : (
                        <span className="text-slate-500">no rating questions</span>
                      )}
                    </span>
                    {t.previous && t.previous.average !== null && t.average !== null && (
                      <span>
                        {t.average - t.previous.average >= 0 ? "▲" : "▼"} {Math.abs(t.average - t.previous.average).toFixed(2)} vs{" "}
                        {t.previous.label}
                      </span>
                    )}
                    <span className="inline-flex flex-wrap items-center gap-x-2">
                      Comments:{" "}
                      {s.analyzed === 0 ? (
                        <span className="text-slate-500">none analyzed</span>
                      ) : (
                        (["positive", "neutral", "negative"] as const).map((k) => (
                          <span key={k} className="inline-flex items-center gap-1">
                            <span className="w-2 h-2 rounded-sm" style={{ backgroundColor: SENTIMENT_COLORS[k] }} />
                            {k[0].toUpperCase() + k.slice(1)} {fmtPct(percent(s[k], s.analyzed))}
                          </span>
                        ))
                      )}
                      {s.analyzed > 0 && (
                        <span className="text-slate-400">
                          ({s.analyzed}
                          {s.fallback > 0 ? `, ${s.fallback} fallback` : ""}
                          {!t.commentsCount ? `; under ${MIN_COMMENTS_FOR_PERCENT}, not used for labels` : ""})
                        </span>
                      )}
                    </span>
                  </div>
                  {t.negativeWords.length > 0 && (
                    <p className="text-xs text-slate-500">
                      Common words in negative comments: {t.negativeWords.map((w) => `${w.word} (${w.comments})`).join(", ")}
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
};

export default TopicInsights;

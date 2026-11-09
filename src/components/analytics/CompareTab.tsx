import React, { useEffect, useMemo, useState } from "react";
import { Info } from "lucide-react";
import { Survey, SurveyResponse } from "../../types";
import {
  ComparedRow,
  SurveyStats,
  interpretRating,
  percent,
  responsesForSurvey,
  sameQuestions,
  sharedTopics,
  surveyStats,
} from "../../lib/analytics";
import { SampleNotice, SentimentBar, SentimentFootnote, StatCard, fmtPct } from "./AnalyticsParts";

interface Props {
  /** Only the surveys the viewer may see: owners their own, the admin all. */
  surveys: Survey[];
  responses: SurveyResponse[];
}

const selectClass =
  "w-full px-3 py-2 rounded-xl border border-slate-200 text-sm text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-200";

function SideSummary({ name, stats }: { name: string; stats: SurveyStats }) {
  const usable = stats.level !== "insufficient";
  return (
    <div className="space-y-3 min-w-0">
      <p className="text-sm font-bold text-slate-800 truncate" title={name}>
        {name}
      </p>
      <SampleNotice level={stats.level} n={stats.responses} />
      <div className="grid grid-cols-2 gap-3">
        <StatCard label="Responses">{stats.responses}</StatCard>
        <StatCard label="Average rating">
          {usable && stats.averageRating !== null ? (
            <span>
              {stats.averageRating.toFixed(2)}
              <span className="block text-xs font-semibold text-slate-500">{interpretRating(stats.averageRating)}</span>
            </span>
          ) : (
            "—"
          )}
        </StatCard>
      </div>
      {usable && (
        <div className="p-4 rounded-2xl bg-white border border-slate-200 space-y-2">
          <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Comment sentiment</p>
          <SentimentBar counts={stats.sentiment} />
          <SentimentFootnote counts={stats.sentiment} />
        </div>
      )}
    </div>
  );
}

function Value({ v }: { v: { average: number | null; n: number } }) {
  if (v.average === null) {
    return <span className="text-slate-400">{v.n > 0 ? `n = ${v.n}, need 5` : "—"}</span>;
  }
  return (
    <span>
      <strong>{v.average.toFixed(2)}</strong> <span className="text-slate-500">(n = {v.n})</span>
    </span>
  );
}

function ComparedTable({ title, note, rows }: { title: string; note: string; rows: ComparedRow[] }) {
  return (
    <div className="space-y-2">
      <h3 className="text-sm font-bold text-slate-800">{title}</h3>
      <p className="text-xs text-slate-500">{note}</p>
      <div className="border border-slate-200 rounded-2xl bg-white overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-[11px] uppercase tracking-wide text-slate-500 border-b border-slate-100">
              <th className="px-4 py-2 font-bold">Item</th>
              <th className="px-4 py-2 font-bold whitespace-nowrap">Survey A</th>
              <th className="px-4 py-2 font-bold whitespace-nowrap">Survey B</th>
              <th className="px-4 py-2 font-bold whitespace-nowrap">B vs A</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((r, i) => {
              const diff = r.a.average !== null && r.b.average !== null ? r.b.average - r.a.average : null;
              return (
                <tr key={i}>
                  <td className="px-4 py-2.5 text-slate-800 min-w-[12rem]">{r.label}</td>
                  <td className="px-4 py-2.5 whitespace-nowrap">
                    <Value v={r.a} />
                  </td>
                  <td className="px-4 py-2.5 whitespace-nowrap">
                    <Value v={r.b} />
                  </td>
                  <td className="px-4 py-2.5 whitespace-nowrap">
                    {diff === null ? (
                      <span className="text-slate-400">—</span>
                    ) : Math.abs(diff) < 0.005 ? (
                      <span className="text-slate-500">No change</span>
                    ) : (
                      <span className={diff > 0 ? "text-blue-700 font-semibold" : "text-red-700 font-semibold"}>
                        {diff > 0 ? "▲" : "▼"} {Math.abs(diff).toFixed(2)}
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export const CompareTab: React.FC<Props> = ({ surveys, responses }) => {
  const [aId, setAId] = useState(surveys[1] ? String(surveys[1].id) : "");
  const [bId, setBId] = useState(surveys[0] ? String(surveys[0].id) : "");

  // Keep both choices valid if the survey list changes.
  useEffect(() => {
    const ids = surveys.map((s) => String(s.id));
    if (!ids.includes(aId)) setAId(ids[1] || ids[0] || "");
    if (!ids.includes(bId)) setBId(ids[0] || "");
  }, [surveys, aId, bId]);

  const a = surveys.find((s) => String(s.id) === aId) || null;
  const b = surveys.find((s) => String(s.id) === bId) || null;

  const result = useMemo(() => {
    if (!a || !b || a.id === b.id) return null;
    const ra = responsesForSurvey(responses, a);
    const rb = responsesForSurvey(responses, b);
    const sa = surveyStats(a, ra);
    const sb = surveyStats(b, rb);
    const bothUsable = sa.level !== "insufficient" && sb.level !== "insufficient";
    return {
      sa,
      sb,
      bothUsable,
      topics: bothUsable ? sharedTopics(a, ra, b, rb) : [],
      questions: bothUsable ? sameQuestions(a, ra, b, rb) : [],
    };
  }, [a, b, responses]);

  if (surveys.length < 2) {
    return (
      <p className="flex items-start gap-2 text-sm text-slate-600">
        <Info className="w-4 h-4 mt-0.5 shrink-0" />
        You need at least two surveys that have gone live to compare them.
      </p>
    );
  }

  const option = (s: Survey) => (
    <option key={String(s.id)} value={String(s.id)}>
      {s.title} ({s.status})
    </option>
  );

  const s = result?.sa.sentiment;
  const t = result?.sb.sentiment;

  return (
    <div className="space-y-5">
      <div className="p-4 rounded-2xl bg-white border border-slate-200 grid grid-cols-1 md:grid-cols-2 gap-3">
        <label className="block space-y-1">
          <span className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Survey A</span>
          <select value={aId} onChange={(e) => setAId(e.target.value)} className={selectClass}>
            {surveys.map(option)}
          </select>
        </label>
        <label className="block space-y-1">
          <span className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Survey B</span>
          <select value={bId} onChange={(e) => setBId(e.target.value)} className={selectClass}>
            {surveys.map(option)}
          </select>
        </label>
        <p className="md:col-span-2 text-xs text-slate-500">
          Each survey over all its time. Sentiment is shown as percentages, so surveys with different numbers of responses
          compare fairly.
        </p>
      </div>

      {!a || !b ? null : a.id === b.id ? (
        <p className="text-sm text-slate-500">Pick two different surveys.</p>
      ) : result ? (
        <>
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
            <SideSummary name={`A: ${a.title}`} stats={result.sa} />
            <SideSummary name={`B: ${b.title}`} stats={result.sb} />
          </div>

          {result.bothUsable && s && t && (
            <div className="p-4 rounded-2xl bg-indigo-50/60 border border-indigo-100 text-sm text-slate-800 space-y-1">
              <p className="text-[11px] font-bold uppercase tracking-wide text-indigo-700">At a glance</p>
              {result.sa.averageRating !== null && result.sb.averageRating !== null && (
                <p>
                  Average rating: {result.sa.averageRating.toFixed(2)} (A) vs {result.sb.averageRating.toFixed(2)} (B),{" "}
                  {Math.abs(result.sb.averageRating - result.sa.averageRating) < 0.005
                    ? "the same."
                    : `${result.sb.averageRating > result.sa.averageRating ? "higher" : "lower"} in B by ${Math.abs(
                        result.sb.averageRating - result.sa.averageRating
                      ).toFixed(2)}.`}
                </p>
              )}
              {s.analyzed > 0 && t.analyzed > 0 && (
                <p>
                  Negative comments: {fmtPct(percent(s.negative, s.analyzed))} (A) vs {fmtPct(percent(t.negative, t.analyzed))}{" "}
                  (B); positive: {fmtPct(percent(s.positive, s.analyzed))} (A) vs {fmtPct(percent(t.positive, t.analyzed))} (B).
                </p>
              )}
              <p className="text-xs text-slate-500">
                Different surveys can have different respondents and questions; compare like with like.
              </p>
            </div>
          )}

          {result.bothUsable && (
            <>
              {result.topics.length > 0 ? (
                <ComparedTable
                  title="By shared topic"
                  note="Topics both surveys use (the same admin topic). Averages need at least 5 ratings."
                  rows={result.topics}
                />
              ) : (
                <p className="text-xs text-slate-500">These surveys share no topics with rating questions.</p>
              )}
              {result.questions.length > 0 ? (
                <ComparedTable
                  title="By same question"
                  note="Rating questions worded the same in both surveys, for example a survey and its copy."
                  rows={result.questions}
                />
              ) : (
                <p className="text-xs text-slate-500">These surveys have no rating questions worded the same.</p>
              )}
            </>
          )}
        </>
      ) : null}
    </div>
  );
};

export default CompareTab;

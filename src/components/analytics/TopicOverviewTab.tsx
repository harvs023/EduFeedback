import React, { useMemo, useState } from "react";
import { ChevronDown, ChevronRight, Download, Info } from "lucide-react";
import type { AcademicYearTerms, Survey, SurveyResponse, Topic } from "../../types";
import {
  MIN_RESPONSES,
  type PeriodSpec,
  interpretRating,
  inPeriod,
  percent,
  periodKey,
  periodLabel,
  periodOptions,
  previousPeriod,
  responsesForSurvey,
} from "../../lib/analytics";
import { MIN_COMMENTS_FOR_PERCENT } from "../../lib/recommendations";
import { topicQuestionsCsv, topicsAcrossSurveys, topicTableCsv, type TopicRow } from "../../lib/topicAnalytics";
import { SENTIMENT_COLORS, SentimentBar, StatCard, fmtPct } from "./AnalyticsParts";

interface Props {
  surveys: Survey[];
  responses: SurveyResponse[];
  topics: Topic[];
  calendar: AcademicYearTerms[];
  onOpenSurvey: (id: string) => void;
}

type Kind = "all" | "year" | "semester";

/** Change in mean vs the previous period of the same kind, when both have enough responses. */
function changeText(now: TopicRow, before: TopicRow | undefined): React.ReactNode {
  if (!before || now.average === null || before.average === null) return <span className="text-slate-400">–</span>;
  if (now.level === "insufficient" || before.level === "insufficient") return <span className="text-slate-400">–</span>;
  const diff = now.average - before.average;
  if (Math.abs(diff) < 0.005) return <span className="text-slate-500">no change</span>;
  return <span className={diff > 0 ? "text-blue-700" : "text-red-700"}>{diff > 0 ? "▲" : "▼"} {Math.abs(diff).toFixed(2)}</span>;
}

/**
 * Results per topic across the viewer's surveys (the admin: all live surveys; everyone else: only
 * their own), with a table and charts. Only rating answers under the same topic are combined (see
 * topicAnalytics.ts); whole surveys are never averaged together.
 */
export const TopicOverviewTab: React.FC<Props> = ({ surveys, responses, topics, calendar, onOpenSurvey }) => {
  const [kind, setKind] = useState<Kind>("all");
  const options = useMemo(() => periodOptions(kind, responses, calendar), [kind, responses, calendar]);
  const [chosen, setChosen] = useState<string>("all");
  const period: PeriodSpec = options.find((o) => periodKey(o) === chosen) || options[0] || { kind: "all" };
  const prev = previousPeriod(period, options);
  const [openRows, setOpenRows] = useState<Set<string>>(new Set());
  const toggleRow = (id: string) =>
    setOpenRows((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const rows = useMemo(() => topicsAcrossSurveys(surveys, responses, topics, period, calendar), [surveys, responses, topics, period, calendar]);
  const prevRows = useMemo(
    () => (prev ? topicsAcrossSurveys(surveys, responses, topics, prev, calendar) : []),
    [surveys, responses, topics, prev, calendar]
  );
  const periodResponses = useMemo(
    () => surveys.flatMap((s) => responsesForSurvey(responses, s)).filter((r) => inPeriod(r, period, calendar)),
    [surveys, responses, period, calendar]
  );
  const surveysWithData = new Set(periodResponses.map((r) => String(r.surveyId))).size;

  const charted = rows.filter((r) => r.level !== "insufficient" && r.average !== null);
  const byMean = [...charted].sort((a, b) => (b.average ?? 0) - (a.average ?? 0));
  const withComments = rows.filter((r) => r.level !== "insufficient" && r.sentiment.analyzed >= MIN_COMMENTS_FOR_PERCENT);

  const download = (csv: string, name: string) => {
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `EduFeedback_${name}_${periodLabel(period).replace(/[^A-Za-z0-9]+/g, "_")}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-5">
      {/* Period picker */}
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={kind}
          onChange={(e) => {
            setKind(e.target.value as Kind);
            setChosen("");
          }}
          className="px-3 py-2 rounded-xl border border-slate-200 bg-white text-sm"
          aria-label="Kind of period"
        >
          <option value="all">All time</option>
          <option value="year">Per school year</option>
          <option value="semester">Per semester</option>
        </select>
        {kind !== "all" && (
          <select
            value={periodKey(period)}
            onChange={(e) => setChosen(e.target.value)}
            className="px-3 py-2 rounded-xl border border-slate-200 bg-white text-sm"
            aria-label="Period"
          >
            {options.map((o) => (
              <option key={periodKey(o)} value={periodKey(o)}>
                {periodLabel(o)}
              </option>
            ))}
          </select>
        )}
        {kind === "semester" && options.length === 0 && (
          <span className="text-xs text-slate-500">No semesters yet: the admin enters them in Review Center &gt; Academic Calendar.</span>
        )}
        <div className="ml-auto flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => download(topicTableCsv(rows, periodLabel(period), interpretRating), "by_topic")}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
          >
            <Download className="w-4 h-4" /> Export table (CSV)
          </button>
          <button
            type="button"
            onClick={() => download(topicQuestionsCsv(rows, periodLabel(period), interpretRating, MIN_RESPONSES), "questions_by_topic")}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
          >
            <Download className="w-4 h-4" /> Export questions (CSV)
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <StatCard label="Topics with answers">{rows.length}</StatCard>
        <StatCard label="Surveys with responses">{surveysWithData}</StatCard>
        <StatCard label="Responses">{periodResponses.length}</StatCard>
      </div>

      <div className="flex items-start gap-2 px-4 py-3 rounded-2xl bg-slate-50 border border-slate-200 text-xs text-slate-600">
        <Info className="w-4 h-4 mt-0.5 shrink-0 text-slate-500" />
        <span>
          {periodLabel(period)}. Each topic combines the rating answers of every survey that uses it: each respondent's own
          average over the topic's questions in one survey counts once. Whole surveys are not averaged together. The
          surveys have different respondents and dates, so these are descriptive results only. A topic needs at least{" "}
          {MIN_RESPONSES} responses to show numbers; under 30 it is marked as a small sample.
        </span>
      </div>

      {rows.length === 0 ? (
        <p className="py-10 text-center text-sm text-slate-500 bg-white border border-slate-200 rounded-2xl">
          No answers under any topic in this period.
        </p>
      ) : (
        <>
          {/* Chart 1: mean rating per topic */}
          <section className="p-4 sm:p-5 rounded-2xl bg-white border border-slate-200 space-y-3">
            <h3 className="text-sm font-bold text-slate-900">Mean rating per topic (1 to 5)</h3>
            {byMean.length === 0 ? (
              <p className="text-xs text-slate-500">No topic has {MIN_RESPONSES} or more responses in this period yet.</p>
            ) : (
              <div className="space-y-2" role="img" aria-label="Bar chart of the mean rating per topic; the same numbers are in the table below.">
                {byMean.map((r) => {
                  const avg = r.average as number;
                  const width = ((avg - 1) / 4) * 100;
                  return (
                    <div key={r.topicId} className="grid grid-cols-[minmax(0,8rem)_1fr_6.5rem] sm:grid-cols-[minmax(0,12rem)_1fr_8rem] items-center gap-3 text-sm">
                      <span className="truncate text-slate-700" title={r.topicName}>
                        {r.topicName}
                      </span>
                      <div className="h-3 rounded-full bg-slate-100" title={`${r.topicName}: ${avg.toFixed(2)} (${interpretRating(avg)}), n = ${r.n}`}>
                        <div className="h-full rounded-full bg-indigo-500" style={{ width: `${Math.max(width, 2)}%` }} />
                      </div>
                      <span className="text-right tabular-nums text-slate-800">
                        <strong>{avg.toFixed(2)}</strong>
                        {r.level === "small" && <span className="text-amber-700 font-bold">*</span>}{" "}
                        <span className="text-xs text-slate-500">{interpretRating(avg)}</span>
                      </span>
                    </div>
                  );
                })}
                <div className="grid grid-cols-[minmax(0,8rem)_1fr_6.5rem] sm:grid-cols-[minmax(0,12rem)_1fr_8rem] gap-3 text-[10px] text-slate-400">
                  <span />
                  <span className="flex justify-between">
                    <span>1</span>
                    <span>2</span>
                    <span>3</span>
                    <span>4</span>
                    <span>5</span>
                  </span>
                  <span />
                </div>
                {byMean.some((r) => r.level === "small") && (
                  <p className="text-[11px] text-amber-800">* Small sample (fewer than 30 responses), read with caution.</p>
                )}
              </div>
            )}
          </section>

          {/* Chart 2: sentiment per topic */}
          <section className="p-4 sm:p-5 rounded-2xl bg-white border border-slate-200 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-bold text-slate-900">Comment sentiment per topic</h3>
              <span className="flex gap-3 text-xs text-slate-600">
                {(["positive", "neutral", "negative"] as const).map((k) => (
                  <span key={k} className="inline-flex items-center gap-1">
                    <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: SENTIMENT_COLORS[k] }} />
                    {k[0].toUpperCase() + k.slice(1)}
                  </span>
                ))}
              </span>
            </div>
            {withComments.length === 0 ? (
              <p className="text-xs text-slate-500">
                No topic has {MIN_COMMENTS_FOR_PERCENT} or more analyzed comments in this period yet.
              </p>
            ) : (
              <div className="space-y-3">
                {withComments.map((r) => (
                  <div key={r.topicId} className="grid grid-cols-1 sm:grid-cols-[minmax(0,12rem)_1fr] gap-x-3 gap-y-1 items-center">
                    <span className="text-sm text-slate-700 truncate" title={r.topicName}>
                      {r.topicName} <span className="text-xs text-slate-400">({r.sentiment.analyzed})</span>
                    </span>
                    <SentimentBar counts={r.sentiment} compact />
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Table */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-slate-500">Click a topic to see the surveys and the questions grouped under it.</p>
            <button
              type="button"
              onClick={() => setOpenRows(openRows.size === rows.length ? new Set() : new Set(rows.map((r) => r.topicId)))}
              className="text-xs font-bold text-indigo-700 hover:underline cursor-pointer"
            >
              {openRows.size === rows.length ? "Hide all questions" : "Show all questions"}
            </button>
          </div>
          <section className="rounded-2xl bg-white border border-slate-200 overflow-x-auto">
            <table className="w-full text-sm min-w-[720px]">
              <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="text-left px-4 py-2.5">Topic</th>
                  <th className="text-right px-3 py-2.5">Surveys</th>
                  <th className="text-right px-3 py-2.5">n</th>
                  <th className="text-left px-3 py-2.5">Mean rating</th>
                  <th className="text-left px-3 py-2.5">Positive / Neutral / Negative</th>
                  <th className="text-left px-3 py-2.5">{prev ? `vs ${periodLabel(prev)}` : "Change"}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((r) => {
                  const enough = r.level !== "insufficient";
                  const s = r.sentiment;
                  const isOpen = openRows.has(r.topicId);
                  return (
                    <React.Fragment key={r.topicId}>
                      <tr className="hover:bg-slate-50 cursor-pointer" onClick={() => toggleRow(r.topicId)}>
                        <td className="px-4 py-2.5 font-semibold text-slate-900">
                          <span className="inline-flex items-center gap-1">
                            {isOpen ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
                            {r.topicName}
                            {r.retired && <span className="text-[10px] font-bold uppercase text-slate-400 ml-1">retired</span>}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 text-right tabular-nums">{r.surveys}</td>
                        <td className="px-3 py-2.5 text-right tabular-nums">{r.n}</td>
                        {!enough ? (
                          <td colSpan={3} className="px-3 py-2.5 text-xs text-slate-500">
                            Not enough responses to analyze yet ({r.n} of {MIN_RESPONSES})
                          </td>
                        ) : (
                          <>
                            <td className="px-3 py-2.5">
                              {r.average === null ? (
                                <span className="text-slate-400">No ratings</span>
                              ) : (
                                <>
                                  <strong>{r.average.toFixed(2)}</strong>{" "}
                                  <span className="text-xs text-slate-500">{interpretRating(r.average)}</span>
                                </>
                              )}
                              {r.level === "small" && (
                                <span className="ml-1.5 text-[10px] font-bold uppercase text-amber-700">small sample</span>
                              )}
                            </td>
                            <td className="px-3 py-2.5 text-xs text-slate-700">
                              {s.analyzed === 0
                                ? <span className="text-slate-400">No analyzed comments</span>
                                : `${fmtPct(percent(s.positive, s.analyzed))} / ${fmtPct(percent(s.neutral, s.analyzed))} / ${fmtPct(percent(s.negative, s.analyzed))} (${s.analyzed})`}
                              {s.fallback > 0 && <span className="block text-[10px] text-slate-400">{s.fallback} by the fallback word list</span>}
                            </td>
                            <td className="px-3 py-2.5 text-xs">{changeText(r, prevRows.find((p) => p.topicId === r.topicId))}</td>
                          </>
                        )}
                      </tr>
                      {isOpen && (
                        <tr className="bg-slate-50/60">
                          <td colSpan={6} className="px-6 py-3">
                            <p className="text-[11px] font-bold uppercase text-slate-500 mb-2">
                              Questions grouped under "{r.topicName}", by survey
                            </p>
                            <div className="space-y-3">
                              {r.parts.map((p) => (
                                <div key={p.surveyId} className="rounded-xl bg-white border border-slate-200 p-3 space-y-2">
                                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                                    <span className="font-semibold text-slate-800">
                                      {p.surveyTitle} <span className="font-normal text-slate-400">· n = {p.n}</span>
                                      {p.n >= MIN_RESPONSES && p.average !== null && (
                                        <span className="font-normal text-slate-500">
                                          {" "}
                                          · topic mean {p.average.toFixed(2)} {interpretRating(p.average)}
                                        </span>
                                      )}
                                    </span>
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        onOpenSurvey(p.surveyId);
                                      }}
                                      className="font-bold text-indigo-700 hover:underline cursor-pointer"
                                    >
                                      Open survey
                                    </button>
                                  </div>
                                  <table className="w-full text-xs">
                                    <thead className="text-[10px] uppercase tracking-wide text-slate-400">
                                      <tr>
                                        <th className="text-left font-semibold py-1 pr-2">Question</th>
                                        <th className="text-right font-semibold py-1 px-2 w-12">n</th>
                                        <th className="text-left font-semibold py-1 pl-2 w-44">Mean</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                      {p.questions.map((q, i) => (
                                        <tr key={i}>
                                          <td className="py-1.5 pr-2 text-slate-700">
                                            {q.text || "(empty question)"}
                                            <span className="block text-[10px] text-slate-400">
                                              {q.type === "rating" ? "Rating 1-5" : "Comment"}
                                              {q.blockTitle ? ` · section "${q.blockTitle}"` : ""}
                                            </span>
                                          </td>
                                          <td className="py-1.5 px-2 text-right tabular-nums text-slate-600">{q.n}</td>
                                          <td className="py-1.5 pl-2 text-slate-700">
                                            {q.type === "paragraph" ? (
                                              <span className="text-slate-400">{q.n} comment{q.n === 1 ? "" : "s"}</span>
                                            ) : q.average === null || q.n < MIN_RESPONSES ? (
                                              <span className="text-slate-400">Not enough answers ({q.n} of {MIN_RESPONSES})</span>
                                            ) : (
                                              <>
                                                <strong>{q.average.toFixed(2)}</strong>{" "}
                                                <span className="text-slate-500">{interpretRating(q.average)}</span>
                                              </>
                                            )}
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              ))}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </section>
        </>
      )}
    </div>
  );
};

export default TopicOverviewTab;

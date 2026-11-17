import { describeAudience } from "../../lib/audience";
import React, { useMemo, useState } from "react";
import { AlertTriangle, ChevronRight, Info, ThumbsUp } from "lucide-react";
import type { AcademicYearTerms, Survey, SurveyResponse, Topic, UserProfile } from "../../types";
import {
  MIN_RESPONSES,
  type PeriodSpec,
  type SampleLevel,
  interpretRating,
  percent,
  periodKey,
  periodLabel,
  periodOptions,
} from "../../lib/analytics";
import {
  MIN_COMMENTS_FOR_PERCENT,
  MIXED_MIN_AVERAGE,
  NEEDS_ATTENTION_AVERAGE,
  NEEDS_ATTENTION_NEGATIVE_PCT,
  STRENGTH_AVERAGE,
  STRENGTH_POSITIVE_PCT,
} from "../../lib/recommendations";
import { topicsAcrossSurveys } from "../../lib/topicAnalytics";
import { overviewNumbers } from "../../lib/overviewStats";
import { CountBar, DivergingAxis, SENTIMENT_COLORS, SentimentBar, SentimentLegend, SentimentRowLabel, StatCard, fmtPct } from "./AnalyticsParts";

interface Props {
  surveys: Survey[];
  responses: SurveyResponse[];
  topics: Topic[];
  calendar: AcademicYearTerms[];
  /** Admin only: today's user list for a live participation count. */
  users: UserProfile[];
  isAdmin: boolean;
  onOpenSurvey: (id: string) => void;
  /** Open the detailed "By topic" tab. */
  onOpenTopics?: () => void;
}

type Kind = "all" | "year" | "semester";

const RATING_LABELS = ["1 (Poor)", "2", "3", "4", "5 (Excellent)"];

/** Horizontal bars on the 1-5 scale with the value and interpretation written at each bar. */
function MeanBars({ rows, empty }: { rows: { key: string; label: string; average: number; n: number; level: SampleLevel }[]; empty: string }) {
  if (rows.length === 0) return <p className="text-xs text-slate-500">{empty}</p>;
  const grid = "grid grid-cols-[minmax(0,7.5rem)_1fr_7rem] sm:grid-cols-[minmax(0,11rem)_1fr_8.5rem] items-center gap-3";
  return (
    <div className="space-y-2">
      {rows.map((r) => (
        <div key={r.key} className={`${grid} text-sm`}>
          <span className="truncate text-slate-700" title={r.label}>
            {r.label}
          </span>
          <div className="h-3 rounded-full bg-slate-100" title={`${r.label}: ${r.average.toFixed(2)} (${interpretRating(r.average)}), n = ${r.n}`}>
            <div className="h-full rounded-full bg-indigo-500" style={{ width: `${Math.max(((r.average - 1) / 4) * 100, 2)}%` }} />
          </div>
          <span className="text-right tabular-nums text-slate-800">
            <strong>{r.average.toFixed(2)}</strong>
            {r.level === "small" && <span className="text-amber-700 font-bold">*</span>}{" "}
            <span className="text-xs text-slate-500">{interpretRating(r.average)}</span>
          </span>
        </div>
      ))}
      <div className={`${grid} text-[10px] text-slate-400`}>
        <span />
        <span className="flex justify-between">
          {[1, 2, 3, 4, 5].map((v) => (
            <span key={v}>{v}</span>
          ))}
        </span>
        <span />
      </div>
      {rows.some((r) => r.level === "small") && (
        <p className="text-[11px] text-amber-800">* Small sample (fewer than 30 responses), read with caution.</p>
      )}
    </div>
  );
}

function Panel({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="p-4 sm:p-5 rounded-2xl bg-white border border-slate-200 space-y-3 min-w-0">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-bold text-slate-900">{title}</h3>
        {action}
      </div>
      {children}
    </section>
  );
}

/**
 * The first page of Analytics: how all the viewer's surveys are doing in one period, at a glance.
 * The admin sees every live survey; a creator sees only their own.
 */
export const OverviewTab: React.FC<Props> = ({ surveys, responses, topics, calendar, users, isAdmin, onOpenSurvey, onOpenTopics }) => {
  const [kind, setKind] = useState<Kind>("all");
  const options = useMemo(() => periodOptions(kind, responses, calendar), [kind, responses, calendar]);
  const [chosen, setChosen] = useState("all");
  const period: PeriodSpec = options.find((o) => periodKey(o) === chosen) || options[0] || { kind: "all" };

  const nums = useMemo(() => overviewNumbers(surveys, responses, period, calendar, users), [surveys, responses, period, calendar, users]);
  const topicRows = useMemo(() => topicsAcrossSurveys(surveys, responses, topics, period, calendar), [surveys, responses, topics, period, calendar]);

  const topicBars = topicRows
    .filter((r) => r.level !== "insufficient" && r.average !== null)
    .map((r) => ({ key: r.topicId, label: r.topicName, average: r.average as number, n: r.n, level: r.level }))
    .sort((a, b) => b.average - a.average);
  const categoryBars = nums.categories
    .filter((c) => c.level !== "insufficient" && c.average !== null)
    .map((c) => ({ key: c.key, label: c.label, average: c.average as number, n: c.n, level: c.level }));
  const topicSentiment = topicRows.filter((r) => r.level !== "insufficient" && r.sentiment.analyzed >= MIN_COMMENTS_FOR_PERCENT);

  // Quick insights, by the same rules as the Recommendations (no AI).
  const judged = topicRows.filter((r) => r.level !== "insufficient" && r.average !== null);
  const negPct = (r: (typeof topicRows)[number]) =>
    r.sentiment.analyzed >= MIN_COMMENTS_FOR_PERCENT ? percent(r.sentiment.negative, r.sentiment.analyzed) : null;
  const posPct = (r: (typeof topicRows)[number]) =>
    r.sentiment.analyzed >= MIN_COMMENTS_FOR_PERCENT ? percent(r.sentiment.positive, r.sentiment.analyzed) : null;
  const attention = judged.filter((r) => {
    const neg = negPct(r);
    return (r.average as number) <= NEEDS_ATTENTION_AVERAGE || (neg !== null && neg >= NEEDS_ATTENTION_NEGATIVE_PCT);
  });
  // Like the Recommendations: never a strength while it also needs attention (or shows mixed signals).
  const strengths = judged.filter(
    (r) =>
      !attention.includes(r) &&
      (r.average as number) >= STRENGTH_AVERAGE &&
      (posPct(r) === null || (posPct(r) as number) >= STRENGTH_POSITIVE_PCT)
  );

  const enough = nums.overall.level !== "insufficient";
  const s = nums.sentiment;
  const maxMonth = Math.max(1, ...nums.months.map((m) => m.count));

  return (
    <div className="space-y-5">
      {/* Period */}
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
        {kind !== "all" && options.length > 0 && (
          <select value={periodKey(period)} onChange={(e) => setChosen(e.target.value)} className="px-3 py-2 rounded-xl border border-slate-200 bg-white text-sm" aria-label="Period">
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
        <span className="text-xs text-slate-500">{isAdmin ? "All surveys that have gone live." : "Your surveys only."}</span>
      </div>

      {/* Headline numbers */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <StatCard label="Surveys with responses" hint={`of ${surveys.length} survey${surveys.length === 1 ? "" : "s"}`}>
          {nums.surveysWithResponses}
        </StatCard>
        <StatCard label="Responses">{nums.responses}</StatCard>
        <StatCard
          label="Participation"
          hint={
            nums.participation
              ? `${nums.participation.responses} of ${nums.participation.eligible} eligible${nums.participation.live ? "" : " (counted at approval)"}`
              : period.kind === "all"
              ? "Not known yet"
              : "Shown for All time only"
          }
        >
          {nums.participation ? fmtPct(nums.participation.percent) : "–"}
        </StatCard>
        <StatCard
          label="Overall rating"
          hint={
            enough && nums.overall.average !== null
              ? `${interpretRating(nums.overall.average)} · all surveys combined${nums.favorable.percent !== null ? ` · ${fmtPct(nums.favorable.percent)} rated 4-5` : ""}`
              : `Needs ${MIN_RESPONSES} rated responses (${nums.overall.n} so far)`
          }
        >
          {enough && nums.overall.average !== null ? nums.overall.average.toFixed(2) : "–"}
        </StatCard>
        <StatCard
          label="Positive comments"
          hint={s.analyzed > 0 ? `of ${s.analyzed} analyzed comment${s.analyzed === 1 ? "" : "s"}` : "No analyzed comments yet"}
        >
          {s.analyzed >= MIN_COMMENTS_FOR_PERCENT ? fmtPct(percent(s.positive, s.analyzed)) : "–"}
        </StatCard>
      </div>

      <div className="flex items-start gap-2 px-4 py-3 rounded-2xl bg-slate-50 border border-slate-200 text-xs text-slate-600">
        <Info className="w-4 h-4 mt-0.5 shrink-0 text-slate-500" />
        <span>
          {periodLabel(period)}. Combined figures count each respondent's own average once per survey; whole survey averages
          are not averaged with each other. The surveys have different questions, respondents and dates, so combined numbers
          are descriptive only. Surveys can be meant for different groups (for example one program or year level), so combined
          figures mix different respondents. Groups with fewer than {MIN_RESPONSES} responses show no numbers; under 30 they
          are marked as a small sample.
        </span>
      </div>

      {/* Quick insights */}
      {(strengths.length > 0 || attention.length > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {strengths.length > 0 && (
            <div className="p-4 rounded-2xl bg-blue-50 border border-blue-200 text-sm text-blue-950 space-y-1">
              <div className="font-bold flex items-center gap-1.5">
                <ThumbsUp className="w-4 h-4" /> Strengths
              </div>
              {strengths.slice(0, 3).map((r) => (
                <div key={r.topicId}>
                  {r.topicName}: <strong>{(r.average as number).toFixed(2)}</strong> {interpretRating(r.average as number)} (n = {r.n})
                </div>
              ))}
            </div>
          )}
          {attention.length > 0 && (
            <div className="p-4 rounded-2xl bg-red-50 border border-red-200 text-sm text-red-950 space-y-1">
              <div className="font-bold flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4" /> Needs attention
              </div>
              {attention.slice(0, 3).map((r) => {
                const neg = negPct(r);
                return (
                  <div key={r.topicId}>
                    {r.topicName}: <strong>{(r.average as number).toFixed(2)}</strong> {interpretRating(r.average as number)}
                    {neg !== null && neg >= NEEDS_ATTENTION_NEGATIVE_PCT && `, ${fmtPct(neg)} negative comments`}
                    {(r.average as number) >= MIXED_MIN_AVERAGE && " (mixed signals)"} (n = {r.n})
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Charts */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <Panel
          title="Mean rating per topic (1 to 5)"
          action={
            onOpenTopics && (
              <button type="button" onClick={onOpenTopics} className="text-xs font-bold text-indigo-700 hover:underline cursor-pointer">
                Details by topic
              </button>
            )
          }
        >
          <MeanBars rows={topicBars} empty={`No topic has ${MIN_RESPONSES} or more responses in this period yet.`} />
        </Panel>

        <Panel title="Mean rating per category (1 to 5)">
          <MeanBars rows={categoryBars} empty={`No category has ${MIN_RESPONSES} or more responses in this period yet.`} />
        </Panel>

        <Panel
          title="Comment sentiment"
          action={<SentimentLegend />}
        >
          <div className="space-y-1">
            <p className="text-xs font-semibold text-slate-600">All comments</p>
            {s.analyzed >= MIN_COMMENTS_FOR_PERCENT ? (
              <SentimentBar counts={s} compact />
            ) : (
              <p className="text-xs text-slate-500">Needs {MIN_COMMENTS_FOR_PERCENT} analyzed comments ({s.analyzed} so far).</p>
            )}
          </div>
          {topicSentiment.length > 0 && (
            <div className="space-y-2.5 pt-2 border-t border-slate-100">
              <p className="text-xs font-semibold text-slate-600">Per topic</p>
              <div className="sm:pl-39">
                <DivergingAxis />
              </div>
              {topicSentiment.map((r) => (
                <div key={r.topicId} className="grid grid-cols-1 sm:grid-cols-[minmax(0,9rem)_1fr] gap-x-3 gap-y-1 items-center">
                  <SentimentRowLabel name={r.topicName} counts={r.sentiment} />
                  <SentimentBar counts={r.sentiment} compact legend={false} />
                </div>
              ))}
            </div>
          )}
        </Panel>

        <Panel title="How people rated (all rating answers)">
          {nums.favorable.answers === 0 || !enough ? (
            <p className="text-xs text-slate-500">Needs {MIN_RESPONSES} rated responses ({nums.overall.n} so far).</p>
          ) : (
            <div className="space-y-2">
              {[4, 3, 2, 1, 0].map((i) => (
                <CountBar key={i} label={RATING_LABELS[i]} count={nums.distribution[i]} total={nums.favorable.answers} />
              ))}
              <p className="text-[11px] text-slate-500">{nums.favorable.answers} rating answers in total.</p>
            </div>
          )}
        </Panel>
      </div>

      <Panel title="Responses per month">
        {nums.months.length === 0 ? (
          <p className="text-xs text-slate-500">No responses in this period.</p>
        ) : (
          <div className="flex gap-1.5 h-44 overflow-x-auto pb-1" role="img" aria-label="Number of responses per month">
            {nums.months.map((m) => (
              <div key={m.month} className="flex flex-col items-center h-full min-w-9 flex-1" title={`${m.label}: ${m.count} responses`}>
                {/* Plot area: the bar's height is a share of this box; the top padding leaves room for the number. */}
                <div className="flex-1 min-h-0 w-full flex items-end justify-center pt-4 border-b border-slate-200">
                  <div
                    className={`relative w-full max-w-8 rounded-t-md ${m.count > 0 ? "bg-indigo-500" : ""}`}
                    style={{ height: m.count > 0 ? `${Math.max((m.count / maxMonth) * 100, 3)}%` : "0" }}
                  >
                    <span className="absolute -top-4 inset-x-0 text-center text-[10px] font-semibold text-slate-700 tabular-nums">
                      {m.count}
                    </span>
                  </div>
                </div>
                <span className="text-[10px] text-slate-500 mt-1 whitespace-nowrap">{m.label}</span>
              </div>
            ))}
          </div>
        )}
      </Panel>

      {/* All surveys */}
      <Panel title={`All surveys (${surveys.length})`}>
        <ul className="divide-y divide-slate-100 -mx-1">
          {nums.rows.map(({ survey, stats }) => {
            const ok = stats.level !== "insufficient";
            const c = stats.sentiment;
            return (
              <li key={String(survey.id)}>
                <button
                  type="button"
                  onClick={() => onOpenSurvey(String(survey.id))}
                  className="w-full text-left px-1 py-2.5 hover:bg-slate-50 rounded-lg cursor-pointer flex items-center gap-3"
                >
                  <div className="min-w-0 flex-1 grid grid-cols-1 md:grid-cols-[minmax(0,1.6fr)_4rem_minmax(0,1fr)_minmax(0,1.4fr)] gap-x-4 gap-y-0.5 md:items-center">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-900 truncate">{survey.title}</p>
                      <p className="text-[11px] text-slate-500 capitalize">
                        {survey.status} · {survey.cat}
                      </p>
                      <p className="text-[11px] text-slate-500 truncate" title={describeAudience(survey.targetAudience)}>
                        For: {describeAudience(survey.targetAudience)}
                      </p>
                    </div>
                    <p className="text-sm text-slate-700">n = {stats.responses}</p>
                    {!ok ? (
                      <p className="text-xs text-slate-500 md:col-span-2">
                        Not enough responses yet ({stats.responses} of {MIN_RESPONSES})
                      </p>
                    ) : (
                      <>
                        <p className="text-sm text-slate-800">
                          {stats.averageRating === null ? (
                            <span className="text-slate-400">No ratings</span>
                          ) : (
                            <>
                              <strong>{stats.averageRating.toFixed(2)}</strong>{" "}
                              <span className="text-xs text-slate-500">{interpretRating(stats.averageRating)}</span>
                            </>
                          )}
                          {stats.level === "small" && <span className="ml-1.5 text-[10px] font-bold uppercase text-amber-700">small sample</span>}
                        </p>
                        <p className="text-xs text-slate-700 flex flex-wrap gap-x-3">
                          {c.analyzed === 0 ? (
                            <span className="text-slate-400">No analyzed comments</span>
                          ) : (
                            (["negative", "neutral", "positive"] as const).map((k) => (
                              <span key={k} className="inline-flex items-center gap-1">
                                <span className="w-2 h-2 rounded-sm" style={{ backgroundColor: SENTIMENT_COLORS[k] }} />
                                {k[0].toUpperCase() + k.slice(1)} {fmtPct(percent(c[k], c.analyzed))}
                              </span>
                            ))
                          )}
                        </p>
                      </>
                    )}
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
                </button>
              </li>
            );
          })}
        </ul>
      </Panel>
    </div>
  );
};

export default OverviewTab;

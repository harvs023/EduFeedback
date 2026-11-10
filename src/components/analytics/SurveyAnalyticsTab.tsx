import React, { useEffect, useMemo, useState } from "react";
import { Download, Info } from "lucide-react";
import { AcademicYearTerms, Survey, SurveyResponse, UserProfile } from "../../types";
import { countEligibleUsers, eligibilityCutoff } from "../../lib/surveyReview";
import { authFetch } from "../../lib/firebase";
import {
  MIN_RESPONSES,
  PeriodKind,
  PeriodSpec,
  SurveyStats,
  inPeriod,
  percent,
  periodKey,
  periodLabel,
  periodOptions,
  previousPeriod,
  commentsCsv,
  responsesCsv,
  responsesForSurvey,
  surveyStats,
} from "../../lib/analytics";
import { endOfDay, startOfDay } from "../../lib/schoolYear";
import { Change, RatingValue, SampleNotice, SentimentBar, SentimentFootnote, StatCard, fmtPct } from "./AnalyticsParts";
import { QuestionResults } from "./QuestionResults";
import { TopicInsights } from "./TopicInsights";
import { ResponseChecks } from "./ResponseChecks";
import { FlagResponseDialog } from "./FlagResponseDialog";
import { checkResponse } from "../../lib/responseChecks";

const KINDS: { id: PeriodKind; label: string }[] = [
  { id: "all", label: "All time" },
  { id: "year", label: "School year" },
  { id: "semester", label: "Semester" },
  { id: "month", label: "Month" },
  { id: "custom", label: "Custom" },
];

interface Props {
  surveys: Survey[];
  responses: SurveyResponse[];
  calendar: AcademicYearTerms[];
  surveyId: string;
  onSelectSurvey: (id: string) => void;
  /** Admin only (the rules let only the admin read the user list): for a live eligible count. */
  users?: UserProfile[];
  /** Responses the admin excluded (never counted; shown in "Responses to check" only). */
  excludedResponses?: SurveyResponse[];
  /** Flag a response for the admin (survey owner or admin). */
  onFlagResponse?: (responseId: string, reasons: string[], note: string) => Promise<void>;
}

/** A period picker for one kind: a list of choices, or two dates for "custom". */
function PeriodChooser({
  kind,
  options,
  value,
  onChange,
  custom,
  onCustom,
}: {
  kind: PeriodKind;
  options: PeriodSpec[];
  value: string;
  onChange: (key: string) => void;
  custom: { from: string; to: string };
  onCustom: (c: { from: string; to: string }) => void;
}) {
  const input = "px-3 py-2 rounded-xl border border-slate-200 text-sm text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-200";
  if (kind === "all") return null;
  if (kind === "custom") {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <input type="date" value={custom.from} onChange={(e) => onCustom({ ...custom, from: e.target.value })} className={input} aria-label="From" />
        <span className="text-xs text-slate-500">to</span>
        <input type="date" value={custom.to} onChange={(e) => onCustom({ ...custom, to: e.target.value })} className={input} aria-label="To" />
      </div>
    );
  }
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} className={input}>
      {options.map((o) => (
        <option key={periodKey(o)} value={periodKey(o)}>
          {periodLabel(o)}
        </option>
      ))}
    </select>
  );
}

function customSpec(c: { from: string; to: string }): PeriodSpec | null {
  const from = startOfDay(c.from);
  const to = endOfDay(c.to);
  return from !== null && to !== null && from <= to ? { kind: "custom", from, to } : null;
}

/** The numbers for one period. `other` is the period it is compared with, if any. */
function PeriodSummary({
  label,
  stats,
  other,
  closed,
}: {
  label: string;
  stats: SurveyStats;
  other?: SurveyStats | null;
  /** The survey has closed: eligible people are those with an account before it closed. */
  closed: boolean;
}) {
  const when = closed ? "before the survey closed" : "today";
  const usable = stats.level !== "insufficient";
  const otherUsable = other && other.level !== "insufficient" ? other : null;
  return (
    <div className="space-y-3 min-w-0">
      <p className="text-sm font-bold text-slate-800">{label}</p>
      <SampleNotice level={stats.level} n={stats.responses} />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="Responses">{stats.responses}</StatCard>
        <StatCard
          label="Participation"
          hint={
            !stats.participation
              ? "Eligible count not recorded"
              : stats.participation.percent === null
              ? stats.participation.live
                ? `More responses than the ${stats.participation.eligible} eligible accounts ${when} (some may have changed program or left)`
                : `More responses than the ${stats.participation.eligible} people eligible when it was approved (more joined later)`
              : `${stats.responses} of ${stats.participation.eligible} eligible accounts ${
                  stats.participation.live ? when : "when it was approved"
                }`
          }
        >
          {stats.participation?.percent != null ? fmtPct(stats.participation.percent) : "—"}
        </StatCard>
        <StatCard
          label="Average rating"
          hint={
            usable && otherUsable ? (
              <Change now={stats.averageRating} before={otherUsable.averageRating} />
            ) : usable && stats.ratingRespondents > 0 ? (
              `${stats.ratingRespondents} people rated`
            ) : undefined
          }
        >
          {usable ? <RatingValue average={stats.averageRating} /> : "—"}
        </StatCard>
        <StatCard
          label="Negative comments"
          hint={
            usable && otherUsable && stats.sentiment.analyzed > 0 && otherUsable.sentiment.analyzed > 0 ? (
              <Change
                now={percent(stats.sentiment.negative, stats.sentiment.analyzed)}
                before={percent(otherUsable.sentiment.negative, otherUsable.sentiment.analyzed)}
                digits={0}
                suffix=" pts"
              />
            ) : usable ? (
              `of ${stats.sentiment.analyzed} analyzed`
            ) : undefined
          }
        >
          {usable && stats.sentiment.analyzed > 0 ? fmtPct(percent(stats.sentiment.negative, stats.sentiment.analyzed)) : "—"}
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

export const SurveyAnalyticsTab: React.FC<Props> = ({
  surveys,
  responses,
  calendar,
  surveyId,
  onSelectSurvey,
  users = [],
  excludedResponses = [],
  onFlagResponse,
}) => {
  const [flagTarget, setFlagTarget] = useState<{ responseId: string; suggested: string[] } | null>(null);
  const survey = surveys.find((s) => String(s.id) === surveyId) || null;
  const surveyResponses = useMemo(() => (survey ? responsesForSurvey(responses, survey) : []), [responses, survey]);

  const [kind, setKind] = useState<PeriodKind>("all");
  const [mainKey, setMainKey] = useState("");
  const [mainCustom, setMainCustom] = useState({ from: "", to: "" });
  const [compareChecked, setCompareOn] = useState(false);
  const [compareKey, setCompareKey] = useState("");
  const [compareCustom, setCompareCustom] = useState({ from: "", to: "" });

  const options = useMemo(() => periodOptions(kind, surveyResponses, calendar), [kind, surveyResponses, calendar]);

  // New kind or survey: start from the newest period, comparing with the one before it.
  useEffect(() => {
    setMainKey(options[0] ? periodKey(options[0]) : "");
    setCompareKey(options[1] ? periodKey(options[1]) : "");
  }, [kind, surveyId]);

  // The tick only counts where comparing is possible (not All time, and not with a single period),
  // so switching back to All time never leaves an empty comparison column behind.
  const canCompare = kind !== "all" && (kind === "custom" || options.length > 1);
  const compareOn = compareChecked && canCompare;

  const mainPeriod: PeriodSpec | null =
    kind === "custom" ? customSpec(mainCustom) : options.find((o) => periodKey(o) === mainKey) || options[0] || null;
  const comparePeriod: PeriodSpec | null = !compareOn
    ? null
    : kind === "custom"
    ? customSpec(compareCustom)
    : options.find((o) => periodKey(o) === compareKey) || (mainPeriod ? previousPeriod(mainPeriod, options) : null);

  const cutoff = survey ? eligibilityCutoff(survey) : null;
  // Admin: counted here from the user list. Owner: counted by the server (owners may not read the
  // user list); if the server cannot answer, the count saved at approval is used instead.
  const [serverEligible, setServerEligible] = useState<number | undefined>(undefined);
  useEffect(() => {
    setServerEligible(undefined);
    if (!survey || users.length > 0) return;
    let cancelled = false;
    authFetch("/api/surveys/eligible", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ surveyId: String(survey.id) }),
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!cancelled && typeof d?.eligible === "number") setServerEligible(d.eligible);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [survey?.id, users.length]); // re-ask only when the survey changes
  const liveEligible = useMemo(
    () => (survey && users.length > 0 ? countEligibleUsers(survey, users, cutoff) : serverEligible),
    [survey, users, cutoff, serverEligible]
  );
  const statsFor = (p: PeriodSpec | null) =>
    survey && p ? surveyStats(survey, surveyResponses.filter((r) => inPeriod(r, p, calendar)), liveEligible) : null;
  const mainStats = statsFor(mainPeriod);
  const compareStats = statsFor(comparePeriod);

  // For the recommendations: responses in the chosen period, and in the period just before it
  // (same kind) for "getting worse". All time and custom dates have no "before".
  const mainResponses = useMemo(
    () => (mainPeriod ? surveyResponses.filter((r) => inPeriod(r, mainPeriod, calendar)) : []),
    [surveyResponses, mainPeriod && periodKey(mainPeriod), calendar]
  );
  const previousForInsights = useMemo(() => {
    if (!mainPeriod || kind === "all" || kind === "custom") return null;
    const prev = previousPeriod(mainPeriod, options);
    return prev
      ? { label: periodLabel(prev), responses: surveyResponses.filter((r) => inPeriod(r, prev, calendar)) }
      : null;
  }, [surveyResponses, mainPeriod && periodKey(mainPeriod), kind, options, calendar]);

  const exportFile = (fileKind: "responses" | "comments") => {
    if (!survey || !mainPeriod) return;
    const rows = surveyResponses.filter((r) => inPeriod(r, mainPeriod, calendar));
    const text = fileKind === "comments" ? commentsCsv(survey, rows, calendar) : responsesCsv(survey, rows, calendar);
    const blob = new Blob(["\uFEFF" + text], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${survey.title.replace(/[^a-z0-9]+/gi, "_").slice(0, 50)}_${fileKind}_${periodLabel(mainPeriod).replace(/[^a-z0-9]+/gi, "_")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const sectionTitle = (index: number) => {
    const blockId = survey?.questions[index]?.blockId;
    return survey?.topicBlocks?.find((b) => b.id === blockId)?.title || null;
  };

  if (surveys.length === 0) return null;

  return (
    <div className="space-y-5">
      {/* Pickers */}
      <div className="p-4 rounded-2xl bg-white border border-slate-200 space-y-3">
        <label className="block space-y-1">
          <span className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Survey</span>
          <select
            value={surveyId}
            onChange={(e) => onSelectSurvey(e.target.value)}
            className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-200"
          >
            {surveys.map((s) => (
              <option key={String(s.id)} value={String(s.id)}>
                {s.title} ({s.status})
              </option>
            ))}
          </select>
        </label>
        <div className="space-y-1">
          <span className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Period</span>
          <div className="flex flex-wrap gap-1.5">
            {KINDS.map((k) => (
              <button
                key={k.id}
                type="button"
                onClick={() => setKind(k.id)}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold border cursor-pointer ${
                  kind === k.id ? "bg-indigo-600 text-white border-indigo-600" : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                }`}
              >
                {k.label}
              </button>
            ))}
          </div>
        </div>
        {kind === "semester" && calendar.length === 0 ? (
          <p className="flex items-start gap-2 text-sm text-slate-600">
            <Info className="w-4 h-4 mt-0.5 shrink-0" />
            No academic calendar yet. Ask the admin to add the school years in Review Center &gt; Academic Calendar.
          </p>
        ) : (
          <PeriodChooser kind={kind} options={options} value={mainKey} onChange={setMainKey} custom={mainCustom} onCustom={setMainCustom} />
        )}
        {kind === "year" && calendar.length === 0 && (
          <p className="text-xs text-slate-500">
            School years are estimated (starting in August) until the admin adds the academic calendar.
          </p>
        )}
        {canCompare && (
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <label className="inline-flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
              <input type="checkbox" checked={compareChecked} onChange={(e) => setCompareOn(e.target.checked)} className="w-4 h-4 accent-indigo-600" />
              Compare with another period
            </label>
            {compareOn && (
              <PeriodChooser
                kind={kind}
                options={options}
                value={compareKey}
                onChange={setCompareKey}
                custom={compareCustom}
                onCustom={setCompareCustom}
              />
            )}
          </div>
        )}
        {compareOn && (
          <p className="text-xs text-slate-500">
            Each person answers a survey only once, so the two periods have different respondents.
          </p>
        )}
      </div>

      {!survey ? null : !mainPeriod || !mainStats ? (
        <p className="text-sm text-slate-500">
          {kind === "custom" ? "Pick a start and end date (the end must not be before the start)." : "No period to show."}
        </p>
      ) : (
        <>
          <div className={compareOn ? "grid grid-cols-1 xl:grid-cols-2 gap-5" : ""}>
            <PeriodSummary label={periodLabel(mainPeriod)} stats={mainStats} other={compareStats} closed={cutoff !== null} />
            {compareOn &&
              (comparePeriod && compareStats ? (
                <PeriodSummary label={periodLabel(comparePeriod)} stats={compareStats} other={null} closed={cutoff !== null} />
              ) : (
                <p className="text-sm text-slate-500">
                  {kind === "custom" ? "Pick the dates of the other period." : "Pick the other period."}
                </p>
              ))}
          </div>

          {survey && mainStats.level !== "insufficient" && (
            <TopicInsights
              survey={survey}
              responses={mainResponses}
              periodLabel={periodLabel(mainPeriod)}
              previous={previousForInsights}
            />
          )}

          {survey && mainStats.level !== "insufficient" && (
            <ResponseChecks
              survey={survey}
              responses={mainResponses}
              excluded={responsesForSurvey(excludedResponses, survey).filter((r) => inPeriod(r, mainPeriod, calendar))}
              onFlag={onFlagResponse ? (r, suggested) => setFlagTarget({ responseId: r.id, suggested }) : undefined}
            />
          )}

          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-bold text-slate-800">Per question · {periodLabel(mainPeriod)}</h3>
              <div className="flex flex-col items-end gap-1">
                <div className="flex flex-wrap justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => exportFile("responses")}
                    disabled={mainStats.level === "insufficient"}
                    title="One row per response, all answers"
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-white"
                  >
                    <Download className="w-4 h-4" />
                    Export responses
                  </button>
                  <button
                    type="button"
                    onClick={() => exportFile("comments")}
                    disabled={mainStats.level === "insufficient"}
                    title="One row per comment, no names"
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-white"
                  >
                    <Download className="w-4 h-4" />
                    Export comments
                  </button>
                </div>
                {mainStats.level === "insufficient" && (
                  <span className="text-[11px] text-slate-500">
                    Available from {MIN_RESPONSES} responses, so no one's answers can be singled out.
                  </span>
                )}
              </div>
            </div>
            {mainStats.level !== "insufficient" && (
              <QuestionResults
                results={mainStats.questions}
                sectionTitle={(r) => sectionTitle(r.index)}
                isFlagged={(id) => !!surveyResponses.find((r) => r.id === id)?.review}
                onFlagComment={
                  onFlagResponse && survey
                    ? (id) => {
                        const r = surveyResponses.find((x) => x.id === id);
                        if (r) setFlagTarget({ responseId: id, suggested: checkResponse(survey, r) });
                      }
                    : undefined
                }
              />
            )}
          </div>
        </>
      )}
      {flagTarget && onFlagResponse && (
        <FlagResponseDialog
          suggested={flagTarget.suggested}
          onCancel={() => setFlagTarget(null)}
          onSubmit={async (reasons, note) => {
            await onFlagResponse(flagTarget.responseId, reasons, note);
            setFlagTarget(null);
          }}
        />
      )}
    </div>
  );
};

export default SurveyAnalyticsTab;

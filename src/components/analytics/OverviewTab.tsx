import React, { useMemo } from "react";
import { ChevronRight } from "lucide-react";
import { Survey, SurveyResponse } from "../../types";
import { MIN_RESPONSES, interpretRating, percent, responsesForSurvey, surveyStats } from "../../lib/analytics";
import { SENTIMENT_COLORS, StatCard, fmtPct } from "./AnalyticsParts";

interface Props {
  surveys: Survey[];
  responses: SurveyResponse[];
  onOpenSurvey: (id: string) => void;
}

/**
 * All-time summary of every survey the viewer may see. Surveys are listed side by side, never
 * merged into one average: their questions differ, so a combined number would mean nothing.
 */
export const OverviewTab: React.FC<Props> = ({ surveys, responses, onOpenSurvey }) => {
  const rows = useMemo(
    () => surveys.map((s) => ({ survey: s, stats: surveyStats(s, responsesForSurvey(responses, s)) })),
    [surveys, responses]
  );
  const totalResponses = rows.reduce((sum, r) => sum + r.stats.responses, 0);
  const totalComments = rows.reduce((sum, r) => sum + r.stats.sentiment.analyzed, 0);

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <StatCard label="Surveys">{surveys.length}</StatCard>
        <StatCard label="Responses">{totalResponses}</StatCard>
        <StatCard label="Comments analyzed">{totalComments}</StatCard>
      </div>
      <p className="text-xs text-slate-500">
        All time. Each survey is shown on its own row; surveys are not averaged together, because their questions are
        different. Open a survey to choose a school year, semester or month.
      </p>

      <ul className="divide-y divide-slate-100 border border-slate-200 rounded-2xl bg-white overflow-hidden">
        {rows.map(({ survey, stats }) => {
          const enough = stats.level !== "insufficient";
          const s = stats.sentiment;
          return (
            <li key={String(survey.id)}>
              <button
                type="button"
                onClick={() => onOpenSurvey(String(survey.id))}
                className="w-full text-left px-4 py-3 hover:bg-slate-50 cursor-pointer flex items-center gap-3"
              >
                <div className="min-w-0 flex-1 grid grid-cols-1 md:grid-cols-[minmax(0,1.6fr)_4rem_minmax(0,1fr)_minmax(0,1.4fr)] gap-x-4 gap-y-1 md:items-center">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-900 truncate">{survey.title}</p>
                    <p className="text-[11px] text-slate-500 capitalize">
                      {survey.status} · {survey.cat}
                    </p>
                  </div>
                  <p className="text-sm text-slate-700">
                    <span className="md:hidden text-slate-500">Responses: </span>n = {stats.responses}
                  </p>
                  {!enough ? (
                    <p className="text-xs text-slate-500 md:col-span-2">
                      Not enough responses to analyze yet ({stats.responses} of {MIN_RESPONSES})
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
                        {stats.level === "small" && (
                          <span className="ml-1.5 text-[10px] font-bold uppercase text-amber-700">small sample</span>
                        )}
                      </p>
                      <p className="text-xs text-slate-700 flex flex-wrap gap-x-3">
                        {s.analyzed === 0 ? (
                          <span className="text-slate-400">No analyzed comments</span>
                        ) : (
                          (["positive", "neutral", "negative"] as const).map((k) => (
                            <span key={k} className="inline-flex items-center gap-1">
                              <span className="w-2 h-2 rounded-sm" style={{ backgroundColor: SENTIMENT_COLORS[k] }} />
                              {k[0].toUpperCase() + k.slice(1)} {fmtPct(percent(s[k], s.analyzed))}
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
    </div>
  );
};

export default OverviewTab;

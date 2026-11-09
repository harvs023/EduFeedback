import React, { useEffect, useMemo, useState } from "react";
import { BarChart3, ClipboardList, Columns2, LayoutList, Plus, RefreshCw } from "lucide-react";
import { AcademicYearTerms, Survey, SurveyResponse, UserProfile } from "../../types";
import { analyzableSurveys } from "../../lib/analytics";
import { OverviewTab } from "./OverviewTab";
import { SurveyAnalyticsTab } from "./SurveyAnalyticsTab";
import { CompareTab } from "./CompareTab";

interface AnalyticsPageProps {
  surveys: Survey[];
  /** Trusted responses only (unconfirmed sentiment results already removed). */
  responses: SurveyResponse[];
  academicCalendar: AcademicYearTerms[];
  /** A survey id to open directly, or "all" for the overview. */
  initialSurveyId?: string | number | "all";
  isAdmin: boolean;
  currentUser: UserProfile | null;
  /** Loaded for the admin only; used for a live eligible count. */
  users?: UserProfile[];
  /** When the data was last loaded, and how to load it again (the page is not live). */
  dataLoadedAt?: number | null;
  onRefresh?: () => Promise<void>;
  onCreateSurvey?: () => void;
}

type Tab = "overview" | "survey" | "compare";

export const AnalyticsPage: React.FC<AnalyticsPageProps> = ({
  surveys,
  responses,
  academicCalendar,
  initialSurveyId,
  isAdmin,
  currentUser,
  users = [],
  dataLoadedAt = null,
  onRefresh,
  onCreateSurvey,
}) => {
  const [refreshing, setRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const refresh = async () => {
    if (!onRefresh) return;
    setRefreshing(true);
    setRefreshError(null);
    try {
      await onRefresh();
    } catch (err: any) {
      setRefreshError(err?.message || "Could not load the latest responses. Please try again.");
    } finally {
      setRefreshing(false);
    }
  };
  const visible = useMemo(
    () => analyzableSurveys(surveys, currentUser?.email || "", isAdmin),
    [surveys, currentUser?.email, isAdmin]
  );
  const startsOnSurvey = initialSurveyId !== undefined && initialSurveyId !== "all";
  const [tab, setTab] = useState<Tab>(startsOnSurvey ? "survey" : "overview");
  const [surveyId, setSurveyId] = useState<string>(startsOnSurvey ? String(initialSurveyId) : "");

  useEffect(() => {
    if (initialSurveyId !== undefined && initialSurveyId !== "all") {
      setSurveyId(String(initialSurveyId));
      setTab("survey");
    }
  }, [initialSurveyId]);

  // Always have a valid survey selected for the "One survey" tab.
  useEffect(() => {
    if (visible.length && !visible.some((s) => String(s.id) === surveyId)) setSurveyId(String(visible[0].id));
  }, [visible, surveyId]);

  const tabs: { id: Tab; label: string; icon: typeof BarChart3 }[] = [
    { id: "overview", label: "Overview", icon: LayoutList },
    { id: "survey", label: "One survey", icon: BarChart3 },
    { id: "compare", label: "Compare surveys", icon: Columns2 },
  ];

  return (
    <div className="max-w-6xl mx-auto space-y-5 pb-12">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="font-serif text-2xl font-bold text-slate-900">Analytics</h1>
          <p className="text-sm text-slate-500">
            {isAdmin ? "All surveys that have gone live." : "Results of the surveys you created."} Only sentiment results
            confirmed by the server are counted.
          </p>
        </div>
        {onRefresh && (
          <div className="flex flex-col items-end gap-1">
            <button
              type="button"
              onClick={refresh}
              disabled={refreshing}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60 cursor-pointer"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
              {refreshing ? "Refreshing..." : "Refresh"}
            </button>
            {dataLoadedAt && (
              <span className="text-[11px] text-slate-500">
                Last updated{" "}
                {new Date(dataLoadedAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
              </span>
            )}
          </div>
        )}
      </div>
      {refreshError && (
        <p className="px-3 py-2 rounded-xl bg-rose-50 border border-rose-100 text-xs text-rose-700">{refreshError}</p>
      )}

      {visible.length === 0 ? (
        <div className="py-14 text-center bg-white border border-slate-200 rounded-3xl space-y-3">
          <ClipboardList className="w-10 h-10 mx-auto text-slate-300" />
          <p className="text-sm text-slate-600">No published surveys yet. Results appear here once a survey goes live.</p>
          {onCreateSurvey && (
            <button
              type="button"
              onClick={onCreateSurvey}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              Create a survey
            </button>
          )}
        </div>
      ) : (
        <>
          <div className="flex gap-1.5 border-b border-slate-200 overflow-x-auto">
            {tabs.map((t) => {
              const Icon = t.icon;
              const active = tab === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTab(t.id)}
                  className={`inline-flex items-center gap-1.5 px-4 py-2.5 text-sm font-semibold border-b-2 -mb-px cursor-pointer whitespace-nowrap shrink-0 ${
                    active ? "border-indigo-600 text-indigo-700" : "border-transparent text-slate-500 hover:text-slate-800"
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {t.label}
                </button>
              );
            })}
          </div>

          {tab === "overview" ? (
            <OverviewTab
              surveys={visible}
              responses={responses}
              onOpenSurvey={(id) => {
                setSurveyId(id);
                setTab("survey");
              }}
            />
          ) : tab === "compare" ? (
            <CompareTab surveys={visible} responses={responses} />
          ) : (
            <SurveyAnalyticsTab
              surveys={visible}
              responses={responses}
              calendar={academicCalendar}
              surveyId={surveyId}
              onSelectSurvey={setSurveyId}
              users={isAdmin ? users : []}
            />
          )}
        </>
      )}
    </div>
  );
};

export default AnalyticsPage;

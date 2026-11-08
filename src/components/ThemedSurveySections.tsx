import React, { useState, useMemo } from "react";
import { useConfirm } from "./ConfirmDialog";
import { Survey, UserProfile, SurveyResponse } from "../types";
import { getSurveyAvailability, isInAudience } from "../lib/surveyReview";
import { DEFAULT_SURVEY_CATEGORIES } from "../data/initialData";
import {
  Flame,
  Star,
  Search,
  CheckCircle2,
  Clock,
  Users,
  Calendar,
  ArrowRight,
  BarChart3,
  ClipboardList,
  Pencil,
  Trash2,
} from "lucide-react";

interface ThemedSurveySectionsProps {
  surveys: Survey[];
  currentUser: UserProfile | null;
  userResponses?: SurveyResponse[];
  /** Surveys this person answered, named or anonymous ("already answered" records). */
  answeredSurveyIds?: string[];
  onTakeSurvey?: (survey: Survey) => void;
  onOpenSurvey?: (survey: Survey) => void;
  onViewAnalytics: (surveyId: string | number) => void;
  onCreateSurvey?: () => void;
  onCreateNewSurvey?: () => void;
  onEditSurvey?: (survey: Survey) => void;
  onDeleteSurvey?: (surveyId: string | number, surveyTitle?: string) => void;
  searchQuery?: string;
  selectedCategory?: string;
  categories?: string[];
}

// Helper to evaluate dynamic performance metrics for surveys
// "Trending": automatically designated if survey reached a mass amount of respondents in a timeframe (high volume/velocity)
// "Top Rated": automatically designated if survey achieved 4.4+ rating backed by statistically sound volume (>= 20 respondents)
export const getSurveyPerformanceMetrics = (survey: Survey) => {
  const totalResponses = survey.responses || 0;
  const ratingAverage = survey.ratingAverage || 0;
  const satisfactionPercent = Math.min(100, Math.round((ratingAverage / 5) * 100));

  let createdTime = survey.createdAtTimestamp;
  if (!createdTime && survey.created) {
    const parsed = Date.parse(survey.created);
    if (!isNaN(parsed)) createdTime = parsed;
  }
  if (!createdTime && survey.openDate) {
    const parsed = Date.parse(survey.openDate);
    if (!isNaN(parsed)) createdTime = parsed;
  }
  if (!createdTime) {
    createdTime = Date.now() - 30 * 24 * 60 * 60 * 1000;
  }

  const daysActive = Math.max(1, Math.round((Date.now() - createdTime) / (1000 * 60 * 60 * 24)));
  const velocityDaily = Math.round((totalResponses / daysActive) * 10) / 10;

  // Dynamic Trending: Mass amount of respondents in timeframe (>= 150 total OR >= 40 with >= 1.5 daily velocity)
  const isTrending = totalResponses >= 150 || (totalResponses >= 40 && velocityDaily >= 1.5);

  // Dynamic Top Rated: Statistically sound rating (>= 4.4 rating with >= 20 respondents)
  const isTopRated = ratingAverage >= 4.4 && totalResponses >= 20;

  return {
    totalResponses,
    daysActive,
    velocityDaily,
    isTrending,
    isTopRated,
    ratingAverage,
    satisfactionPercent,
  };
};

export const ThemedSurveySections: React.FC<ThemedSurveySectionsProps> = ({
  surveys,
  currentUser,
  userResponses = [],
  answeredSurveyIds: receiptSurveyIds = [],
  onTakeSurvey,
  onOpenSurvey,
  onViewAnalytics,
  onCreateSurvey,
  onCreateNewSurvey,
  onEditSurvey,
  onDeleteSurvey,
  searchQuery = "",
  selectedCategory = "all",
  categories = DEFAULT_SURVEY_CATEGORIES,
}) => {
  const { confirm, confirmDialog } = useConfirm();
  const [performanceFilter, setPerformanceFilter] = useState<"all" | "trending" | "top-rated">("all");
  const [internalSearch, setInternalSearch] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<"all" | "unanswered" | "answered">("all");
  const [categoryFilter, setCategoryFilter] = useState<string>(selectedCategory);
  const isSuperadmin = currentUser?.role === "superadmin" || currentUser?.pos === "Superadmin";

  const handleLaunchSurvey = (survey: Survey) => {
    if (onTakeSurvey) onTakeSurvey(survey);
    else if (onOpenSurvey) onOpenSurvey(survey);
  };

  // Surveys answered with the person's name: these answers can be opened again.
  const namedAnswerIds = useMemo(() => {
    const myEmail = (currentUser?.email || "").trim().toLowerCase();
    if (!myEmail) return new Set<string>();
    return new Set(
      userResponses
        .filter((r) => (r.userEmail || "").trim().toLowerCase() === myEmail)
        .map((r) => String(r.surveyId))
    );
  }, [userResponses, currentUser]);

  // Everything this person answered, including anonymous answers.
  const answeredSurveyIds = useMemo(
    () => new Set<string>([...namedAnswerIds, ...receiptSurveyIds]),
    [namedAnswerIds, receiptSurveyIds]
  );

  // Target audience eligibility check
  const isEligible = (survey: Survey) => !currentUser || isInAudience(survey, currentUser.pos);

  const effectiveSearch = (searchQuery || internalSearch).trim().toLowerCase();

  // Open surveys the current user can answer. Your own surveys are managed in My Surveys, not here.
  const eligibleSurveys = useMemo(() => {
    const myEmail = (currentUser?.email || "").trim().toLowerCase();
    return surveys.filter((s) => {
      if (myEmail && (s.owner || "").trim().toLowerCase() === myEmail) return false;

      if (getSurveyAvailability(s) !== "open") return false;
      return isEligible(s);
    });
  }, [surveys, currentUser]);

  // Dynamic Performance Groupings (Calculated automatically from volume & ratings)
  const dynamicTrendingSurveys = useMemo(() => {
    return [...eligibleSurveys]
      .filter((s) => getSurveyPerformanceMetrics(s).isTrending)
      .sort((a, b) => (b.responses || 0) - (a.responses || 0));
  }, [eligibleSurveys]);

  const dynamicTopRatedSurveys = useMemo(() => {
    return [...eligibleSurveys]
      .filter((s) => getSurveyPerformanceMetrics(s).isTopRated)
      .sort((a, b) => (b.ratingAverage || 0) - (a.ratingAverage || 0));
  }, [eligibleSurveys]);

  // Category tabs: "All" plus one tab per category from categories list with count of eligible surveys
  const categoryTabs = useMemo(() => {
    return [
      { id: "all", label: "All", count: eligibleSurveys.length },
      ...categories.map((c) => ({
        id: c,
        label: c,
        count: eligibleSurveys.filter((s) => s.cat === c).length,
      })),
    ];
  }, [eligibleSurveys, categories]);

  // Filtered surveys applying category, performance metric, status, and search query
  const filteredSurveys = useMemo(() => {
    return eligibleSurveys.filter((s) => {
      // 1. Dynamic Performance Filter (Trending / Top Rated earned by performance)
      const perf = getSurveyPerformanceMetrics(s);
      if (performanceFilter === "trending" && !perf.isTrending) return false;
      if (performanceFilter === "top-rated" && !perf.isTopRated) return false;

      // 2. Category Filter (surveys whose category is not in the list still show under "All")
      if (categoryFilter !== "all" && s.cat !== categoryFilter) return false;

      // 3. Response Status Filter
      const isAnswered = answeredSurveyIds.has(String(s.id));
      if (statusFilter === "unanswered" && isAnswered) return false;
      if (statusFilter === "answered" && !isAnswered) return false;

      // 4. Search Query
      if (effectiveSearch) {
        const matchesTitle = s.title.toLowerCase().includes(effectiveSearch);
        const matchesDesc = s.desc.toLowerCase().includes(effectiveSearch);
        const matchesTags = s.tags?.some((t) => t.toLowerCase().includes(effectiveSearch));
        if (!matchesTitle && !matchesDesc && !matchesTags) return false;
      }

      return true;
    });
  }, [eligibleSurveys, performanceFilter, categoryFilter, statusFilter, effectiveSearch, answeredSurveyIds]);

  // Priority / Mandatory Institutional Surveys assigned to current user
  const pendingRequiredSurveys = useMemo(() => {
    if (!currentUser) return [];
    return surveys.filter((s) => {
      if (!s.isRequired || s.status !== "published") return false;
      if ((s.owner || "").trim().toLowerCase() === currentUser.email.trim().toLowerCase()) return false;
      const isAnswered = answeredSurveyIds.has(String(s.id));
      if (isAnswered) return false;
      if (s.requiredAudience === "faculty") return currentUser.pos === "Faculty";
      if (s.requiredAudience === "students") return currentUser.pos === "Student" || currentUser.pos === "Student Officer";
      if (s.requiredAudience === "officers") return currentUser.pos === "Student Officer";
      return true; // "all"
    });
  }, [surveys, currentUser, answeredSurveyIds]);

  return (
    <div className="space-y-6">
      {confirmDialog}
      {/* Simple Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-slate-200">
        <div>
          <h1 className="font-serif text-2xl font-bold text-slate-900">Take a Survey</h1>
          <p className="text-xs text-slate-500 mt-0.5">Surveys available to you</p>
        </div>
        <div className="px-3 py-1.5 rounded-full bg-indigo-50 border border-indigo-100 text-xs font-bold text-indigo-700 w-fit">
          {eligibleSurveys.length} {eligibleSurveys.length === 1 ? "survey" : "surveys"} available
        </div>
      </div>

      {/* Priority / Mandatory Institutional Survey Banner (First thing shown on homepage) */}
      {pendingRequiredSurveys.length > 0 && (
        <div className="space-y-3">
          {pendingRequiredSurveys.map((reqSurvey) => (
            <div
              key={reqSurvey.id}
              className="bg-gradient-to-r from-amber-500 via-orange-500 to-rose-600 rounded-2xl p-5 sm:p-6 text-white shadow-lg border border-amber-300/40 relative overflow-hidden"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="bg-white/20 backdrop-blur-md px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider text-white border border-white/30 flex items-center gap-1">
                      <Star className="w-3 h-3 fill-white" />
                      <span>Priority Action Required</span>
                    </span>
                    <span className="text-amber-100 text-xs font-semibold">
                      Institutional Semester Clearance Requirement
                    </span>
                  </div>
                  <h3 className="font-bold text-lg sm:text-xl text-white leading-tight">
                    {reqSurvey.title}
                  </h3>
                  <p className="text-xs text-amber-50 max-w-2xl leading-relaxed">
                    {reqSurvey.desc || "This institutional evaluation requires your immediate completion for semester clearance records and university quality assurance."}
                  </p>
                </div>
                <button
                  onClick={() => handleLaunchSurvey(reqSurvey)}
                  className="px-5 py-2.5 bg-white hover:bg-amber-50 text-amber-950 font-extrabold text-xs sm:text-sm rounded-xl shadow-md transition-all shrink-0 cursor-pointer flex items-center justify-center gap-2 hover:scale-[1.02] active:scale-[0.98]"
                >
                  <span>Complete Survey Now</span>
                  <ArrowRight className="w-4 h-4 text-amber-700" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Filter and Category Selector Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-3.5">
        {/* Row 1: Categories */}
        <div className="flex items-center justify-between flex-wrap gap-2.5">
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 max-w-full">
            {categoryTabs.map((tab) => {
              const isSelected = categoryFilter === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setCategoryFilter(tab.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium shrink-0 transition-all flex items-center gap-1.5 ${
                    isSelected
                      ? "bg-indigo-600 text-white shadow-xs font-semibold"
                      : "bg-slate-50 text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  <span>{tab.label}</span>
                  <span
                    className={`px-1.5 py-0.2 rounded text-[10px] font-bold ${
                      isSelected ? "bg-white/20 text-white" : "bg-slate-200 text-slate-700"
                    }`}
                  >
                    {tab.count}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={internalSearch}
                onChange={(e) => setInternalSearch(e.target.value)}
                placeholder="Search surveys..."
                className="pl-8 pr-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-700 outline-hidden placeholder:text-slate-400 w-36 sm:w-44 focus:bg-white focus:border-indigo-400"
              />
            </div>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-700 outline-hidden"
            >
              <option value="all">Status: All</option>
              <option value="unanswered">Pending</option>
              <option value="answered">Completed</option>
            </select>
          </div>
        </div>


        {/* Row 2: Performance Filters */}
        <div className="pt-2.5 border-t border-slate-100 flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              Quick Filter:
            </span>
            <div className="inline-flex items-center p-0.5 bg-slate-100 rounded-lg border border-slate-200 text-xs flex-wrap">
              <button
                onClick={() => setPerformanceFilter("all")}
                className={`px-2.5 py-1 rounded-md font-medium transition-all ${
                  performanceFilter === "all"
                    ? "bg-white text-slate-900 shadow-xs font-semibold"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                All Surveys ({eligibleSurveys.length})
              </button>

              <button
                onClick={() => setPerformanceFilter("trending")}
                className={`px-2.5 py-1 rounded-md font-medium transition-all flex items-center gap-1.5 ${
                  performanceFilter === "trending"
                    ? "bg-amber-500 text-white shadow-xs font-bold"
                    : "text-slate-600 hover:text-amber-700"
                }`}
                title="Filtered dynamically: Surveys that reached a mass amount of respondents in this timeframe"
              >
                <Flame className="w-3 h-3" />
                <span>🔥 Trending ({dynamicTrendingSurveys.length})</span>
              </button>
              <button
                onClick={() => setPerformanceFilter("top-rated")}
                className={`px-2.5 py-1 rounded-md font-medium transition-all flex items-center gap-1.5 ${
                  performanceFilter === "top-rated"
                    ? "bg-indigo-600 text-white shadow-xs font-bold"
                    : "text-slate-600 hover:text-indigo-700"
                }`}
                title="Filtered dynamically: Surveys with 4.4+ rating and validated response volume"
              >
                <Star className="w-3 h-3" />
                <span>⭐ Top Rated ({dynamicTopRatedSurveys.length})</span>
              </button>
            </div>
          </div>

          <div className="text-[11px] text-slate-400">
            Designations are evaluated dynamically from live respondent influx & scores.
          </div>
        </div>
      </div>

      {/* Main Surveys Cards Grid */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h3 className="font-bold text-base text-slate-900">
              Available Surveys ({filteredSurveys.length})
            </h3>
            {performanceFilter !== "all" && (
              <span className="text-xs px-2 py-0.5 rounded-full font-bold bg-amber-100 text-amber-800">
                Filtered by {performanceFilter === "trending" ? "🔥 Trending" : "⭐ Top Rated"}
              </span>
            )}
          </div>
          {currentUser && (currentUser.role !== "superadmin" && currentUser.pos !== "Superadmin") && (onCreateSurvey || onCreateNewSurvey) && (
            <button
              onClick={onCreateSurvey || onCreateNewSurvey}
              className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white text-xs font-semibold rounded-lg shadow-xs transition-colors cursor-pointer flex items-center gap-1.5"
            >
              <ClipboardList className="w-3.5 h-3.5" />
              <span>+ Create Survey</span>
            </button>
          )}
        </div>

        {filteredSurveys.length === 0 ? (
          <div className="bg-white rounded-2xl p-10 text-center border border-slate-200 space-y-3">
            <div className="w-12 h-12 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto">
              <ClipboardList className="w-6 h-6" />
            </div>
            <h4 className="font-bold text-slate-900 text-sm">No surveys found</h4>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              No active surveys match your selected filters. Reset filters to view all institutional surveys.
            </p>
            <button
              onClick={() => {
                setPerformanceFilter("all");
                setInternalSearch("");
                setStatusFilter("all");
                setCategoryFilter("all");
              }}
              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-lg"
            >
              Reset Filters
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredSurveys.map((survey) => {
              const isAnswered = answeredSurveyIds.has(String(survey.id));
              const perf = getSurveyPerformanceMetrics(survey);

              return (
                <div
                  key={survey.id}
                  className={`bg-white p-5 rounded-xl border shadow-xs hover:shadow-sm transition-all flex flex-col justify-between ${
                    "border-slate-200 hover:border-slate-300"
                  }`}
                >
                  <div className="space-y-2.5">
                    {/* Top tags & status */}
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 border border-indigo-100 rounded-md text-[11px] font-semibold">
                          {survey.cat}
                        </span>

                        {/* Dynamically Earned Performance Badges */}
                        {perf.isTrending && (
                          <span
                            className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-800 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-md"
                            title={`Dynamic Trending: Mass reach of ${perf.totalResponses} respondents in timeframe (${perf.velocityDaily} resp/day)`}
                          >
                            <Flame className="w-3 h-3 text-amber-500 fill-amber-500" />
                            <span>Trending</span>
                          </span>
                        )}

                        {perf.isTopRated && (
                          <span
                            className="inline-flex items-center gap-1 text-[10px] font-bold text-indigo-800 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-md"
                            title={`Dynamic Top Rated: ${perf.ratingAverage.toFixed(1)} ★ based on verified response volume`}
                          >
                            <Star className="w-3 h-3 text-amber-400 fill-amber-400" />
                            <span>{perf.ratingAverage.toFixed(1)} ★</span>
                          </span>
                        )}
                      </div>

                      {isAnswered ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100">
                          <CheckCircle2 className="w-3 h-3" />
                          <span>Done</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-100">
                          <Clock className="w-3 h-3" />
                          <span>Open</span>
                        </span>
                      )}
                    </div>

                    <h4 className="font-bold text-sm text-slate-900 line-clamp-2 leading-snug">
                      {survey.title}
                    </h4>
                    <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed">
                      {survey.desc}
                    </p>
                  </div>

                  {/* Footer actions */}
                  <div className="pt-4 mt-4 border-t border-slate-100 flex items-center justify-between gap-2">
                    <div className="text-[11px] text-slate-400 font-medium">
                      <span>{survey.responses || 0} responses</span>
                      {perf.isTrending && (
                        <span className="text-[10px] text-amber-600 font-semibold block">
                          ⚡ Mass velocity: {perf.velocityDaily}/day
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5">
                      {isAnswered && !namedAnswerIds.has(String(survey.id)) ? (
                        <span
                          className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 cursor-default"
                          title="You answered this anonymously, so your answers are not linked to you and cannot be shown."
                        >
                          Completed
                        </span>
                      ) : (
                        <button
                          onClick={() => handleLaunchSurvey(survey)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                            isAnswered
                              ? "bg-slate-100 hover:bg-slate-200 text-slate-700"
                              : "bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs"
                          }`}
                        >
                          {isAnswered ? "View Answers" : "Take Survey"}
                        </button>
                      )}

                      {/* Creator and Admin Controls */}
                      {isSuperadmin && (
                        <div className="flex items-center gap-1">
                          {onEditSurvey && (
                            <button
                              onClick={() => onEditSurvey(survey)}
                              className="p-1.5 rounded-lg border border-slate-200 hover:bg-indigo-50 hover:border-indigo-200 text-slate-600 hover:text-indigo-600 cursor-pointer transition-colors"
                              title="Edit Survey Questions & Settings"
                              aria-label="Edit Survey"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                          )}

                          <button
                            onClick={() => onViewAnalytics(survey.id)}
                            className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-600 hover:text-slate-900 cursor-pointer transition-colors"
                            title="View Survey Analytics (Creator & Admin)"
                            aria-label="View Analytics"
                          >
                            <BarChart3 className="w-3.5 h-3.5" />
                          </button>

                          {onDeleteSurvey && (
                            <button
                              onClick={async () => {
                                const ok = await confirm({
                                  title: "Delete this survey?",
                                  message: `"${survey.title}" will be permanently deleted. This cannot be undone.`,
                                  confirmLabel: "Delete",
                                  danger: true,
                                });
                                if (ok) onDeleteSurvey(survey.id, survey.title);
                              }}
                              className="p-1.5 rounded-lg border border-slate-200 hover:bg-rose-50 hover:border-rose-200 text-slate-400 hover:text-rose-600 cursor-pointer transition-colors"
                              title="Delete Survey"
                              aria-label="Delete Survey"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

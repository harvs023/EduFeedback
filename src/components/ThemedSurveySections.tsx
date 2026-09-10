import React, { useState, useMemo } from "react";
import { Survey, UserProfile, SurveyResponse } from "../types";
import {
  Flame,
  Star,
  BookOpen,
  Building2,
  HeartHandshake,
  Landmark,
  Search,
  CheckCircle2,
  Clock,
  Users,
  Calendar,
  ArrowRight,
  Sparkles,
  BarChart3,
  HelpCircle,
  TrendingUp,
  Newspaper,
  ClipboardList,
} from "lucide-react";

interface ThemedSurveySectionsProps {
  surveys: Survey[];
  currentUser: UserProfile | null;
  userResponses?: SurveyResponse[];
  onTakeSurvey?: (survey: Survey) => void;
  onOpenSurvey?: (survey: Survey) => void;
  onViewAnalytics: (surveyId: string | number) => void;
  onCreateSurvey?: () => void;
  onCreateNewSurvey?: () => void;
  searchQuery?: string;
  selectedCategory?: string;
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
  onTakeSurvey,
  onOpenSurvey,
  onViewAnalytics,
  onCreateSurvey,
  onCreateNewSurvey,
  searchQuery = "",
  selectedCategory = "all",
}) => {
  const [selectedTheme, setSelectedTheme] = useState<string>("all");
  const [performanceFilter, setPerformanceFilter] = useState<"all" | "trending" | "top-rated">("all");
  const [internalSearch, setInternalSearch] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<"all" | "unanswered" | "answered">("all");
  const [categoryFilter, setCategoryFilter] = useState<string>(selectedCategory);
  const isSuperadmin = currentUser?.role === "superadmin" || currentUser?.pos === "Superadmin";

  const handleLaunchSurvey = (survey: Survey) => {
    if (onTakeSurvey) onTakeSurvey(survey);
    else if (onOpenSurvey) onOpenSurvey(survey);
  };

  const answeredSurveyIds = useMemo(() => {
    return new Set(userResponses.map((r) => String(r.surveyId)));
  }, [userResponses]);

  // Target audience eligibility check
  const isEligible = (survey: Survey) => {
    if (!currentUser) return true;
    const target = survey.targetAudience;
    if (!target || target.type === "all") return true;
    if (target.type === "faculty") return currentUser.pos === "Faculty";
    if (target.type === "students") return currentUser.pos === "Student" || currentUser.pos === "Student Officer";
    if (target.type === "officers") return currentUser.pos === "Student Officer";
    return true;
  };

  const effectiveSearch = (searchQuery || internalSearch).trim().toLowerCase();

  // Eligible active surveys for current user
  const eligibleSurveys = useMemo(() => {
    return surveys.filter((s) => {
      if (s.status !== "published" && s.status !== "scheduled") return false;
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

  // Purely Thematic Domain Groupings (Academics, Facilities, Student Welfare, Governance)
  const academicSurveys = useMemo(
    () => eligibleSurveys.filter((s) => s.cat === "Course" || s.cat === "Instructor" || s.themeSection === "academics"),
    [eligibleSurveys]
  );
  const facilitiesSurveys = useMemo(
    () => eligibleSurveys.filter((s) => s.cat === "Facilities" || s.themeSection === "facilities"),
    [eligibleSurveys]
  );
  const studentLifeSurveys = useMemo(
    () => eligibleSurveys.filter((s) => s.cat === "Student Services" || s.themeSection === "student-life"),
    [eligibleSurveys]
  );
  const governanceSurveys = useMemo(
    () => eligibleSurveys.filter((s) => s.cat === "General" || s.themeSection === "governance"),
    [eligibleSurveys]
  );

  // Thematic tabs strictly contain substantive institutional domains (Trending and Top Rated are performance filters)
  const themeTabs = [
    { id: "all", label: "All Thematic Domains", count: eligibleSurveys.length, icon: Sparkles },
    { id: "academics", label: "Academic Quality", count: academicSurveys.length, icon: BookOpen },
    { id: "facilities", label: "Campus Facilities", count: facilitiesSurveys.length, icon: Building2 },
    { id: "student-life", label: "Student Welfare", count: studentLifeSurveys.length, icon: HeartHandshake },
    { id: "governance", label: "Governance & Policies", count: governanceSurveys.length, icon: Landmark },
  ];

  // Filtered surveys applying theme, performance metric, status, and category
  const filteredSurveys = useMemo(() => {
    return eligibleSurveys.filter((s) => {
      // 1. Dynamic Performance Filter (Trending / Top Rated earned by performance)
      const perf = getSurveyPerformanceMetrics(s);
      if (performanceFilter === "trending" && !perf.isTrending) return false;
      if (performanceFilter === "top-rated" && !perf.isTopRated) return false;

      // 2. Thematic Domain Filter
      if (selectedTheme === "academics" && s.cat !== "Course" && s.cat !== "Instructor" && s.themeSection !== "academics") return false;
      if (selectedTheme === "facilities" && s.cat !== "Facilities" && s.themeSection !== "facilities") return false;
      if (selectedTheme === "student-life" && s.cat !== "Student Services" && s.themeSection !== "student-life") return false;
      if (selectedTheme === "governance" && s.cat !== "General" && s.themeSection !== "governance") return false;

      // 3. Response Status Filter
      const isAnswered = answeredSurveyIds.has(String(s.id));
      if (statusFilter === "unanswered" && isAnswered) return false;
      if (statusFilter === "answered" && !isAnswered) return false;

      // 4. Category Filter
      if (categoryFilter !== "all" && s.cat !== categoryFilter) return false;

      // 5. Search Query
      if (effectiveSearch) {
        const matchesTitle = s.title.toLowerCase().includes(effectiveSearch);
        const matchesDesc = s.desc.toLowerCase().includes(effectiveSearch);
        const matchesTags = s.tags?.some((t) => t.toLowerCase().includes(effectiveSearch));
        if (!matchesTitle && !matchesDesc && !matchesTags) return false;
      }

      return true;
    });
  }, [eligibleSurveys, selectedTheme, performanceFilter, effectiveSearch, statusFilter, categoryFilter, answeredSurveyIds]);

  return (
    <div className="space-y-6">
      {/* Top 3 Stat Cards (from Sleek Interface design) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <div className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-1">TOTAL RESPONDENTS</div>
          <div className="text-2xl font-bold text-slate-900">12,482</div>
          <div className="text-green-500 text-xs font-medium mt-1">+14% from last month</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <div className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-1">SENTIMENT SCORE</div>
          <div className="text-2xl font-bold text-slate-900">8.4 / 10</div>
          <div className="text-blue-500 text-xs font-medium mt-1">Strong Positive (Tagalog/Eng)</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <div className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-1">ACTIVE SURVEYS</div>
          <div className="text-2xl font-bold text-slate-900">{filteredSurveys.length}</div>
          <div className="text-slate-500 text-xs font-medium mt-1">across 6 themes</div>
        </div>
      </div>

      {/* Main Grid: Left 8 Cols (Performance comparison & Category cards) + Right 4 Cols (News update & Top Performing) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column (8 cols) */}
        <div className="lg:col-span-8 space-y-6">
          {/* Annual Performance Comparison Bar Chart card */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="font-bold text-lg text-slate-900">Annual Performance Comparison</h2>
                <p className="text-xs text-slate-500">Student feedback volume & response velocity</p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setSelectedTheme("all")}
                  className="px-3 py-1 text-xs border border-slate-200 rounded-lg hover:bg-slate-50 font-medium text-slate-600 transition-colors"
                >
                  Past Month
                </button>
                <button className="px-3 py-1 text-xs bg-indigo-600 text-white rounded-lg font-medium shadow-xs">
                  Past Year
                </button>
              </div>
            </div>

            {/* Sleek bar visualization */}
            <div className="relative h-32 flex items-end justify-between gap-3 sm:gap-4 px-2 pt-4">
              <div className="w-full bg-indigo-100 rounded-t h-12 relative group transition-all hover:bg-indigo-200">
                <div className="absolute -top-6 left-1/2 -translate-x-1/2 text-[10px] hidden group-hover:block bg-slate-800 text-white px-1.5 py-0.5 rounded shadow-xs">
                  1.2k
                </div>
              </div>
              <div className="w-full bg-indigo-200 rounded-t h-20 relative group transition-all hover:bg-indigo-300">
                <div className="absolute -top-6 left-1/2 -translate-x-1/2 text-[10px] hidden group-hover:block bg-slate-800 text-white px-1.5 py-0.5 rounded shadow-xs">
                  2.4k
                </div>
              </div>
              <div className="w-full bg-indigo-300 rounded-t h-28 relative group transition-all hover:bg-indigo-400">
                <div className="absolute -top-6 left-1/2 -translate-x-1/2 text-[10px] hidden group-hover:block bg-slate-800 text-white px-1.5 py-0.5 rounded shadow-xs">
                  3.8k
                </div>
              </div>
              <div className="w-full bg-indigo-400 rounded-t h-24 relative group transition-all hover:bg-indigo-500">
                <div className="absolute -top-6 left-1/2 -translate-x-1/2 text-[10px] hidden group-hover:block bg-slate-800 text-white px-1.5 py-0.5 rounded shadow-xs">
                  3.1k
                </div>
              </div>
              <div className="w-full bg-indigo-500 rounded-t h-32 relative group transition-all hover:bg-indigo-600">
                <div className="absolute -top-6 left-1/2 -translate-x-1/2 text-[10px] hidden group-hover:block bg-slate-800 text-white px-1.5 py-0.5 rounded shadow-xs">
                  4.6k
                </div>
              </div>
              <div className="w-full bg-indigo-600 rounded-t h-40 relative group transition-all hover:bg-indigo-700">
                <div className="absolute -top-6 left-1/2 -translate-x-1/2 text-[10px] hidden group-hover:block bg-slate-800 text-white px-1.5 py-0.5 rounded shadow-xs">
                  5.8k
                </div>
              </div>
              <div className="w-full bg-indigo-700 rounded-t h-36 relative group transition-all hover:bg-indigo-800">
                <div className="absolute -top-6 left-1/2 -translate-x-1/2 text-[10px] hidden group-hover:block bg-slate-800 text-white px-1.5 py-0.5 rounded shadow-xs">
                  5.2k
                </div>
              </div>
            </div>

            <div className="flex justify-between text-[10px] text-slate-400 mt-2 px-2 uppercase font-bold tracking-widest">
              <span>Jan</span>
              <span>Feb</span>
              <span>Mar</span>
              <span>Apr</span>
              <span>May</span>
              <span>Jun</span>
              <span>Jul</span>
            </div>
          </div>

          {/* Categorized Themes & Trending Now Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Categorized Themes Pill Card */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-bold text-slate-900">Categorized Themes</h3>
                <span className="text-[10px] text-slate-400 font-medium">Domain Classification</span>
              </div>
              <div className="space-y-2">
                <div
                  onClick={() => setSelectedTheme("academics")}
                  className={`flex items-center justify-between text-sm p-2 rounded-lg cursor-pointer transition-colors ${
                    selectedTheme === "academics" ? "bg-blue-50 border border-blue-200" : "bg-slate-50 hover:bg-slate-100"
                  }`}
                >
                  <span className="flex items-center gap-2 text-slate-700 font-medium">
                    <div className="w-2 h-2 rounded-full bg-blue-500"></div> Academic Quality
                  </span>
                  <span className="font-mono text-xs font-semibold text-slate-600">{academicSurveys.length} surveys</span>
                </div>
                <div
                  onClick={() => setSelectedTheme("facilities")}
                  className={`flex items-center justify-between text-sm p-2 rounded-lg cursor-pointer transition-colors ${
                    selectedTheme === "facilities" ? "bg-amber-50 border border-amber-200" : "hover:bg-slate-50"
                  }`}
                >
                  <span className="flex items-center gap-2 text-slate-700 font-medium">
                    <div className="w-2 h-2 rounded-full bg-amber-500"></div> Campus Facilities
                  </span>
                  <span className="font-mono text-xs font-semibold text-slate-600">{facilitiesSurveys.length} surveys</span>
                </div>
                <div
                  onClick={() => setSelectedTheme("student-life")}
                  className={`flex items-center justify-between text-sm p-2 rounded-lg cursor-pointer transition-colors ${
                    selectedTheme === "student-life" ? "bg-emerald-50 border border-emerald-200" : "hover:bg-slate-50"
                  }`}
                >
                  <span className="flex items-center gap-2 text-slate-700 font-medium">
                    <div className="w-2 h-2 rounded-full bg-emerald-500"></div> Student Welfare
                  </span>
                  <span className="font-mono text-xs font-semibold text-slate-600">{studentLifeSurveys.length} surveys</span>
                </div>
                <div
                  onClick={() => setSelectedTheme("governance")}
                  className={`flex items-center justify-between text-sm p-2 rounded-lg cursor-pointer transition-colors ${
                    selectedTheme === "governance" ? "bg-purple-50 border border-purple-200" : "hover:bg-slate-50"
                  }`}
                >
                  <span className="flex items-center gap-2 text-slate-700 font-medium">
                    <div className="w-2 h-2 rounded-full bg-purple-500"></div> Governance & Policy
                  </span>
                  <span className="font-mono text-xs font-semibold text-slate-600">{governanceSurveys.length} surveys</span>
                </div>
              </div>
            </div>

            {/* Trending Now spotlight card (Calculated Dynamically from response velocity) */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-bold text-amber-600 flex items-center gap-1.5">
                  <Flame className="w-4 h-4 fill-amber-500 text-amber-500" />
                  <span>Trending Now</span>
                </h3>
                <span className="text-[10px] bg-amber-50 text-amber-700 px-2 py-0.5 rounded font-semibold border border-amber-200">
                  Mass Response Reach
                </span>
              </div>

              {dynamicTrendingSurveys.length === 0 ? (
                <div className="py-6 text-center text-xs text-slate-400">
                  No active surveys currently meet mass velocity criteria.
                </div>
              ) : (
                <div className="space-y-3">
                  {dynamicTrendingSurveys.slice(0, 3).map((s, idx) => {
                    const perf = getSurveyPerformanceMetrics(s);
                    return (
                      <div
                        key={s.id}
                        onClick={() => handleLaunchSurvey(s)}
                        className="flex items-start gap-3 group cursor-pointer hover:bg-amber-50/50 p-1.5 -mx-1.5 rounded-lg transition-colors"
                        title="Click to take or view this trending survey"
                      >
                        <div className="text-base font-extrabold text-amber-500/70 font-mono mt-0.5">
                          0{idx + 1}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-bold text-slate-800 group-hover:text-amber-700 truncate">
                            {s.title}
                          </div>
                          <div className="text-[10px] text-slate-500 flex items-center gap-2 mt-0.5">
                            <span className="font-semibold text-slate-700">{perf.totalResponses} respondents</span>
                            <span>•</span>
                            <span className="text-emerald-600 font-semibold">
                              {perf.velocityDaily > 0 ? `${perf.velocityDaily} resp/day` : "Mass reach"}
                            </span>
                            <span>•</span>
                            <span className="text-slate-400">{s.cat}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Column (4 cols) */}
        <div className="lg:col-span-4 space-y-6">
          {/* Dark News Update Card */}
          <div className="bg-indigo-900 rounded-2xl p-6 text-white shadow-md">
            <h3 className="text-sm font-bold mb-4 flex items-center gap-2 uppercase tracking-widest text-indigo-200">
              <Newspaper className="w-4 h-4 text-indigo-300" />
              <span>News Update</span>
            </h3>
            <div className="space-y-4">
              <div className="border-l-2 border-indigo-400 pl-4 py-1">
                <div className="text-[10px] text-indigo-300 font-bold uppercase tracking-wider">SYSTEM ANNOUNCEMENT</div>
                <div className="text-xs leading-relaxed text-indigo-50 mt-0.5">
                  v2.4 Patch: Dynamic survey performance engine enabled (Trending & Top-Rated badges earned automatically).
                </div>
              </div>
              <div className="border-l-2 border-indigo-400 pl-4 py-1">
                <div className="text-[10px] text-indigo-300 font-bold uppercase tracking-wider">CAMPUS PULSE</div>
                <div className="text-xs leading-relaxed text-indigo-50 mt-0.5">
                  Registration for Year-End Academic Feedback cycle opens Monday morning.
                </div>
              </div>
            </div>
          </div>

          {/* Top Performing Surveys Card (Calculated Dynamically from ratings) */}
          <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
                <span>Top Performing Surveys</span>
              </h3>
              <span className="text-[10px] bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded font-semibold border border-indigo-200">
                Verified Ratings
              </span>
            </div>

            {dynamicTopRatedSurveys.length === 0 ? (
              <div className="py-6 text-center text-xs text-slate-400">
                Surveys with 4.4+ rating and volume will appear here.
              </div>
            ) : (
              <div className="space-y-4">
                {dynamicTopRatedSurveys.slice(0, 3).map((s, idx) => {
                  const perf = getSurveyPerformanceMetrics(s);
                  return (
                    <div
                      key={s.id}
                      onClick={() => handleLaunchSurvey(s)}
                      className="flex items-center gap-3.5 group cursor-pointer hover:bg-slate-50 p-1 -mx-1 rounded-lg transition-colors"
                      title="Click to view survey"
                    >
                      <div className="w-7 h-7 bg-indigo-50 text-indigo-700 rounded-lg flex items-center justify-center font-bold text-xs shrink-0">
                        {idx + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-bold text-slate-800 group-hover:text-indigo-600 truncate">
                          {s.title}
                        </div>
                        <div className="w-full bg-slate-100 h-1.5 rounded-full mt-1.5 overflow-hidden">
                          <div
                            className="h-full bg-indigo-600 rounded-full transition-all"
                            style={{ width: `${perf.satisfactionPercent}%` }}
                          ></div>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="text-[11px] font-bold text-slate-800">{perf.ratingAverage.toFixed(1)} ★</div>
                        <div className="text-[9px] text-slate-400">{perf.satisfactionPercent}% sat.</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Local Response Insights Quote */}
            <div className="mt-6 pt-5 border-t border-slate-100">
              <div className="text-[10px] font-bold text-slate-400 mb-2 uppercase tracking-widest">
                Local Response Insights
              </div>
              <div className="bg-slate-50 p-3 rounded-lg italic text-[11px] text-slate-600 leading-relaxed border border-slate-200/60">
                "Maganda ang turo pero kulang sa kagamitan sa lab."
                <span className="not-italic font-bold text-indigo-600 ml-1 block mt-1">
                  — Tagalog NLP Sentiment Synced
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Filter and Theme Selector Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-3.5">
        {/* Row 1: Thematic Domains */}
        <div className="flex items-center justify-between flex-wrap gap-2.5">
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 max-w-full">
            {themeTabs.map((tab) => {
              const isSelected = selectedTheme === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setSelectedTheme(tab.id)}
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

          <div className="flex items-center gap-2">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-700 outline-hidden"
            >
              <option value="all">Status: All</option>
              <option value="unanswered">Pending</option>
              <option value="answered">Completed</option>
            </select>

            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-700 outline-hidden"
            >
              <option value="all">Category: All</option>
              <option value="Course">Course</option>
              <option value="Instructor">Instructor</option>
              <option value="Facilities">Facilities</option>
              <option value="Student Services">Student Services</option>
              <option value="General">General</option>
            </select>
          </div>
        </div>

        {/* Row 2: Performance Evaluation Filter (Decoupled from Themes) */}
        <div className="pt-2.5 border-t border-slate-100 flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              Performance Filter:
            </span>
            <div className="inline-flex items-center p-0.5 bg-slate-100 rounded-lg border border-slate-200 text-xs">
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
                setSelectedTheme("all");
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
                  className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs hover:border-slate-300 hover:shadow-sm transition-all flex flex-col justify-between"
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

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleLaunchSurvey(survey)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                          isAnswered
                            ? "bg-slate-100 hover:bg-slate-200 text-slate-700"
                            : "bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs"
                        }`}
                      >
                        {isAnswered ? "View Answers" : "Take Survey"}
                      </button>

                      {(isSuperadmin || (currentUser && survey.owner?.toLowerCase() === currentUser.email?.toLowerCase())) && (
                        <button
                          onClick={() => onViewAnalytics(survey.id)}
                          className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-600 hover:text-slate-900 cursor-pointer"
                          title="View Survey Analytics (Creator & Admin Only)"
                        >
                          <BarChart3 className="w-4 h-4" />
                        </button>
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

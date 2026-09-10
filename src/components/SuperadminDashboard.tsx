import React, { useState, useMemo, useRef, useEffect } from "react";
import {
  Survey,
  SurveyResponse,
  UserProfile,
  ActivityLog,
  NewsAnnouncement,
  TagalogMLSample,
  SystemBackupData,
} from "../types";
import { UserManagementView } from "./UserManagementView";
import { DatabaseBackupView } from "./DatabaseBackupView";
import {
  ShieldAlert,
  Users,
  ClipboardList,
  Activity,
  Database,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Download,
  Trash2,
  UserCheck,
  UserX,
  Search,
  Eye,
  RotateCcw,
  Calendar,
  Clock,
  Filter,
  Layers,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  ExternalLink,
  Flag,
  BarChart3,
  BrainCircuit,
  CalendarDays,
  ListFilter,
  ArrowUpDown,
  History,
  TrendingUp,
  Tag,
  Building,
} from "lucide-react";

interface SuperadminDashboardProps {
  surveys: Survey[];
  users: UserProfile[];
  logs: ActivityLog[];
  responses?: SurveyResponse[];
  newsList?: NewsAnnouncement[];
  mlDataset?: TagalogMLSample[];
  currentUser?: UserProfile | null;
  onClearFlag: (surveyId: string | number) => void;
  onFlagSurvey: (surveyId: string | number, reason: string) => void;
  onDeleteSurvey: (surveyId: string | number) => void;
  onToggleUserStatus: (email: string, newStatus: "active" | "suspended") => void;
  onPromoteUser: (email: string, newPos: UserProfile["pos"]) => void;
  onAddUser?: (user: UserProfile) => void;
  onUpdateUser?: (email: string, changes: Partial<UserProfile>) => void;
  onDeleteUser?: (email: string) => void;
  onRestoreBackup?: (backupData: SystemBackupData, mode: "overwrite" | "merge") => void;
  onResetDatabase?: () => void;
  onNavigateToAnalytics?: (surveyId?: string | number | "all") => void;
  onNavigateToML?: () => void;
  initialTab?: "surveys" | "flagged" | "users" | "logs" | "backup";
  showToast?: (text: string, type?: "success" | "info") => void;
}

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

// Helper to safely parse creation date from string or timestamp
function parseSurveyDate(survey: Survey): {
  dateObj: Date;
  year: number;
  monthIndex: number; // 0 to 11
  monthName: string;
  day: number;
  isoDate: string; // YYYY-MM-DD
  displayDate: string;
} {
  let dateObj: Date;
  if (survey.createdAtTimestamp) {
    dateObj = new Date(survey.createdAtTimestamp);
  } else if (survey.created) {
    const parsed = new Date(survey.created);
    dateObj = isNaN(parsed.getTime()) ? new Date("2026-02-01") : parsed;
  } else {
    dateObj = new Date("2026-02-01");
  }

  const year = dateObj.getFullYear();
  const monthIndex = dateObj.getMonth();
  const day = dateObj.getDate();
  const monthName = MONTH_NAMES[monthIndex] || "February";
  const isoDate = `${year}-${String(monthIndex + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  const displayDate = dateObj.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  return { dateObj, year, monthIndex, monthName, day, isoDate, displayDate };
}

export const SuperadminDashboard: React.FC<SuperadminDashboardProps> = ({
  surveys,
  users,
  logs,
  responses = [],
  newsList = [],
  mlDataset = [],
  currentUser = null,
  onClearFlag,
  onFlagSurvey,
  onDeleteSurvey,
  onToggleUserStatus,
  onPromoteUser,
  onAddUser,
  onUpdateUser,
  onDeleteUser,
  onRestoreBackup,
  onResetDatabase,
  onNavigateToAnalytics,
  onNavigateToML,
  initialTab = "surveys",
  showToast,
}) => {
  // Tabs: surveys timeline directory, flagged moderation queue, users, logs, backup, ml-supervision
  const [activeTab, setActiveTab] = useState<"surveys" | "flagged" | "users" | "logs" | "backup" | "ml-status">(
    initialTab || "surveys"
  );

  // Horizontal scroll container ref & handlers for governance tabs
  const tabsContainerRef = useRef<HTMLDivElement>(null);

  const handleTabClick = (
    tabId: "surveys" | "flagged" | "users" | "logs" | "backup" | "ml-status",
    e?: React.MouseEvent<HTMLButtonElement>
  ) => {
    setActiveTab(tabId);
    if (e?.currentTarget) {
      e.currentTarget.scrollIntoView({
        behavior: "smooth",
        inline: "nearest",
        block: "nearest",
      });
    }
  };

  // Automatically ensure active tab is scrolled into view
  useEffect(() => {
    const activeBtn = tabsContainerRef.current?.querySelector<HTMLElement>('[data-active="true"]');
    if (activeBtn) {
      activeBtn.scrollIntoView({
        behavior: "smooth",
        inline: "nearest",
        block: "nearest",
      });
    }
  }, [activeTab]);

  const scrollTabs = (direction: "left" | "right") => {
    if (tabsContainerRef.current) {
      tabsContainerRef.current.scrollBy({
        left: direction === "left" ? -240 : 240,
        behavior: "smooth",
      });
    }
  };

  // View presentation mode: Timeline or Table
  const [viewMode, setViewMode] = useState<"timeline" | "table">("timeline");

  // Granular Timeframe Filters (Year, Month, Date)
  const [searchSurvey, setSearchSurvey] = useState<string>("");
  const [filterYear, setFilterYear] = useState<string>("all");
  const [filterMonth, setFilterMonth] = useState<string>("all"); // "1" to "12" or "all"
  const [dateFilterMode, setDateFilterMode] = useState<"all" | "exact" | "today" | "past-7-days" | "past-30-days" | "range">("all");
  const [exactDateInput, setExactDateInput] = useState<string>("");
  const [dateRangeStart, setDateRangeStart] = useState<string>("");
  const [dateRangeEnd, setDateRangeEnd] = useState<string>("");

  // Academic & Status Filters
  const [filterAcademicYear, setFilterAcademicYear] = useState<string>("all");
  const [filterSemester, setFilterSemester] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [filterCreator, setFilterCreator] = useState<string>("all");

  // User Management search
  const [searchUser, setSearchUser] = useState<string>("");

  // Inspect Survey Modal State
  const [selectedSurveyForPreview, setSelectedSurveyForPreview] = useState<Survey | null>(null);

  // Flag Reason Modal State
  const [flagReasonModal, setFlagReasonModal] = useState<{ surveyId: string | number; title: string } | null>(null);
  const [flagReasonInput, setFlagReasonInput] = useState<string>("");

  // Backup State
  const [backupGenerated, setBackupGenerated] = useState<string | null>(null);

  const flaggedSurveys = useMemo(() => surveys.filter((s) => s.flagged), [surveys]);

  // Extract all unique creation years present in data
  const availableYears = useMemo(() => {
    const yearsSet = new Set<number>([2026, 2025, 2024]);
    surveys.forEach((s) => {
      const parsed = parseSurveyDate(s);
      if (!isNaN(parsed.year)) yearsSet.add(parsed.year);
    });
    return Array.from(yearsSet).sort((a, b) => b - a);
  }, [surveys]);

  // Extract all unique creators
  const uniqueCreators = useMemo(() => {
    const map = new Map<string, string>();
    surveys.forEach((s) => {
      if (s.owner) map.set(s.owner, s.ownerName || s.owner);
    });
    return Array.from(map.entries()).map(([email, name]) => ({ email, name }));
  }, [surveys]);

  // Filter surveys strictly based on Year, Month, Date, and criteria
  const filteredSurveys = useMemo(() => {
    const today = new Date();
    const todayIso = today.toISOString().slice(0, 10);
    const sevenDaysAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const thirtyDaysAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

    return surveys.filter((s) => {
      const parsed = parseSurveyDate(s);

      // 1. Year Filter
      if (filterYear !== "all" && String(parsed.year) !== filterYear) {
        return false;
      }

      // 2. Month Filter (1-indexed)
      if (filterMonth !== "all" && String(parsed.monthIndex + 1) !== filterMonth) {
        return false;
      }

      // 3. Date / Day Filter Mode
      if (dateFilterMode === "today") {
        if (parsed.isoDate !== todayIso) return false;
      } else if (dateFilterMode === "past-7-days") {
        if (parsed.isoDate < sevenDaysAgo || parsed.isoDate > todayIso) return false;
      } else if (dateFilterMode === "past-30-days") {
        if (parsed.isoDate < thirtyDaysAgo || parsed.isoDate > todayIso) return false;
      } else if (dateFilterMode === "exact" && exactDateInput) {
        if (parsed.isoDate !== exactDateInput) return false;
      } else if (dateFilterMode === "range") {
        if (dateRangeStart && parsed.isoDate < dateRangeStart) return false;
        if (dateRangeEnd && parsed.isoDate > dateRangeEnd) return false;
      }

      // 4. Academic Year
      if (filterAcademicYear !== "all") {
        const surveyAy = s.academicYear || "2025-2026";
        if (surveyAy !== filterAcademicYear) return false;
      }

      // 5. Semester / Term
      if (filterSemester !== "all") {
        const surveyTerm = s.term || "2nd Sem";
        if (surveyTerm !== filterSemester) return false;
      }

      // 6. Category
      if (filterCategory !== "all" && s.cat !== filterCategory) {
        return false;
      }

      // 7. Status
      if (filterStatus !== "all") {
        if (filterStatus === "flagged") {
          if (!s.flagged) return false;
        } else if (s.status !== filterStatus) {
          return false;
        }
      }

      // 8. Creator
      if (filterCreator !== "all" && s.owner !== filterCreator) {
        return false;
      }

      // 9. Search Query
      if (searchSurvey.trim()) {
        const q = searchSurvey.toLowerCase();
        const matchesTitle = s.title.toLowerCase().includes(q);
        const matchesDesc = s.desc.toLowerCase().includes(q);
        const matchesOwner = (s.ownerName || "").toLowerCase().includes(q) || s.owner.toLowerCase().includes(q);
        const matchesCat = s.cat.toLowerCase().includes(q);
        if (!matchesTitle && !matchesDesc && !matchesOwner && !matchesCat) return false;
      }

      return true;
    });
  }, [
    surveys,
    filterYear,
    filterMonth,
    dateFilterMode,
    exactDateInput,
    dateRangeStart,
    dateRangeEnd,
    filterAcademicYear,
    filterSemester,
    filterCategory,
    filterStatus,
    filterCreator,
    searchSurvey,
  ]);

  // Group filtered surveys by Year -> Month -> Day for Timeline view
  const timelineGroups = useMemo(() => {
    // Sort surveys by creation date descending
    const sorted = [...filteredSurveys].sort((a, b) => {
      const da = parseSurveyDate(a).dateObj.getTime();
      const db = parseSurveyDate(b).dateObj.getTime();
      return db - da;
    });

    const groups: Array<{
      groupKey: string; // e.g. "February 2026"
      year: number;
      monthName: string;
      surveys: Array<{ survey: Survey; parsedDate: ReturnType<typeof parseSurveyDate> }>;
    }> = [];

    sorted.forEach((s) => {
      const p = parseSurveyDate(s);
      const groupKey = `${p.monthName} ${p.year}`;
      let group = groups.find((g) => g.groupKey === groupKey);
      if (!group) {
        group = {
          groupKey,
          year: p.year,
          monthName: p.monthName,
          surveys: [],
        };
        groups.push(group);
      }
      group.surveys.push({ survey: s, parsedDate: p });
    });

    return groups;
  }, [filteredSurveys]);

  // Timeframe stats calculation
  const timeframeStats = useMemo(() => {
    const total = filteredSurveys.length;
    const totalResponses = filteredSurveys.reduce((acc, s) => acc + (s.responses || 0), 0);
    const publishedCount = filteredSurveys.filter((s) => s.status === "published").length;
    const flaggedCount = filteredSurveys.filter((s) => s.flagged).length;
    return { total, totalResponses, publishedCount, flaggedCount };
  }, [filteredSurveys]);

  const handleResetFilters = () => {
    setFilterYear("all");
    setFilterMonth("all");
    setDateFilterMode("all");
    setExactDateInput("");
    setDateRangeStart("");
    setDateRangeEnd("");
    setFilterAcademicYear("all");
    setFilterSemester("all");
    setFilterStatus("all");
    setFilterCategory("all");
    setFilterCreator("all");
    setSearchSurvey("");
  };

  const handleExportLogs = () => {
    const headers = ["Timestamp", "User", "Position", "Action", "Details", "IP_Address"];
    const rows = logs.map((l) => [
      `"${l.time}"`,
      `"${l.user}"`,
      `"${l.pos}"`,
      `"${l.action}"`,
      `"${l.details.replace(/"/g, '""')}"`,
      `"${l.ip || "10.0.1.1"}"`,
    ]);
    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `EduFeedback_Audit_Logs_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleGenerateBackup = () => {
    const timestamp = new Date().toLocaleString();
    setBackupGenerated(timestamp);
  };

  const filteredUsers = users.filter(
    (u) =>
      u.name.toLowerCase().includes(searchUser.toLowerCase()) ||
      u.email.toLowerCase().includes(searchUser.toLowerCase()) ||
      u.pos.toLowerCase().includes(searchUser.toLowerCase())
  );

  return (
    <div className="space-y-6 pb-12">
      {/* Superadmin Oversight Header */}
      <div className="bg-slate-900 text-white rounded-3xl p-6 sm:p-8 shadow-xl border border-slate-800 space-y-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/20 text-indigo-300 text-xs font-bold uppercase tracking-wider border border-indigo-400/30">
              <ShieldAlert className="w-3.5 h-3.5" />
              <span>Superadmin Institutional Governance</span>
            </div>
            <h1 className="font-serif text-2xl sm:text-3xl font-extrabold tracking-tight">
              System Administration & Macro Survey Moderation
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 max-w-3xl leading-relaxed">
              Institutional oversight dashboard for monitoring all evaluation instruments created across years, months, and exact dates. Admin responsibilities focus on content moderation, security configuration, and macro analytics.
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {onNavigateToAnalytics && (
              <button
                onClick={() => onNavigateToAnalytics("all")}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl flex items-center gap-2 transition-all shadow-xs cursor-pointer"
              >
                <BarChart3 className="w-4 h-4" />
                <span>Macro Analytics View</span>
              </button>
            )}
            {onNavigateToML && (
              <button
                onClick={onNavigateToML}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs rounded-xl flex items-center gap-2 border border-slate-700 transition-all cursor-pointer"
              >
                <BrainCircuit className="w-4 h-4 text-emerald-400" />
                <span>Tagalog ML Studio</span>
              </button>
            )}
          </div>
        </div>

        {/* Global Institutional Metrics */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
          <div className="bg-slate-800/80 p-4 rounded-2xl border border-slate-700/80">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
              Total Surveys Authored
            </span>
            <div className="font-serif text-2xl font-black text-white">{surveys.length}</div>
            <span className="text-[11px] text-slate-400">across all academic years</span>
          </div>

          <div className="bg-slate-800/80 p-4 rounded-2xl border border-slate-700/80">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
              Filter Match (Timeframe)
            </span>
            <div className="font-serif text-2xl font-black text-indigo-400">{filteredSurveys.length}</div>
            <span className="text-[11px] text-indigo-300">surveys in selected timeframe</span>
          </div>

          <div className="bg-slate-800/80 p-4 rounded-2xl border border-slate-700/80">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
              Total Response Submissions
            </span>
            <div className="font-serif text-2xl font-black text-emerald-400">{timeframeStats.totalResponses}</div>
            <span className="text-[11px] text-emerald-300">in filtered timeframe</span>
          </div>

          <div className="bg-slate-800/80 p-4 rounded-2xl border border-slate-700/80">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
              Pending Policy Flags
            </span>
            <div className="font-serif text-2xl font-black text-rose-400">{flaggedSurveys.length}</div>
            <span className="text-[11px] text-rose-300">require administrator review</span>
          </div>
        </div>

        {/* Governance Navigation Tabs with Horizontal Scroll Controls */}
        <div className="pt-4 border-t border-slate-800">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => scrollTabs("left")}
              className="p-2 rounded-xl bg-slate-800/90 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700/80 transition-colors cursor-pointer shrink-0"
              title="Scroll tabs left"
              aria-label="Scroll tabs left"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <div
              ref={tabsContainerRef}
              className="flex-1 flex items-center gap-2 overflow-x-auto scroll-smooth py-1 px-0.5"
            >
              {[
                { id: "surveys", label: "Creation Timeframe Directory", count: surveys.length, icon: CalendarDays },
                { id: "flagged", label: "Flagged Surveys Queue", count: flaggedSurveys.length, icon: Flag },
                { id: "users", label: "User & Role Directory", count: users.length, icon: Users },
                { id: "logs", label: "Activity Audit Trail", count: logs.length, icon: Activity },
                { id: "backup", label: "System Backup & Snapshots", icon: Database },
              ].map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    data-active={isActive ? "true" : "false"}
                    onClick={(e) => handleTabClick(tab.id as any, e)}
                    className={`px-4 py-2.5 rounded-xl text-xs font-bold whitespace-nowrap cursor-pointer transition-all flex items-center gap-2 shrink-0 ${
                      isActive
                        ? "bg-indigo-600 text-white shadow-sm ring-1 ring-indigo-400"
                        : "bg-slate-800/90 text-slate-300 hover:bg-slate-700 hover:text-white border border-slate-700/60"
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5 shrink-0" />
                    <span>{tab.label}</span>
                    {tab.count !== undefined && (
                      <span
                        className={`px-1.5 py-0.5 rounded-md text-[10px] font-extrabold ${
                          isActive ? "bg-indigo-700 text-white" : "bg-slate-700 text-slate-300"
                        }`}
                      >
                        {tab.count}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            <button
              type="button"
              onClick={() => scrollTabs("right")}
              className="p-2 rounded-xl bg-slate-800/90 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700/80 transition-colors cursor-pointer shrink-0"
              title="Scroll tabs right"
              aria-label="Scroll tabs right"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* TAB 1: CREATION TIMEFRAME DIRECTORY (YEAR, MONTH, DATE) */}
      {activeTab === "surveys" && (
        <div className="space-y-6">
          {/* Detailed Timeframe Filter Controls Card */}
          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs space-y-5">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-100 pb-4">
              <div>
                <h2 className="font-serif text-lg font-bold text-slate-900 flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-indigo-600" />
                  <span>Surveys Creation Timeframe Filter (Year · Month · Date)</span>
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Filter and inspect all surveys created by university creators on specific years, months, and exact dates.
                </p>
              </div>

              {/* View Mode Switcher (Timeline vs Table) */}
              <div className="flex items-center gap-2">
                <div className="p-1 bg-slate-100 rounded-xl flex items-center border border-slate-200">
                  <button
                    onClick={() => setViewMode("timeline")}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer ${
                      viewMode === "timeline" ? "bg-white text-indigo-700 shadow-xs" : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    <CalendarDays className="w-3.5 h-3.5" />
                    <span>Timeline View</span>
                  </button>
                  <button
                    onClick={() => setViewMode("table")}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer ${
                      viewMode === "table" ? "bg-white text-indigo-700 shadow-xs" : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    <ListFilter className="w-3.5 h-3.5" />
                    <span>Table View</span>
                  </button>
                </div>

                <button
                  onClick={handleResetFilters}
                  className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                  title="Reset all filters"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Reset</span>
                </button>
              </div>
            </div>

            {/* Granular Multi-Tier Filter Controls Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3.5">
              {/* Filter 1: Creation Year */}
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block">
                  Creation Year
                </label>
                <select
                  value={filterYear}
                  onChange={(e) => setFilterYear(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:bg-white focus:outline-hidden"
                >
                  <option value="all">All Years (2024–2026)</option>
                  {availableYears.map((yr) => (
                    <option key={yr} value={String(yr)}>
                      Year {yr}
                    </option>
                  ))}
                </select>
              </div>

              {/* Filter 2: Creation Month */}
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block">
                  Creation Month
                </label>
                <select
                  value={filterMonth}
                  onChange={(e) => setFilterMonth(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:bg-white focus:outline-hidden"
                >
                  <option value="all">All Months (Jan–Dec)</option>
                  {MONTH_NAMES.map((mName, idx) => (
                    <option key={mName} value={String(idx + 1)}>
                      {mName} ({String(idx + 1).padStart(2, "0")})
                    </option>
                  ))}
                </select>
              </div>

              {/* Filter 3: Exact Date Mode */}
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block">
                  Date Mode / Period
                </label>
                <select
                  value={dateFilterMode}
                  onChange={(e) => setDateFilterMode(e.target.value as any)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:bg-white focus:outline-hidden"
                >
                  <option value="all">All Dates</option>
                  <option value="today">Created Today</option>
                  <option value="past-7-days">Past 7 Days</option>
                  <option value="past-30-days">Past 30 Days</option>
                  <option value="exact">Specific Exact Date</option>
                  <option value="range">Custom Date Range</option>
                </select>
              </div>

              {/* Filter 4: Academic Year */}
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block">
                  Academic Term
                </label>
                <select
                  value={filterAcademicYear}
                  onChange={(e) => setFilterAcademicYear(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:bg-white focus:outline-hidden"
                >
                  <option value="all">All Academic Years</option>
                  <option value="2025-2026">AY 2025–2026 (Current)</option>
                  <option value="2024-2025">AY 2024–2025</option>
                  <option value="2023-2024">AY 2023–2024</option>
                </select>
              </div>

              {/* Secondary Filter: Category */}
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block">
                  Category Theme
                </label>
                <select
                  value={filterCategory}
                  onChange={(e) => setFilterCategory(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:bg-white focus:outline-hidden"
                >
                  <option value="all">All Categories</option>
                  <option value="Course">Course</option>
                  <option value="Instructor">Instructor</option>
                  <option value="Facilities">Facilities</option>
                  <option value="Student Services">Student Services</option>
                  <option value="General">General / Governance</option>
                </select>
              </div>

              {/* Secondary Filter: Status */}
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block">
                  Moderation Status
                </label>
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:bg-white focus:outline-hidden"
                >
                  <option value="all">All Statuses</option>
                  <option value="published">Published</option>
                  <option value="scheduled">Scheduled</option>
                  <option value="draft">Draft</option>
                  <option value="flagged">Flagged Only</option>
                  <option value="archived">Archived</option>
                </select>
              </div>

              {/* Secondary Filter: Creator / Owner */}
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block">
                  Creator (Faculty / Officer)
                </label>
                <select
                  value={filterCreator}
                  onChange={(e) => setFilterCreator(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:bg-white focus:outline-hidden truncate"
                >
                  <option value="all">All Creators</option>
                  {uniqueCreators.map((c) => (
                    <option key={c.email} value={c.email}>
                      {c.name} ({c.email})
                    </option>
                  ))}
                </select>
              </div>

              {/* Keyword Search */}
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block">
                  Keyword Search
                </label>
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={searchSurvey}
                    onChange={(e) => setSearchSurvey(e.target.value)}
                    placeholder="Title, owner, keywords..."
                    className="w-full pl-8 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder:text-slate-400 focus:bg-white focus:outline-hidden"
                  />
                </div>
              </div>
            </div>

            {/* Date Pickers (Shown if exact or range selected) */}
            {dateFilterMode === "exact" && (
              <div className="p-4 bg-indigo-50/60 rounded-2xl border border-indigo-100 flex items-center gap-3">
                <Calendar className="w-4 h-4 text-indigo-600" />
                <label className="text-xs font-bold text-indigo-900">Select Specific Creation Date:</label>
                <input
                  type="date"
                  value={exactDateInput}
                  onChange={(e) => setExactDateInput(e.target.value)}
                  className="px-3 py-1.5 bg-white border border-indigo-200 rounded-xl text-xs font-bold text-indigo-950 focus:outline-hidden"
                />
                {exactDateInput && (
                  <button
                    onClick={() => setExactDateInput("")}
                    className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold cursor-pointer underline"
                  >
                    Clear Date
                  </button>
                )}
              </div>
            )}

            {dateFilterMode === "range" && (
              <div className="p-4 bg-indigo-50/60 rounded-2xl border border-indigo-100 flex items-center gap-3 flex-wrap">
                <Calendar className="w-4 h-4 text-indigo-600" />
                <span className="text-xs font-bold text-indigo-900">From Date:</span>
                <input
                  type="date"
                  value={dateRangeStart}
                  onChange={(e) => setDateRangeStart(e.target.value)}
                  className="px-3 py-1.5 bg-white border border-indigo-200 rounded-xl text-xs font-bold text-indigo-950 focus:outline-hidden"
                />
                <span className="text-xs font-bold text-indigo-900">To Date:</span>
                <input
                  type="date"
                  value={dateRangeEnd}
                  onChange={(e) => setDateRangeEnd(e.target.value)}
                  className="px-3 py-1.5 bg-white border border-indigo-200 rounded-xl text-xs font-bold text-indigo-950 focus:outline-hidden"
                />
              </div>
            )}

            {/* Timeframe Results Header Banner */}
            <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-bold text-slate-800">
                  Showing {filteredSurveys.length} of {surveys.length} Total Surveys
                </span>
                <span className="text-slate-400">·</span>
                <span className="text-slate-600">
                  {filterYear !== "all" ? `Year: ${filterYear}` : "All Years"} ·{" "}
                  {filterMonth !== "all" ? `Month: ${MONTH_NAMES[parseInt(filterMonth) - 1]}` : "All Months"} ·{" "}
                  {dateFilterMode !== "all" ? `Date Filter: ${dateFilterMode}` : "All Dates"}
                </span>
              </div>

              <div className="flex items-center gap-3 text-slate-500 font-medium">
                <span>{timeframeStats.publishedCount} Published</span>
                <span>·</span>
                <span>{timeframeStats.totalResponses} Total Responses</span>
                {timeframeStats.flaggedCount > 0 && (
                  <span className="text-rose-600 font-bold">
                    · {timeframeStats.flaggedCount} Flagged
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* VIEW MODE 1: CHRONOLOGICAL TIMELINE VIEW */}
          {viewMode === "timeline" && (
            <div className="space-y-8">
              {timelineGroups.length === 0 ? (
                <div className="bg-white rounded-3xl p-12 text-center border border-slate-200 space-y-3">
                  <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto">
                    <Calendar className="w-6 h-6" />
                  </div>
                  <h3 className="font-serif text-base font-bold text-slate-900">
                    No surveys found for this timeframe
                  </h3>
                  <p className="text-xs text-slate-500 max-w-sm mx-auto">
                    No surveys were created in the selected Year, Month, or Date combination. Adjust the timeframe selectors above to explore other dates.
                  </p>
                  <button
                    onClick={handleResetFilters}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer"
                  >
                    Reset Timeframe Filters
                  </button>
                </div>
              ) : (
                timelineGroups.map((group) => (
                  <div key={group.groupKey} className="space-y-4">
                    {/* Month & Year Group Header */}
                    <div className="flex items-center gap-3">
                      <div className="px-3.5 py-1.5 bg-slate-900 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-xs">
                        <Calendar className="w-3.5 h-3.5 text-indigo-400" />
                        <span>{group.groupKey}</span>
                      </div>
                      <div className="h-px bg-slate-200 flex-1"></div>
                      <span className="text-xs font-semibold text-slate-400">
                        {group.surveys.length} {group.surveys.length === 1 ? "survey created" : "surveys created"}
                      </span>
                    </div>

                    {/* Timeline Cards Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {group.surveys.map(({ survey: s, parsedDate: p }) => (
                        <div
                          key={s.id}
                          className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs hover:border-slate-300 hover:shadow-sm transition-all flex flex-col justify-between space-y-4"
                        >
                          <div className="space-y-3">
                            {/* Top metadata badge bar */}
                            <div className="flex items-center justify-between gap-2 flex-wrap">
                              <div className="flex items-center gap-1.5">
                                <span className="px-2.5 py-0.5 rounded-lg bg-indigo-50 text-indigo-700 border border-indigo-100 text-[11px] font-bold">
                                  {s.cat}
                                </span>
                                <span className="text-[11px] font-semibold text-slate-500">
                                  {s.academicYear || "AY 2025-2026"} · {s.term || "2nd Sem"}
                                </span>
                              </div>

                              {/* Status badge */}
                              {s.flagged ? (
                                <span className="px-2 py-0.5 rounded-md bg-rose-50 text-rose-700 border border-rose-200 text-[10px] font-bold flex items-center gap-1">
                                  <Flag className="w-3 h-3" />
                                  <span>Flagged</span>
                                </span>
                              ) : (
                                <span
                                  className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                                    s.status === "published"
                                      ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                      : s.status === "scheduled"
                                      ? "bg-blue-50 text-blue-700 border border-blue-200"
                                      : "bg-slate-100 text-slate-700 border border-slate-200"
                                  }`}
                                >
                                  {s.status.toUpperCase()}
                                </span>
                              )}
                            </div>

                            {/* Title & Description */}
                            <div className="space-y-1">
                              <h3 className="font-bold text-base text-slate-900 leading-snug">
                                {s.title}
                              </h3>
                              <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed">
                                {s.desc}
                              </p>
                            </div>

                            {/* Creator & Creation Date details */}
                            <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 space-y-1 text-xs">
                              <div className="flex items-center justify-between text-slate-700">
                                <span className="font-semibold">Author / Creator:</span>
                                <span className="font-bold text-slate-900">{s.ownerName || "Faculty Member"}</span>
                              </div>
                              <div className="flex items-center justify-between text-slate-500 text-[11px]">
                                <span>Email:</span>
                                <span className="font-mono">{s.owner}</span>
                              </div>
                              <div className="flex items-center justify-between text-slate-500 text-[11px] pt-1 border-t border-slate-200/60">
                                <span className="flex items-center gap-1">
                                  <Clock className="w-3 h-3 text-slate-400" />
                                  <span>Creation Date:</span>
                                </span>
                                <span className="font-bold text-slate-800">{p.displayDate}</span>
                              </div>
                            </div>
                          </div>

                          {/* Footer response stats & admin moderation action buttons */}
                          <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                            <div className="text-xs space-y-0.5">
                              <div className="font-bold text-slate-900">{s.responses || 0} Submissions</div>
                              <div className="text-[11px] text-slate-400">
                                {s.questions?.length || 0} Questions · {s.ratingAverage ? `${s.ratingAverage} / 5.0 Avg` : "No rating"}
                              </div>
                            </div>

                            <div className="flex items-center gap-1.5">
                              <button
                                onClick={() => setSelectedSurveyForPreview(s)}
                                className="p-2 hover:bg-slate-100 text-slate-600 hover:text-slate-900 rounded-xl transition-colors cursor-pointer border border-slate-200"
                                title="Inspect Survey Questions"
                              >
                                <Eye className="w-4 h-4" />
                              </button>

                              {onNavigateToAnalytics && (
                                <button
                                  onClick={() => onNavigateToAnalytics(s.id)}
                                  className="p-2 hover:bg-indigo-50 text-slate-600 hover:text-indigo-700 rounded-xl transition-colors cursor-pointer border border-slate-200"
                                  title="View Macro Survey Analytics"
                                >
                                  <BarChart3 className="w-4 h-4" />
                                </button>
                              )}

                              {s.flagged ? (
                                <button
                                  onClick={() => onClearFlag(s.id)}
                                  className="p-2 hover:bg-emerald-50 text-emerald-600 rounded-xl transition-colors cursor-pointer border border-emerald-200"
                                  title="Clear Flag & Approve"
                                >
                                  <CheckCircle2 className="w-4 h-4" />
                                </button>
                              ) : (
                                <button
                                  onClick={() => setFlagReasonModal({ surveyId: s.id, title: s.title })}
                                  className="p-2 hover:bg-amber-50 text-slate-500 hover:text-amber-600 rounded-xl transition-colors cursor-pointer border border-slate-200"
                                  title="Flag for Policy Review"
                                >
                                  <Flag className="w-4 h-4" />
                                </button>
                              )}

                              <button
                                onClick={() => {
                                  if (window.confirm(`Permanently remove survey "${s.title}" from institutional records?`)) {
                                    onDeleteSurvey(s.id);
                                  }
                                }}
                                className="p-2 hover:bg-rose-50 text-slate-400 hover:text-rose-600 rounded-xl transition-colors cursor-pointer border border-slate-200"
                                title="Delete Survey"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* VIEW MODE 2: STRUCTURED TABLE VIEW */}
          {viewMode === "table" && (
            <div className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-slate-100 text-slate-700 font-bold uppercase text-[10px] tracking-wider">
                    <tr>
                      <th className="p-4">Survey & Category</th>
                      <th className="p-4">Created Date (Timeframe)</th>
                      <th className="p-4">Creator / Author</th>
                      <th className="p-4">Academic Term</th>
                      <th className="p-4">Responses & Rating</th>
                      <th className="p-4">Status</th>
                      <th className="p-4 text-right">Moderation Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {filteredSurveys.length > 0 ? (
                      filteredSurveys.map((s) => {
                        const parsed = parseSurveyDate(s);
                        return (
                          <tr key={s.id} className="hover:bg-slate-50 transition-colors">
                            <td className="p-4 space-y-1 max-w-xs">
                              <div className="font-bold text-slate-900 text-sm leading-snug">{s.title}</div>
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 font-bold text-[10px] border border-indigo-200">
                                  {s.cat}
                                </span>
                                <span className="text-[11px] text-slate-500">
                                  {s.questions?.length || 0} Questions
                                </span>
                              </div>
                            </td>

                            <td className="p-4 space-y-0.5 whitespace-nowrap">
                              <div className="font-bold text-slate-900 flex items-center gap-1.5">
                                <Calendar className="w-3.5 h-3.5 text-indigo-600" />
                                <span>{parsed.displayDate}</span>
                              </div>
                              <div className="text-[10px] text-slate-400 font-mono">
                                Year {parsed.year} · {parsed.monthName}
                              </div>
                            </td>

                            <td className="p-4 space-y-0.5">
                              <div className="font-bold text-slate-900">{s.ownerName || "Faculty"}</div>
                              <div className="text-[11px] text-slate-500 font-mono">{s.owner}</div>
                            </td>

                            <td className="p-4 space-y-0.5 whitespace-nowrap">
                              <div className="font-semibold text-slate-800">
                                {s.academicYear || "AY 2025-2026"}
                              </div>
                              <div className="text-[10px] text-slate-500">{s.term || "2nd Sem"}</div>
                            </td>

                            <td className="p-4 space-y-0.5 whitespace-nowrap">
                              <div className="font-extrabold text-slate-900">
                                {s.responses || 0} Submissions
                              </div>
                              <div className="text-[11px] text-amber-600 font-bold">
                                {s.ratingAverage ? `${s.ratingAverage} / 5.0 Rating` : "No rating"}
                              </div>
                            </td>

                            <td className="p-4">
                              {s.flagged ? (
                                <span className="px-2 py-0.5 rounded-md bg-rose-50 text-rose-700 border border-rose-200 font-bold text-[10px] flex items-center gap-1 w-fit">
                                  <Flag className="w-3 h-3" />
                                  <span>Flagged</span>
                                </span>
                              ) : (
                                <span
                                  className={`px-2 py-0.5 rounded-md font-bold text-[10px] ${
                                    s.status === "published"
                                      ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                      : s.status === "scheduled"
                                      ? "bg-blue-50 text-blue-700 border border-blue-200"
                                      : "bg-slate-100 text-slate-700 border border-slate-200"
                                  }`}
                                >
                                  {s.status.toUpperCase()}
                                </span>
                              )}
                            </td>

                            <td className="p-4 text-right space-x-1 whitespace-nowrap">
                              <button
                                onClick={() => setSelectedSurveyForPreview(s)}
                                title="Inspect Survey Questions"
                                className="p-1.5 hover:bg-slate-100 text-slate-600 hover:text-slate-900 rounded-lg transition-colors cursor-pointer"
                              >
                                <Eye className="w-4 h-4" />
                              </button>
                              {onNavigateToAnalytics && (
                                <button
                                  onClick={() => onNavigateToAnalytics(s.id)}
                                  title="View Analytics"
                                  className="p-1.5 hover:bg-indigo-50 text-slate-600 hover:text-indigo-700 rounded-lg transition-colors cursor-pointer"
                                >
                                  <BarChart3 className="w-4 h-4" />
                                </button>
                              )}
                              {s.flagged ? (
                                <button
                                  onClick={() => onClearFlag(s.id)}
                                  title="Clear Flag"
                                  className="p-1.5 hover:bg-emerald-50 text-slate-400 hover:text-emerald-600 rounded-lg transition-colors cursor-pointer"
                                >
                                  <CheckCircle2 className="w-4 h-4" />
                                </button>
                              ) : (
                                <button
                                  onClick={() => setFlagReasonModal({ surveyId: s.id, title: s.title })}
                                  title="Flag Survey for Review"
                                  className="p-1.5 hover:bg-amber-50 text-slate-400 hover:text-amber-600 rounded-lg transition-colors cursor-pointer"
                                >
                                  <Flag className="w-4 h-4" />
                                </button>
                              )}
                              <button
                                onClick={() => {
                                  if (window.confirm(`Are you sure you want to permanently delete survey "${s.title}"?`)) {
                                    onDeleteSurvey(s.id);
                                  }
                                }}
                                title="Delete Survey"
                                className="p-1.5 hover:bg-rose-50 text-slate-400 hover:text-rose-600 rounded-lg transition-colors cursor-pointer"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan={7} className="p-8 text-center text-slate-400">
                          No surveys found matching the selected Year, Month, and Date filters.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: FLAGGED SURVEYS MODERATION QUEUE */}
      {activeTab === "flagged" && (
        <div className="bg-white p-6 sm:p-8 rounded-3xl border border-slate-200 shadow-xs space-y-6">
          <div className="border-b border-slate-100 pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h2 className="font-serif text-xl font-bold text-slate-900">
                Flagged Surveys Moderation Queue ({flaggedSurveys.length})
              </h2>
              <p className="text-xs text-slate-500">
                Surveys reported for inappropriate question design, campus evaluation policy non-compliance, or misleading content.
              </p>
            </div>
          </div>

          {flaggedSurveys.length > 0 ? (
            <div className="space-y-4">
              {flaggedSurveys.map((s) => (
                <div
                  key={s.id}
                  className="p-5 rounded-2xl bg-rose-50/50 border border-rose-200 flex flex-col md:flex-row md:items-center justify-between gap-4"
                >
                  <div className="space-y-1.5 max-w-2xl">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded-md bg-rose-100 text-rose-800 font-bold text-[10px] border border-rose-300">
                        Flagged
                      </span>
                      <span className="text-xs font-semibold text-slate-500">
                        {s.cat} · {s.academicYear || "AY 2025-2026"}
                      </span>
                    </div>
                    <h3 className="font-bold text-base text-slate-900">{s.title}</h3>
                    <p className="text-xs text-rose-800 font-medium">
                      Reported Reason: {s.flagReason || "Violates campus evaluation content policies"}
                    </p>
                    <div className="text-[11px] text-slate-500">
                      Created by: {s.ownerName} ({s.owner}) on {s.created}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    <button
                      onClick={() => setSelectedSurveyForPreview(s)}
                      className="px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold text-xs rounded-xl cursor-pointer"
                    >
                      Inspect Questions
                    </button>
                    <button
                      onClick={() => onClearFlag(s.id)}
                      className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl cursor-pointer"
                    >
                      Clear Flag
                    </button>
                    <button
                      onClick={() => onDeleteSurvey(s.id)}
                      className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl cursor-pointer"
                    >
                      Delete Survey
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-10 text-center text-slate-400 border border-dashed border-slate-200 rounded-2xl space-y-2">
              <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto" />
              <div className="text-sm font-bold text-slate-700">Flagged Queue is Clean</div>
              <p className="text-xs text-slate-400">All institutional surveys meet university standards and policies.</p>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: USER & ROLE DIRECTORY */}
      {activeTab === "users" && (
        <UserManagementView
          users={users}
          currentUser={currentUser}
          onAddUser={onAddUser || (() => {})}
          onUpdateUser={onUpdateUser || (() => {})}
          onDeleteUser={onDeleteUser || (() => {})}
          onToggleUserStatus={onToggleUserStatus}
          onPromoteUser={onPromoteUser}
        />
      )}

      {/* TAB 4: ACTIVITY AUDIT TRAIL */}
      {activeTab === "logs" && (
        <div className="bg-white p-6 sm:p-8 rounded-3xl border border-slate-200 shadow-xs space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
            <div>
              <h2 className="font-serif text-xl font-bold text-slate-900">
                Institutional Security & Activity Audit Trail
              </h2>
              <p className="text-xs text-slate-500">
                Real-time chronological log of administrative operations, survey creation events, and policy audits.
              </p>
            </div>

            <button
              onClick={handleExportLogs}
              className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl flex items-center gap-2 cursor-pointer transition-all"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export CSV Logs</span>
            </button>
          </div>

          <div className="border border-slate-200 rounded-2xl overflow-hidden max-h-96 overflow-y-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-100 text-slate-700 font-bold uppercase text-[10px] tracking-wider sticky top-0">
                <tr>
                  <th className="p-3.5">Timestamp</th>
                  <th className="p-3.5">User & Position</th>
                  <th className="p-3.5">Action Event</th>
                  <th className="p-3.5">Activity Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700 font-mono text-[11px]">
                {logs.map((log, idx) => (
                  <tr key={log.id || idx} className="hover:bg-slate-50 transition-colors">
                    <td className="p-3.5 text-slate-500 whitespace-nowrap">{log.time}</td>
                    <td className="p-3.5">
                      <span className="font-bold text-slate-900 font-sans">{log.user}</span>
                      <span className="text-[10px] text-slate-500 block">({log.pos})</span>
                    </td>
                    <td className="p-3.5 font-bold text-indigo-700">{log.action}</td>
                    <td className="p-3.5 text-slate-700 font-sans">{log.details}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 5: BACKUP & DATA SNAPSHOTS */}
      {activeTab === "backup" && (
        <DatabaseBackupView
          surveys={surveys}
          responses={responses}
          users={users}
          logs={logs}
          newsList={newsList}
          mlDataset={mlDataset}
          currentUser={currentUser}
          onRestoreBackup={onRestoreBackup || (() => {})}
          onResetDatabase={onResetDatabase || (() => {})}
          showToast={showToast || (() => {})}
        />
      )}

      {/* INSPECT SURVEY QUESTIONS MODAL */}
      {selectedSurveyForPreview && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setSelectedSurveyForPreview(null)}
        >
          <div
            className="bg-white rounded-3xl max-w-2xl w-full p-6 sm:p-8 shadow-2xl border border-slate-200 max-h-[85vh] overflow-y-auto space-y-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between border-b border-slate-100 pb-4">
              <div>
                <span className="px-2.5 py-0.5 rounded-md bg-indigo-50 text-indigo-700 font-bold text-xs border border-indigo-200">
                  {selectedSurveyForPreview.cat} · {selectedSurveyForPreview.academicYear || "AY 2025-2026"}
                </span>
                <h3 className="font-serif text-xl font-bold text-slate-900 mt-2">
                  {selectedSurveyForPreview.title}
                </h3>
                <p className="text-xs text-slate-500 mt-1">{selectedSurveyForPreview.desc}</p>
                <div className="mt-2 text-[11px] text-slate-500">
                  Created by: <span className="font-bold text-slate-800">{selectedSurveyForPreview.ownerName}</span> ({selectedSurveyForPreview.owner}) on {selectedSurveyForPreview.created}
                </div>
              </div>
              <button
                onClick={() => setSelectedSurveyForPreview(null)}
                className="p-1 rounded-full hover:bg-slate-100 text-slate-400 cursor-pointer"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                Evaluation Instruments & Questions ({selectedSurveyForPreview.questions.length})
              </h4>
              <div className="space-y-3">
                {selectedSurveyForPreview.questions.map((q, idx) => (
                  <div key={idx} className="p-4 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-2">
                    <div className="font-bold text-slate-900">
                      {idx + 1}. {q.text} <span className="font-normal text-slate-500">({q.type})</span>
                    </div>
                    {q.labels && (
                      <div className="text-slate-500 text-[11px]">Rating Scale: {q.labels.join(" · ")}</div>
                    )}
                    {q.options && (
                      <div className="text-slate-500 text-[11px]">Options: {q.options.join(", ")}</div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-end pt-4 border-t border-slate-100">
              <button
                onClick={() => setSelectedSurveyForPreview(null)}
                className="px-5 py-2 bg-slate-900 text-white font-bold text-xs rounded-xl cursor-pointer"
              >
                Close Preview
              </button>
            </div>
          </div>
        </div>
      )}

      {/* FLAG REASON MODAL */}
      {flagReasonModal && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setFlagReasonModal(null)}
        >
          <div
            className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-serif text-lg font-bold text-slate-900">
              Flag Survey for Policy Review
            </h3>
            <p className="text-xs text-slate-600">
              Enter the reason why survey "{flagReasonModal.title}" is being flagged:
            </p>
            <textarea
              rows={3}
              value={flagReasonInput}
              onChange={(e) => setFlagReasonInput(e.target.value)}
              placeholder="e.g. Inappropriate question design or misleading instructions..."
              className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:bg-white focus:outline-hidden"
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setFlagReasonModal(null)}
                className="px-4 py-2 bg-slate-100 text-slate-700 font-bold text-xs rounded-xl cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  onFlagSurvey(flagReasonModal.surveyId, flagReasonInput || "Administrative Policy Flag");
                  setFlagReasonModal(null);
                  setFlagReasonInput("");
                }}
                className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-xl cursor-pointer"
              >
                Confirm Flag
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

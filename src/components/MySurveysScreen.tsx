import React, { useState, useMemo } from "react";
import { Survey, UserProfile, SurveyResponse } from "../types";
import {
  PlusCircle,
  Pencil,
  Trash2,
  BarChart3,
  Users,
  Calendar,
  Layers,
  Search,
  Eye,
  CheckCircle,
  Clock,
  Copy,
  AlertCircle,
  ExternalLink,
  Filter,
  ShieldCheck,
  ShieldAlert,
  Flag,
  SlidersHorizontal,
  Download,
  Check,
  Sparkles,
  RefreshCw,
  FolderKanban,
  Tag,
  User,
  CheckSquare,
  X,
  FileSpreadsheet,
} from "lucide-react";

interface MySurveysScreenProps {
  surveys: Survey[];
  currentUser: UserProfile | null;
  userResponses: SurveyResponse[];
  onCreateNewSurvey: () => void;
  onEditSurvey: (survey: Survey) => void;
  onDeleteSurvey: (surveyId: string | number, surveyTitle?: string) => void;
  onViewAnalytics: (surveyId: string | number) => void;
  onTakeSurvey?: (survey: Survey) => void;
  onFlagSurvey?: (surveyId: string | number, reason: string) => void;
  onClearFlag?: (surveyId: string | number) => void;
  onUpdateSurveyStatus?: (surveyId: string | number, newStatus: "published" | "draft" | "scheduled" | "closed") => void;
  onDuplicateSurvey?: (survey: Survey) => void;
}

export const MySurveysScreen: React.FC<MySurveysScreenProps> = ({
  surveys,
  currentUser,
  userResponses,
  onCreateNewSurvey,
  onEditSurvey,
  onDeleteSurvey,
  onViewAnalytics,
  onTakeSurvey,
  onFlagSurvey,
  onClearFlag,
  onUpdateSurveyStatus,
  onDuplicateSurvey,
}) => {
  const isAdmin = currentUser?.role === "superadmin" || currentUser?.pos === "Superadmin";
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "published" | "draft" | "scheduled" | "closed" | "flagged">("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [creatorFilter, setCreatorFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<"newest" | "responses" | "title" | "flagged">("newest");
  const [copiedId, setCopiedId] = useState<string | number | null>(null);

  // Moderation Flag Modal State
  const [flagModalSurvey, setFlagModalSurvey] = useState<{ id: string | number; title: string } | null>(null);
  const [flagReasonInput, setFlagReasonInput] = useState<string>("");

  // Scope: For Admin, show all campus surveys (Campus Survey Management).
  // For standard users, show only surveys authored by currentUser (My Surveys).
  const visibleSurveys = useMemo(() => {
    if (!currentUser?.email) return [];
    if (isAdmin) return surveys;
    return surveys.filter((s) => s.owner?.toLowerCase() === currentUser.email?.toLowerCase());
  }, [surveys, currentUser, isAdmin]);

  // Aggregate statistics
  const stats = useMemo(() => {
    const total = visibleSurveys.length;
    const published = visibleSurveys.filter((s) => s.status === "published").length;
    const drafts = visibleSurveys.filter((s) => s.status === "draft").length;
    const scheduled = visibleSurveys.filter((s) => s.status === "scheduled").length;
    const closed = visibleSurveys.filter((s) => s.status === "closed").length;
    const flagged = visibleSurveys.filter((s) => s.flagged).length;
    const totalResponses = visibleSurveys.reduce((acc, curr) => acc + (curr.responses || 0), 0);
    const avgResponses = total > 0 ? (totalResponses / total).toFixed(1) : "0";

    return { total, published, drafts, scheduled, closed, flagged, totalResponses, avgResponses };
  }, [visibleSurveys]);

  // Unique categories
  const availableCategories = useMemo(() => {
    const set = new Set<string>();
    visibleSurveys.forEach((s) => {
      if (s.cat) set.add(s.cat);
    });
    return Array.from(set).sort();
  }, [visibleSurveys]);

  // Unique creators (for admin filtering)
  const uniqueCreators = useMemo(() => {
    const map = new Map<string, string>();
    surveys.forEach((s) => {
      if (s.owner) {
        map.set(s.owner.toLowerCase(), s.ownerName || s.owner);
      }
    });
    return Array.from(map.entries()).map(([email, name]) => ({ email, name }));
  }, [surveys]);

  // Filter and sort surveys
  const filteredSurveys = useMemo(() => {
    return visibleSurveys
      .filter((s) => {
        // Status filter
        if (statusFilter === "flagged") {
          if (!s.flagged) return false;
        } else if (statusFilter !== "all" && s.status !== statusFilter) {
          return false;
        }

        // Category filter
        if (categoryFilter !== "all" && s.cat?.toLowerCase() !== categoryFilter.toLowerCase()) {
          return false;
        }

        // Creator filter (Admin only)
        if (isAdmin && creatorFilter !== "all" && s.owner?.toLowerCase() !== creatorFilter.toLowerCase()) {
          return false;
        }

        // Text search
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const matchTitle = s.title.toLowerCase().includes(q);
          const matchDesc = s.desc?.toLowerCase().includes(q);
          const matchCat = s.cat?.toLowerCase().includes(q);
          const matchOwner = (s.ownerName || s.owner || "").toLowerCase().includes(q);
          const matchYear = (s.academicYear || "").toLowerCase().includes(q);
          if (!matchTitle && !matchDesc && !matchCat && !matchOwner && !matchYear) return false;
        }
        return true;
      })
      .sort((a, b) => {
        if (sortBy === "responses") return (b.responses || 0) - (a.responses || 0);
        if (sortBy === "title") return a.title.localeCompare(b.title);
        if (sortBy === "flagged") {
          if (a.flagged && !b.flagged) return -1;
          if (!a.flagged && b.flagged) return 1;
        }
        // default newest
        return String(b.id).localeCompare(String(a.id));
      });
  }, [visibleSurveys, statusFilter, categoryFilter, creatorFilter, searchQuery, sortBy, isAdmin]);

  const handleCopyLink = (surveyId: string | number) => {
    const shareUrl = `${window.location.origin}/#survey-${surveyId}`;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(shareUrl);
      setCopiedId(surveyId);
      setTimeout(() => setCopiedId(null), 2000);
    }
  };

  const handleExportCSV = () => {
    const headers = [
      "Survey ID",
      "Title",
      "Category",
      "Status",
      "Responses",
      "Questions",
      "Creator Name",
      "Creator Email",
      "Academic Year",
      "Date Created",
      "Flagged Status",
      "Flag Reason",
    ];

    const rows = filteredSurveys.map((s) => [
      `"${s.id}"`,
      `"${(s.title || "").replace(/"/g, '""')}"`,
      `"${(s.cat || "").replace(/"/g, '""')}"`,
      `"${s.status || "published"}"`,
      s.responses || 0,
      s.questions?.length || s.questionCount || 0,
      `"${(s.ownerName || "").replace(/"/g, '""')}"`,
      `"${(s.owner || "").replace(/"/g, '""')}"`,
      `"${s.academicYear || "2025-2026"}"`,
      `"${s.created || ""}"`,
      s.flagged ? "Flagged" : "Normal",
      `"${(s.flagReason || "").replace(/"/g, '""')}"`,
    ]);

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute(
      "download",
      `EduFeedback_Surveys_Registry_${new Date().toISOString().slice(0, 10)}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-12">
      {/* Header Banner - Contextual for Admin vs Creator */}
      <div className="bg-white p-6 sm:p-8 rounded-3xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-50 text-indigo-700 text-xs font-bold tracking-wider uppercase border border-indigo-200">
            {isAdmin ? (
              <>
                <SlidersHorizontal className="w-3.5 h-3.5 text-indigo-600" />
                <span>Institutional Administration • Survey Operations</span>
              </>
            ) : (
              <>
                <FolderKanban className="w-3.5 h-3.5 text-indigo-600" />
                <span>Author Workspace</span>
              </>
            )}
          </div>
          <h1 className="font-serif text-2xl sm:text-3xl font-extrabold text-slate-900">
            {isAdmin ? "Campus Survey Management" : "My Surveys & Instruments"}
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 max-w-2xl leading-relaxed">
            {isAdmin
              ? "Centrally supervise, regulate, and configure all feedback instruments across faculties, student council bodies, and university units. Monitor live student submissions, update availability status, and govern moderation."
              : "Manage your authored feedback surveys, review live responses, update question sets, and track participant engagement across your campus evaluations."}
          </p>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          {isAdmin && (
            <button
              onClick={handleExportCSV}
              className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl border border-slate-200 cursor-pointer flex items-center gap-2 transition-all shadow-xs"
              title="Download survey registry CSV"
            >
              <Download className="w-4 h-4 text-slate-500" />
              <span>Export Registry</span>
            </button>
          )}

          <button
            onClick={onCreateNewSurvey}
            className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-md shadow-indigo-500/20 cursor-pointer flex items-center gap-2 transition-all"
          >
            <PlusCircle className="w-4 h-4" />
            <span>{isAdmin ? "Create Institutional Survey" : "Create New Survey"}</span>
          </button>
        </div>
      </div>

      {/* Aggregate Statistics Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3.5">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <p className="text-xs text-slate-500 font-medium">{isAdmin ? "Campus Surveys" : "Total Authored"}</p>
          <p className="text-2xl font-black text-slate-900 mt-1">{stats.total}</p>
          <p className="text-[11px] text-slate-400 mt-0.5">
            {isAdmin ? "Across all departments" : "Created by your account"}
          </p>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <p className="text-xs text-slate-500 font-medium">Live & Published</p>
          <p className="text-2xl font-black text-emerald-600 mt-1 flex items-center gap-2">
            <span>{stats.published}</span>
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          </p>
          <p className="text-[11px] text-slate-400 mt-0.5">Actively accepting input</p>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <p className="text-xs text-slate-500 font-medium">{isAdmin ? "Campus Submissions" : "Total Responses"}</p>
          <p className="text-2xl font-black text-indigo-600 mt-1">{stats.totalResponses.toLocaleString()}</p>
          <p className="text-[11px] text-slate-400 mt-0.5">
            {isAdmin ? "Aggregated student/faculty feedback" : "Participant submissions"}
          </p>
        </div>

        <div
          onClick={() => setStatusFilter("flagged")}
          className={`p-4 rounded-2xl border shadow-xs cursor-pointer transition-all ${
            stats.flagged > 0
              ? "bg-rose-50/60 border-rose-200 hover:bg-rose-100/60"
              : "bg-white border-slate-200"
          }`}
          title="Filter by flagged surveys"
        >
          <div className="flex items-center justify-between">
            <p className={`text-xs font-medium ${stats.flagged > 0 ? "text-rose-700" : "text-slate-500"}`}>
              Under Review / Flagged
            </p>
            {stats.flagged > 0 && <ShieldAlert className="w-4 h-4 text-rose-600" />}
          </div>
          <p className={`text-2xl font-black mt-1 ${stats.flagged > 0 ? "text-rose-600" : "text-slate-700"}`}>
            {stats.flagged}
          </p>
          <p className="text-[11px] text-slate-400 mt-0.5">
            {stats.flagged > 0 ? "Pending moderation check" : "Zero active flags"}
          </p>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs col-span-2 sm:col-span-1">
          <p className="text-xs text-slate-500 font-medium">Drafts & Scheduled</p>
          <p className="text-2xl font-black text-amber-600 mt-1">{stats.drafts + stats.scheduled}</p>
          <p className="text-[11px] text-slate-400 mt-0.5">Preparation & scheduled launch</p>
        </div>
      </div>

      {/* Multi-Dimensional Filter & Search Controls */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
        {/* Top row: Search and primary status pills */}
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4">
          {/* Search Input */}
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder={isAdmin ? "Search by title, author, category, or AY..." : "Search your surveys by title or category..."}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-hidden focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 bg-slate-50/60"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-600"
              >
                ×
              </button>
            )}
          </div>

          {/* Status filter tabs */}
          <div className="inline-flex items-center p-1 bg-slate-100 rounded-xl text-xs overflow-x-auto shrink-0 scrollbar-none">
            <button
              onClick={() => setStatusFilter("all")}
              className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
                statusFilter === "all" ? "bg-white text-slate-900 shadow-xs font-semibold" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              All ({visibleSurveys.length})
            </button>
            <button
              onClick={() => setStatusFilter("published")}
              className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
                statusFilter === "published" ? "bg-white text-emerald-700 shadow-xs font-semibold" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Active ({stats.published})
            </button>
            <button
              onClick={() => setStatusFilter("draft")}
              className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
                statusFilter === "draft" ? "bg-white text-amber-700 shadow-xs font-semibold" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Drafts ({stats.drafts})
            </button>
            <button
              onClick={() => setStatusFilter("scheduled")}
              className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
                statusFilter === "scheduled" ? "bg-white text-blue-700 shadow-xs font-semibold" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Scheduled ({stats.scheduled})
            </button>
            <button
              onClick={() => setStatusFilter("closed")}
              className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
                statusFilter === "closed" ? "bg-white text-slate-800 shadow-xs font-semibold" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Closed ({stats.closed})
            </button>
            <button
              onClick={() => setStatusFilter("flagged")}
              className={`px-3 py-1.5 rounded-lg font-medium transition-all flex items-center gap-1 ${
                statusFilter === "flagged"
                  ? "bg-rose-600 text-white shadow-xs font-semibold"
                  : stats.flagged > 0
                  ? "text-rose-600 hover:bg-rose-50"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <Flag className="w-3 h-3" />
              <span>Flagged ({stats.flagged})</span>
            </button>
          </div>
        </div>

        {/* Bottom row: Category Filter, Author Filter (Admin), Sort By */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-100 text-xs text-slate-600">
          <div className="flex flex-wrap items-center gap-3">
            {/* Category Filter */}
            <div className="flex items-center gap-1.5">
              <span className="font-semibold text-slate-500">Category:</span>
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1 text-xs text-slate-700 font-medium focus:outline-hidden focus:border-indigo-400"
              >
                <option value="all">All Categories ({availableCategories.length})</option>
                {availableCategories.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            {/* Creator Filter for Admins */}
            {isAdmin && uniqueCreators.length > 0 && (
              <div className="flex items-center gap-1.5">
                <span className="font-semibold text-slate-500">Author / Unit:</span>
                <select
                  value={creatorFilter}
                  onChange={(e) => setCreatorFilter(e.target.value)}
                  className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1 text-xs text-slate-700 font-medium focus:outline-hidden focus:border-indigo-400 max-w-[200px] truncate"
                >
                  <option value="all">All Authors / Units</option>
                  {uniqueCreators.map((creator) => (
                    <option key={creator.email} value={creator.email}>
                      {creator.name} ({creator.email})
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Sort By Dropdown */}
          <div className="flex items-center gap-1.5">
            <span className="font-semibold text-slate-500">Sort By:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1 text-xs text-slate-700 font-medium focus:outline-hidden focus:border-indigo-400"
            >
              <option value="newest">Newest First</option>
              <option value="responses">Most Submissions</option>
              <option value="title">Alphabetical (A-Z)</option>
              <option value="flagged">Flagged / Moderation Priority</option>
            </select>
          </div>
        </div>
      </div>

      {/* Surveys List / Empty State */}
      {filteredSurveys.length === 0 ? (
        <div className="bg-white rounded-3xl border border-slate-200 p-12 text-center space-y-4 shadow-xs">
          <div className="w-14 h-14 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600 mx-auto">
            <Layers className="w-7 h-7" />
          </div>
          <div className="space-y-1">
            <h3 className="font-bold text-slate-900 text-lg">
              {visibleSurveys.length === 0
                ? isAdmin
                  ? "No campus surveys registered yet"
                  : "You haven't authored any surveys yet"
                : "No surveys matched your search & filter parameters"}
            </h3>
            <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
              {visibleSurveys.length === 0
                ? isAdmin
                  ? "Initialize your university feedback program by creating the first institutional evaluation or importing existing instruments."
                  : "Start by building your first survey instrument. You can gather student opinions, course evaluations, or campus feedback with custom rating scales."
                : "Try clearing your search query, or resetting the status and category filters to view other instruments."}
            </p>
          </div>

          {visibleSurveys.length === 0 ? (
            <button
              onClick={onCreateNewSurvey}
              className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-xs cursor-pointer inline-flex items-center gap-2"
            >
              <PlusCircle className="w-4 h-4" />
              <span>{isAdmin ? "Create First Institutional Survey" : "Create Your First Survey"}</span>
            </button>
          ) : (
            <button
              onClick={() => {
                setSearchQuery("");
                setStatusFilter("all");
                setCategoryFilter("all");
                setCreatorFilter("all");
              }}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl cursor-pointer"
            >
              Reset All Filters
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredSurveys.map((survey) => {
            const isDraft = survey.status === "draft";
            const isScheduled = survey.status === "scheduled";
            const isClosed = survey.status === "closed";
            const isLive = survey.status === "published" || (!isDraft && !isScheduled && !isClosed);
            const isFlagged = Boolean(survey.flagged);

            return (
              <div
                key={survey.id}
                className={`bg-white rounded-3xl border transition-all p-5 flex flex-col justify-between space-y-4 shadow-xs relative ${
                  isFlagged
                    ? "border-rose-300 ring-2 ring-rose-100/50"
                    : "border-slate-200 hover:border-indigo-300 hover:shadow-md"
                }`}
              >
                <div className="space-y-3">
                  {/* Top Row: Category, Mandatory Badge & Status Pill */}
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-slate-100 text-slate-700">
                        {survey.cat}
                      </span>
                      {survey.isRequired && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                          Mandatory
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5">
                      {isDraft && (
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200 flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          <span>Draft</span>
                        </span>
                      )}
                      {isScheduled && (
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200 flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          <span>Scheduled</span>
                        </span>
                      )}
                      {isLive && (
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                          <span>Live</span>
                        </span>
                      )}
                      {isClosed && (
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 text-slate-500 border border-slate-200">
                          Closed
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Flagged Alert Banner (if flagged) */}
                  {isFlagged && (
                    <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="font-bold flex items-center gap-1 text-[11px] text-rose-700">
                          <ShieldAlert className="w-3.5 h-3.5 text-rose-600" />
                          <span>Flagged for Review</span>
                        </span>
                        {isAdmin && onClearFlag && (
                          <button
                            onClick={() => onClearFlag(survey.id)}
                            className="px-2 py-0.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-[10px] font-bold cursor-pointer transition-colors"
                          >
                            Approve / Clear
                          </button>
                        )}
                      </div>
                      {survey.flagReason && (
                        <p className="text-[11px] text-rose-600 italic">
                          "{survey.flagReason}"
                        </p>
                      )}
                    </div>
                  )}

                  {/* Survey Title & Description */}
                  <div>
                    <h3 className="font-bold text-slate-900 text-base leading-snug line-clamp-2">
                      {survey.title}
                    </h3>
                    <p className="text-xs text-slate-500 line-clamp-2 mt-1 leading-relaxed">
                      {survey.desc || "No description provided."}
                    </p>
                  </div>

                  {/* Author / Department Attribution (Crucial for Admin Survey Management) */}
                  <div className="p-2 bg-slate-50 rounded-xl text-[11px] text-slate-600 flex items-center justify-between">
                    <div className="flex items-center gap-1.5 truncate">
                      <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span className="truncate">
                        <strong className="text-slate-800 font-semibold">{survey.ownerName || "University Admin"}</strong>
                        {survey.owner && <span className="text-slate-400 text-[10px] ml-1">({survey.owner})</span>}
                      </span>
                    </div>
                    <span className="text-[10px] font-mono text-slate-400 shrink-0">
                      AY {survey.academicYear || "2025-2026"}
                    </span>
                  </div>

                  {/* Metadata Chips */}
                  <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100 text-[11px] text-slate-600">
                    <div className="flex items-center gap-1.5">
                      <Users className="w-3.5 h-3.5 text-indigo-500" />
                      <span className="font-semibold text-slate-800">{survey.responses || 0}</span>
                      <span>Submissions</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Layers className="w-3.5 h-3.5 text-indigo-500" />
                      <span>{survey.questions?.length || survey.questionCount || 0} Questions</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-slate-400" />
                      <span>{survey.created || "Recently"}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <CheckSquare className="w-3.5 h-3.5 text-emerald-500" />
                      <span>{survey.targetAudience?.type ? `Target: ${survey.targetAudience.type}` : "Open Campus"}</span>
                    </div>
                  </div>

                  {/* Admin Inline Status Switcher (When in Admin mode) */}
                  {isAdmin && onUpdateSurveyStatus && (
                    <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                      <span className="text-[11px] font-semibold text-slate-500">Lifecycle Status:</span>
                      <select
                        value={survey.status || "published"}
                        onChange={(e) =>
                          onUpdateSurveyStatus(
                            survey.id,
                            e.target.value as "published" | "draft" | "scheduled" | "closed"
                          )
                        }
                        className="bg-slate-50 border border-slate-200 rounded-lg px-2 py-0.5 text-[11px] font-bold text-slate-700 cursor-pointer focus:outline-hidden focus:border-indigo-400"
                      >
                        <option value="published">🟢 Live / Published</option>
                        <option value="draft">🟡 Draft</option>
                        <option value="scheduled">🔵 Scheduled</option>
                        <option value="closed">⚪ Closed / Archive</option>
                      </select>
                    </div>
                  )}
                </div>

                {/* Card Actions Bar */}
                <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {/* Edit Survey Button */}
                    <button
                      onClick={() => onEditSurvey(survey)}
                      className="px-2.5 py-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                      title="Edit questions, scales, and settings"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                      <span>Edit</span>
                    </button>

                    {/* Analytics Button */}
                    <button
                      onClick={() => onViewAnalytics(survey.id)}
                      className="px-2.5 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                      title="View detailed response analytics & Tagalog sentiment"
                    >
                      <BarChart3 className="w-3.5 h-3.5 text-slate-500" />
                      <span>Analytics</span>
                    </button>

                    {/* Duplicate Button (Admin & Authors) */}
                    {onDuplicateSurvey && (
                      <button
                        onClick={() => onDuplicateSurvey(survey)}
                        className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-500 hover:text-slate-900 cursor-pointer transition-colors"
                        title="Duplicate as new draft instrument"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  <div className="flex items-center gap-1">
                    {/* Share Link Button */}
                    <button
                      onClick={() => handleCopyLink(survey.id)}
                      className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-500 hover:text-slate-900 cursor-pointer transition-colors"
                      title={copiedId === survey.id ? "Link copied!" : "Copy survey share link"}
                    >
                      {copiedId === survey.id ? (
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                      ) : (
                        <ExternalLink className="w-3.5 h-3.5" />
                      )}
                    </button>

                    {/* Take / Preview Survey */}
                    {onTakeSurvey && (
                      <button
                        onClick={() => onTakeSurvey(survey)}
                        className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-500 hover:text-slate-900 cursor-pointer transition-colors"
                        title="Preview survey as respondent"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                    )}

                    {/* Flag / Moderate (For Admins) */}
                    {isAdmin && onFlagSurvey && !isFlagged && (
                      <button
                        onClick={() => {
                          setFlagModalSurvey({ id: survey.id, title: survey.title });
                          setFlagReasonInput("");
                        }}
                        className="p-1.5 rounded-lg border border-slate-200 hover:bg-rose-50 hover:border-rose-200 text-slate-400 hover:text-rose-600 cursor-pointer transition-colors"
                        title="Flag survey for compliance or content violation"
                      >
                        <Flag className="w-3.5 h-3.5" />
                      </button>
                    )}

                    {/* Delete Survey Button */}
                    <button
                      onClick={() => {
                        const confirmMsg = isAdmin
                          ? `[Admin Action] Permanently remove survey "${survey.title}"? All responses, questions, and metrics will be wiped.`
                          : `Are you sure you want to delete "${survey.title}"? All responses and questions will be permanently removed.`;
                        if (window.confirm(confirmMsg)) {
                          onDeleteSurvey(survey.id, survey.title);
                        }
                      }}
                      className="p-1.5 rounded-lg border border-slate-200 hover:bg-rose-50 hover:border-rose-200 text-slate-400 hover:text-rose-600 cursor-pointer transition-colors"
                      title="Permanently remove survey"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Flag / Moderation Reason Modal */}
      {flagModalSurvey && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setFlagModalSurvey(null)}
        >
          <div
            className="bg-white rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl border border-slate-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-rose-600">
                <ShieldAlert className="w-5 h-5" />
                <h3 className="font-bold text-base text-slate-900">Flag Survey for Moderation</h3>
              </div>
              <button
                onClick={() => setFlagModalSurvey(null)}
                className="p-1 rounded-lg text-slate-400 hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-600">
              Flagging <strong className="text-slate-900">"{flagModalSurvey.title}"</strong> marks it for urgent administrative review and alerts university stakeholders.
            </p>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700">Reason for Flagging:</label>
              <textarea
                value={flagReasonInput}
                onChange={(e) => setFlagReasonInput(e.target.value)}
                placeholder="e.g., Inappropriate content, offensive language, duplicate survey, or non-compliant rating format..."
                rows={3}
                className="w-full text-xs p-3 rounded-xl border border-slate-200 focus:outline-hidden focus:border-rose-500 focus:ring-1 focus:ring-rose-500 bg-slate-50"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setFlagModalSurvey(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  if (onFlagSurvey && flagModalSurvey) {
                    onFlagSurvey(flagModalSurvey.id, flagReasonInput || "Administrative review requested");
                    setFlagModalSurvey(null);
                  }
                }}
                className="px-4 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl shadow-xs"
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

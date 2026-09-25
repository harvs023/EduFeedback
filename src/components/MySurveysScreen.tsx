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
  Flame,
  Star,
  Filter,
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
}) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "published" | "draft" | "scheduled" | "closed">("all");
  const [sortBy, setSortBy] = useState<"newest" | "responses" | "title">("newest");
  const [copiedId, setCopiedId] = useState<string | number | null>(null);

  // All surveys authored by currentUser
  const mySurveys = useMemo(() => {
    if (!currentUser?.email) return [];
    return surveys.filter((s) => s.owner?.toLowerCase() === currentUser.email?.toLowerCase());
  }, [surveys, currentUser]);

  // Aggregate statistics for the creator
  const stats = useMemo(() => {
    const total = mySurveys.length;
    const published = mySurveys.filter((s) => s.status === "published").length;
    const drafts = mySurveys.filter((s) => s.status === "draft").length;
    const totalResponses = mySurveys.reduce((acc, curr) => acc + (curr.responses || 0), 0);
    const avgResponses = total > 0 ? (totalResponses / total).toFixed(1) : "0";

    return { total, published, drafts, totalResponses, avgResponses };
  }, [mySurveys]);

  // Filter and sort surveys
  const filteredSurveys = useMemo(() => {
    return mySurveys
      .filter((s) => {
        if (statusFilter !== "all" && s.status !== statusFilter) return false;
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const matchTitle = s.title.toLowerCase().includes(q);
          const matchDesc = s.desc?.toLowerCase().includes(q);
          const matchCat = s.cat?.toLowerCase().includes(q);
          if (!matchTitle && !matchDesc && !matchCat) return false;
        }
        return true;
      })
      .sort((a, b) => {
        if (sortBy === "responses") return (b.responses || 0) - (a.responses || 0);
        if (sortBy === "title") return a.title.localeCompare(b.title);
        // newest
        return String(b.id).localeCompare(String(a.id));
      });
  }, [mySurveys, statusFilter, searchQuery, sortBy]);

  const handleCopyLink = (surveyId: string | number) => {
    const shareUrl = `${window.location.origin}/#survey-${surveyId}`;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(shareUrl);
      setCopiedId(surveyId);
      setTimeout(() => setCopiedId(null), 2000);
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-12">
      {/* Header Banner */}
      <div className="bg-white p-6 sm:p-8 rounded-3xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-50 text-indigo-700 text-xs font-bold tracking-wider uppercase border border-indigo-200">
            <span>Author Workspace</span>
          </div>
          <h1 className="font-serif text-2xl sm:text-3xl font-extrabold text-slate-900">
            My Surveys & Instruments
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 max-w-xl">
            Manage your authored feedback surveys, review live responses, update question sets, and track participant engagement across your campus evaluations.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={onCreateNewSurvey}
            className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-md shadow-indigo-500/20 cursor-pointer flex items-center gap-2 transition-all"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Create New Survey</span>
          </button>
        </div>
      </div>

      {/* Creator Performance Metrics Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <p className="text-xs text-slate-500 font-medium">Total Authored</p>
          <p className="text-2xl font-black text-slate-900 mt-1">{stats.total}</p>
          <p className="text-[11px] text-slate-400 mt-0.5">Instruments created by you</p>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <p className="text-xs text-slate-500 font-medium">Active / Published</p>
          <p className="text-2xl font-black text-emerald-600 mt-1">{stats.published}</p>
          <p className="text-[11px] text-slate-400 mt-0.5">Currently open for responses</p>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <p className="text-xs text-slate-500 font-medium">Total Responses</p>
          <p className="text-2xl font-black text-indigo-600 mt-1">{stats.totalResponses.toLocaleString()}</p>
          <p className="text-[11px] text-slate-400 mt-0.5">Student & staff submissions</p>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <p className="text-xs text-slate-500 font-medium">Drafts & Scheduled</p>
          <p className="text-2xl font-black text-amber-600 mt-1">{stats.drafts}</p>
          <p className="text-[11px] text-slate-400 mt-0.5">Pending launch</p>
        </div>
      </div>

      {/* Search, Filter & Sort Controls */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by survey title, topic, or category..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-hidden focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 bg-slate-50/50"
          />
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto flex-wrap">
          {/* Status filter tabs */}
          <div className="inline-flex items-center p-1 bg-slate-100 rounded-xl text-xs">
            <button
              onClick={() => setStatusFilter("all")}
              className={`px-3 py-1 rounded-lg font-medium transition-all ${
                statusFilter === "all" ? "bg-white text-slate-900 shadow-xs font-semibold" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              All ({mySurveys.length})
            </button>
            <button
              onClick={() => setStatusFilter("published")}
              className={`px-3 py-1 rounded-lg font-medium transition-all ${
                statusFilter === "published" ? "bg-white text-slate-900 shadow-xs font-semibold" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Active ({stats.published})
            </button>
            <button
              onClick={() => setStatusFilter("draft")}
              className={`px-3 py-1 rounded-lg font-medium transition-all ${
                statusFilter === "draft" ? "bg-white text-slate-900 shadow-xs font-semibold" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Drafts ({stats.drafts})
            </button>
          </div>

          {/* Sort dropdown */}
          <div className="flex items-center gap-1.5 text-xs text-slate-600">
            <span className="font-semibold">Sort:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-xs text-slate-700 font-medium focus:outline-hidden"
            >
              <option value="newest">Newest First</option>
              <option value="responses">Most Responses</option>
              <option value="title">Alphabetical</option>
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
              {mySurveys.length === 0 ? "You haven't authored any surveys yet" : "No surveys matched your search"}
            </h3>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              {mySurveys.length === 0
                ? "Start by building your first survey instrument. You can gather student opinions, course evaluations, or campus feedback with custom rating scales."
                : "Try clearing your search query or adjusting your status filter."}
            </p>
          </div>
          {mySurveys.length === 0 ? (
            <button
              onClick={onCreateNewSurvey}
              className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-xs cursor-pointer inline-flex items-center gap-2"
            >
              <PlusCircle className="w-4 h-4" />
              <span>Create Your First Survey</span>
            </button>
          ) : (
            <button
              onClick={() => {
                setSearchQuery("");
                setStatusFilter("all");
              }}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl"
            >
              Clear Filters
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredSurveys.map((survey) => {
            const isDraft = survey.status === "draft";
            const isScheduled = survey.status === "scheduled";
            const isClosed = survey.status === "closed";

            return (
              <div
                key={survey.id}
                className="bg-white rounded-2xl border border-slate-200 hover:border-indigo-200 hover:shadow-md transition-all p-5 flex flex-col justify-between space-y-4"
              >
                <div className="space-y-3">
                  {/* Category & Status Pill */}
                  <div className="flex items-center justify-between gap-2">
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-slate-100 text-slate-700">
                      {survey.cat}
                    </span>

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
                      {!isDraft && !isScheduled && !isClosed && (
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                          <span>Live</span>
                        </span>
                      )}
                      {isClosed && (
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 text-slate-500">
                          Closed
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Survey Title & Description */}
                  <div>
                    <h3 className="font-bold text-slate-900 text-base leading-snug line-clamp-2">
                      {survey.title}
                    </h3>
                    <p className="text-xs text-slate-500 line-clamp-2 mt-1">
                      {survey.desc || "No description provided."}
                    </p>
                  </div>

                  {/* Metadata Chips */}
                  <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100 text-[11px] text-slate-600">
                    <div className="flex items-center gap-1.5">
                      <Users className="w-3.5 h-3.5 text-indigo-500" />
                      <span>{survey.responses || 0} Responses</span>
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
                      <span className="w-2 h-2 rounded-full bg-slate-300" />
                      <span>AY: {survey.academicYear || "2025-2026"}</span>
                    </div>
                  </div>
                </div>

                {/* Card Actions */}
                <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => onEditSurvey(survey)}
                      className="px-3 py-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                      title="Edit questions and settings"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                      <span>Edit</span>
                    </button>

                    <button
                      onClick={() => onViewAnalytics(survey.id)}
                      className="px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                      title="View response analytics"
                    >
                      <BarChart3 className="w-3.5 h-3.5 text-slate-500" />
                      <span>Analytics</span>
                    </button>
                  </div>

                  <div className="flex items-center gap-1">
                    {onTakeSurvey && survey.status === "published" && (
                      <button
                        onClick={() => onTakeSurvey(survey)}
                        className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-500 hover:text-slate-900 cursor-pointer"
                        title="Preview survey as respondent"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                    )}

                    <button
                      onClick={() => {
                        if (
                          window.confirm(
                            `Are you sure you want to delete "${survey.title}"? All responses and questions will be permanently removed.`
                          )
                        ) {
                          onDeleteSurvey(survey.id, survey.title);
                        }
                      }}
                      className="p-1.5 rounded-lg border border-slate-200 hover:bg-rose-50 hover:border-rose-200 text-slate-400 hover:text-rose-600 cursor-pointer transition-colors"
                      title="Delete survey"
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
    </div>
  );
};

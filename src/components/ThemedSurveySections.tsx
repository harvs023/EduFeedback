import React, { useState, useMemo } from "react";
import { Survey, UserProfile, SurveyResponse } from "../types";
import { getSurveyAvailability, isInAudience } from "../lib/surveyReview";
import { ArrowLeft, ArrowRight, ClipboardList, PlusCircle, Search, Star } from "lucide-react";
import { SurveyCard } from "./takeSurvey/SurveyCard";
import { SurveyRow } from "./takeSurvey/SurveyRow";
import { TakedownDialog } from "./takeSurvey/TakedownDialog";

/** Id of the first section, which lists every survey. */
const ALL_SECTION = "__all__";
/** Most cards built per row (the row itself shows as many as fit, then a faded one). */
const ROW_LIMIT = 8;

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
  /** Admin: take a live survey down (archive with a reason; answers are kept). */
  onTakedownSurvey?: (surveyId: string | number, reason: string) => Promise<boolean> | void;
  searchQuery?: string;
  selectedCategory?: string;
  categories?: string[];
}

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
  onTakedownSurvey,
  searchQuery = "",
  selectedCategory = "all",
  categories = [],
}) => {
  const [internalSearch, setInternalSearch] = useState<string>("");
  const [takedownTarget, setTakedownTarget] = useState<Survey | null>(null);
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
  const isEligible = (survey: Survey) => !currentUser || isInAudience(survey, currentUser);

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

  // Status filter and search apply everywhere (sections, "See all" and search results).
  const visibleSurveys = useMemo(() => {
    return eligibleSurveys
      .filter((s) => {
        const isAnswered = answeredSurveyIds.has(String(s.id));
        if (statusFilter === "unanswered" && isAnswered) return false;
        if (statusFilter === "answered" && !isAnswered) return false;
        if (effectiveSearch) {
          const text = [s.title, s.desc, ...(s.tags || [])].join(" ").toLowerCase();
          if (!text.includes(effectiveSearch)) return false;
        }
        return true;
      })
      // Not yet answered first, then newest.
      .sort(
        (a, b) =>
          Number(answeredSurveyIds.has(String(a.id))) - Number(answeredSurveyIds.has(String(b.id))) ||
          (b.createdAtTimestamp || 0) - (a.createdAtTimestamp || 0)
      );
  }, [eligibleSurveys, statusFilter, effectiveSearch, answeredSurveyIds]);

  // "All surveys" first, then one section per category (empty ones too): the admin's categories in
  // their order, then any older category a live survey still uses.
  const sections = useMemo(() => {
    const names = Array.from(new Set([...categories, ...visibleSurveys.map((s) => s.cat).filter(Boolean)]));
    return [
      { id: ALL_SECTION, name: "All surveys", surveys: visibleSurveys },
      ...names.map((name) => ({ id: name, name, surveys: visibleSurveys.filter((s) => s.cat === name) })),
    ];
  }, [visibleSurveys, categories]);

  const waitingCount = eligibleSurveys.filter((s) => !answeredSurveyIds.has(String(s.id))).length;

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

  const card = (survey: Survey) => {
    const id = String(survey.id);
    return (
      <SurveyCard
        key={id}
        survey={survey}
        answered={answeredSurveyIds.has(id)}
        answeredAnonymously={answeredSurveyIds.has(id) && !namedAnswerIds.has(id)}
        onOpen={() => handleLaunchSurvey(survey)}
        admin={
          isSuperadmin
            ? {
                onAnalytics: () => onViewAnalytics(survey.id),
                onTakeDown: onTakedownSurvey ? () => setTakedownTarget(survey) : undefined,
              }
            : undefined
        }
      />
    );
  };

  const grid = "grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4";
  const openSection = categoryFilter === "all" ? undefined : sections.find((sec) => sec.id === categoryFilter);
  const resetFilters = () => {
    setInternalSearch("");
    setStatusFilter("all");
    setCategoryFilter("all");
  };

  return (
    <div className="space-y-6">
      {takedownTarget && onTakedownSurvey && (
        <TakedownDialog
          title={takedownTarget.title}
          onClose={() => setTakedownTarget(null)}
          onConfirm={(reason) => onTakedownSurvey(takedownTarget.id, reason)}
        />
      )}

      {/* Header: title, counts, search and status */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900">Take a survey</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {eligibleSurveys.length === 0
              ? "No surveys are open for you right now."
              : `${eligibleSurveys.length} open for you · ${waitingCount} waiting for your answer`}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="search"
              value={internalSearch}
              onChange={(e) => setInternalSearch(e.target.value)}
              placeholder="Search surveys"
              aria-label="Search surveys"
              className="pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-xl text-sm text-slate-800 placeholder:text-slate-400 w-48 sm:w-60 focus:outline-hidden focus:border-indigo-400"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as "all" | "unanswered" | "answered")}
            aria-label="Show"
            className="px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm text-slate-700"
          >
            <option value="all">All surveys</option>
            <option value="unanswered">To answer</option>
            <option value="answered">Answered</option>
          </select>
          {currentUser && !isSuperadmin && (onCreateSurvey || onCreateNewSurvey) && (
            <button
              type="button"
              onClick={onCreateSurvey || onCreateNewSurvey}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold rounded-xl cursor-pointer"
            >
              <PlusCircle className="w-4 h-4" /> Create survey
            </button>
          )}
        </div>
      </div>

      {/* Required surveys first */}
      {pendingRequiredSurveys.map((reqSurvey) => (
        <div
          key={reqSurvey.id}
          className="bg-gradient-to-r from-amber-500 via-orange-500 to-rose-600 rounded-2xl p-5 sm:p-6 text-white shadow-lg"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1.5">
              <span className="inline-flex items-center gap-1 bg-white/20 px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wide">
                <Star className="w-3 h-3 fill-white" /> Required survey
              </span>
              <h3 className="font-bold text-lg sm:text-xl leading-tight">{reqSurvey.title}</h3>
              <p className="text-sm text-amber-50 max-w-2xl">
                {reqSurvey.desc || "The school asks everyone in this group to answer this survey."}
              </p>
            </div>
            <button
              type="button"
              onClick={() => handleLaunchSurvey(reqSurvey)}
              className="px-5 py-2.5 bg-white hover:bg-amber-50 text-amber-950 font-bold text-sm rounded-xl shadow-md shrink-0 cursor-pointer inline-flex items-center justify-center gap-2"
            >
              Answer now <ArrowRight className="w-4 h-4 text-amber-700" />
            </button>
          </div>
        </div>
      ))}

      {visibleSurveys.length === 0 ? (
        <div className="bg-white rounded-2xl p-10 text-center border border-slate-200 space-y-3">
          <div className="w-12 h-12 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto">
            <ClipboardList className="w-6 h-6" />
          </div>
          <h2 className="font-bold text-slate-900">
            {eligibleSurveys.length === 0 ? "No surveys yet" : "No surveys match"}
          </h2>
          <p className="text-sm text-slate-500 max-w-sm mx-auto">
            {eligibleSurveys.length === 0
              ? "When a survey for you opens, it will appear here."
              : "Try another search or show all surveys."}
          </p>
          {eligibleSurveys.length > 0 && (
            <button type="button" onClick={resetFilters} className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-bold rounded-xl cursor-pointer">
              Show all surveys
            </button>
          )}
        </div>
      ) : effectiveSearch ? (
        /* Search: one list across all categories */
        <section className="space-y-3" aria-label="Search results">
          <h2 className="text-lg font-bold text-slate-900">
            Results for "{effectiveSearch}" <span className="text-slate-400 font-semibold">({visibleSurveys.length})</span>
          </h2>
          <div className={grid}>{visibleSurveys.map(card)}</div>
        </section>
      ) : openSection ? (
        /* "See all" of one category */
        <section className="space-y-3" aria-label={openSection.name}>
          <button
            type="button"
            onClick={() => setCategoryFilter("all")}
            className="inline-flex items-center gap-1.5 text-sm font-bold text-indigo-700 hover:underline cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" /> All categories
          </button>
          <h2 className="text-lg font-bold text-slate-900">
            {openSection.name} <span className="text-slate-400 font-semibold">({openSection.surveys.length})</span>
          </h2>
          <div className={grid}>{openSection.surveys.map(card)}</div>
        </section>
      ) : (
        /* "All surveys", then one row per category with "See all" */
        sections.map((sec) => (
          <section key={sec.id} className="space-y-3" aria-label={sec.name}>
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-bold text-slate-900">
                {sec.name} <span className="text-slate-400 font-semibold">({sec.surveys.length})</span>
              </h2>
              {sec.surveys.length > 0 && (
                <button
                  type="button"
                  onClick={() => setCategoryFilter(sec.id)}
                  className="inline-flex items-center gap-1 text-sm font-bold text-indigo-700 hover:underline cursor-pointer shrink-0"
                >
                  See all <ArrowRight className="w-4 h-4" />
                </button>
              )}
            </div>
            {sec.surveys.length === 0 ? (
              <p className="px-4 py-6 rounded-2xl border border-dashed border-slate-300 text-sm text-slate-500 text-center">
                No open surveys in this category right now.
              </p>
            ) : (
              <SurveyRow items={sec.surveys.slice(0, ROW_LIMIT).map(card)} onSeeAll={() => setCategoryFilter(sec.id)} />
            )}
          </section>
        ))
      )}
    </div>
  );
};

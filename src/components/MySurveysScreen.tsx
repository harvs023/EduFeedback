import React, { useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, Download, FolderKanban, PlusCircle, Search } from "lucide-react";
import { useConfirm } from "./ConfirmDialog";
import { Survey, UserProfile, SurveyResponse } from "../types";
import { SurveyRow } from "./takeSurvey/SurveyRow";
import { MySurveyCard } from "./mySurveys/MySurveyCard";
import { SurveyActionsSheet } from "./mySurveys/SurveyActionsSheet";

interface MySurveysScreenProps {
  surveys: Survey[];
  currentUser: UserProfile | null;
  userResponses: SurveyResponse[];
  onCreateNewSurvey: () => void;
  onEditSurvey: (survey: Survey) => void;
  onDeleteSurvey: (surveyId: string | number, surveyTitle?: string) => void;
  onViewAnalytics: (surveyId: string | number) => void;
  onPreviewSurvey?: (survey: Survey) => void;
  onArchiveSurvey?: (surveyId: string | number, reason: string) => Promise<void> | void;
  onWithdrawSurvey?: (surveyId: string | number) => Promise<void> | void;
  onDuplicateSurvey?: (survey: Survey) => void;
}

type SectionId = "attention" | "drafts" | "review" | "live" | "closed";

const SECTIONS: { id: SectionId; title: string; statuses: string[]; hint: string }[] = [
  { id: "attention", title: "Needs your attention", statuses: ["rejected"], hint: "Not approved: edit and send again." },
  { id: "drafts", title: "Drafts", statuses: ["draft"], hint: "Only you can see these." },
  { id: "review", title: "Waiting for review", statuses: ["pending"], hint: "The administrator is checking these." },
  { id: "live", title: "Live", statuses: ["published", "scheduled"], hint: "Taking answers now or opening soon." },
  { id: "closed", title: "Closed", statuses: ["archived"], hint: "No longer taking answers; results stay in Analytics." },
];

/** Most cards built per row (the row shows as many as fit, then a faded one). */
const ROW_LIMIT = 8;

const createdAt = (s: Survey) => s.createdAtTimestamp || (s.created ? Date.parse(s.created) || 0 : 0);

/**
 * My Surveys: the person's own surveys (the admin too; everyone's surveys are in Review Center >
 * All surveys), one section per status in a fixed order, each a row with See all.
 */
export const MySurveysScreen: React.FC<MySurveysScreenProps> = ({
  surveys,
  currentUser,
  userResponses,
  onCreateNewSurvey,
  onEditSurvey,
  onDeleteSurvey,
  onViewAnalytics,
  onPreviewSurvey,
  onArchiveSurvey,
  onWithdrawSurvey,
  onDuplicateSurvey,
}) => {
  const { confirm, confirmDialog } = useConfirm();
  const [search, setSearch] = useState("");
  const [openSection, setOpenSection] = useState<SectionId | null>(null);
  const [actionsFor, setActionsFor] = useState<Survey | null>(null);

  const myEmail = (currentUser?.email || "").trim().toLowerCase();
  const mine = useMemo(
    () =>
      surveys
        .filter((s) => (s.owner || "").trim().toLowerCase() === myEmail)
        .sort((a, b) => createdAt(b) - createdAt(a)),
    [surveys, myEmail]
  );

  // Responses the admin excluded after review, per survey (still saved, not counted in Analytics).
  const excludedBySurvey = useMemo(() => {
    const map: Record<string, number> = {};
    for (const r of userResponses || []) {
      if (r.review?.status === "excluded") map[String(r.surveyId)] = (map[String(r.surveyId)] || 0) + 1;
    }
    return map;
  }, [userResponses]);

  const q = search.trim().toLowerCase();
  const found = q
    ? mine.filter((s) => [s.title, s.desc, s.cat].join(" ").toLowerCase().includes(q))
    : mine;

  const sections = SECTIONS.map((sec) => ({ ...sec, surveys: mine.filter((s) => sec.statuses.includes(s.status || "published")) }))
    // Empty sections are hidden, except Drafts (where new work starts).
    .filter((sec) => sec.surveys.length > 0 || sec.id === "drafts");
  const shownSection = openSection ? sections.find((sec) => sec.id === openSection) : undefined;

  const withdraw = async (survey: Survey) => {
    const ok = await confirm({
      title: "Withdraw from review?",
      message: `"${survey.title}" goes back to your drafts. The administrator will no longer see it. You can edit it and send it again.`,
      confirmLabel: "Withdraw",
    });
    if (ok && onWithdrawSurvey) await onWithdrawSurvey(survey.id);
  };

  const remove = async (survey: Survey) => {
    setActionsFor(null);
    const ok = await confirm({
      title: "Delete this survey?",
      message: `"${survey.title}" will be permanently deleted. This cannot be undone.`,
      confirmLabel: "Delete",
      danger: true,
    });
    if (ok) onDeleteSurvey(survey.id, survey.title);
  };

  const copyLink = (survey: Survey) => {
    navigator.clipboard?.writeText(`${window.location.origin}/#survey-${survey.id}`);
  };

  const card = (survey: Survey) => {
    const isPending = survey.status === "pending";
    return (
      <MySurveyCard
        key={String(survey.id)}
        survey={survey}
        excluded={excludedBySurvey[String(survey.id)] || 0}
        canWithdraw={isPending && Boolean(onWithdrawSurvey)}
        onEdit={() => onEditSurvey(survey)}
        onWithdraw={() => withdraw(survey)}
        onAnalytics={() => onViewAnalytics(survey.id)}
        onMore={() => setActionsFor(survey)}
      />
    );
  };

  const exportCsv = () => {
    const cell = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const header = ["Title", "Category", "Status", "Answers", "Questions", "School year", "Created"];
    const rows = mine.map((s) =>
      [s.title, s.cat, s.status || "published", s.responses || 0, s.questions?.length || 0, s.academicYear || "", s.created || ""].map(cell).join(",")
    );
    const blob = new Blob(["﻿" + [header.map(cell).join(","), ...rows].join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `my_surveys_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const grid = "grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4";
  const live = mine.filter((s) => s.status === "published" || s.status === "scheduled").length;
  const answers = mine.reduce((n, s) => n + (s.responses || 0), 0);

  return (
    <div className="space-y-6">
      {confirmDialog}

      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900">My surveys</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {mine.length === 0
              ? "You have not created a survey yet."
              : `${mine.length} survey${mine.length === 1 ? "" : "s"} · ${live} live · ${answers} answers in total`}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search my surveys"
              aria-label="Search my surveys"
              className="pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-xl text-sm text-slate-800 placeholder:text-slate-400 w-48 sm:w-60 focus:outline-hidden focus:border-indigo-400"
            />
          </div>
          {mine.length > 0 && (
            <button
              type="button"
              onClick={exportCsv}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-sm font-semibold rounded-xl cursor-pointer"
              title="Download a list of your surveys (CSV)"
            >
              <Download className="w-4 h-4" /> Export list
            </button>
          )}
          <button
            type="button"
            onClick={onCreateNewSurvey}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold rounded-xl cursor-pointer"
          >
            <PlusCircle className="w-4 h-4" /> Create survey
          </button>
        </div>
      </div>

      {mine.length === 0 ? (
        <div className="bg-white rounded-2xl p-10 text-center border border-slate-200 space-y-3">
          <div className="w-12 h-12 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto">
            <FolderKanban className="w-6 h-6" />
          </div>
          <h2 className="font-bold text-slate-900">No surveys yet</h2>
          <p className="text-sm text-slate-500 max-w-sm mx-auto">
            Create your first survey. It starts as a draft, and the administrator reviews it before it goes live.
          </p>
          <button
            type="button"
            onClick={onCreateNewSurvey}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold rounded-xl cursor-pointer"
          >
            <PlusCircle className="w-4 h-4" /> Create survey
          </button>
        </div>
      ) : q ? (
        <section className="space-y-3" aria-label="Search results">
          <h2 className="text-lg font-bold text-slate-900">
            Results for "{search.trim()}" <span className="text-slate-400 font-semibold">({found.length})</span>
          </h2>
          {found.length === 0 ? (
            <p className="text-sm text-slate-500">No survey matches.</p>
          ) : (
            <div className={grid}>{found.map(card)}</div>
          )}
        </section>
      ) : shownSection ? (
        <section className="space-y-3" aria-label={shownSection.title}>
          <button
            type="button"
            onClick={() => setOpenSection(null)}
            className="inline-flex items-center gap-1.5 text-sm font-bold text-indigo-700 hover:underline cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" /> All my surveys
          </button>
          <h2 className="text-lg font-bold text-slate-900">
            {shownSection.title} <span className="text-slate-400 font-semibold">({shownSection.surveys.length})</span>
          </h2>
          <div className={grid}>{shownSection.surveys.map(card)}</div>
        </section>
      ) : (
        sections.map((sec) => (
          <section key={sec.id} className="space-y-3" aria-label={sec.title}>
            <div className="flex items-end justify-between gap-3">
              <div>
                <h2 className={`text-lg font-bold ${sec.id === "attention" ? "text-rose-700" : "text-slate-900"}`}>
                  {sec.title} <span className="text-slate-400 font-semibold">({sec.surveys.length})</span>
                </h2>
                <p className="text-xs text-slate-500">{sec.hint}</p>
              </div>
              {sec.surveys.length > 0 && (
                <button
                  type="button"
                  onClick={() => setOpenSection(sec.id)}
                  className="inline-flex items-center gap-1 text-sm font-bold text-indigo-700 hover:underline cursor-pointer shrink-0"
                >
                  See all <ArrowRight className="w-4 h-4" />
                </button>
              )}
            </div>
            {sec.surveys.length === 0 ? (
              <p className="px-4 py-6 rounded-2xl border border-dashed border-slate-300 text-sm text-slate-500 text-center">
                No drafts. Press "Create survey" to start one.
              </p>
            ) : (
              <SurveyRow items={sec.surveys.slice(0, ROW_LIMIT).map(card)} onSeeAll={() => setOpenSection(sec.id)} />
            )}
          </section>
        ))
      )}

      {actionsFor && (
        <SurveyActionsSheet
          survey={actionsFor}
          // The rules let the owner close only a live survey, and delete only drafts and rejected surveys.
          canClose={(actionsFor.status === "published" || actionsFor.status === "scheduled") && Boolean(onArchiveSurvey)}
          canDelete={actionsFor.status === "draft" || actionsFor.status === "rejected"}
          onClose={() => setActionsFor(null)}
          onPreview={
            onPreviewSurvey
              ? () => {
                  onPreviewSurvey(actionsFor);
                  setActionsFor(null);
                }
              : undefined
          }
          onCopyLink={actionsFor.status === "published" || actionsFor.status === "scheduled" ? () => copyLink(actionsFor) : undefined}
          onDuplicate={
            onDuplicateSurvey
              ? () => {
                  onDuplicateSurvey(actionsFor);
                  setActionsFor(null);
                }
              : undefined
          }
          onAnalytics={
            ["published", "scheduled", "archived"].includes(actionsFor.status || "published")
              ? () => onViewAnalytics(actionsFor.id)
              : undefined
          }
          onCloseEarly={async (reason) => {
            if (onArchiveSurvey) await onArchiveSurvey(actionsFor.id, reason);
          }}
          onDelete={() => remove(actionsFor)}
        />
      )}
    </div>
  );
};

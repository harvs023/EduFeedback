import { BarChart3, Calendar, Clock, Lock, MoreHorizontal, Pencil, RefreshCw, Users, X } from "lucide-react";
import type { Survey } from "../../types";
import { getSurveyAvailability } from "../../lib/surveyReview";
import { describeAudience } from "../../lib/audience";

const STATUS: Record<string, { label: string; className: string }> = {
  draft: { label: "Draft", className: "bg-amber-50 text-amber-800" },
  pending: { label: "Waiting for review", className: "bg-orange-50 text-orange-800" },
  rejected: { label: "Not approved", className: "bg-rose-50 text-rose-700" },
  scheduled: { label: "Scheduled", className: "bg-blue-50 text-blue-700" },
  published: { label: "Live", className: "bg-emerald-50 text-emerald-700" },
  archived: { label: "Closed", className: "bg-slate-100 text-slate-600" },
};

/** One survey in My Surveys: status, key facts, one main button for its status and "More". */
export function MySurveyCard({
  survey,
  excluded,
  canWithdraw,
  onEdit,
  onWithdraw,
  onAnalytics,
  onMore,
}: {
  survey: Survey;
  /** Responses the admin excluded after review (still saved, not counted). */
  excluded: number;
  canWithdraw: boolean;
  onEdit: () => void;
  onWithdraw: () => void;
  onAnalytics: () => void;
  onMore: () => void;
}) {
  const status = survey.status || "published";
  const chip = STATUS[status] || STATUS.published;
  const availability = getSurveyAvailability(survey);
  const live = status === "published" || status === "scheduled";
  const questions = survey.questions?.length || survey.questionCount || 0;

  let when = "";
  if (live && availability === "upcoming" && survey.openDate) when = `Opens ${new Date(survey.openDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;
  else if (live && availability === "closed") when = "Ended (closing date passed)";
  else if (live) when = survey.openEnded || !survey.closeDate ? "No closing date" : `Closes ${new Date(survey.closeDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;

  const main = (() => {
    const base = "flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-sm font-bold cursor-pointer";
    if (status === "draft" || status === "rejected") {
      return (
        <button type="button" onClick={onEdit} className={`${base} bg-indigo-600 hover:bg-indigo-700 text-white`}>
          <Pencil className="w-4 h-4" /> {status === "rejected" ? "Edit and resend" : "Edit"}
        </button>
      );
    }
    if (status === "pending") {
      return canWithdraw ? (
        <button type="button" onClick={onWithdraw} className={`${base} bg-white border border-slate-300 hover:bg-slate-50 text-slate-700`}>
          <RefreshCw className="w-4 h-4" /> Withdraw to edit
        </button>
      ) : (
        <span className={`${base} bg-slate-100 text-slate-500 cursor-default`}>
          <Lock className="w-4 h-4" /> Locked during review
        </span>
      );
    }
    return (
      <button type="button" onClick={onAnalytics} className={`${base} bg-indigo-600 hover:bg-indigo-700 text-white`}>
        <BarChart3 className="w-4 h-4" /> See results
      </button>
    );
  })();

  return (
    <article className="flex flex-col justify-between gap-4 p-5 rounded-2xl border border-slate-200 bg-white hover:border-indigo-300 hover:shadow-md transition-all">
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold ${chip.className}`}>
            {status === "published" && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />}
            {status === "rejected" && <X className="w-3 h-3" />}
            {status === "pending" && <Clock className="w-3 h-3" />}
            {chip.label}
          </span>
          <span className="text-[11px] font-semibold text-slate-500 truncate">{survey.cat}</span>
        </div>
        <h3 className="text-base font-bold text-slate-900 leading-snug line-clamp-2">{survey.title}</h3>
        {status === "rejected" && (
          <p className="p-2 rounded-lg bg-rose-50 text-xs text-rose-800">
            <span className="font-bold">Reason:</span> {survey.rejectionReason || "No reason was given."}
          </p>
        )}
        {status === "pending" && (
          <p className="text-xs text-slate-500">The administrator is reviewing it. You will get a notification.</p>
        )}
        <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-slate-500">
          {(live || status === "archived") && (
            <span className="inline-flex items-center gap-1">
              <Users className="w-3.5 h-3.5" /> {survey.responses || 0} answers
              {excluded > 0 && (
                <span className="text-rose-700" title="Excluded by the admin after review: still saved, not counted in Analytics">
                  ({excluded} excluded)
                </span>
              )}
            </span>
          )}
          <span>
            {questions} question{questions === 1 ? "" : "s"}
          </span>
          {when && (
            <span className="inline-flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5" /> {when}
            </span>
          )}
        </div>
        <p className="text-[11px] text-slate-500 truncate" title={describeAudience(survey.targetAudience)}>
          For: {describeAudience(survey.targetAudience)}
        </p>
      </div>
      <div className="flex items-center gap-2">
        {main}
        <button
          type="button"
          onClick={onMore}
          className="p-2 rounded-xl border border-slate-200 text-slate-500 hover:text-slate-900 hover:bg-slate-50 cursor-pointer"
          title="More actions"
          aria-label={`More actions for "${survey.title}"`}
        >
          <MoreHorizontal className="w-4 h-4" />
        </button>
      </div>
    </article>
  );
}

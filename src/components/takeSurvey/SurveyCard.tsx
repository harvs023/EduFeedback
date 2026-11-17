import { Ban, BarChart3, CheckCircle2, ListChecks, UserX } from "lucide-react";
import type { Survey } from "../../types";

/** When the survey closes, in words ("Closes Dec 5" / "No closing date"). */
function closingText(s: Survey): string {
  if (s.openEnded || !s.closeDate) return "No closing date";
  const t = Date.parse(s.closeDate);
  if (!Number.isFinite(t)) return "No closing date";
  const days = Math.ceil((t - Date.now()) / (24 * 60 * 60 * 1000));
  if (days <= 0) return "Closes today";
  if (days === 1) return "Closes tomorrow";
  if (days <= 7) return `Closes in ${days} days`;
  return `Closes ${new Date(t).toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;
}

/** One survey on the Take a Survey page. */
export function SurveyCard({
  survey,
  answered,
  answeredAnonymously,
  onOpen,
  admin,
}: {
  survey: Survey;
  answered: boolean;
  /** Answered anonymously: the answers are not linked to the person and cannot be shown again. */
  answeredAnonymously: boolean;
  onOpen: () => void;
  /** Admin-only buttons. */
  admin?: { onAnalytics: () => void; onTakeDown?: () => void };
}) {
  const questions = survey.questions?.length || 0;
  const closing = closingText(survey);
  const soon = closing === "Closes today" || closing === "Closes tomorrow";

  return (
    <article
      className={`group flex flex-col justify-between gap-4 p-5 rounded-2xl border bg-white transition-all ${
        answered ? "border-slate-200 opacity-80" : "border-slate-200 hover:border-indigo-300 hover:shadow-md"
      }`}
    >
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <span className="px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 text-[11px] font-semibold truncate">{survey.cat}</span>
          {answered ? (
            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700">
              <CheckCircle2 className="w-3.5 h-3.5" /> Answered
            </span>
          ) : (
            <span className={`text-[11px] font-semibold ${soon ? "text-rose-600" : "text-slate-500"}`}>{closing}</span>
          )}
        </div>
        <h3 className="text-base font-bold text-slate-900 leading-snug line-clamp-2">{survey.title}</h3>
        {survey.desc && <p className="text-sm text-slate-500 leading-relaxed line-clamp-2">{survey.desc}</p>}
      </div>

      <div className="space-y-3">
        <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-slate-500">
          <span className="inline-flex items-center gap-1">
            <ListChecks className="w-3.5 h-3.5" /> {questions} question{questions === 1 ? "" : "s"}
          </span>
          {survey.allowAnonymous && (
            <span className="inline-flex items-center gap-1">
              <UserX className="w-3.5 h-3.5" /> Can answer anonymously
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {answeredAnonymously ? (
            <span
              className="flex-1 text-center px-3 py-2 rounded-xl text-sm font-semibold bg-emerald-50 text-emerald-700"
              title="You answered this anonymously, so your answers are not linked to you and cannot be shown."
            >
              Completed
            </span>
          ) : (
            <button
              type="button"
              onClick={onOpen}
              className={`flex-1 px-3 py-2 rounded-xl text-sm font-bold cursor-pointer transition-colors ${
                answered ? "bg-slate-100 hover:bg-slate-200 text-slate-700" : "bg-indigo-600 hover:bg-indigo-700 text-white"
              }`}
            >
              {answered ? "View my answers" : "Answer survey"}
            </button>
          )}
          {admin && (
            <>
              <button
                type="button"
                onClick={admin.onAnalytics}
                className="p-2 rounded-xl border border-slate-200 text-slate-500 hover:text-slate-900 hover:bg-slate-50 cursor-pointer"
                title="Open in Analytics"
                aria-label="Open in Analytics"
              >
                <BarChart3 className="w-4 h-4" />
              </button>
              {admin.onTakeDown && (
                <button
                  type="button"
                  onClick={admin.onTakeDown}
                  className="p-2 rounded-xl border border-slate-200 text-slate-400 hover:text-rose-600 hover:bg-rose-50 cursor-pointer"
                  title="Take down (close and archive, answers are kept)"
                  aria-label="Take down survey"
                >
                  <Ban className="w-4 h-4" />
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </article>
  );
}

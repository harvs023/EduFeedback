import React, { useMemo, useState } from "react";
import { CheckCircle2, Flag, Loader2, ShieldOff } from "lucide-react";
import type { ReportReason, Survey, SurveyReport } from "../types";
import { REPORT_REASON_LABELS } from "./ReportSurveyDialog";
import { formatDateTime } from "../lib/timeAgo";

interface ReportedSurveysPanelProps {
  reports: SurveyReport[];
  surveys: Survey[];
  onDismiss: (surveyId: string, note: string) => Promise<void>;
  /** Takes the survey down (archives it with the reason) and closes its reports. */
  onTakedown: (surveyId: string, reason: string) => Promise<void>;
}

interface Group {
  surveyId: string;
  title: string;
  survey?: Survey;
  reports: SurveyReport[];
  open: SurveyReport[];
  reasonCounts: [ReportReason, number][];
}

const STATUS_LABEL: Record<SurveyReport["status"], string> = {
  open: "Waiting",
  dismissed: "Dismissed (survey kept)",
  taken_down: "Survey taken down",
};

export const ReportedSurveysPanel: React.FC<ReportedSurveysPanelProps> = ({ reports, surveys, onDismiss, onTakedown }) => {
  const [view, setView] = useState<"waiting" | "decided">("waiting");
  const [action, setAction] = useState<{ surveyId: string; kind: "dismiss" | "takedown" } | null>(null);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);

  const groups = useMemo<Group[]>(() => {
    const bySurvey = new Map<string, SurveyReport[]>();
    for (const r of reports) {
      const k = String(r.surveyId);
      bySurvey.set(k, [...(bySurvey.get(k) || []), r]);
    }
    return Array.from(bySurvey.entries()).map(([surveyId, list]) => {
      const counts = new Map<ReportReason, number>();
      list.forEach((r) => r.reasons.forEach((x) => counts.set(x, (counts.get(x) || 0) + 1)));
      const sorted = [...list].sort((a, b) => b.reportedAt - a.reportedAt);
      return {
        surveyId,
        title: surveys.find((s) => String(s.id) === surveyId)?.title || list[0].surveyTitle,
        survey: surveys.find((s) => String(s.id) === surveyId),
        reports: sorted,
        open: sorted.filter((r) => r.status === "open"),
        reasonCounts: Array.from(counts.entries()).sort((a, b) => b[1] - a[1]),
      };
    });
  }, [reports, surveys]);

  const waiting = groups.filter((g) => g.open.length > 0).sort((a, b) => b.open.length - a.open.length);
  const decided = groups
    .filter((g) => g.open.length === 0)
    .sort((a, b) => (b.reports[0].decidedAt || 0) - (a.reports[0].decidedAt || 0));
  const shown = view === "waiting" ? waiting : decided;

  const start = (surveyId: string, kind: "dismiss" | "takedown") => {
    setAction({ surveyId, kind });
    setText("");
  };

  const confirm = async () => {
    if (!action) return;
    if (action.kind === "takedown" && text.trim().length < 10) return;
    setBusy(true);
    try {
      if (action.kind === "dismiss") await onDismiss(action.surveyId, text.trim());
      else await onTakedown(action.surveyId, text.trim());
      setAction(null);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="bg-white p-6 sm:p-8 rounded-3xl border border-slate-200 shadow-xs space-y-5">
      <div className="space-y-1">
        <h2 className="font-serif text-xl font-bold text-slate-900 flex items-center gap-2">
          <Flag className="w-5 h-5 text-rose-600" /> Reported Surveys
        </h2>
        <p className="text-xs text-slate-500 max-w-3xl">
          Users can report a live survey once each. Review the reasons, then <strong>dismiss</strong> the reports (the survey
          stays live) or <strong>take the survey down</strong> (it is archived and its creator gets your reason). The creator
          never sees who reported; reporters are told your decision.
        </p>
      </div>

      <div className="flex gap-2">
        {(["waiting", "decided"] as const).map((v) => (
          <button
            key={v}
            type="button"
            onClick={() => setView(v)}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold cursor-pointer ${
              view === v ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"
            }`}
          >
            {v === "waiting" ? `Waiting (${waiting.length})` : `Decided (${decided.length})`}
          </button>
        ))}
      </div>

      {shown.length === 0 && (
        <div className="p-8 text-center text-xs text-slate-500 border border-dashed border-slate-200 rounded-2xl">
          {view === "waiting" ? "No reports waiting. Nice and clean." : "No decided reports yet."}
        </div>
      )}

      <div className="space-y-4">
        {shown.map((g) => {
          const live = g.survey?.status === "published" || g.survey?.status === "scheduled";
          const isActing = action?.surveyId === g.surveyId;
          const list = view === "waiting" ? g.open : g.reports;
          return (
            <div key={g.surveyId} className="p-4 sm:p-5 rounded-2xl border border-slate-200 space-y-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <div className="font-bold text-slate-900 text-sm">{g.title}</div>
                  <div className="text-[11px] text-slate-500">
                    By {g.survey?.owner || "unknown"} · status: {g.survey?.status || "deleted"} ·{" "}
                    {list.length} report{list.length === 1 ? "" : "s"}
                  </div>
                </div>
                <div className="flex flex-wrap gap-1">
                  {g.reasonCounts.map(([r, n]) => (
                    <span key={r} className="px-2 py-0.5 rounded-full bg-rose-50 border border-rose-200 text-[10px] font-bold text-rose-700">
                      {REPORT_REASON_LABELS[r]} ×{n}
                    </span>
                  ))}
                </div>
              </div>

              <ul className="space-y-1.5">
                {list.map((r) => (
                  <li key={r.id} className="p-2.5 rounded-xl bg-slate-50 border border-slate-100 text-xs">
                    <div className="flex flex-wrap justify-between gap-2 text-[11px] text-slate-500">
                      <span>
                        {r.reportedBy} · {formatDateTime(r.reportedAt)}
                      </span>
                      {view === "decided" && <span className="font-bold text-slate-600">{STATUS_LABEL[r.status]}</span>}
                    </div>
                    <div className="text-slate-700 mt-0.5">
                      {r.reasons.map((x) => REPORT_REASON_LABELS[x]).join(", ")}
                      {r.note && <span className="text-slate-600">: "{r.note}"</span>}
                    </div>
                    {view === "decided" && r.decisionNote && (
                      <div className="text-[11px] text-slate-500 mt-1">Your note: {r.decisionNote}</div>
                    )}
                  </li>
                ))}
              </ul>

              {view === "waiting" &&
                (isActing ? (
                  <div className="p-3 rounded-xl border border-slate-200 bg-white space-y-2">
                    <label className="text-xs font-bold text-slate-800">
                      {action.kind === "dismiss"
                        ? "Note for the reporters (optional)"
                        : "Reason for taking it down (at least 10 characters, shown to the creator and reporters)"}
                    </label>
                    <textarea
                      value={text}
                      onChange={(e) => setText(e.target.value)}
                      rows={2}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                    />
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setAction(null)}
                        disabled={busy}
                        className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-lg cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={confirm}
                        disabled={busy || (action.kind === "takedown" && text.trim().length < 10)}
                        className={`px-3 py-1.5 text-white font-bold text-xs rounded-lg flex items-center gap-1 cursor-pointer disabled:opacity-50 ${
                          action.kind === "dismiss" ? "bg-slate-800 hover:bg-slate-900" : "bg-rose-600 hover:bg-rose-700"
                        }`}
                      >
                        {busy && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                        {action.kind === "dismiss" ? "Dismiss reports" : "Take survey down"}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => start(g.surveyId, "dismiss")}
                      className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-lg flex items-center gap-1 cursor-pointer"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" /> Dismiss (keep survey)
                    </button>
                    {live ? (
                      <button
                        type="button"
                        onClick={() => start(g.surveyId, "takedown")}
                        className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-lg flex items-center gap-1 cursor-pointer"
                      >
                        <ShieldOff className="w-3.5 h-3.5" /> Take survey down
                      </button>
                    ) : (
                      <span className="text-[11px] text-slate-500 self-center">
                        The survey is no longer live, so it cannot be taken down; dismiss the reports.
                      </span>
                    )}
                  </div>
                ))}
            </div>
          );
        })}
      </div>
    </div>
  );
};

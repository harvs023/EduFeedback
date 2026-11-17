import React, { useState } from "react";
import { Flag, Loader2, X } from "lucide-react";
import type { ReportReason } from "../types";

export const REPORT_REASON_LABELS: Record<ReportReason, string> = {
  offensive: "Offensive or inappropriate",
  personal_info: "Asks for personal or sensitive information",
  misleading: "Misleading, or not a real school survey",
  spam: "Spam or duplicate",
  other: "Other",
};

export const MAX_REPORT_NOTE = 500;

interface ReportSurveyDialogProps {
  surveyTitle: string;
  onClose: () => void;
  /** Resolves to true when the report was saved. */
  onSubmit: (reasons: ReportReason[], note: string) => Promise<boolean>;
}

export const ReportSurveyDialog: React.FC<ReportSurveyDialogProps> = ({ surveyTitle, onClose, onSubmit }) => {
  const [reasons, setReasons] = useState<ReportReason[]>([]);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  const toggle = (r: ReportReason) => setReasons((prev) => (prev.includes(r) ? prev.filter((x) => x !== r) : [...prev, r]));

  const submit = async () => {
    if (reasons.length === 0) {
      setError("Please choose at least one reason.");
      return;
    }
    if (reasons.includes("other") && !note.trim()) {
      setError('Please explain in the note what "Other" means.');
      return;
    }
    setError(null);
    setSending(true);
    const ok = await onSubmit(reasons, note.trim().slice(0, MAX_REPORT_NOTE));
    setSending(false);
    if (ok) onClose();
  };

  return (
    <div className="fixed inset-0 z-70 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="report-title"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center">
              <Flag className="w-4 h-4" />
            </div>
            <div>
              <h3 id="report-title" className="font-serif text-lg font-bold text-slate-900">
                Report this survey
              </h3>
              <p className="text-xs text-slate-500 line-clamp-1">{surveyTitle}</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="p-1 rounded-full hover:bg-slate-100 text-slate-400" aria-label="Close">
            <X className="w-5 h-5" />
          </button>
        </div>

        <p className="text-xs text-slate-600">
          The administrator will review your report. The survey's creator is <strong>not</strong> told who reported it. You can
          report a survey only once.
        </p>

        <div className="space-y-1.5">
          <div className="text-xs font-bold text-slate-800">What is wrong with it?</div>
          {(Object.keys(REPORT_REASON_LABELS) as ReportReason[]).map((r) => (
            <label key={r} className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
              <input type="checkbox" checked={reasons.includes(r)} onChange={() => toggle(r)} className="w-4 h-4 accent-rose-600" />
              {REPORT_REASON_LABELS[r]}
            </label>
          ))}
        </div>

        <div className="space-y-1">
          <label className="text-xs font-bold text-slate-800" htmlFor="report-note">
            Note {reasons.includes("other") ? "(required)" : "(optional)"}
          </label>
          <textarea
            id="report-note"
            value={note}
            onChange={(e) => setNote(e.target.value.slice(0, MAX_REPORT_NOTE))}
            rows={3}
            placeholder="e.g. Question 4 asks for my home address."
            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:outline-hidden focus:border-rose-300"
          />
          <div className="text-[10px] text-slate-400 text-right">
            {note.length}/{MAX_REPORT_NOTE}
          </div>
        </div>

        {error && <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700 font-semibold">{error}</div>}

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={sending}
            className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Flag className="w-4 h-4" />} Send report
          </button>
        </div>
      </div>
    </div>
  );
};

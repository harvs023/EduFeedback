import { useState } from "react";
import { AlertTriangle, Loader2, X } from "lucide-react";

const MIN_REASON = 10;

/**
 * Admin: take a live survey down (it is closed and archived with the reason; answers are kept and
 * the owner is told why). Used instead of deleting a live survey.
 */
export function TakedownDialog({
  title,
  onClose,
  onConfirm,
}: {
  title: string;
  onClose: () => void;
  /** Resolves when done; the dialog closes afterwards. */
  onConfirm: (reason: string) => Promise<unknown> | void;
}) {
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const ok = reason.trim().length >= MIN_REASON;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Take down survey"
      >
        <div className="flex items-start justify-between gap-3">
          <h3 className="flex items-center gap-2 text-lg font-bold text-slate-900">
            <AlertTriangle className="w-5 h-5 text-rose-600" /> Take down this survey?
          </h3>
          <button type="button" onClick={onClose} className="p-1 rounded-full hover:bg-slate-100 text-slate-400" aria-label="Close">
            <X className="w-5 h-5" />
          </button>
        </div>
        <p className="text-sm text-slate-600">
          "{title}" will stop taking answers and move to the archive. Answers already given are kept, and the owner is
          told the reason.
        </p>
        <label className="block">
          <span className="block text-xs font-bold text-slate-700 mb-1">Reason (shown to the owner)</span>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            maxLength={500}
            placeholder="e.g. The questions ask for personal information."
            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm"
          />
          <span className={`block text-[11px] mt-0.5 ${ok ? "text-emerald-600" : "text-slate-400"}`}>
            At least {MIN_REASON} characters ({reason.trim().length})
          </span>
        </label>
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-bold rounded-xl cursor-pointer">
            Cancel
          </button>
          <button
            type="button"
            disabled={!ok || busy}
            onClick={async () => {
              setBusy(true);
              try {
                await onConfirm(reason.trim());
                onClose();
              } finally {
                setBusy(false);
              }
            }}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-sm font-bold rounded-xl cursor-pointer disabled:opacity-50"
          >
            {busy && <Loader2 className="w-4 h-4 animate-spin" />} Take down
          </button>
        </div>
      </div>
    </div>
  );
}

import React, { useState } from "react";
import { Flag, X } from "lucide-react";
import { MANUAL_REASONS, REASONS } from "../../lib/responseChecks";

interface Props {
  /** Warnings the system found; they start ticked. */
  suggested: string[];
  onCancel: () => void;
  onSubmit: (reasons: string[], note: string) => Promise<void>;
}

const ALL_REASONS = [...Object.values(REASONS), ...MANUAL_REASONS];

/** Flag one response for the admin. The owner can only flag; the admin keeps or excludes it. */
export const FlagResponseDialog: React.FC<Props> = ({ suggested, onCancel, onSubmit }) => {
  const [picked, setPicked] = useState<string[]>(suggested);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggle = (r: string) => setPicked((p) => (p.includes(r) ? p.filter((x) => x !== r) : [...p, r]));
  const needsNote = picked.includes("Other") && !note.trim();

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      await onSubmit(picked, note.trim());
    } catch (err: any) {
      setError(err?.message || "Could not flag this response. Please try again.");
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl p-5 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Flag className="w-4 h-4 text-amber-600" />
              Flag for admin review
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              The response keeps counting until the admin decides. Only the admin can exclude it. This cannot be undone by
              you.
            </p>
          </div>
          <button type="button" onClick={onCancel} className="p-1 rounded-lg text-slate-500 hover:bg-slate-100 cursor-pointer" aria-label="Close">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="space-y-1.5">
          <p className="text-xs font-bold text-slate-700">Why? (pick at least one)</p>
          {ALL_REASONS.map((r) => (
            <label key={r} className="flex items-center gap-2 text-sm text-slate-800 cursor-pointer">
              <input type="checkbox" checked={picked.includes(r)} onChange={() => toggle(r)} className="w-4 h-4 accent-amber-600" />
              {r}
              {suggested.includes(r) && <span className="text-[10px] font-bold uppercase text-amber-700">found by the system</span>}
            </label>
          ))}
        </div>
        <label className="block space-y-1">
          <span className="text-xs font-bold text-slate-700">Note for the admin {picked.includes("Other") ? "(required for Other)" : "(optional)"}</span>
          <textarea
            value={note}
            maxLength={300}
            rows={3}
            onChange={(e) => setNote(e.target.value)}
            placeholder="What looks wrong? Do not write the respondent's name."
            className="w-full p-2.5 rounded-xl border border-slate-200 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-200"
          />
        </label>
        {error && <p className="text-xs text-rose-700">{error}</p>}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onCancel} className="px-4 py-2 rounded-xl bg-slate-100 text-slate-700 text-sm font-semibold hover:bg-slate-200 cursor-pointer">
            Cancel
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={busy || picked.length === 0 || needsNote}
            className="px-4 py-2 rounded-xl bg-amber-600 text-white text-sm font-semibold hover:bg-amber-700 disabled:opacity-50 cursor-pointer"
          >
            {busy ? "Flagging..." : "Flag it"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default FlagResponseDialog;

import { useState } from "react";
import { Archive, BarChart3, Check, CopyPlus, Eye, Link2, Loader2, Trash2, X } from "lucide-react";
import type { Survey } from "../../types";

/**
 * "More actions" for one survey in My Surveys. Only the actions the rules allow for this survey's
 * status are offered: preview, copy link (live), copy as new draft, see results, close early
 * (live, owner), delete (draft / not approved).
 */
export function SurveyActionsSheet({
  survey,
  canClose,
  canDelete,
  onClose,
  onPreview,
  onCopyLink,
  onDuplicate,
  onAnalytics,
  onCloseEarly,
  onDelete,
}: {
  survey: Survey;
  canClose: boolean;
  canDelete: boolean;
  onClose: () => void;
  onPreview?: () => void;
  onCopyLink?: () => void;
  onDuplicate?: () => void;
  onAnalytics?: () => void;
  onCloseEarly: (reason: string) => Promise<void> | void;
  onDelete: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const [closing, setClosing] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  const item =
    "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold text-slate-700 hover:bg-slate-50 text-left cursor-pointer";

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={onClose}>
      <div
        className="bg-white w-full sm:max-w-sm rounded-t-3xl sm:rounded-3xl p-4 shadow-2xl border border-slate-200 space-y-2"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="More actions"
      >
        <div className="flex items-start justify-between gap-2 px-1 pb-1">
          <p className="text-sm font-bold text-slate-900 leading-snug line-clamp-2">{survey.title}</p>
          <button type="button" onClick={onClose} className="p-1 rounded-full hover:bg-slate-100 text-slate-400" aria-label="Close">
            <X className="w-5 h-5" />
          </button>
        </div>

        {closing ? (
          <div className="space-y-2 p-1">
            <p className="text-sm font-bold text-slate-800">Close this survey now?</p>
            <p className="text-xs text-slate-600">
              It stops taking answers right away and moves to Closed. Its results stay in Analytics. This cannot be undone,
              but you can copy it as a new draft later.
            </p>
            <input
              value={reason}
              maxLength={200}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Reason (optional), e.g. Enough answers collected"
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm"
            />
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setClosing(false)} className="px-3 py-2 rounded-xl bg-slate-100 text-sm font-bold text-slate-700 cursor-pointer">
                Back
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  try {
                    await onCloseEarly(reason.trim());
                    onClose();
                  } finally {
                    setBusy(false);
                  }
                }}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-900 text-white text-sm font-bold cursor-pointer disabled:opacity-50"
              >
                {busy && <Loader2 className="w-4 h-4 animate-spin" />} Close survey
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-0.5">
            {onAnalytics && (
              <button type="button" onClick={onAnalytics} className={item}>
                <BarChart3 className="w-4 h-4 text-slate-400" /> See results
              </button>
            )}
            {onPreview && (
              <button type="button" onClick={onPreview} className={item}>
                <Eye className="w-4 h-4 text-slate-400" /> Preview as a respondent
              </button>
            )}
            {onCopyLink && (
              <button
                type="button"
                onClick={() => {
                  onCopyLink();
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1500);
                }}
                className={item}
              >
                {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Link2 className="w-4 h-4 text-slate-400" />}
                {copied ? "Link copied" : "Copy link to share"}
              </button>
            )}
            {onDuplicate && (
              <button type="button" onClick={onDuplicate} className={item}>
                <CopyPlus className="w-4 h-4 text-slate-400" /> Copy as a new draft
              </button>
            )}
            {canClose && (
              <button type="button" onClick={() => setClosing(true)} className={item}>
                <Archive className="w-4 h-4 text-slate-400" /> Close early
              </button>
            )}
            {canDelete && (
              <button type="button" onClick={onDelete} className={`${item} text-rose-700 hover:bg-rose-50`}>
                <Trash2 className="w-4 h-4" /> Delete
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

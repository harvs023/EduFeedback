import { useMemo, useState } from "react";
import { AlertTriangle, GraduationCap, Loader2, X } from "lucide-react";
import type { SchoolLists, UserProfile } from "../types";
import { planYearMove } from "../lib/schoolYearMove";
import { formatDateTime } from "../lib/timeAgo";

const CONFIRM_WORD = "MOVE UP";
/** A second move within this many days is probably a mistake; the dialog warns. */
const RECENT_DAYS = 180;

/**
 * "New school year: move students up one year" (plan step 10c-1b). Shows the plan first:
 * who moves up (and must pick a new section once), who graduates (suspended), who is skipped.
 */
export function NewSchoolYearMove({
  users,
  lists,
  lastMoveAt,
  onConfirm,
}: {
  users: UserProfile[];
  lists: SchoolLists | null;
  lastMoveAt?: number;
  onConfirm: () => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const plan = useMemo(() => planYearMove(users, lists), [users, lists]);
  const recent = lastMoveAt && Date.now() - lastMoveAt < RECENT_DAYS * 24 * 60 * 60 * 1000;
  const nothing = plan.moveUp.length === 0 && plan.graduate.length === 0;

  const close = () => {
    setOpen(false);
    setTyped("");
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="px-4 py-2.5 bg-white hover:bg-slate-50 text-slate-800 font-bold text-xs rounded-xl flex items-center gap-2 transition-all cursor-pointer border border-slate-300"
        title="Move every student up one year level at the start of a new school year"
      >
        <GraduationCap className="w-4 h-4 text-indigo-600" />
        <span>New school year</span>
      </button>

      {open && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-4 overflow-y-auto" onClick={close}>
          <div
            className="bg-white rounded-3xl max-w-2xl w-full p-6 shadow-2xl border border-slate-200 space-y-4 my-8 text-sm"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-label="New school year"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold text-slate-900">New school year: move students up one year</h2>
                <p className="text-xs text-slate-500">
                  For active students and student officers. Faculty and the admin are not changed.
                  {lastMoveAt ? ` Last done ${formatDateTime(lastMoveAt)}.` : " Not done before."}
                </p>
              </div>
              <button type="button" onClick={close} className="p-1 text-slate-400 hover:text-slate-600" aria-label="Close">
                <X className="w-5 h-5" />
              </button>
            </div>

            {recent && (
              <p className="flex items-start gap-2 p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                This was already done less than {RECENT_DAYS} days ago. Doing it again moves everyone up a second time.
              </p>
            )}

            <div className="space-y-3">
              <section className="p-3 rounded-xl bg-indigo-50 border border-indigo-200">
                <p className="font-bold text-indigo-900">{plan.moveUp.length} will move up one year</p>
                <p className="text-xs text-indigo-900">
                  Their section is cleared. Next time they log in, they are asked to choose their new section once.
                </p>
              </section>
              <section className="p-3 rounded-xl bg-amber-50 border border-amber-200 space-y-1">
                <p className="font-bold text-amber-900">{plan.graduate.length} are in their program's last year: marked graduated</p>
                <p className="text-xs text-amber-900">
                  Their accounts are suspended (they can no longer log in). Their past answers stay in the results. You can
                  re-activate an account in this directory if someone did not graduate.
                </p>
                {plan.graduate.length > 0 && (
                  <ul className="max-h-32 overflow-y-auto text-xs text-amber-900 list-disc pl-5">
                    {plan.graduate.map((g) => (
                      <li key={g.user.email}>
                        {g.user.name} ({g.program}, {g.year})
                      </li>
                    ))}
                  </ul>
                )}
              </section>
              {plan.skipped.length > 0 && (
                <section className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
                  <p className="font-bold text-slate-800">{plan.skipped.length} will not be changed (fix them by hand)</p>
                  <ul className="max-h-32 overflow-y-auto text-xs text-slate-700 list-disc pl-5">
                    {plan.skipped.map((s) => (
                      <li key={s.user.email}>
                        {s.user.name}: {s.reason}
                      </li>
                    ))}
                  </ul>
                </section>
              )}
            </div>

            <p className="text-xs text-slate-600">
              This cannot be undone with one click. Download a backup first (Review Center &gt; Backup &amp; Restore).
            </p>

            {nothing ? (
              <p className="text-xs font-semibold text-slate-600">There is no one to move.</p>
            ) : (
              <div className="space-y-2">
                <label className="block text-xs font-bold text-slate-700">
                  Type <span className="font-mono">{CONFIRM_WORD}</span> to confirm
                </label>
                <input
                  value={typed}
                  onChange={(e) => setTyped(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono"
                />
              </div>
            )}

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={close}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={nothing || busy || typed.trim().toUpperCase() !== CONFIRM_WORD}
                onClick={async () => {
                  setBusy(true);
                  try {
                    await onConfirm();
                    close();
                  } finally {
                    setBusy(false);
                  }
                }}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs cursor-pointer disabled:opacity-50"
              >
                {busy && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Move {plan.moveUp.length} up, mark {plan.graduate.length} graduated
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

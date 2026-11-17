import { useState } from "react";
import { CheckCircle2, Loader2, UserCog, XCircle } from "lucide-react";
import type { ProfileChangeRequest, UserProfile } from "../types";
import { formatDateTime } from "../lib/timeAgo";
import { SCHOOL_FIELD_LABELS, changedFields, schoolFieldsOf, type SchoolFieldKey } from "../lib/profileRequests";

const MIN_REJECT_NOTE = 5;

/**
 * Review Center tab "Profile Requests" (plan step 10c-1a): people's requests to change their
 * locked school details. Approve updates the profile; Reject needs a short reason.
 */
export function ProfileRequestsPanel({
  requests,
  users,
  onDecide,
}: {
  requests: ProfileChangeRequest[];
  users: UserProfile[];
  onDecide: (request: ProfileChangeRequest, approve: boolean, note: string) => Promise<void>;
}) {
  const [view, setView] = useState<"waiting" | "decided">("waiting");
  const [action, setAction] = useState<{ id: string; approve: boolean } | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const waiting = requests.filter((r) => r.status === "pending").sort((a, b) => a.requestedAt - b.requestedAt);
  const decided = requests.filter((r) => r.status !== "pending").sort((a, b) => (b.decidedAt || 0) - (a.decidedAt || 0));
  const shown = view === "waiting" ? waiting : decided;

  const confirm = async (r: ProfileChangeRequest) => {
    if (!action) return;
    if (!action.approve && note.trim().length < MIN_REJECT_NOTE) return;
    setBusy(true);
    try {
      await onDecide(r, action.approve, note.trim());
      setAction(null);
      setNote("");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="bg-white rounded-3xl border border-slate-200 p-5 sm:p-6 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900">
            <UserCog className="w-5 h-5 text-indigo-600" /> Profile change requests
          </h2>
          <p className="text-xs text-slate-500 max-w-2xl">
            People cannot change their department, program, year, section or student ID themselves, because surveys
            can be meant for these groups. Approving a request updates the person's profile right away. You can also
            edit anyone directly on the Users page.
          </p>
        </div>
        <div className="flex gap-1 p-1 rounded-xl bg-slate-100 text-xs font-bold">
          {(["waiting", "decided"] as const).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setView(v)}
              className={`px-3 py-1.5 rounded-lg cursor-pointer ${view === v ? "bg-white text-slate-900 shadow-xs" : "text-slate-500"}`}
            >
              {v === "waiting" ? `Waiting (${waiting.length})` : `Decided (${decided.length})`}
            </button>
          ))}
        </div>
      </div>

      {shown.length === 0 ? (
        <p className="text-sm text-slate-500 py-6 text-center">
          {view === "waiting" ? "No requests are waiting." : "No decided requests yet."}
        </p>
      ) : (
        <ul className="space-y-3">
          {shown.map((r) => {
            const person = users.find((u) => u.email.toLowerCase() === r.email.toLowerCase());
            const now = person ? schoolFieldsOf(person) : null;
            const changed = changedFields(r.current, r.requested);
            // The profile was changed since the request was sent (e.g. the admin edited it directly).
            const outdated = r.status === "pending" && now && changed.some((k) => (now[k] || "") !== (r.current[k] || ""));
            const acting = action?.id === r.id;
            return (
              <li key={r.id} className="p-4 rounded-2xl border border-slate-200 space-y-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-slate-900">{r.name}</p>
                    <p className="text-xs text-slate-500 break-all">
                      {r.email}
                      {person ? ` · ${person.pos}` : " · account no longer exists"}
                    </p>
                  </div>
                  <span className="text-[11px] text-slate-500">Sent {formatDateTime(r.requestedAt)}</span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-left text-slate-500">
                        <th className="py-1 pr-3 font-semibold">Field</th>
                        <th className="py-1 pr-3 font-semibold">Current</th>
                        <th className="py-1 font-semibold">Requested</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(Object.keys(r.requested) as SchoolFieldKey[]).map((k) => {
                        const isChanged = changed.includes(k);
                        return (
                          <tr key={k} className={isChanged ? "bg-amber-50" : ""}>
                            <td className="py-1 pr-3 font-semibold text-slate-700">{SCHOOL_FIELD_LABELS[k]}</td>
                            <td className="py-1 pr-3 text-slate-600">{r.current[k] || "—"}</td>
                            <td className={`py-1 ${isChanged ? "font-bold text-slate-900" : "text-slate-600"}`}>
                              {r.requested[k] || "—"}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <p className="text-xs text-slate-700">
                  <span className="font-semibold">Reason:</span> {r.reason}
                </p>

                {outdated && (
                  <p className="text-xs p-2 rounded-lg bg-amber-50 border border-amber-200 text-amber-900">
                    This person's profile changed after the request was sent. Check the current values on the Users page before
                    approving.
                  </p>
                )}

                {r.status !== "pending" ? (
                  <p
                    className={`text-xs font-semibold ${r.status === "approved" ? "text-emerald-700" : "text-rose-700"}`}
                  >
                    {r.status === "approved" ? "Approved" : "Rejected"}
                    {r.decidedAt ? ` ${formatDateTime(r.decidedAt)}` : ""}
                    {r.decidedBy ? ` by ${r.decidedBy}` : ""}
                    {r.decisionNote ? `. Note: ${r.decisionNote}` : ""}
                  </p>
                ) : acting ? (
                  <div className="space-y-2 p-3 rounded-xl bg-slate-50 border border-slate-200">
                    <label className="block text-xs font-bold text-slate-700">
                      {action.approve ? "Note to the person (optional)" : "Reason for rejecting (shown to the person)"}
                    </label>
                    <textarea
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      rows={2}
                      maxLength={300}
                      className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl"
                      placeholder={action.approve ? "" : "e.g. Please bring your registration form to the office first."}
                    />
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setAction(null)}
                        className="px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-xs font-bold text-slate-700 cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        disabled={busy || !person || (!action.approve && note.trim().length < MIN_REJECT_NOTE)}
                        onClick={() => confirm(r)}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-white cursor-pointer disabled:opacity-50 ${
                          action.approve ? "bg-emerald-600 hover:bg-emerald-700" : "bg-rose-600 hover:bg-rose-700"
                        }`}
                      >
                        {busy && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                        {action.approve ? "Approve and update profile" : "Reject request"}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={!person}
                      onClick={() => {
                        setAction({ id: r.id, approve: true });
                        setNote("");
                      }}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold cursor-pointer disabled:opacity-50"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" /> Approve
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setAction({ id: r.id, approve: false });
                        setNote("");
                      }}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-rose-300 text-rose-700 hover:bg-rose-50 text-xs font-bold cursor-pointer"
                    >
                      <XCircle className="w-3.5 h-3.5" /> Reject
                    </button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

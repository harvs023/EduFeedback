import { useState } from "react";
import { Clock, Lock, Send, X } from "lucide-react";
import type { ProfileChangeRequest, ProfileSchoolFields as Fields, SchoolLists, UserProfile } from "../types";
import { SchoolFieldsPicker } from "./SchoolFieldsPicker";
import { missingSchoolField, type SchoolFields } from "../lib/schoolLists";
import { SCHOOL_FIELD_LABELS, changedFields, describeChanges, fieldKeysFor, isStudentPos, schoolFieldsOf } from "../lib/profileRequests";
import { formatDateTime } from "../lib/timeAgo";

const MIN_REASON = 10;
const MAX_REASON = 500;

/**
 * The locked school fields on the profile screen, with "Request a change" (plan step 10c-1a).
 * The person cannot edit these directly; the admin approves or rejects a request.
 */
export function ProfileSchoolFields({
  user,
  lists,
  request,
  showDecision,
  onSend,
  onCancel,
}: {
  user: UserProfile;
  lists: SchoolLists | null;
  /** This person's latest request (any status), or null. */
  request: ProfileChangeRequest | null;
  /** Show the approved / not approved note (only the first time after the decision). */
  showDecision: boolean;
  onSend: (requested: Fields, reason: string) => Promise<boolean>;
  onCancel: () => Promise<void>;
}) {
  const isStudent = isStudentPos(user.pos);
  const current = schoolFieldsOf(user);
  const keys = fieldKeysFor(user.pos);
  const [formOpen, setFormOpen] = useState(false);
  const [school, setSchool] = useState<SchoolFields>({
    department: current.department || "",
    program: current.program || "",
    year: current.year || "",
    section: current.section || "",
  });
  const [studentId, setStudentId] = useState(current.studentId || "");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const waiting = request?.status === "pending";

  const submit = async () => {
    const missing = missingSchoolField(school, isStudent);
    if (missing) return setError(missing);
    if (isStudent && !studentId.trim()) return setError("Please enter your student ID.");
    const requested: Fields = {};
    for (const k of keys) requested[k] = k === "studentId" ? studentId.trim() : school[k as keyof SchoolFields];
    if (changedFields(current, requested).length === 0) return setError("Nothing was changed. Change at least one field.");
    if (reason.trim().length < MIN_REASON) return setError(`Please give a reason (at least ${MIN_REASON} characters).`);
    setError(null);
    setBusy(true);
    const ok = await onSend(requested, reason.trim());
    setBusy(false);
    if (ok) {
      setFormOpen(false);
      setReason("");
    }
  };

  return (
    <div className="space-y-3 p-4 rounded-2xl bg-slate-50 border border-slate-200">
      <div className="flex items-center gap-1.5">
        <Lock className="w-3.5 h-3.5 text-slate-500" />
        <p className="font-bold text-slate-700 uppercase tracking-wider">School details</p>
      </div>
      <p className="text-[11px] text-slate-500">
        Surveys can be meant for a department, program, year or section, so only the administrator can change these.
      </p>

      <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2">
        {keys.map((k) => (
          <div key={k} className="min-w-0">
            <dt className="text-[10px] font-bold uppercase tracking-wide text-slate-500">{SCHOOL_FIELD_LABELS[k]}</dt>
            <dd className="text-sm font-semibold text-slate-900 truncate">{current[k] || <span className="text-slate-400">Not set</span>}</dd>
          </div>
        ))}
      </dl>

      {waiting && request && (
        <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 space-y-1.5">
          <p className="flex items-center gap-1.5 font-bold text-amber-900">
            <Clock className="w-3.5 h-3.5" /> Change request waiting for the administrator
          </p>
          <p className="text-amber-900">{describeChanges(request.current, request.requested)}</p>
          <p className="text-[11px] text-amber-800">Sent {formatDateTime(request.requestedAt)}</p>
          <button
            type="button"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              await onCancel();
              setBusy(false);
            }}
            className="text-[11px] font-bold text-amber-900 underline cursor-pointer disabled:opacity-50"
          >
            Cancel this request
          </button>
        </div>
      )}

      {showDecision && request && request.status !== "pending" && (
        <div
          className={`p-3 rounded-xl border space-y-1 ${
            request.status === "approved" ? "bg-emerald-50 border-emerald-200 text-emerald-900" : "bg-rose-50 border-rose-200 text-rose-900"
          }`}
        >
          <p className="font-bold">
            Your last request was {request.status === "approved" ? "approved" : "not approved"}
            {request.decidedAt ? ` (${formatDateTime(request.decidedAt)})` : ""}.
          </p>
          <p>{describeChanges(request.current, request.requested)}</p>
          {request.decisionNote && <p>Administrator's note: {request.decisionNote}</p>}
        </div>
      )}

      {!waiting && !formOpen && (
        <button
          type="button"
          onClick={() => setFormOpen(true)}
          className="px-3 py-1.5 rounded-lg bg-white border border-slate-300 hover:bg-slate-100 text-slate-800 font-bold cursor-pointer"
        >
          Request a change
        </button>
      )}

      {!waiting && formOpen && (
        <div className="space-y-3 p-3 rounded-xl bg-white border border-indigo-200">
          <div className="flex items-center justify-between">
            <p className="font-bold text-slate-800">Request a change</p>
            <button type="button" onClick={() => setFormOpen(false)} className="p-1 text-slate-400 hover:text-slate-600" aria-label="Close">
              <X className="w-4 h-4" />
            </button>
          </div>
          <p className="text-[11px] text-slate-500">Change only what is wrong. The administrator will review it.</p>
          <SchoolFieldsPicker lists={lists} isStudent={isStudent} value={school} onChange={setSchool} />
          {isStudent && (
            <div>
              <label className="block font-bold text-slate-700 mb-1">Student ID</label>
              <input
                type="text"
                value={studentId}
                onChange={(e) => setStudentId(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-semibold"
              />
            </div>
          )}
          <div>
            <label className="block font-bold text-slate-700 mb-1">Reason</label>
            <textarea
              value={reason}
              maxLength={MAX_REASON}
              rows={3}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. I shifted from BSCS to BSIT this semester."
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl"
            />
            <p className="text-[10px] text-slate-400 text-right">
              {reason.trim().length} / {MAX_REASON}
            </p>
          </div>
          {error && <div className="p-2.5 bg-rose-50 rounded-xl border border-rose-200 font-semibold text-rose-700">{error}</div>}
          <div className="flex justify-end">
            <button
              type="button"
              disabled={busy}
              onClick={submit}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold cursor-pointer disabled:opacity-50"
            >
              <Send className="w-3.5 h-3.5" /> Send request
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

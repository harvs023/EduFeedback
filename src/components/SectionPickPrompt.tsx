import { useState } from "react";
import { GraduationCap, Loader2 } from "lucide-react";
import type { SchoolLists, UserProfile } from "../types";
import { findDepartment, findProgram, sectionChoices } from "../lib/schoolLists";
import { yearNumber } from "../lib/schoolYearMove";

/**
 * One-time section pick after the admin's "New school year" move (plan step 10c-1b). The student
 * may set only their section, once (firestore.rules allows exactly this while sectionPickNeeded).
 */
export function SectionPickPrompt({
  user,
  lists,
  onSave,
  onLater,
}: {
  user: UserProfile;
  lists: SchoolLists | null;
  onSave: (section: string) => Promise<boolean>;
  onLater: () => void;
}) {
  const program = findProgram(findDepartment(lists, user.department || ""), user.program || "");
  const year = yearNumber(user.year);
  const choices = program && year ? sectionChoices(program, year) : [];
  const [section, setSection] = useState("");
  const [busy, setBusy] = useState(false);

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-4" onClick={onLater}>
      <div
        className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4 text-sm"
        role="dialog"
        aria-label="Choose your new section"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2">
          <GraduationCap className="w-6 h-6 text-indigo-600" />
          <h2 className="text-lg font-bold text-slate-900">Welcome to the new school year</h2>
        </div>
        <p className="text-slate-700">
          You are now in <strong>{user.year}</strong> of <strong>{user.program}</strong>. Please choose your new section. You
          can do this only once; after that, changes go through a request to the administrator.
        </p>

        {choices.length === 0 ? (
          <p className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900">
            No sections are set up for your year yet. Please try again later or contact the administrator.
          </p>
        ) : (
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Section</label>
            <select
              value={section}
              onChange={(e) => setSection(e.target.value)}
              className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-900"
            >
              <option value="">Choose your section</option>
              {choices.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
        )}

        <p className="text-[11px] text-slate-500">
          Wrong year or program? Choose "Later" and send a change request from My Profile.
        </p>

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onLater}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs cursor-pointer"
          >
            Later
          </button>
          <button
            type="button"
            disabled={!section || busy}
            onClick={async () => {
              setBusy(true);
              await onSave(section);
              setBusy(false);
            }}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs cursor-pointer disabled:opacity-50"
          >
            {busy && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            Save my section
          </button>
        </div>
      </div>
    </div>
  );
}

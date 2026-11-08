import React, { useMemo, useState } from "react";
import { CalendarDays, Pencil, Trash2, Save, X, Info } from "lucide-react";
import { AcademicYearTerms } from "../types";
import { useConfirm } from "./ConfirmDialog";
import {
  endOfDay,
  formatSchoolYear,
  startOfDay,
  termFor,
  toDateInput,
  validateAcademicYear,
} from "../lib/schoolYear";

interface AcademicCalendarManagerProps {
  calendar: AcademicYearTerms[];
  adminEmail: string;
  onSave: (terms: AcademicYearTerms) => Promise<void>;
  onDelete: (schoolYear: string) => Promise<void>;
}

interface FormState {
  schoolYear: string;
  sem1Start: string;
  sem1End: string;
  sem2Start: string;
  sem2End: string;
}

const formatDay = (timestamp: number) =>
  new Date(timestamp).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

/** The school year after the latest one entered, or the current one if none. */
function suggestedSchoolYear(calendar: AcademicYearTerms[]): string {
  const latest = [...calendar].sort((a, b) => b.sem1Start - a.sem1Start)[0];
  const start = latest ? Number(latest.schoolYear.slice(0, 4)) + 1 : Number(termFor(Date.now()).schoolYear.slice(0, 4));
  return `${start}-${start + 1}`;
}

const emptyForm = (calendar: AcademicYearTerms[]): FormState => ({
  schoolYear: suggestedSchoolYear(calendar),
  sem1Start: "",
  sem1End: "",
  sem2Start: "",
  sem2End: "",
});

export const AcademicCalendarManager: React.FC<AcademicCalendarManagerProps> = ({
  calendar,
  adminEmail,
  onSave,
  onDelete,
}) => {
  const { confirm, confirmDialog } = useConfirm();
  const [form, setForm] = useState<FormState>(() => emptyForm(calendar));
  const [editing, setEditing] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const sorted = useMemo(() => [...calendar].sort((a, b) => b.sem1Start - a.sem1Start), [calendar]);
  const today = termFor(Date.now(), calendar);

  const setField = (key: keyof FormState, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setError(null);
    setMessage(null);
  };

  const startEdit = (y: AcademicYearTerms) => {
    setEditing(y.schoolYear);
    setForm({
      schoolYear: y.schoolYear,
      sem1Start: toDateInput(y.sem1Start),
      sem1End: toDateInput(y.sem1End),
      sem2Start: toDateInput(y.sem2Start),
      sem2End: toDateInput(y.sem2End),
    });
    setError(null);
    setMessage(null);
  };

  const cancelEdit = () => {
    setEditing(null);
    setForm(emptyForm(calendar));
    setError(null);
  };

  const handleSave = async () => {
    const schoolYear = form.schoolYear.trim();
    const sem1Start = startOfDay(form.sem1Start);
    const sem1End = endOfDay(form.sem1End);
    const sem2Start = startOfDay(form.sem2Start);
    const sem2End = endOfDay(form.sem2End);
    if (sem1Start === null || sem1End === null || sem2Start === null || sem2End === null) {
      setError("Please fill in all four dates.");
      return;
    }
    if (!editing && calendar.some((y) => y.schoolYear === schoolYear)) {
      setError(`SY ${schoolYear} is already in the calendar. Use its edit button to change it.`);
      return;
    }
    const entry = { schoolYear, sem1Start, sem1End, sem2Start, sem2End };
    const problem = validateAcademicYear(entry, calendar);
    if (problem) {
      setError(problem);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await onSave({ ...entry, updatedAt: Date.now(), updatedBy: adminEmail.trim().toLowerCase() });
      setMessage(`Saved ${formatSchoolYear(schoolYear)}.`);
      setEditing(null);
      setForm(emptyForm([...calendar.filter((y) => y.schoolYear !== schoolYear), { ...entry, updatedAt: 0, updatedBy: "" }]));
    } catch (err: any) {
      setError(err?.message || "Could not save. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async (y: AcademicYearTerms) => {
    const ok = await confirm({
      title: `Delete ${formatSchoolYear(y.schoolYear)}?`,
      message:
        "Responses from this school year will no longer show a semester until you enter its dates again. No responses are deleted.",
      confirmLabel: "Delete",
      danger: true,
    });
    if (!ok) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      await onDelete(y.schoolYear);
      if (editing === y.schoolYear) cancelEdit();
    } catch (err: any) {
      setError(err?.message || "Could not delete. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const dateInput = (key: keyof FormState, label: string) => (
    <label className="block space-y-1">
      <span className="text-[11px] font-semibold text-slate-600">{label}</span>
      <input
        type="date"
        value={form[key]}
        onChange={(e) => setField(key, e.target.value)}
        className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-200"
      />
    </label>
  );

  return (
    <div className="bg-white p-6 sm:p-8 rounded-3xl border border-slate-200 shadow-xs space-y-6">
      {confirmDialog}
      <div className="border-b border-slate-100 pb-4">
        <h2 className="font-serif text-xl font-bold text-slate-900">Academic Calendar ({calendar.length})</h2>
        <p className="text-xs text-slate-500">
          Enter the 1st and 2nd Sem dates for each school year. Each response's school year and semester are
          worked out from the day it was submitted, so fixing a date here fixes every chart.
        </p>
      </div>

      {/* Today */}
      <div className="flex items-start gap-3 px-4 py-3 rounded-2xl bg-indigo-50 border border-indigo-100 text-sm">
        <CalendarDays className="w-5 h-5 text-indigo-600 shrink-0 mt-0.5" />
        <div>
          <p className="font-semibold text-indigo-900">
            Today: {today.term ? `${today.term}, ${formatSchoolYear(today.schoolYear)}` : "not covered by the calendar"}
          </p>
          {!today.term && (
            <p className="text-xs text-indigo-800">
              Add the current school year below. Until then the school year is estimated ({formatSchoolYear(today.schoolYear)},
              assuming it starts in August) and semesters are unknown.
            </p>
          )}
        </div>
      </div>

      {/* Form */}
      <div className="space-y-3 border border-slate-100 rounded-2xl p-4">
        <div className="flex flex-wrap items-end gap-3">
          <label className="block space-y-1">
            <span className="text-[11px] font-semibold text-slate-600">School year</span>
            <input
              type="text"
              value={form.schoolYear}
              disabled={!!editing}
              maxLength={9}
              onChange={(e) => setField("schoolYear", e.target.value)}
              placeholder="2026-2027"
              className="w-36 px-3 py-2 rounded-xl border border-slate-200 text-sm text-slate-800 disabled:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-200"
            />
          </label>
          {editing && <span className="text-xs text-slate-500 pb-2.5">Editing {formatSchoolYear(editing)}</span>}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="grid grid-cols-2 gap-2 p-3 rounded-xl bg-slate-50">
            <p className="col-span-2 text-xs font-bold text-slate-700">1st Sem</p>
            {dateInput("sem1Start", "First day")}
            {dateInput("sem1End", "Last day")}
          </div>
          <div className="grid grid-cols-2 gap-2 p-3 rounded-xl bg-slate-50">
            <p className="col-span-2 text-xs font-bold text-slate-700">2nd Sem</p>
            {dateInput("sem2Start", "First day")}
            {dateInput("sem2End", "Last day")}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={handleSave}
            disabled={busy}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50 cursor-pointer"
          >
            <Save className="w-4 h-4" />
            {editing ? "Save changes" : "Add school year"}
          </button>
          {editing && (
            <button
              type="button"
              onClick={cancelEdit}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-slate-100 text-slate-700 text-sm font-semibold hover:bg-slate-200 cursor-pointer"
            >
              <X className="w-4 h-4" />
              Cancel
            </button>
          )}
        </div>
        {error && (
          <div className="px-4 py-2.5 rounded-xl bg-rose-50 border border-rose-100 text-xs text-rose-700 font-medium">
            {error}
          </div>
        )}
        {message && (
          <div className="px-4 py-2.5 rounded-xl bg-emerald-50 border border-emerald-100 text-xs text-emerald-700 font-medium">
            {message}
          </div>
        )}
        <p className="flex items-start gap-1.5 text-[11px] text-slate-500">
          <Info className="w-3.5 h-3.5 shrink-0 mt-px" />
          Days between semesters count as "Between terms". The break after the 2nd Sem belongs to that school year
          until the next school year's 1st Sem starts.
        </p>
      </div>

      {/* List */}
      {sorted.length === 0 ? (
        <div className="py-8 text-center text-sm text-slate-500">
          <CalendarDays className="w-8 h-8 mx-auto mb-2 text-slate-300" />
          No school years yet. Add the current one above.
        </div>
      ) : (
        <ul className="divide-y divide-slate-100 border border-slate-100 rounded-2xl overflow-hidden">
          {sorted.map((y) => {
            const isCurrent = today.source === "calendar" && today.schoolYear === y.schoolYear;
            return (
              <li key={y.schoolYear} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0 space-y-0.5">
                  <p className="text-sm font-bold text-slate-800 flex items-center gap-2">
                    {formatSchoolYear(y.schoolYear)}
                    {isCurrent && (
                      <span className="text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100">
                        Current
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-slate-600">
                    1st Sem: {formatDay(y.sem1Start)} – {formatDay(y.sem1End)}
                  </p>
                  <p className="text-xs text-slate-600">
                    2nd Sem: {formatDay(y.sem2Start)} – {formatDay(y.sem2End)}
                  </p>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => startEdit(y)}
                    disabled={busy}
                    title="Edit dates"
                    className="p-2 rounded-lg text-slate-600 hover:bg-slate-100 disabled:opacity-50 cursor-pointer"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(y)}
                    disabled={busy}
                    title="Delete school year"
                    className="p-2 rounded-lg text-rose-600 hover:bg-rose-50 disabled:opacity-50 cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};

export default AcademicCalendarManager;

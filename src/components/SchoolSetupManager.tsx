import React, { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Archive, ChevronDown, ChevronRight, Loader2, Plus, RotateCcw, Save, School, Trash2, Undo2 } from "lucide-react";
import type { SchoolDepartment, SchoolLists, SchoolProgram, Survey, SurveyCategory, UserProfile } from "../types";
import { DEPARTMENTS_DATA } from "../data/initialData";
import {
  MAX_YEAR_LEVELS,
  allCategories,
  allSectionLabels,
  listsFromBuiltIn,
  newId,
  schoolUsage,
  validateSchoolLists,
  yearLabel,
} from "../lib/schoolLists";
import { useConfirm } from "./ConfirmDialog";

interface SchoolSetupManagerProps {
  lists: SchoolLists | null;
  users: UserProfile[];
  surveys: Survey[];
  onSave: (lists: SchoolLists) => Promise<void>;
}

/** A working copy; categories start from the built-in ones if the list was never saved. */
const clone = (l: SchoolLists | null): SchoolLists =>
  JSON.parse(JSON.stringify({ departments: l?.departments || [], categories: allCategories(l) }));

/** "a, b c" -> ["A", "B", "C"] */
function parseLetters(text: string): string[] {
  return text
    .split(/[\s,]+/)
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean);
}

export const SchoolSetupManager: React.FC<SchoolSetupManagerProps> = ({ lists, users, surveys, onSave }) => {
  const { confirm, confirmDialog } = useConfirm();
  const saved = useMemo<SchoolLists>(() => clone(lists), [lists]);
  const [draft, setDraft] = useState<SchoolLists>(saved);
  const [rawSections, setRawSections] = useState<Record<string, string>>({});
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setDraft(saved);
    setRawSections({});
  }, [saved]);

  const usage = useMemo(() => schoolUsage(users), [users]);
  const dirty = JSON.stringify(draft) !== JSON.stringify(saved);
  const errors = useMemo(
    () => (dirty ? validateSchoolLists(draft, lists, users, surveys) : []),
    [dirty, draft, lists, users, surveys]
  );

  const categoryUse = useMemo(() => {
    const m = new Map<string, number>();
    surveys.forEach((sv) => sv.cat && m.set(sv.cat, (m.get(sv.cat) || 0) + 1));
    return m;
  }, [surveys]);
  const updateCat = (id: string, patch: Partial<SurveyCategory>) =>
    setDraft((d) => ({ ...d, categories: (d.categories || []).map((c) => (c.id === id ? { ...c, ...patch } : c)) }));

  const updateDept = (id: string, patch: Partial<SchoolDepartment>) =>
    setDraft((d) => ({ ...d, departments: d.departments.map((x) => (x.id === id ? { ...x, ...patch } : x)) }));

  const updateProg = (deptId: string, progId: string, patch: Partial<SchoolProgram>) =>
    setDraft((d) => ({
      departments: d.departments.map((x) =>
        x.id === deptId ? { ...x, programs: x.programs.map((p) => (p.id === progId ? { ...p, ...patch } : p)) } : x
      ),
    }));

  const addDepartment = () => {
    const id = newId("dept");
    setDraft((d) => ({ ...d, departments: [...d.departments, { id, name: "", programs: [] }] }));
    setOpen((o) => ({ ...o, [id]: true }));
  };

  const addProgram = (deptId: string) =>
    setDraft((d) => ({
      departments: d.departments.map((x) =>
        x.id === deptId
          ? { ...x, programs: [...x.programs, { id: newId("prog"), name: "", code: "", yearLevels: 4, sections: {} }] }
          : x
      ),
    }));

  const deptUseCount = (d: SchoolDepartment) => usage.departments.get(d.name) || 0;
  const progUseCount = (p: SchoolProgram) =>
    (usage.programs.get(p.name) || 0) + allSectionLabels(p).reduce((n, s) => n + (usage.sections.get(s) || 0), 0);

  const removeDept = async (d: SchoolDepartment) => {
    const ok = await confirm({
      title: "Remove this department?",
      message: `"${d.name || "New department"}" and its ${d.programs.length} program(s) will be removed when you save.`,
      confirmLabel: "Remove",
      danger: true,
    });
    if (ok) setDraft((x) => ({ ...x, departments: x.departments.filter((y) => y.id !== d.id) }));
  };

  const removeProg = async (deptId: string, p: SchoolProgram) => {
    const ok = await confirm({
      title: "Remove this program?",
      message: `"${p.name || "New program"}" and its sections will be removed when you save.`,
      confirmLabel: "Remove",
      danger: true,
    });
    if (ok) {
      setDraft((x) => ({
        departments: x.departments.map((y) => (y.id === deptId ? { ...y, programs: y.programs.filter((q) => q.id !== p.id) } : y)),
      }));
    }
  };

  const startFromBuiltIn = async () => {
    const ok = await confirm({
      title: "Start from the built-in list?",
      message:
        "This fills in the colleges and programs that were written in the app. Program codes are guessed (check them), and sections start empty. Nothing is saved until you click Save changes.",
      confirmLabel: "Fill in the list",
    });
    if (ok) {
      const built = listsFromBuiltIn(DEPARTMENTS_DATA);
      setDraft((d) => ({ ...d, departments: built.departments }));
      setOpen(Object.fromEntries(built.departments.map((d) => [d.id, true])));
    }
  };

  const discard = async () => {
    const ok = await confirm({ title: "Discard your changes?", message: "The list goes back to the last saved version.", confirmLabel: "Discard" });
    if (ok) {
      setDraft(saved);
      setRawSections({});
    }
  };

  const handleSave = async () => {
    if (errors.length) return;
    setSaving(true);
    try {
      const cleaned: SchoolLists = {
        categories: (draft.categories || []).map((c) => ({ ...c, name: c.name.trim() })),
        departments: draft.departments.map((d) => ({
          ...d,
          name: d.name.trim(),
          programs: d.programs.map((p) => {
            const sections: Record<string, string[]> = {};
            for (let y = 1; y <= p.yearLevels; y++) {
              const letters = p.sections[String(y)] || [];
              if (letters.length) sections[String(y)] = letters;
            }
            return { ...p, name: p.name.trim(), code: p.code.trim().toUpperCase(), sections };
          }),
        })),
      };
      await onSave(cleaned);
    } finally {
      setSaving(false);
    }
  };

  const inputCls = "w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:outline-hidden focus:border-indigo-400";

  return (
    <div className="space-y-6">
      {confirmDialog}
      <div className="bg-white p-6 sm:p-8 rounded-3xl border border-slate-200 shadow-xs space-y-3">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-50 text-indigo-700 text-xs font-bold uppercase tracking-wider border border-indigo-200">
          <School className="w-3.5 h-3.5" />
          <span>School Setup</span>
        </div>
        <h1 className="font-serif text-2xl font-extrabold text-slate-900">Departments, programs, sections and categories</h1>
        <p className="text-xs sm:text-sm text-slate-500 max-w-3xl">
          These lists are what people choose from when they sign up and edit their profile. Each program has a short code;
          sections are letters per year level, so code <strong>CS</strong> with 1st Year sections <strong>A, B</strong> gives{" "}
          <strong>CS-1A</strong> and <strong>CS-1B</strong>. Anyone can read this list (the sign-up page needs it before
          login); it holds no personal data. Items that accounts already use cannot be renamed or deleted: retire them
          instead, and they stop being offered.
        </p>
      </div>

      {draft.departments.length === 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-3xl p-6 space-y-3 text-xs text-amber-900">
          <div className="font-bold flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" /> The list is empty, so sign-up is closed.
          </div>
          <p>New people see "Registration is not open yet" until at least one department is saved.</p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={startFromBuiltIn}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl cursor-pointer"
            >
              Start from the built-in list
            </button>
            <button
              type="button"
              onClick={addDepartment}
              className="px-4 py-2 bg-white border border-amber-300 hover:bg-amber-100 text-amber-900 font-bold rounded-xl cursor-pointer"
            >
              Add a department by hand
            </button>
          </div>
        </div>
      )}

      {draft.departments.map((d) => {
        const isOpen = open[d.id] ?? false;
        const dCount = deptUseCount(d);
        return (
          <div key={d.id} className={`bg-white rounded-3xl border shadow-xs ${d.retired ? "border-slate-200 opacity-70" : "border-slate-200"}`}>
            <div className="p-4 sm:p-5 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => setOpen((o) => ({ ...o, [d.id]: !isOpen }))}
                className="p-1 rounded-lg hover:bg-slate-100 cursor-pointer"
                aria-label={isOpen ? "Collapse" : "Expand"}
              >
                {isOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
              </button>
              <input
                value={d.name}
                onChange={(e) => updateDept(d.id, { name: e.target.value })}
                placeholder="Department name, e.g. College of Computer Studies"
                className={`${inputCls} flex-1 min-w-[200px]`}
              />
              <span className="text-[11px] text-slate-500">
                {d.programs.length} program(s) · used by {dCount} account(s)
                {d.retired && <span className="ml-1 font-bold text-slate-700">· Retired</span>}
              </span>
              <button
                type="button"
                onClick={() => updateDept(d.id, { retired: !d.retired })}
                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-[11px] rounded-lg flex items-center gap-1 cursor-pointer"
              >
                {d.retired ? <RotateCcw className="w-3.5 h-3.5" /> : <Archive className="w-3.5 h-3.5" />}
                {d.retired ? "Restore" : "Retire"}
              </button>
              <button
                type="button"
                onClick={() => removeDept(d)}
                disabled={dCount > 0 || d.programs.some((p) => progUseCount(p) > 0)}
                title={dCount > 0 ? "In use: retire it instead" : "Remove"}
                className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>

            {isOpen && (
              <div className="px-4 sm:px-5 pb-5 space-y-3 border-t border-slate-100 pt-4">
                {d.programs.length === 0 && <p className="text-xs text-slate-500">No programs yet.</p>}
                {d.programs.map((p) => {
                  const pCount = progUseCount(p);
                  return (
                    <div key={p.id} className={`p-4 rounded-2xl border bg-slate-50 space-y-3 ${p.retired ? "opacity-70" : ""} border-slate-200`}>
                      <div className="grid grid-cols-1 md:grid-cols-[1fr_110px_130px_auto] gap-2 items-end">
                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Program name</label>
                          <input
                            value={p.name}
                            onChange={(e) => updateProg(d.id, p.id, { name: e.target.value })}
                            placeholder="e.g. Bachelor of Science in Computer Science"
                            className={inputCls}
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Code</label>
                          <input
                            value={p.code}
                            onChange={(e) => updateProg(d.id, p.id, { code: e.target.value.toUpperCase().replace(/\s/g, "") })}
                            placeholder="e.g. CS"
                            className={`${inputCls} font-mono`}
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Year levels</label>
                          <select
                            value={p.yearLevels}
                            onChange={(e) => updateProg(d.id, p.id, { yearLevels: Number(e.target.value) })}
                            className={inputCls}
                          >
                            {Array.from({ length: MAX_YEAR_LEVELS }, (_, i) => i + 1).map((n) => (
                              <option key={n} value={n}>
                                {n} year{n > 1 ? "s" : ""}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => updateProg(d.id, p.id, { retired: !p.retired })}
                            className="px-3 py-2 bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 font-bold text-[11px] rounded-lg flex items-center gap-1 cursor-pointer"
                          >
                            {p.retired ? <RotateCcw className="w-3.5 h-3.5" /> : <Archive className="w-3.5 h-3.5" />}
                            {p.retired ? "Restore" : "Retire"}
                          </button>
                          <button
                            type="button"
                            onClick={() => removeProg(d.id, p)}
                            disabled={pCount > 0}
                            title={pCount > 0 ? "In use: retire it instead" : "Remove"}
                            className="p-2 text-rose-600 hover:bg-rose-50 rounded-lg cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <div className="text-[10px] font-bold text-slate-500 uppercase">
                          Sections per year (letters, separated by commas){p.retired ? " · Retired" : ""} · used by {pCount}{" "}
                          account(s)
                        </div>
                        {Array.from({ length: p.yearLevels }, (_, i) => i + 1).map((y) => {
                          const key = `${p.id}:${y}`;
                          const letters = p.sections[String(y)] || [];
                          return (
                            <div key={y} className="grid grid-cols-[80px_1fr] sm:grid-cols-[80px_200px_1fr] gap-2 items-center">
                              <span className="text-xs font-semibold text-slate-700">{yearLabel(y)}</span>
                              <input
                                value={rawSections[key] ?? letters.join(", ")}
                                onChange={(e) => {
                                  setRawSections((r) => ({ ...r, [key]: e.target.value }));
                                  updateProg(d.id, p.id, { sections: { ...p.sections, [String(y)]: parseLetters(e.target.value) } });
                                }}
                                placeholder="e.g. A, B, C"
                                className={`${inputCls} font-mono`}
                              />
                              <span className="text-[11px] text-slate-500 truncate">
                                {letters.length
                                  ? letters.map((l) => `${p.code || "?"}-${y}${l}`).join(", ")
                                  : "No sections"}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
                <button
                  type="button"
                  onClick={() => addProgram(d.id)}
                  className="px-3 py-2 bg-white border border-dashed border-slate-300 hover:bg-slate-50 text-slate-700 font-bold text-xs rounded-xl flex items-center gap-1.5 cursor-pointer"
                >
                  <Plus className="w-4 h-4" /> Add program
                </button>
              </div>
            )}
          </div>
        );
      })}

      {draft.departments.length > 0 && (
        <button
          type="button"
          onClick={addDepartment}
          className="px-4 py-2.5 bg-white border border-dashed border-slate-300 hover:bg-slate-50 text-slate-700 font-bold text-xs rounded-xl flex items-center gap-1.5 cursor-pointer"
        >
          <Plus className="w-4 h-4" /> Add department
        </button>
      )}

      <div className="bg-white p-5 sm:p-6 rounded-3xl border border-slate-200 shadow-xs space-y-3">
        <div>
          <h2 className="font-serif text-lg font-bold text-slate-900">Survey categories</h2>
          <p className="text-xs text-slate-500">
            Creators pick one when they build a survey, and Take a Survey groups surveys by them. Categories that surveys
            already use cannot be renamed or removed: retire them instead.
          </p>
        </div>
        {(draft.categories || []).map((c) => {
          const used = categoryUse.get(c.name) || 0;
          return (
            <div key={c.id} className={`flex flex-wrap items-center gap-2 ${c.retired ? "opacity-70" : ""}`}>
              <input
                value={c.name}
                onChange={(e) => updateCat(c.id, { name: e.target.value })}
                placeholder="Category name, e.g. Facilities"
                className={`${inputCls} flex-1 min-w-[180px]`}
              />
              <span className="text-[11px] text-slate-500">
                used by {used} survey(s){c.retired ? " · Retired" : ""}
              </span>
              <button
                type="button"
                onClick={() => updateCat(c.id, { retired: !c.retired })}
                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-[11px] rounded-lg flex items-center gap-1 cursor-pointer"
              >
                {c.retired ? <RotateCcw className="w-3.5 h-3.5" /> : <Archive className="w-3.5 h-3.5" />}
                {c.retired ? "Restore" : "Retire"}
              </button>
              <button
                type="button"
                onClick={() => setDraft((d) => ({ ...d, categories: (d.categories || []).filter((x) => x.id !== c.id) }))}
                disabled={used > 0}
                title={used > 0 ? "In use: retire it instead" : "Remove"}
                className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          );
        })}
        <button
          type="button"
          onClick={() => setDraft((d) => ({ ...d, categories: [...(d.categories || []), { id: newId("cat"), name: "" }] }))}
          className="px-3 py-2 bg-white border border-dashed border-slate-300 hover:bg-slate-50 text-slate-700 font-bold text-xs rounded-xl flex items-center gap-1.5 cursor-pointer"
        >
          <Plus className="w-4 h-4" /> Add category
        </button>
      </div>

      {dirty && (
        <div className="sticky bottom-4 bg-white border border-slate-200 shadow-lg rounded-2xl p-4 space-y-3">
          {errors.length > 0 && (
            <ul className="text-xs text-rose-700 list-disc pl-5 space-y-0.5">
              {errors.map((e) => (
                <li key={e}>{e}</li>
              ))}
            </ul>
          )}
          <div className="flex flex-wrap items-center gap-2 justify-end">
            <span className="text-xs text-slate-500 mr-auto">You have unsaved changes.</span>
            <button
              type="button"
              onClick={discard}
              disabled={saving}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl flex items-center gap-1.5 cursor-pointer"
            >
              <Undo2 className="w-4 h-4" /> Discard
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving || errors.length > 0}
              className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Save changes
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

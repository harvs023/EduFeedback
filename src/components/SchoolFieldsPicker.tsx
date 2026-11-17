import React from "react";
import type { SchoolLists } from "../types";
import {
  activeDepartments,
  activePrograms,
  findDepartment,
  findProgram,
  sectionChoices,
  yearLabel,
  yearsWithSections,
  type SchoolFields,
} from "../lib/schoolLists";

interface SchoolFieldsPickerProps {
  lists: SchoolLists | null;
  /** Students and student officers choose program, year and section; others only a department. */
  isStudent: boolean;
  value: SchoolFields;
  onChange: (value: SchoolFields) => void;
  variant?: "dark" | "light";
  disabled?: boolean;
}

/**
 * Department -> Program -> Year -> Section choices from the admin's School Setup lists.
 * A value that is no longer offered (retired, or from before the lists) stays selectable for
 * that person and is marked, so editing a profile never changes it by accident.
 */
export const SchoolFieldsPicker: React.FC<SchoolFieldsPickerProps> = ({
  lists,
  isStudent,
  value,
  onChange,
  variant = "light",
  disabled,
}) => {
  const dark = variant === "dark";
  const labelCls = dark
    ? "block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1"
    : "block font-bold text-slate-700 mb-1";
  const selectCls = dark
    ? "w-full px-3 py-2.5 bg-slate-950/70 border border-slate-700/80 rounded-xl text-xs text-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
    : "w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-900 focus:bg-white focus:outline-hidden disabled:opacity-50";
  const optCls = dark ? "bg-slate-900 text-white" : undefined;
  const noteCls = dark ? "text-[11px] text-amber-300 mt-1" : "text-[11px] text-amber-700 mt-1";

  const dept = findDepartment(lists, value.department);
  const program = findProgram(dept, value.program);
  const years = yearsWithSections(program);
  const yearNum = years.find((y) => yearLabel(y) === value.year);
  const sections = yearNum ? sectionChoices(program, yearNum) : [];

  const deptOptions = activeDepartments(lists).map((d) => d.name);
  const progOptions = activePrograms(dept).map((p) => p.name);
  const yearOptions = years.map(yearLabel);

  const withCurrent = (options: string[], current: string) =>
    current && !options.includes(current) ? [...options, current] : options;
  const mark = (options: string[], name: string) => (options.includes(name) ? name : `${name} (no longer offered)`);

  const set = (patch: Partial<SchoolFields>) => onChange({ ...value, ...patch });

  return (
    <div className="space-y-3">
      <div>
        <label className={labelCls}>College / Department</label>
        <select
          value={value.department}
          disabled={disabled}
          onChange={(e) => set({ department: e.target.value, program: "", year: "", section: "" })}
          className={selectCls}
        >
          <option value="" className={optCls}>
            Choose your college / department
          </option>
          {withCurrent(deptOptions, value.department).map((d) => (
            <option key={d} value={d} className={optCls}>
              {mark(deptOptions, d)}
            </option>
          ))}
        </select>
      </div>

      {isStudent && (
        <>
          <div>
            <label className={labelCls}>Program</label>
            <select
              value={value.program}
              disabled={disabled || !value.department}
              onChange={(e) => set({ program: e.target.value, year: "", section: "" })}
              className={selectCls}
            >
              <option value="" className={optCls}>
                {value.department ? "Choose your program" : "Choose a department first"}
              </option>
              {withCurrent(progOptions, value.program).map((p) => (
                <option key={p} value={p} className={optCls}>
                  {mark(progOptions, p)}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className={labelCls}>Year Level</label>
              <select
                value={value.year}
                disabled={disabled || !value.program}
                onChange={(e) => set({ year: e.target.value, section: "" })}
                className={selectCls}
              >
                <option value="" className={optCls}>
                  Choose
                </option>
                {withCurrent(yearOptions, value.year).map((y) => (
                  <option key={y} value={y} className={optCls}>
                    {mark(yearOptions, y)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls}>Section</label>
              <select
                value={value.section}
                disabled={disabled || !value.year}
                onChange={(e) => set({ section: e.target.value })}
                className={selectCls}
              >
                <option value="" className={optCls}>
                  Choose
                </option>
                {withCurrent(sections, value.section).map((s) => (
                  <option key={s} value={s} className={optCls}>
                    {mark(sections, s)}
                  </option>
                ))}
              </select>
            </div>
          </div>
          {value.program && program && years.length === 0 && (
            <p className={noteCls}>No sections are set up for this program yet. Please contact the administrator.</p>
          )}
        </>
      )}
    </div>
  );
};

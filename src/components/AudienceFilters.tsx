import type { SchoolLists, SchoolProgram, TargetAudience } from "../types";
import { activeDepartments, activePrograms, findDepartment, sectionChoices, yearLabel } from "../lib/schoolLists";
import type { AudienceLists } from "../lib/audience";

/** Programs a department list allows (all active programs when no department is chosen). */
function candidatePrograms(lists: SchoolLists | null, departments: string[]): SchoolProgram[] {
  const depts = departments.length
    ? departments.map((d) => findDepartment(lists, d)).filter((d): d is NonNullable<typeof d> => !!d)
    : activeDepartments(lists);
  return depts.flatMap((d) => activePrograms(d));
}

/** Removes choices that no longer fit after a change higher up (department -> program -> year -> section). */
export function pruneAudience(lists: SchoolLists | null, v: AudienceLists): AudienceLists {
  const departments = v.departments || [];
  const programNames = new Set(candidatePrograms(lists, departments).map((p) => p.name));
  const programs = (v.programs || []).filter((p) => programNames.has(p));
  const sectionNames = new Set(sectionOptions(lists, departments, programs, v.years || []));
  const sections = programs.length ? (v.sections || []).filter((s) => sectionNames.has(s)) : [];
  return { departments, programs, years: v.years || [], sections };
}

function sectionOptions(lists: SchoolLists | null, departments: string[], programs: string[], years: string[]): string[] {
  const chosen = candidatePrograms(lists, departments).filter((p) => programs.includes(p.name));
  const out: string[] = [];
  for (const p of chosen) {
    for (let y = 1; y <= p.yearLevels; y++) {
      if (years.length && !years.includes(yearLabel(y))) continue;
      out.push(...sectionChoices(p, y));
    }
  }
  return out;
}

/** The lists to save on the survey: only non-empty ones, and only what fits the audience type. */
export function audienceListsToSave(type: TargetAudience["type"], v: AudienceLists): AudienceLists {
  const out: AudienceLists = {};
  if (v.departments?.length) out.departments = v.departments;
  if (type === "students" || type === "officers") {
    if (v.programs?.length) out.programs = v.programs;
    if (v.years?.length) out.years = v.years;
    if (v.programs?.length && v.sections?.length) out.sections = v.sections;
  }
  return out;
}

function Chips({
  label,
  hint,
  options,
  selected,
  onToggle,
}: {
  label: string;
  hint?: string;
  options: string[];
  selected: string[];
  onToggle: (value: string) => void;
}) {
  // Values chosen earlier but no longer offered stay visible so they can be removed.
  const all = [...options, ...selected.filter((s) => !options.includes(s))];
  return (
    <div>
      <p className="text-xs font-bold text-slate-700">
        {label} <span className="font-normal text-slate-500">{hint || "(none chosen = no limit)"}</span>
      </p>
      {all.length === 0 ? (
        <p className="text-[11px] text-slate-400 mt-1">Nothing to choose here yet.</p>
      ) : (
        <div className="flex flex-wrap gap-1.5 mt-1.5">
          {all.map((o) => {
            const on = selected.includes(o);
            const gone = !options.includes(o);
            return (
              <button
                key={o}
                type="button"
                onClick={() => onToggle(o)}
                aria-pressed={on}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold border cursor-pointer ${
                  on ? "bg-indigo-600 border-indigo-600 text-white" : "bg-white border-slate-300 text-slate-700 hover:border-slate-400"
                }`}
              >
                {o}
                {gone ? " (no longer offered)" : ""}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

/**
 * "Narrow down (optional)" under Target Audience (plan step 10c-2). Department for every
 * audience type; program, year and section only for students / officers.
 */
export function AudienceFilters({
  type,
  lists,
  value,
  onChange,
}: {
  type: TargetAudience["type"];
  lists: SchoolLists | null;
  value: AudienceLists;
  onChange: (value: AudienceLists) => void;
}) {
  const departments = value.departments || [];
  const programs = value.programs || [];
  const years = value.years || [];
  const sections = value.sections || [];
  const studentsOnly = type === "students" || type === "officers";

  const toggle = (list: string[], v: string) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);
  const set = (patch: AudienceLists) => onChange(pruneAudience(lists, { ...value, ...patch }));

  const progOptions = candidatePrograms(lists, departments).map((p) => p.name);
  const maxYears = Math.max(
    0,
    ...candidatePrograms(lists, departments)
      .filter((p) => !programs.length || programs.includes(p.name))
      .map((p) => p.yearLevels)
  );
  const yearOptions = Array.from({ length: maxYears }, (_, i) => yearLabel(i + 1));
  const secOptions = programs.length ? sectionOptions(lists, departments, programs, years) : [];

  if (activeDepartments(lists).length === 0) {
    return (
      <p className="text-[11px] text-slate-500">
        Narrowing by department, program, year or section becomes available once the admin has set up the school list.
      </p>
    );
  }

  return (
    <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
      <div>
        <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">Narrow down (optional)</span>
        <p className="text-[11px] text-slate-500 mt-0.5">
          Within a row, any chosen value counts. Between rows, all must match.
          {studentsOnly ? "" : " Program, year and section are available when the audience is students or officers."}
        </p>
      </div>
      <Chips
        label="Department"
        options={activeDepartments(lists).map((d) => d.name)}
        selected={departments}
        onToggle={(d) => set({ departments: toggle(departments, d) })}
      />
      {studentsOnly && (
        <>
          <Chips
            label="Program"
            options={progOptions}
            selected={programs}
            onToggle={(p) => set({ programs: toggle(programs, p) })}
          />
          <Chips label="Year level" options={yearOptions} selected={years} onToggle={(y) => set({ years: toggle(years, y) })} />
          {programs.length > 0 ? (
            <Chips
              label="Section"
              options={secOptions}
              selected={sections}
              onToggle={(s) => set({ sections: toggle(sections, s) })}
            />
          ) : (
            <p className="text-[11px] text-slate-500">Choose a program first to narrow down by section.</p>
          )}
        </>
      )}
    </div>
  );
}

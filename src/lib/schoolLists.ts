import type { SchoolDepartment, SchoolLists, SchoolProgram, Survey, SurveyCategory, UserProfile } from "../types";
import { DEFAULT_SURVEY_CATEGORIES } from "../data/initialData";

/**
 * The school's departments, programs and sections, managed by the admin (School Setup) and
 * stored in one document `school_setup/lists`. Profiles keep the plain names (department,
 * program, year, section), so names that are in use are never changed or removed silently:
 * the admin retires them instead.
 */

export const MAX_YEAR_LEVELS = 5;

/** The admin's categories, or the built-in ones while the list has never been saved. */
export function allCategories(lists: SchoolLists | null): SurveyCategory[] {
  if (lists?.categories) return lists.categories;
  return DEFAULT_SURVEY_CATEGORIES.map((name, i) => ({ id: `cat_builtin_${i}`, name }));
}

/** Category names that can be chosen for a new survey. */
export function activeCategoryNames(lists: SchoolLists | null): string[] {
  return allCategories(lists)
    .filter((c) => !c.retired)
    .map((c) => c.name);
}

export function yearLabel(n: number): string {
  const suffix = n === 1 ? "st" : n === 2 ? "nd" : n === 3 ? "rd" : "th";
  return `${n}${suffix} Year`;
}

/** "CS" + 1 + "A" -> "CS-1A" */
export function sectionLabel(code: string, year: number, letter: string): string {
  return `${code}-${year}${letter}`;
}

export function newId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

export function activeDepartments(lists: SchoolLists | null): SchoolDepartment[] {
  return (lists?.departments || []).filter((d) => !d.retired);
}

export function activePrograms(dept: SchoolDepartment | undefined): SchoolProgram[] {
  return (dept?.programs || []).filter((p) => !p.retired);
}

/** Year levels of a program that have at least one section. */
export function yearsWithSections(program: SchoolProgram | undefined): number[] {
  if (!program) return [];
  const years: number[] = [];
  for (let y = 1; y <= program.yearLevels; y++) {
    if ((program.sections[String(y)] || []).length > 0) years.push(y);
  }
  return years;
}

export function sectionChoices(program: SchoolProgram | undefined, year: number): string[] {
  if (!program || !program.code) return [];
  return (program.sections[String(year)] || []).map((letter) => sectionLabel(program.code, year, letter));
}

/** Sign-up is open when at least one department is active. */
export function registrationOpen(lists: SchoolLists | null): boolean {
  return activeDepartments(lists).length > 0;
}

export function findDepartment(lists: SchoolLists | null, name: string): SchoolDepartment | undefined {
  return (lists?.departments || []).find((d) => d.name === name);
}

export function findProgram(dept: SchoolDepartment | undefined, name: string): SchoolProgram | undefined {
  return (dept?.programs || []).find((p) => p.name === name);
}

export interface SchoolFields {
  department: string;
  program: string;
  year: string;
  section: string;
}

/** What is still missing in a profile's school fields, in plain words, or null. */
export function missingSchoolField(fields: SchoolFields, isStudent: boolean): string | null {
  if (!fields.department) return "Please choose your college / department.";
  if (!isStudent) return null;
  if (!fields.program) return "Please choose your program.";
  if (!fields.year) return "Please choose your year level.";
  if (!fields.section) return "Please choose your section.";
  return null;
}

/** How many accounts use each department, program and section name. */
export function schoolUsage(users: UserProfile[]) {
  const departments = new Map<string, number>();
  const programs = new Map<string, number>();
  const sections = new Map<string, number>();
  const bump = (m: Map<string, number>, k?: string) => {
    if (k) m.set(k, (m.get(k) || 0) + 1);
  };
  for (const u of users) {
    bump(departments, u.department);
    bump(programs, u.program);
    bump(sections, u.section);
  }
  return { departments, programs, sections };
}

/** Section names a program currently offers, e.g. ["CS-1A", "CS-1B"]. */
export function allSectionLabels(program: SchoolProgram): string[] {
  const out: string[] = [];
  for (let y = 1; y <= program.yearLevels; y++) out.push(...sectionChoices(program, y));
  return out;
}

const CODE_RE = /^[A-Z0-9]{1,8}$/;
const LETTER_RE = /^[A-Z0-9]{1,3}$/;

/**
 * Checks the lists before saving. `before` is the saved version, used to stop renaming or
 * removing names that accounts still use (retire them instead).
 */
export function validateSchoolLists(
  lists: SchoolLists,
  before: SchoolLists | null,
  users: UserProfile[],
  surveys: Survey[] = []
): string[] {
  const errors: string[] = [];

  // Categories: unique names, at least one active, and names used by surveys stay as they are.
  const cats = lists.categories || [];
  const catNames = new Set<string>();
  for (const c of cats) {
    const n = c.name.trim();
    if (!n) errors.push("Every category needs a name.");
    else if (catNames.has(n.toLowerCase())) errors.push(`Category "${n}" is listed twice.`);
    catNames.add(n.toLowerCase());
  }
  if (lists.categories && !cats.some((c) => !c.retired && c.name.trim())) {
    errors.push("Keep at least one active category, or nobody can create a survey.");
  }
  const catUse = new Map<string, number>();
  surveys.forEach((s) => s.cat && catUse.set(s.cat, (catUse.get(s.cat) || 0) + 1));
  const nowCat = new Map(cats.map((c) => [c.id, c]));
  for (const c of allCategories(before)) {
    const n = catUse.get(c.name) || 0;
    const now = nowCat.get(c.id);
    if (n > 0 && (!now || now.name.trim() !== c.name)) {
      errors.push(`Category "${c.name}" is used by ${n} survey(s), so it cannot be renamed or removed. Retire it instead.`);
    }
  }
  const usage = schoolUsage(users);
  const deptNames = new Set<string>();
  const progNames = new Set<string>();
  const codes = new Set<string>();

  for (const d of lists.departments) {
    const dn = d.name.trim();
    if (!dn) errors.push("Every department needs a name.");
    else if (deptNames.has(dn.toLowerCase())) errors.push(`Department "${dn}" is listed twice.`);
    deptNames.add(dn.toLowerCase());

    for (const p of d.programs) {
      const pn = p.name.trim();
      if (!pn) errors.push(`A program in "${dn}" has no name.`);
      else if (progNames.has(pn.toLowerCase())) errors.push(`Program "${pn}" is listed twice (program names must be unique).`);
      progNames.add(pn.toLowerCase());

      const hasSections = Object.values(p.sections).some((l) => l.length > 0);
      if (p.code && !CODE_RE.test(p.code)) {
        errors.push(`Program "${pn}": the code "${p.code}" may only use capital letters and digits (up to 8), e.g. CS.`);
      } else if (p.code) {
        if (codes.has(p.code)) errors.push(`The code "${p.code}" is used by two programs; section names would clash.`);
        codes.add(p.code);
      }
      if (hasSections && !p.code) errors.push(`Program "${pn}" has sections, so it needs a code (e.g. CS).`);
      if (p.yearLevels < 1 || p.yearLevels > MAX_YEAR_LEVELS) errors.push(`Program "${pn}": year levels must be 1 to ${MAX_YEAR_LEVELS}.`);
      for (const [year, letters] of Object.entries(p.sections)) {
        if (Number(year) > p.yearLevels && letters.length > 0) {
          errors.push(`Program "${pn}" has sections in ${yearLabel(Number(year))}, but only ${p.yearLevels} year levels.`);
        }
        const seen = new Set<string>();
        for (const l of letters) {
          if (!LETTER_RE.test(l)) errors.push(`Program "${pn}", ${yearLabel(Number(year))}: "${l}" is not a valid section (use letters like A, B, C).`);
          if (seen.has(l)) errors.push(`Program "${pn}", ${yearLabel(Number(year))}: section ${l} is listed twice.`);
          seen.add(l);
        }
      }
    }
  }

  // Names in use must not disappear or change.
  if (before) {
    const nowDept = new Map(lists.departments.map((d) => [d.id, d]));
    const nowProg = new Map(lists.departments.flatMap((d) => d.programs).map((p) => [p.id, p]));
    for (const d of before.departments) {
      const n = usage.departments.get(d.name) || 0;
      const now = nowDept.get(d.id);
      if (n > 0 && (!now || now.name.trim() !== d.name)) {
        errors.push(`Department "${d.name}" is used by ${n} account(s), so it cannot be renamed or deleted. Retire it instead.`);
      }
      for (const p of d.programs) {
        const pnow = nowProg.get(p.id);
        const pn = usage.programs.get(p.name) || 0;
        if (pn > 0 && (!pnow || pnow.name.trim() !== p.name)) {
          errors.push(`Program "${p.name}" is used by ${pn} account(s), so it cannot be renamed or deleted. Retire it instead.`);
        }
        const kept = new Set(pnow ? allSectionLabels(pnow) : []);
        for (const label of allSectionLabels(p)) {
          const sn = usage.sections.get(label) || 0;
          if (sn > 0 && !kept.has(label)) {
            errors.push(`Section ${label} is used by ${sn} account(s), so it cannot be removed or have its code changed.`);
          }
        }
      }
    }
  }
  return Array.from(new Set(errors));
}

/** A starting code from a program name: "Bachelor of Science in Computer Science" -> "CS". */
function guessCode(name: string): string {
  const after = name.includes(" in ") ? name.slice(name.lastIndexOf(" in ") + 4) : name.replace(/^Bachelor of /, "");
  const letters = after
    .split(/\s+/)
    .filter((w) => w && !["and", "of", "in", "the", "Major"].includes(w))
    .map((w) => w[0].toUpperCase())
    .join("");
  return letters.slice(0, 8);
}

/**
 * The school's list that used to be written in the code, as a starting point. Codes are guessed
 * (left empty when two programs would get the same code); sections start empty.
 */
export function listsFromBuiltIn(data: Record<string, string[]>): SchoolLists {
  const used = new Map<string, number>();
  const guesses = Object.values(data).flat().map(guessCode);
  guesses.forEach((g) => used.set(g, (used.get(g) || 0) + 1));
  return {
    departments: Object.entries(data).map(([dept, programs]) => ({
      id: newId("dept"),
      name: dept,
      programs: programs.map((p) => {
        const g = guessCode(p);
        return { id: newId("prog"), name: p, code: (used.get(g) || 0) === 1 ? g : "", yearLevels: 4, sections: {} };
      }),
    })),
  };
}

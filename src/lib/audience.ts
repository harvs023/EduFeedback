import type { Survey, TargetAudience, UserProfile } from "../types";

/** The profile fields an audience check needs (all locked against self-edit). */
export type AudiencePerson = Pick<UserProfile, "pos" | "department" | "program" | "year" | "section">;

export type AudienceLists = Pick<TargetAudience, "departments" | "programs" | "years" | "sections">;

const STUDENT_POS = ["Student", "Student Officer"];

/** Role part: all / students (Student + Student Officer) / faculty / officers / custom roles. */
export function roleMatches(target: TargetAudience | undefined, pos: string | undefined): boolean {
  const type = target?.type || "all";
  const isStudent = STUDENT_POS.includes(pos || "");
  if (type === "all") return true;
  if (type === "students") return isStudent;
  if (type === "faculty") return pos === "Faculty";
  if (type === "officers") return pos === "Student Officer";
  const roles = target?.filters?.roles || [];
  return (
    (roles.includes("students") && isStudent) ||
    (roles.includes("faculty") && pos === "Faculty") ||
    (roles.includes("officers") && pos === "Student Officer")
  );
}

const inList = (list: string[] | undefined, value: string | undefined) =>
  !list || list.length === 0 || list.includes(value || "");

/**
 * Is this person part of the survey's target audience? The one check used by Take a Survey,
 * the eligible count (browser and server) and, mirrored, the Firestore rule `inAudience`.
 */
export function isInAudience(survey: Pick<Survey, "targetAudience">, person: AudiencePerson): boolean {
  const t = survey.targetAudience;
  return (
    roleMatches(t, person.pos) &&
    inList(t?.departments, person.department) &&
    inList(t?.programs, person.program) &&
    inList(t?.years, person.year) &&
    (!t?.sections?.length || ((t.programs?.length || 0) > 0 && t.sections.includes(person.section || "")))
  );
}

const ROLE_WORDS: Record<TargetAudience["type"], string> = {
  all: "Everyone (students, officers, faculty)",
  students: "Students & Student Officers",
  faculty: "Faculty",
  officers: "Student Officers only",
  custom: "Custom",
};

/** "Students & Student Officers · CCS · BSCS, BSIT · 3rd Year · CS-3A" */
export function describeAudience(target: TargetAudience | undefined): string {
  const type = target?.type || "all";
  let role = ROLE_WORDS[type];
  if (type === "custom") {
    const roles = (target?.filters?.roles || []).map((r) =>
      r === "students" ? "Students" : r === "faculty" ? "Faculty" : r === "officers" ? "Officers" : r
    );
    role = roles.length ? `Custom (${roles.join(", ")})` : "Custom (no roles selected)";
  }
  const parts = [role];
  for (const list of [target?.departments, target?.programs, target?.years, target?.sections]) {
    if (list && list.length) parts.push(list.join(", "));
  }
  return parts.join(" · ");
}

/** Same audience on both surveys (order of the chosen values does not matter). */
export function sameAudience(a: TargetAudience | undefined, b: TargetAudience | undefined): boolean {
  const key = (t: TargetAudience | undefined) =>
    JSON.stringify([
      t?.type || "all",
      [...(t?.type === "custom" ? t.filters?.roles || [] : [])].sort(),
      [...(t?.departments || [])].sort(),
      [...(t?.programs || [])].sort(),
      [...(t?.years || [])].sort(),
      [...(t?.sections || [])].sort(),
    ]);
  return key(a) === key(b);
}

/** Department, program and section names used by survey audiences (cannot be renamed or removed). */
export function audienceNamesUsed(surveys: Pick<Survey, "targetAudience">[]) {
  const departments = new Set<string>();
  const programs = new Set<string>();
  const sections = new Set<string>();
  for (const s of surveys) {
    s.targetAudience?.departments?.forEach((d) => departments.add(d));
    s.targetAudience?.programs?.forEach((p) => programs.add(p));
    s.targetAudience?.sections?.forEach((x) => sections.add(x));
  }
  return { departments, programs, sections };
}

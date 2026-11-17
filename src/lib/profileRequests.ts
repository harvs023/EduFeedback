import type { ProfileSchoolFields, UserProfile } from "../types";

export type SchoolFieldKey = keyof ProfileSchoolFields;

export const SCHOOL_FIELD_LABELS: Record<SchoolFieldKey, string> = {
  department: "Department",
  program: "Program",
  year: "Year level",
  section: "Section",
  studentId: "Student ID",
};

/** Students and student officers have all five fields; faculty only a department. */
export function isStudentPos(pos: string | undefined): boolean {
  return pos === "Student" || pos === "Student Officer";
}

export function fieldKeysFor(pos: string | undefined): SchoolFieldKey[] {
  return isStudentPos(pos) ? ["department", "program", "year", "section", "studentId"] : ["department"];
}

/** The person's locked school fields (empty strings for missing ones, so nothing is undefined). */
export function schoolFieldsOf(user: Pick<UserProfile, "pos" | keyof ProfileSchoolFields>): ProfileSchoolFields {
  const out: ProfileSchoolFields = {};
  for (const key of fieldKeysFor(user.pos)) out[key] = (user[key] || "").trim();
  return out;
}

/** Fields whose value differs between the two. */
export function changedFields(current: ProfileSchoolFields, requested: ProfileSchoolFields): SchoolFieldKey[] {
  return (Object.keys(SCHOOL_FIELD_LABELS) as SchoolFieldKey[]).filter(
    (k) => k in requested && (requested[k] || "") !== (current[k] || "")
  );
}

/** "Program: BSCS → BSIT; Section: CS-3A → IT-3A" */
export function describeChanges(current: ProfileSchoolFields, requested: ProfileSchoolFields): string {
  return changedFields(current, requested)
    .map((k) => `${SCHOOL_FIELD_LABELS[k]}: ${current[k] || "(empty)"} → ${requested[k] || "(empty)"}`)
    .join("; ");
}

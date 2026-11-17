import type { SchoolLists, UserProfile } from "../types";
import { findDepartment, findProgram, yearLabel } from "./schoolLists";
import { isStudentPos } from "./profileRequests";

/**
 * The admin's "New school year" move (plan step 10c-1b, option A): every active student and
 * student officer moves up one year level and picks their new section once; students already in
 * their program's last year are marked graduated and suspended. Nothing is written here; this
 * only works out the plan, so the admin sees it before confirming.
 */
export interface YearMovePlan {
  moveUp: { user: UserProfile; from: string; to: string }[];
  graduate: { user: UserProfile; year: string; program: string }[];
  skipped: { user: UserProfile; reason: string }[];
}

/** "3rd Year" -> 3; null if the label does not start with a year number. */
export function yearNumber(label: string | undefined): number | null {
  const m = /^\s*(\d)/.exec(label || "");
  return m ? Number(m[1]) : null;
}

export function planYearMove(users: UserProfile[], lists: SchoolLists | null): YearMovePlan {
  const plan: YearMovePlan = { moveUp: [], graduate: [], skipped: [] };
  for (const user of users) {
    if (!isStudentPos(user.pos) || user.status !== "active") continue;
    const program = findProgram(findDepartment(lists, user.department || ""), user.program || "");
    const year = yearNumber(user.year);
    if (!program) {
      plan.skipped.push({ user, reason: "program not found in School Setup" });
    } else if (year === null) {
      plan.skipped.push({ user, reason: "no year level" });
    } else if (year >= program.yearLevels) {
      plan.graduate.push({ user, year: user.year || "", program: program.name });
    } else {
      plan.moveUp.push({ user, from: user.year || "", to: yearLabel(year + 1) });
    }
  }
  return plan;
}

/** The profile fields written for each person in the plan (admin write, only these fields). */
export function planUpdates(plan: YearMovePlan, now: number): { email: string; fields: Partial<UserProfile> }[] {
  return [
    ...plan.moveUp.map((m) => ({
      email: m.user.email,
      fields: { year: m.to, section: "", sectionPickNeeded: true } as Partial<UserProfile>,
    })),
    ...plan.graduate.map((g) => ({
      email: g.user.email,
      fields: { status: "suspended", graduatedAt: now, sectionPickNeeded: false } as Partial<UserProfile>,
    })),
  ];
}

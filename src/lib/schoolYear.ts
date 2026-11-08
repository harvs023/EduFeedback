import { AcademicYearTerms, TermName } from "../types";

/**
 * School year and semester for a moment in time.
 *
 * The admin's academic calendar (plan step 6b) is the one source of truth. Nothing is stored on a
 * response: its school year and semester are worked out from its submit time whenever they are
 * needed, so correcting a date in the calendar corrects every chart.
 *
 * When the calendar does not cover a date, the school year is estimated with the old rule (the
 * school year starts in August) and the semester is unknown.
 */
export const SCHOOL_YEAR_START_MONTH = 8; // August (1 = January); only used when the calendar has no answer

const DAY_MS = 24 * 60 * 60 * 1000;

export interface TermInfo {
  schoolYear: string;
  /** null when the calendar does not cover this date (ask the admin to add the school year). */
  term: TermName | null;
  source: "calendar" | "estimate";
}

function estimatedSchoolYear(timestamp: number): string {
  const d = new Date(timestamp);
  const year = d.getFullYear();
  const startYear = d.getMonth() + 1 >= SCHOOL_YEAR_START_MONTH ? year : year - 1;
  return `${startYear}-${startYear + 1}`;
}

/**
 * Breaks belong to the school year that just ended: after its 1st Sem starts, a date belongs to it
 * until the next school year's 1st Sem starts. With no next school year entered, the break after
 * the 2nd Sem only lasts until one year after this year's 1st Sem started.
 */
export function termFor(timestamp: number, calendar: AcademicYearTerms[] = []): TermInfo {
  const sorted = [...calendar].sort((a, b) => a.sem1Start - b.sem1Start);
  for (let i = sorted.length - 1; i >= 0; i--) {
    const y = sorted[i];
    if (timestamp < y.sem1Start) continue;
    const next = sorted[i + 1];
    const coveredUntil = next ? next.sem1Start : y.sem1Start + 365 * DAY_MS;
    if (timestamp >= coveredUntil) break;
    let term: TermName = "Between terms";
    if (timestamp <= y.sem1End) term = "1st Sem";
    else if (timestamp >= y.sem2Start && timestamp <= y.sem2End) term = "2nd Sem";
    return { schoolYear: y.schoolYear, term, source: "calendar" };
  }
  return { schoolYear: estimatedSchoolYear(timestamp), term: null, source: "estimate" };
}

export function schoolYearFor(timestamp: number = Date.now(), calendar: AcademicYearTerms[] = []): string {
  return termFor(timestamp, calendar).schoolYear;
}

/** "2026-2027" -> "SY 2026–2027" */
export function formatSchoolYear(schoolYear: string): string {
  return `SY ${schoolYear.replace("-", "–")}`;
}

// ---------------------------------------------------------------- date inputs (admin screen)

/** Timestamp -> "YYYY-MM-DD" in local time, for <input type="date">. */
export function toDateInput(timestamp: number | undefined): string {
  if (!timestamp) return "";
  const d = new Date(timestamp);
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}

/** "YYYY-MM-DD" -> first moment of that day (local time), or null if empty/invalid. */
export function startOfDay(value: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!m) return null;
  const t = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])).getTime();
  return Number.isNaN(t) ? null : t;
}

/** "YYYY-MM-DD" -> last moment of that day (local time), or null if empty/invalid. */
export function endOfDay(value: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!m) return null;
  const t = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]) + 1).getTime() - 1;
  return Number.isNaN(t) ? null : t;
}

/**
 * Checks one school year before saving. Returns a plain-language problem, or null if it is fine.
 * The Firestore rule repeats the date-order checks; the checks against other school years exist
 * only here (the rule cannot compare documents).
 */
export function validateAcademicYear(
  entry: Pick<AcademicYearTerms, "schoolYear" | "sem1Start" | "sem1End" | "sem2Start" | "sem2End">,
  others: AcademicYearTerms[]
): string | null {
  const m = /^(\d{4})-(\d{4})$/.exec(entry.schoolYear);
  if (!m || Number(m[2]) !== Number(m[1]) + 1) {
    return "The school year must look like 2026-2027 (two years in a row).";
  }
  const startYear = Number(m[1]);
  if (new Date(entry.sem1Start).getFullYear() !== startYear) {
    return `The 1st Sem of SY ${entry.schoolYear} must start in ${startYear}.`;
  }
  if (new Date(entry.sem2End).getFullYear() > startYear + 1) {
    return `The 2nd Sem of SY ${entry.schoolYear} must end by the end of ${startYear + 1}.`;
  }
  if (entry.sem1End <= entry.sem1Start) return "The 1st Sem must end after it starts.";
  if (entry.sem2Start <= entry.sem1End) return "The 2nd Sem must start after the 1st Sem ends.";
  if (entry.sem2End <= entry.sem2Start) return "The 2nd Sem must end after it starts.";

  for (const o of others) {
    if (o.schoolYear === entry.schoolYear) continue;
    const overlaps = entry.sem1Start <= o.sem2End && o.sem1Start <= entry.sem2End;
    if (overlaps) {
      return `These dates overlap SY ${o.schoolYear}. One school year must end before the next one starts.`;
    }
  }
  return null;
}

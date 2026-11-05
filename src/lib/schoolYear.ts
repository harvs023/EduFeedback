/**
 * TEMPORARY rule until the admin academic calendar exists (plan step 6b):
 * the school year starts in August. July 2026 -> "2025-2026", September 2026 -> "2026-2027".
 */
export const SCHOOL_YEAR_START_MONTH = 8; // August (1 = January)

export function schoolYearFor(timestamp: number = Date.now()): string {
  const d = new Date(timestamp);
  const year = d.getFullYear();
  const startYear = d.getMonth() + 1 >= SCHOOL_YEAR_START_MONTH ? year : year - 1;
  return `${startYear}-${startYear + 1}`;
}

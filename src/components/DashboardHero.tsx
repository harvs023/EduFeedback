import { ClipboardList, PlusCircle, ShieldCheck } from "lucide-react";
import type { AcademicYearTerms } from "../types";
import { termFor } from "../lib/schoolYear";

function greeting(hour: number): string {
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

/** Decorative drawing: feedback bubbles and a small bar chart (no data, purely visual). */
function FeedbackArt() {
  return (
    <svg viewBox="0 0 220 160" className="w-56 h-auto" aria-hidden="true">
      <rect x="20" y="18" width="128" height="58" rx="16" fill="white" fillOpacity="0.16" />
      <path d="M44 76 L40 94 L62 76 Z" fill="white" fillOpacity="0.16" />
      <rect x="36" y="34" width="70" height="8" rx="4" fill="white" fillOpacity="0.7" />
      <rect x="36" y="50" width="96" height="8" rx="4" fill="white" fillOpacity="0.35" />
      <rect x="92" y="88" width="112" height="56" rx="16" fill="white" fillOpacity="0.22" />
      <path d="M180 144 L186 158 L166 144 Z" fill="white" fillOpacity="0.22" />
      <rect x="108" y="122" width="12" height="12" rx="3" fill="white" fillOpacity="0.55" />
      <rect x="126" y="112" width="12" height="22" rx="3" fill="white" fillOpacity="0.7" />
      <rect x="144" y="104" width="12" height="30" rx="3" fill="white" fillOpacity="0.85" />
      <rect x="162" y="98" width="12" height="36" rx="3" fill="white" />
      <circle cx="178" cy="30" r="14" fill="#fbbf24" fillOpacity="0.9" />
      <path d="M172 30 l4 4 l8 -9" stroke="white" strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/**
 * Welcome banner at the top of the Dashboard: greeting, today's date with the school year and
 * semester (from the academic calendar), one line about what is waiting, and the two main actions.
 */
export function DashboardHero({
  name,
  openCount,
  calendar,
  onTakeSurvey,
  onCreateSurvey,
  admin,
}: {
  name?: string;
  /** Open surveys this person can still answer. */
  openCount: number;
  calendar: AcademicYearTerms[];
  onTakeSurvey: () => void;
  onCreateSurvey: () => void;
  /** Admin: items waiting for review, and the Review Center button instead of "Take a survey". */
  admin?: { waiting: number; onOpenReviewCenter: () => void };
}) {
  const now = new Date();
  const first = (name || "").trim().split(/\s+/)[0];
  const term = calendar.length ? termFor(now.getTime(), calendar) : null;
  const termText = term?.source === "calendar" ? `SY ${term.schoolYear}${term.term ? ` · ${term.term}` : ""}` : "";
  const dateText = now.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });

  return (
    <section
      aria-label="Welcome"
      className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-600 via-indigo-700 to-violet-700 text-white p-6 sm:p-8 shadow-lg"
    >
      {/* Soft background shapes */}
      <div className="absolute -top-16 -right-10 w-64 h-64 rounded-full bg-white/10 blur-2xl" aria-hidden="true" />
      <div className="absolute -bottom-20 left-1/3 w-72 h-72 rounded-full bg-violet-400/20 blur-3xl" aria-hidden="true" />

      <div className="relative flex items-center justify-between gap-6">
        <div className="space-y-3 max-w-xl">
          <p className="text-xs sm:text-sm text-indigo-100">
            {dateText}
            {termText && <span className="ml-2 px-2 py-0.5 rounded-full bg-white/15 text-white font-semibold">{termText}</span>}
          </p>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
            {greeting(now.getHours())}
            {first ? `, ${first}` : ""}!
          </h1>
          <p className="text-sm sm:text-base text-indigo-100">
            {admin
              ? admin.waiting > 0
                ? `${admin.waiting} item${admin.waiting === 1 ? " is" : "s are"} waiting for your review.`
                : "Nothing is waiting for your review. Everything is up to date."
              : openCount > 0
              ? `${openCount} survey${openCount === 1 ? " is" : "s are"} waiting for your answer. Your feedback helps improve the school.`
              : "You're all caught up. Thank you for sharing your feedback!"}
          </p>
          <div className="flex flex-wrap gap-2 pt-1">
            <button
              type="button"
              onClick={admin ? admin.onOpenReviewCenter : onTakeSurvey}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white text-indigo-700 text-sm font-bold shadow-sm hover:bg-indigo-50 cursor-pointer"
            >
              {admin ? (
                <>
                  <ShieldCheck className="w-4 h-4" /> Open Review Center
                </>
              ) : (
                <>
                  <ClipboardList className="w-4 h-4" /> Take a survey
                </>
              )}
            </button>
            <button
              type="button"
              onClick={onCreateSurvey}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/10 border border-white/30 text-white text-sm font-bold hover:bg-white/20 cursor-pointer"
            >
              <PlusCircle className="w-4 h-4" /> Create survey
            </button>
          </div>
        </div>
        <div className="hidden md:block shrink-0">
          <FeedbackArt />
        </div>
      </div>
    </section>
  );
}

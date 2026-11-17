import type { NotificationItem } from "../types";

/** Where a notification leads when clicked. */
export type NotificationTarget =
  | { kind: "view"; view: "dashboard" | "my-surveys" | "take-survey"; label: string }
  | { kind: "review"; tab: string; label: string }
  | { kind: "analytics"; surveyId: string; label: string }
  | { kind: "profile"; label: string };

/**
 * Picks the page a notification is about. Older notifications only have a type and a title,
 * so a few cases also look at the title words. Returns null when there is nothing to open
 * (clicking then only marks it as read).
 */
export function notificationTarget(n: NotificationItem, isAdmin: boolean): NotificationTarget | null {
  const title = (n.title || "").toLowerCase();
  const surveyId = n.data?.surveyId != null ? String(n.data.surveyId) : "";
  const type = String(n.type || "");

  switch (type) {
    case "response":
      if (isAdmin && title.includes("flagged for review")) return { kind: "review", tab: "flagged-responses", label: "Open Flagged responses" };
      return surveyId ? { kind: "analytics", surveyId, label: "See the results" } : { kind: "view", view: "my-surveys", label: "Open My Surveys" };
    case "survey_pending":
      return isAdmin ? { kind: "review", tab: "approvals", label: "Open Survey approvals" } : { kind: "view", view: "my-surveys", label: "Open My Surveys" };
    case "survey_approved":
    case "survey_rejected":
    case "survey_takedown":
    case "survey_deleted":
    case "survey":
      return { kind: "view", view: "my-surveys", label: "Open My Surveys" };
    case "news":
      if (isAdmin && title.includes("awaiting")) return { kind: "review", tab: "news", label: "Open News posts" };
      return { kind: "view", view: "dashboard", label: "Open the news feed" };
    case "survey_report":
      return isAdmin ? { kind: "review", tab: "reports", label: "Open Reported surveys" } : null;
    case "profile_request":
      return isAdmin ? { kind: "review", tab: "profile-requests", label: "Open Profile requests" } : { kind: "profile", label: "Open My Profile" };
    case "school_year":
    case "profile_update":
      return { kind: "profile", label: "Open My Profile" };
    case "required_survey":
      return isAdmin ? null : { kind: "view", view: "take-survey", label: "Open Take a Survey" };
    case "general":
      // Topic changes and topic suggestion decisions are about the person's own surveys.
      if (title.includes("topic")) return { kind: "view", view: "my-surveys", label: "Open My Surveys" };
      return null;
    default:
      return null;
  }
}

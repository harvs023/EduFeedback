import { Survey, UserProfile } from "../types";

export type SurveyAvailability = "upcoming" | "open" | "closed" | "not-live";

export interface PreCheckResult {
  level: "ok" | "attention";
  reasons: string[];
}

export interface CreatorStats {
  submitted: number;
  approved: number;
  rejected: number;
  pending: number;
}

export const OFFENSIVE_WORDS: string[] = [
  // English
  "fuck",
  "shit",
  "bitch",
  "bastard",
  "asshole",
  "dick",
  "cunt",
  "pussy",
  "whore",
  "slut",
  "damn",
  // Tagalog
  "putangina",
  "tangina",
  "puta",
  "gago",
  "tarantado",
  "ulol",
  "bobo",
  "inutil",
  "tanga",
  "pakyu",
  "leche",
  "kupal",
  "hudas",
  "peste",
  "buwisit",
];

/**
 * Returns survey availability state: "upcoming" | "open" | "closed" | "not-live".
 * Status must be published or scheduled, otherwise "not-live".
 * If openDate parses and now < openDate return "upcoming".
 * If closeDate parses and now >= closeDate return "closed".
 * Otherwise "open". Missing or invalid dates mean no limit.
 */
export function getSurveyAvailability(
  survey: Survey,
  now: number = Date.now()
): SurveyAvailability {
  if (survey.status !== "published" && survey.status !== "scheduled") {
    return "not-live";
  }

  if (survey.openDate) {
    const openTime = Date.parse(survey.openDate);
    if (!isNaN(openTime) && now < openTime) {
      return "upcoming";
    }
  }

  if (survey.closeDate) {
    const closeTime = Date.parse(survey.closeDate);
    if (!isNaN(closeTime) && now >= closeTime) {
      return "closed";
    }
  }

  return "open";
}

/**
 * Is someone with this position part of the survey's target audience? The one check used by
 * Take a Survey, the eligible count and (mirrored) the Firestore response rule `inAudience`.
 * all or missing = everyone; students = Student or Student Officer; faculty = Faculty;
 * officers = Student Officer; custom = any of filters.roles with the same mapping.
 */
export function isInAudience(survey: Pick<Survey, "targetAudience">, pos: string | undefined): boolean {
  const target = survey.targetAudience;
  const type = target?.type || "all";
  const isStudent = pos === "Student" || pos === "Student Officer";
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

/**
 * When a survey stopped taking answers: when it was archived, or the end of its closing date if
 * that has passed. null = still open. Used so participation of a closed survey only counts people
 * who had an account before it closed.
 */
export function eligibilityCutoff(survey: Survey, now: number = Date.now()): number | null {
  if (typeof survey.archivedAt === "number" && survey.archivedAt > 0) return survey.archivedAt;
  if (!survey.openEnded && survey.closeDate) {
    const end = Date.parse(survey.closeDate);
    if (!Number.isNaN(end)) {
      const d = new Date(end);
      const endOfDay = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1).getTime() - 1;
      if (endOfDay < now) return endOfDay;
    }
  }
  return null;
}

/** Accounts made after the cutoff did not exist while the survey was open. No date = counted. */
function joinedBy(user: Pick<UserProfile, "joined">, cutoff: number | null): boolean {
  if (cutoff === null || !user.joined) return true;
  const joined = Date.parse(user.joined);
  return Number.isNaN(joined) || joined <= cutoff;
}

/**
 * Active accounts in the survey's audience (isInAudience), not counting the owner. With a cutoff,
 * only accounts that joined by then (see eligibilityCutoff).
 */
export function countEligibleUsers(
  survey: Survey,
  users: Pick<UserProfile, "email" | "status" | "pos" | "joined">[],
  cutoff: number | null = null
): number {
  const ownerEmail = (survey.owner || "").trim().toLowerCase();
  return users.filter((u) => {
    if (u.status !== "active") return false;
    if (!joinedBy(u, cutoff)) return false;
    if (u.email && u.email.trim().toLowerCase() === ownerEmail) return false;
    return isInAudience(survey, u.pos);
  }).length;
}

export function containsGibberish(text: string): boolean {
  if (!text) return false;

  // Words like test, testing, sample, dummy, asdf, qwerty, lorem, ipsum, trial, xxx
  const testWordRegex = /\b(test|testing|sample|dummy|asdf|qwerty|lorem|ipsum|trial|xxx)\b/i;
  if (testWordRegex.test(text)) return true;

  // A word of 4+ letters with no vowels
  const noVowelsRegex = /\b[bcdfghjklmnpqrstvwxyzBCDFGHJKLMNPQRSTVWXYZ]{4,}\b/;
  if (noVowelsRegex.test(text)) return true;

  // Same character repeated 4+ times
  const repeatedCharRegex = /(.)\1{3,}/;
  if (repeatedCharRegex.test(text)) return true;

  // Keyboard runs: asdf, qwer, zxcv, hjkl
  const keyboardRunRegex = /(asdf|qwer|zxcv|hjkl)/i;
  if (keyboardRunRegex.test(text)) return true;

  return false;
}

export function containsOffensive(text: string, wordList: string[] = OFFENSIVE_WORDS): boolean {
  if (!text) return false;
  const lower = text.toLowerCase();
  return wordList.some((w) => {
    const escaped = w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(`(^|\\b|[^a-zA-Z0-9])${escaped}($|\\b|[^a-zA-Z0-9])`, "i");
    return regex.test(lower);
  });
}

/**
 * Runs automated pre-checks on a survey, returning ok/attention and specific reasons.
 */
export function runPreChecks(
  survey: Survey,
  allSurveys: Survey[] = [],
  now: number = Date.now()
): PreCheckResult {
  const reasons: string[] = [];

  const textFields = [
    survey.title || "",
    survey.purpose || "",
    survey.desc || "",
    ...(survey.questions || []).map((q) => q.text || ""),
  ];

  // 1. Gibberish or test content
  if (textFields.some(containsGibberish)) {
    reasons.push("Title, purpose, description, or question text contains test or gibberish content.");
  }

  // 2. Offensive words
  if (textFields.some((t) => containsOffensive(t, OFFENSIVE_WORDS))) {
    reasons.push("Title, purpose, description, or question text contains inappropriate or offensive language.");
  }

  // 3. Fewer than 3 questions
  if (!survey.questions || survey.questions.length < 3) {
    reasons.push("Survey contains fewer than 3 questions.");
  }

  // 4. Question text shorter than 8 characters
  const hasShortQuestion = survey.questions?.some((q) => (q.text || "").trim().length < 8);
  if (hasShortQuestion) {
    reasons.push("One or more question texts are shorter than 8 characters.");
  }

  // 5. Duplicate question texts inside the survey
  if (survey.questions && survey.questions.length > 1) {
    const seen = new Set<string>();
    let hasDup = false;
    for (const q of survey.questions) {
      const norm = (q.text || "").trim().toLowerCase();
      if (norm) {
        if (seen.has(norm)) {
          hasDup = true;
          break;
        }
        seen.add(norm);
      }
    }
    if (hasDup) {
      reasons.push("Survey contains duplicate question texts.");
    }
  }

  // 6. Purpose shorter than 20 characters
  if (!survey.purpose || survey.purpose.trim().length < 20) {
    reasons.push("Survey purpose must be at least 20 characters long.");
  }

  // 7. Duplicate of another non-draft, non-rejected survey by the same owner
  const normTitle = (t: string) => t.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
  const surveyOwner = (survey.owner || "").trim().toLowerCase();
  const currentNormTitle = normTitle(survey.title || "");

  let isDuplicate = false;
  for (const other of allSurveys) {
    if (String(other.id) === String(survey.id)) continue;
    const otherOwner = (other.owner || "").trim().toLowerCase();
    if (otherOwner !== surveyOwner) continue;
    if (other.status === "draft" || other.status === "rejected") continue;

    // Check same normalized title
    if (currentNormTitle && normTitle(other.title || "") === currentNormTitle) {
      isDuplicate = true;
      break;
    }

    // Check 80%+ identical question texts
    if (
      survey.questions &&
      survey.questions.length > 0 &&
      other.questions &&
      other.questions.length > 0
    ) {
      const otherQuestions = new Set(
        other.questions.map((q) => (q.text || "").trim().toLowerCase()).filter(Boolean)
      );
      let matchCount = 0;
      for (const q of survey.questions) {
        const normQ = (q.text || "").trim().toLowerCase();
        if (normQ && otherQuestions.has(normQ)) {
          matchCount++;
        }
      }
      if (matchCount / survey.questions.length >= 0.8) {
        isDuplicate = true;
        break;
      }
    }
  }

  if (isDuplicate) {
    reasons.push("Survey appears to duplicate another existing survey by the same creator.");
  }

  // 8. Custom audience with no roles
  if (survey.targetAudience?.type === "custom") {
    const roles = survey.targetAudience.filters?.roles || [];
    if (roles.length === 0) {
      reasons.push("Custom target audience has no roles selected.");
    }
  }

  // 9. Closing date less than 24 hours from now or more than 365 days away
  if (survey.closeDate) {
    const closeTime = Date.parse(survey.closeDate);
    if (!isNaN(closeTime)) {
      const diffMs = closeTime - now;
      const min24Hours = 24 * 60 * 60 * 1000;
      const max365Days = 365 * 24 * 60 * 60 * 1000;
      if (diffMs < min24Hours || diffMs > max365Days) {
        reasons.push("Closing date must be at least 24 hours from now and no more than 365 days away.");
      }
    }
  }

  // 10. Closing date before opening date
  if (survey.openDate && survey.closeDate) {
    const openTime = Date.parse(survey.openDate);
    const closeTime = Date.parse(survey.closeDate);
    if (!isNaN(openTime) && !isNaN(closeTime) && closeTime < openTime) {
      reasons.push("Closing date cannot be before the opening date.");
    }
  }

  return {
    level: reasons.length > 0 ? "attention" : "ok",
    reasons,
  };
}

/**
 * Returns creator stats:
 * submitted = surveys not in draft
 * approved = surveys with reviewedAt > 0 whose status is not rejected or pending
 * rejected = status rejected
 * pending = status pending
 */
export function getCreatorStats(ownerEmail: string, surveys: Survey[]): CreatorStats {
  const normEmail = (ownerEmail || "").trim().toLowerCase();
  const ownerSurveys = surveys.filter((s) => (s.owner || "").trim().toLowerCase() === normEmail);

  let submitted = 0;
  let approved = 0;
  let rejected = 0;
  let pending = 0;

  for (const s of ownerSurveys) {
    if (s.status !== "draft") {
      submitted++;
    }
    if ((s.reviewedAt || 0) > 0 && s.status !== "rejected" && s.status !== "pending") {
      approved++;
    }
    if (s.status === "rejected") {
      rejected++;
    }
    if (s.status === "pending") {
      pending++;
    }
  }

  return { submitted, approved, rejected, pending };
}

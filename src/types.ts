export type UserRole = "student" | "officer" | "faculty" | "superadmin" | "user";
export type Position = "Student" | "Student Officer" | "Faculty" | "Superadmin";
export type AccountStatus = "active" | "suspended" | "invited" | "pending_approval";

export interface UserProfile {
  id?: string;
  email: string;
  name: string;
  pos: Position;
  role: "user" | "superadmin" | "student" | "faculty" | "officer";
  status: AccountStatus;
  joined?: string;
  surveys?: number;
  studentId?: string;
  year?: string;
  department?: string;
  program?: string;
  section?: string;
  avatarUrl?: string;
  canCreateSurveys?: boolean;
  canPostNews?: boolean;
  restrictionReason?: string;
  /** Last time this person had the app open (heartbeat every 5 minutes); admin sees "active now". */
  lastSeenAt?: number;
}

export type SurveyStatus = "draft" | "pending" | "rejected" | "scheduled" | "published" | "archived";
export type SurveyCategory = "Course" | "Instructor" | "Facilities" | "General" | "Student Services" | "Others";

export type QuestionType = "rating" | "multiple" | "checkbox" | "paragraph";

export interface Question {
  id?: string | number;
  type: QuestionType;
  text: string;
  min?: number;
  max?: number;
  labels?: string[];
  options?: string[];
  blockId?: string;
  required?: boolean;
}

export interface TargetAudience {
  type: "all" | "faculty" | "students" | "officers" | "custom";
  filters?: {
    roles?: string[];
    studentFilters?: {
      departments?: Array<{
        department: string;
        programs: string[];
        years: string[];
        sections: string[];
      }>;
    };
    officerFilters?: {
      departments?: Array<{
        department: string;
        programs: string[];
        years: string[];
        sections: string[];
      }>;
    };
  };
}

export interface Topic {
  id: string;
  name: string;
  status: "active" | "retired";
  order: number;
  createdAt: number;
}

/**
 * One school year in the admin's academic calendar (Firestore `academic_calendar/{schoolYear}`).
 * Dates are timestamps: a start is the first moment of its first day, an end is the last moment
 * of its last day (in the admin's local time).
 */
export interface AcademicYearTerms {
  schoolYear: string; // e.g. "2026-2027" (also the document id)
  sem1Start: number;
  sem1End: number;
  sem2Start: number;
  sem2End: number;
  updatedAt: number;
  updatedBy: string;
}

export type TermName = "1st Sem" | "2nd Sem" | "Between terms";

/** Admin switches (Firestore `settings/app`; active users read, admin writes). */
export interface AppSettings {
  /** false = nobody but the admin can create surveys or send them for review. Missing = open. */
  surveyCreationOpen: boolean;
  updatedAt?: number;
  updatedBy?: string;
}

/**
 * A saved result of the thesis sentiment evaluation (Firestore `evaluation_runs`, admin only,
 * never edited). Firestore cannot store lists inside lists, so the confusion matrix is stored
 * as one row per human label.
 */
export interface EvaluationRun {
  id: string;
  savedAt: number;
  savedBy: string;
  set: "test" | "tuning" | "all";
  n: number;
  correct: number;
  accuracy: number | null;
  macroF1: number | null;
  perClass: { label: string; support: number; precision: number | null; recall: number | null; f1: number | null }[];
  /** confusionRows["Negative"][j] = humans said Negative, Gemini said the j-th of Positive / Neutral / Negative / Not analyzable. */
  confusionRows: Record<string, number[]>;
  humanNotAnalyzable: { n: number; geminiAgreed: number };
  sarcasm: {
    n: number;
    humanYes: number;
    geminiYes: number;
    bothYes: number;
    accuracy: number | null;
    precision: number | null;
    recall: number | null;
    f1: number | null;
  };
  modelVersions: string[];
  promptVersions: string[];
  seed: string;
  source: string;
  leftOutFallback: string;
  leftOutNoResult: string;
  files: { answerKey: string; finalSheet: string };
}

export interface SurveyTopicBlock {
  id: string;
  topicId: string;
  title: string;
  description?: string;
}

export interface Survey {
  id: string | number;
  title: string;
  cat: string;
  status: SurveyStatus;
  desc: string;
  questions: Question[];
  questionCount?: number;
  responses: number;
  created: string;
  createdAtTimestamp?: number;
  openDate?: string | null;
  closeDate?: string | null;
  closes?: string;
  owner: string;
  ownerName: string;
  targetAudience?: TargetAudience;
  flagged?: boolean;
  flagReason?: string | null;
  flaggedBy?: string | null;
  flaggedAt?: string | null;

  tags?: string[];
  isTrending?: boolean;
  ratingAverage?: number;
  academicYear?: string; // e.g. "2024-2025", "2025-2026"
  term?: "1st Sem" | "2nd Sem" | "Midyear";
  isRequired?: boolean; // Admin-designated required/priority survey
  requiredAudience?: "all" | "students" | "faculty" | "officers";
  allowAnonymous?: boolean; // Whether respondents can submit anonymously (if false, identity is recorded for clearance)
  purpose?: string;
  criteriaAcceptedAt?: number;
  submittedAt?: number;
  reviewedBy?: string;
  reviewedAt?: number;
  rejectionReason?: string;
  eligibleCount?: number;
  previousSurveyId?: string | number;
  seriesId?: string;
  archivedAt?: number;
  archivedBy?: string;
  archiveReason?: string;
  topicBlocks?: Array<{ id: string; topicId: string; title: string; description?: string }>;
  /** True = no closing date; the survey runs until the owner or admin archives it. */
  openEnded?: boolean;
}

export type Polarity = "Positive" | "Neutral" | "Negative";
export type CommentLanguage = "Tagalog" | "Taglish" | "English" | "Other";
export type CommentEmotion = "Satisfied" | "Frustrated" | "Confused" | "Hopeful" | "Neutral";

/** Result for one comment (Paragraph answer), following docs/sentiment-prompt-v1.md. */
export interface CommentAnalysis {
  analyzable: boolean;
  /** The 3-label result that is evaluated in the thesis. null when not analyzable. */
  polarity: Polarity | null;
  /** Display label: polarity, or "Constructive Suggestion". */
  sentiment: Polarity | "Constructive Suggestion" | null;
  isSuggestion: boolean;
  score: number | null;
  /** Gemini's own certainty. Always null for the word-list fallback, which cannot measure one. */
  confidence: number | null;
  language: CommentLanguage;
  emotion: CommentEmotion;
  keywords: string[];
  englishTranslation: string;
  sarcasmDetected: boolean;
  reason: string;
  /** "fallback" = word list used because Gemini was unavailable; must be labeled in the UI. */
  method: "gemini" | "fallback";
  /** The model name the app asked for, e.g. "gemini-3.1-flash-lite". */
  model: string | null;
  /** The exact version Gemini reported answering with, e.g. "3.1-flash-lite-05-2026". */
  modelVersion?: string | null;
  promptVersion: string;
  analyzedAt: number;
  /** Server signature over the comment text and this whole result. Checked only by the server. */
  signature?: string;
}

export interface Answer {
  question: string;
  answer: string;
  ratingValue?: number;
  /** Only on Paragraph answers that had text. */
  analysis?: CommentAnalysis;
  /** Earlier results replaced by a re-run, oldest first. Kept as a record, never deleted. */
  previousAnalyses?: CommentAnalysis[];
  /**
   * Screen-only flag (never saved): the saved result failed the server's signature check, so it is
   * hidden from totals and Analytics and the response needs a re-run.
   */
  signatureFailed?: boolean;
}

export interface SurveyResponse {
  id: string;
  surveyId: string | number;
  surveyIdStr?: string;
  surveyTitle: string;
  category: string;
  userEmail: string;
  userName?: string;
  isAnonymous?: boolean;
  answers: Answer[];
  date: string;
  time?: string;
  timestamp?: number;
  academicYear?: string;
  department?: string;
  program?: string;
  year?: string;
  section?: string;
  pos?: string;
  /**
   * no_comment: no Paragraph answer had text. not_analyzable: comments were empty/joke/nonsense.
   * not_analyzed: the analysis service could not be reached; the admin can re-run it.
   * pending: saved at Submit, waiting for the server to analyze it (a few seconds). If it stays
   * pending, the admin re-runs it.
   */
  commentStatus?: "no_comment" | "analyzed" | "not_analyzable" | "not_analyzed" | "pending";
  /** Summary of the analyzable comments in this response. Missing when there were none. */
  sentimentAnalysis?: {
    sentiment: "Positive" | "Negative" | "Neutral" | "Constructive Suggestion";
    polarity?: Polarity;
    score: number;
    language: string;
    aspects?: string[];
    sarcasmDetected?: boolean;
    confidence?: number | null;
    emotion?: string;
    method?: "gemini" | "fallback";
    model?: string | null;
    promptVersion?: string;
    commentCount?: number;
  };
  /** Earlier response summaries replaced by a re-run, oldest first. */
  previousSentimentAnalyses?: Array<NonNullable<SurveyResponse["sentimentAnalysis"]>>;
  /** Set when the survey owner (or admin) flags the response; the admin decides (step 8). */
  review?: ResponseReview;
}

/**
 * A flag on a response and the admin's decision. "flagged" responses still count (the owner
 * cannot remove answers alone); "excluded" ones are never counted in Analytics; "kept" closes it.
 */
export interface ResponseReview {
  status: "flagged" | "kept" | "excluded";
  /** Plain-language reasons, e.g. "Same rating on every question". */
  reasons: string[];
  note: string;
  flaggedBy: string;
  flaggedAt: number;
  decidedBy?: string;
  decidedAt?: number;
  decisionNote?: string;
}

export interface NotificationItem {
  id: string;
  to: string;
  userEmail?: string;
  title: string;
  message: string;
  icon?: string;
  time?: string;
  displayTime?: string;
  read: boolean;
  timestamp: number;
  type?:
    | "welcome"
    | "flag"
    | "flag_cleared"
    | "survey_deleted"
    | "response"
    | "general"
    | "news"
    | "profile_update"
    | "required_survey"
    | "account_approved"
    | "account_pending"
    | "survey"
    | "survey_pending"
    | "survey_approved"
    | "survey_rejected"
    | "survey_takedown"
    | "approval";
  data?: Record<string, any>;
}

export interface ActivityLog {
  id?: string;
  time: string;
  user: string;
  pos: string;
  action: string;
  details: string;
  ip?: string;
  timestamp?: number;
}

export interface NewsAnnouncement {
  id: string;
  title: string;
  summary: string;
  content: string;
  category: "Survey Results Action" | "Campus Announcement" | "System Update" | "Policy Change";
  author: string;
  date: string;
  isPinned?: boolean;
  badgeText?: string;
  likesCount: number;
  hasRead?: boolean;
  /** Older posts have no status; only the admin can see those. */
  status?: "pending" | "published" | "rejected";
  authorEmail?: string;
  submittedAt?: number;
  reviewedBy?: string;
  reviewedAt?: number;
  rejectionReason?: string;
}

export type TimeframeFilter = "all" | "past-month" | "past-quarter" | "past-year" | string;


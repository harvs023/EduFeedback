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
   */
  commentStatus?: "no_comment" | "analyzed" | "not_analyzable" | "not_analyzed";
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

export interface TagalogMLSample {
  id: string;
  text: string;
  sentiment: "Positive" | "Negative" | "Neutral" | "Constructive Suggestion";
  aspect: string;
  language: "Tagalog" | "Taglish" | "English";
  verified: boolean;
  confidence?: number;
}

export interface TagalogMLMetrics {
  accuracy: number;
  f1Score: number;
  finalLoss: number;
  epochs: number;
  totalSamples: number;
  tagalogSamples: number;
  modelStatus: string;
  version: string;
}

export type TimeframeFilter = "all" | "past-month" | "past-quarter" | "past-year" | string;

export interface SystemBackupData {
  app: string;
  version: string;
  exportedAt: string;
  exportTimestamp: number;
  exportedBy?: string;
  stats: {
    surveysCount: number;
    responsesCount: number;
    usersCount: number;
    mlSamplesCount: number;
    logsCount: number;
    newsCount: number;
  };
  data: {
    surveys: Survey[];
    responses: SurveyResponse[];
    users: UserProfile[];
    mlDataset: TagalogMLSample[];
    logs: ActivityLog[];
    news: NewsAnnouncement[];
    categories?: string[];
  };
}

export interface DatabaseSnapshot {
  id: string;
  name: string;
  createdAt: string;
  timestamp: number;
  createdBy: string;
  stats: {
    surveysCount: number;
    responsesCount: number;
    usersCount: number;
    mlSamplesCount: number;
    logsCount: number;
    newsCount: number;
  };
  sizeBytes: number;
  data: SystemBackupData["data"];
}

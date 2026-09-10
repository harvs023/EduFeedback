export type UserRole = "student" | "officer" | "faculty" | "superadmin" | "user";
export type Position = "Student" | "Student Officer" | "Faculty" | "Superadmin";
export type AccountStatus = "active" | "suspended" | "invited";

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
}

export type SurveyStatus = "published" | "scheduled" | "draft" | "archived";
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
  // Thematic domain tags (academics, facilities, student-life, governance)
  // Note: "Trending" and "Top-Rated" are calculated dynamically from performance, not selectable themes
  themeSection?: "academics" | "facilities" | "student-life" | "governance";
  tags?: string[];
  isTrending?: boolean;
  ratingAverage?: number;
  academicYear?: string; // e.g. "2024-2025", "2025-2026"
  term?: "1st Sem" | "2nd Sem" | "Midyear";
}

export interface Answer {
  question: string;
  answer: string;
  ratingValue?: number;
}

export interface SurveyResponse {
  id: string;
  surveyId: string | number;
  surveyIdStr?: string;
  surveyTitle: string;
  category: string;
  userEmail: string;
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
  sentimentAnalysis?: {
    sentiment: "Positive" | "Negative" | "Neutral" | "Constructive Suggestion";
    score: number;
    language: string;
    aspects: string[];
  };
}

export interface NotificationItem {
  id: string;
  userEmail: string;
  title: string;
  message: string;
  icon: string;
  time: string;
  displayTime?: string;
  read: boolean;
  type: "welcome" | "flag" | "flag_cleared" | "survey_deleted" | "response" | "general" | "news" | "profile_update";
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

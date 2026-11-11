import { Survey, SurveyResponse, NewsAnnouncement, UserProfile, ActivityLog } from "../types";

export const DEPARTMENTS_DATA: Record<string, string[]> = {
  "College of Computer Studies": [
    "Bachelor of Science in Computer Science",
    "Bachelor of Science in Information Technology",
    "Bachelor of Science in Computer Engineering",
    "Associate in Computer Technology",
  ],
  "College of Accountancy": [
    "Bachelor of Science in Accountancy",
    "Bachelor of Science in Accounting Information System",
  ],
  "College of Business Administration": [
    "Bachelor of Science in Business Administration",
    "BSBA Major in Marketing Management",
    "BSBA Major in Financial Management",
    "BSBA Major in Human Resource Development Management",
    "BSBA Major in Operations Management",
  ],
  "College of Education": [
    "Bachelor of Elementary Education",
    "BSEd Major in Mathematics",
    "BSEd Major in Filipino",
    "BSEd Major in English",
    "BSEd Major in Sciences",
    "Continuing Professional Teacher Education",
  ],
  "College of Health Sciences": [
    "Bachelor of Science in Nursing",
    "Bachelor of Science in Midwifery",
  ],
  "College of Hospitality Management and Tourism": [
    "Bachelor of Science in Hospitality Management",
    "Bachelor of Science in Tourism Management",
  ],
  "College of Arts and Sciences": [
    "Bachelor of Arts in Political Science",
    "Bachelor of Arts in Psychology",
    "Bachelor of Science in Biology",
  ],
  "School of Engineering": [
    "Bachelor of Science in Mechanical Engineering",
    "Bachelor of Science in Civil Engineering",
    "Bachelor of Science in Electrical Engineering",
  ],
};

export const PROGRAMS_BY_DEPARTMENT: Record<string, string[]> = DEPARTMENTS_DATA;

// ==============================================================================
// MASTER ROOT ADMINISTRATOR CONFIGURATION
// ==============================================================================
// Dynamically loaded from environment variables (e.g. .env VITE_ADMIN_EMAIL, etc.)
// with bulletproof institutional fallbacks. This master root admin account
// is IMMUTABLE and permanently preserved across any full database wipes or resets.
export const MASTER_ADMIN_EMAIL = (
  import.meta.env?.VITE_ADMIN_EMAIL ||
  "admin@edufeedback.edu"
).trim();

export const DEFAULT_SURVEY_CATEGORIES = [
  "Course",
  "Faculty",
  "Facilities",
  "Service",
  "Student Life",
  "Governance & Policy",
  "General",
];

export const MASTER_ADMIN_NAME = (
  import.meta.env?.VITE_ADMIN_NAME ||
  "System Administrator"
).trim();

export const MASTER_ADMIN_USER: UserProfile = {
  email: MASTER_ADMIN_EMAIL,
  name: MASTER_ADMIN_NAME,
  pos: "Superadmin",
  role: "superadmin",
  status: "active",
  department: "Institutional Quality Assurance Office",
  joined: "Jan 15, 2024",
  surveys: 0,
  canCreateSurveys: true,
  canPostNews: true,
};

// Clean Default Users: ONLY the Master Root Administrator is pre-seeded
export const DEFAULT_USERS: UserProfile[] = [MASTER_ADMIN_USER];

export const SAMPLE_USERS: UserProfile[] = DEFAULT_USERS;

export const INITIAL_SURVEYS: Survey[] = [];

export const INITIAL_RESPONSES: SurveyResponse[] = [];

export const INITIAL_NEWS: NewsAnnouncement[] = [];

export const INITIAL_LOGS: ActivityLog[] = [
  {
    id: "log-1",
    time: "Oct 26, 2026, 08:00 AM",
    user: MASTER_ADMIN_EMAIL,
    pos: "Superadmin",
    action: "System Initialized",
    details: "EduFeedback Production Environment initialized with clean slate",
    ip: "127.0.0.1",
    timestamp: Date.now(),
  },
];

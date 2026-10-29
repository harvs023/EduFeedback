import { Survey, SurveyResponse, NewsAnnouncement, TagalogMLSample, UserProfile, ActivityLog } from "../types";

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

export const MASTER_ADMIN_PASSWORD = (
  import.meta.env?.VITE_ADMIN_PASSWORD ||
  ""
).trim();

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
};

// Clean Default Users: ONLY the Master Root Administrator is pre-seeded
export const DEFAULT_USERS: UserProfile[] = [MASTER_ADMIN_USER];

export interface DemoAccountCredential {
  email: string;
  name: string;
  password: string;
  pos: "Superadmin" | "Faculty" | "Student Officer" | "Student";
  role: "superadmin" | "user";
  department: string;
  program?: string;
  description: string;
  badgeLabel: string;
  badgeColor: string;
  accentColor: string;
  permissions: string[];
}

export const DEMO_ACCOUNTS_CREDENTIALS: DemoAccountCredential[] = [
  {
    email: MASTER_ADMIN_EMAIL,
    name: MASTER_ADMIN_NAME,
    password: MASTER_ADMIN_PASSWORD,
    pos: "Superadmin",
    role: "superadmin",
    department: "Institutional Quality Assurance Office",
    description: "Full administrative control: Moderate institutional surveys, manage user directory, train Tagalog sentiment NLP models, and oversee backups.",
    badgeLabel: "System Administrator",
    badgeColor: "bg-rose-50 text-rose-700 border-rose-200 ring-rose-500/20",
    accentColor: "rose",
    permissions: ["Full Administrative Control", "Audit Activity Logs", "Tagalog NLP Dataset Trainer", "Database Backup & Seeding", "User & Role Directory"],
  },
];

export const SAMPLE_USERS: UserProfile[] = DEFAULT_USERS;

export const INITIAL_SURVEYS: Survey[] = [];

export const INITIAL_RESPONSES: SurveyResponse[] = [];

export const INITIAL_NEWS: NewsAnnouncement[] = [];

export const INITIAL_TAGALOG_ML_DATASET: TagalogMLSample[] = [
  // ================= POSITIVE TRAINING PHRASES (Supplied by Admin) =================
  { id: "s1", text: "Napakagaling magpaliwanag ni Doc, malinaw ang bawat formula sa pisara.", sentiment: "Positive", aspect: "Pagtuturo", language: "Tagalog", verified: true },
  { id: "s4", text: "Mabait at approachable ang mga librarian kapag humihiram ng thesis reference.", sentiment: "Positive", aspect: "Aklatan", language: "Tagalog", verified: true },
  { id: "s9", text: "The best prof in CS department! Very inspiring and fair magbigay ng grades.", sentiment: "Positive", aspect: "Pagtuturo", language: "Taglish", verified: true },
  { id: "s12", text: "Mabilis sumagot ang registrar sa email inquiry ko patungkol sa TOR.", sentiment: "Positive", aspect: "Administrasyon", language: "Taglish", verified: true },
  { id: "s15", text: "Napakasaya ng campus week activities at maayos ang crowd control ng security guards.", sentiment: "Positive", aspect: "Student Welfare", language: "Tagalog", verified: true },
  { id: "s16", text: "The professor provides comprehensive coding examples and encourages interactive questions.", sentiment: "Positive", aspect: "Pagtuturo", language: "English", verified: true },
  { id: "s19", text: "The student portal is intuitive and course registration was completed without errors.", sentiment: "Positive", aspect: "Administrasyon", language: "English", verified: true },
  { id: "s21", text: "Course syllabus is well-structured with reasonable deadlines for programming projects.", sentiment: "Positive", aspect: "Kurso", language: "English", verified: true },
  { id: "s23", text: "Guidance counseling staff were empathetic and provided helpful stress management tools.", sentiment: "Positive", aspect: "Student Welfare", language: "English", verified: true },
  { id: "s24", text: "Malinis at malamig ang computer lab 4, maayos ang ventilation at bago ang mga mouse.", sentiment: "Positive", aspect: "Pasilidad", language: "Taglish", verified: true },
  { id: "s25", text: "Mura at masustansya ang meals sa bagong food stalls sa ground canteen.", sentiment: "Positive", aspect: "Canteen", language: "Tagalog", verified: true },
  { id: "s26", text: "Mabilis at maaasahan ang Wi-Fi sa library 2nd floor, nakapag-download ako ng research papers.", sentiment: "Positive", aspect: "Internet / Wi-Fi", language: "Taglish", verified: true },
  { id: "s27", text: "Excellent faculty mentorship during our capstone design defense.", sentiment: "Positive", aspect: "Pagtuturo", language: "English", verified: true },
  { id: "s28", text: "Prompt response from clinic nurses when my classmate felt dizzy during lab.", sentiment: "Positive", aspect: "Student Welfare", language: "English", verified: true },
  { id: "s29", text: "Maasikaso ang accounting office sa scholarship vouchers validation.", sentiment: "Positive", aspect: "Administrasyon", language: "Tagalog", verified: true },
  { id: "s30", text: "Maganda ang illumination at tahimik ang silent study area sa 3rd floor.", sentiment: "Positive", aspect: "Aklatan", language: "Tagalog", verified: true },

  // ================= NEGATIVE TRAINING PHRASES (Supplied by Admin) =================
  { id: "s2", text: "Sobrang bagal ng internet sa 3rd floor, hindi makapag-submit ng lab activity.", sentiment: "Negative", aspect: "Internet / Wi-Fi", language: "Taglish", verified: true },
  { id: "s5", text: "Ang mahal ng pagkain sa canteen pero maliit ang serving size.", sentiment: "Negative", aspect: "Canteen", language: "Tagalog", verified: true },
  { id: "s8", text: "Palaging delay mag-release ng class advisory ang admin office.", sentiment: "Negative", aspect: "Administrasyon", language: "Taglish", verified: true },
  { id: "s10", text: "Sira ang mga upuan sa dulo ng room, may nakausling pako na delikado sa students.", sentiment: "Negative", aspect: "Kagamitan", language: "Tagalog", verified: true },
  { id: "s14", text: "Kulang sa gamit sa chemistry laboratory, naghihiraman pa ng beakers at test tubes.", sentiment: "Negative", aspect: "Kagamitan", language: "Tagalog", verified: true },
  { id: "s17", text: "Wi-Fi connectivity in the engineering annex frequently drops during online examinations.", sentiment: "Negative", aspect: "Internet / Wi-Fi", language: "English", verified: true },
  { id: "s22", text: "Laboratory computers need upgraded RAM for running virtual machines smoothly.", sentiment: "Negative", aspect: "Kagamitan", language: "English", verified: true },
  { id: "s31", text: "Napakainit sa room 305, sira ang ceiling fan at hindi gumagana ang bintana.", sentiment: "Negative", aspect: "Pasilidad", language: "Tagalog", verified: true },
  { id: "s32", text: "Mabagal mag-load ang student portal tuwing enrollment rush, laging nagka-crash ang server.", sentiment: "Negative", aspect: "Administrasyon", language: "Taglish", verified: true },
  { id: "s33", text: "The cashier line took over 2 hours because only two payment windows were open.", sentiment: "Negative", aspect: "Administrasyon", language: "English", verified: true },
  { id: "s34", text: "Unfair grading system with no rubrics provided for the final project submission.", sentiment: "Negative", aspect: "Pagtuturo", language: "English", verified: true },
  { id: "s35", text: "Barado ang drainage sa banyo ng science building, mabaho at madulas.", sentiment: "Negative", aspect: "Pasilidad", language: "Tagalog", verified: true },
  { id: "s36", text: "Hindi dumarating sa tamang oras ang prof sa morning lecture, nasasayang ang schedule.", sentiment: "Negative", aspect: "Pagtuturo", language: "Taglish", verified: true },
  { id: "s37", text: "Lack of updated textbooks in the engineering reference section of the main library.", sentiment: "Negative", aspect: "Aklatan", language: "English", verified: true },
  { id: "s38", text: "Mahina ang signal ng Wi-Fi sa gymnasium at student lounge.", sentiment: "Negative", aspect: "Internet / Wi-Fi", language: "Taglish", verified: true },
  { id: "s39", text: "Cold food served in the kiosk and no microwave available for students.", sentiment: "Negative", aspect: "Canteen", language: "English", verified: true },

  // ================= CONSTRUCTIVE SUGGESTIONS (Supplied by Admin) =================
  { id: "s3", text: "Sana po madagdagan ang ventilation o aircon sa room 402 dahil napakainit kapag tanghali.", sentiment: "Constructive Suggestion", aspect: "Pasilidad", language: "Taglish", verified: true },
  { id: "s7", text: "Dapat maglagay ng water refilling station sa bawat building para tipid sa baon.", sentiment: "Constructive Suggestion", aspect: "Pasilidad", language: "Taglish", verified: true },
  { id: "s11", text: "Maganda sana kung may recorded sessions ang online lecture para mabalikan.", sentiment: "Constructive Suggestion", aspect: "Pagtuturo", language: "Taglish", verified: true },
  { id: "s18", text: "Please consider adding more quiet discussion booths on the library third floor.", sentiment: "Constructive Suggestion", aspect: "Pasilidad", language: "English", verified: true },
  { id: "s20", text: "Air conditioning units in Lab 2 need scheduled filter cleaning and maintenance.", sentiment: "Constructive Suggestion", aspect: "Pasilidad", language: "English", verified: true },
  { id: "s40", text: "Sana magkaroon ng online payment option tulad ng GCash o Maya sa cashier para iwas pila.", sentiment: "Constructive Suggestion", aspect: "Administrasyon", language: "Taglish", verified: true },
  { id: "s41", text: "Dapat maglagay ng additional electrical sockets sa bawat study desk sa library para sa laptops.", sentiment: "Constructive Suggestion", aspect: "Aklatan", language: "Taglish", verified: true },
  { id: "s42", text: "We suggest holding optional tutoring or peer study groups before departmental midterms.", sentiment: "Constructive Suggestion", aspect: "Pagtuturo", language: "English", verified: true },
  { id: "s43", text: "Sana i-extend ang library closing time hanggang 10:00 PM tuwing midterm at finals examination weeks.", sentiment: "Constructive Suggestion", aspect: "Aklatan", language: "Taglish", verified: true },
  { id: "s44", text: "Please provide standardized laboratory rubric guides at the beginning of the semester.", sentiment: "Constructive Suggestion", aspect: "Kurso", language: "English", verified: true },
  { id: "s45", text: "Mungkahi po na maglagay ng covered walkway mula main gate hanggang student center kapag maulan.", sentiment: "Constructive Suggestion", aspect: "Pasilidad", language: "Tagalog", verified: true },
  { id: "s46", text: "Could the IT department provide student license vouchers for cloud computing software?", sentiment: "Constructive Suggestion", aspect: "Kagamitan", language: "English", verified: true },
  { id: "s47", text: "Sana magdagdag ng healthy salad at vegetarian choices sa university canteen.", sentiment: "Constructive Suggestion", aspect: "Canteen", language: "Taglish", verified: true },
  { id: "s48", text: "Recommend installing digital queue monitors outside the registrar and dean's offices.", sentiment: "Constructive Suggestion", aspect: "Administrasyon", language: "English", verified: true },

  // ================= NEUTRAL / INFORMATIVE PHRASES (Supplied by Admin) =================
  { id: "s6", text: "Maayos naman ang pacing ng klase, sakto lang para makahabol ang lahat.", sentiment: "Neutral", aspect: "Kurso", language: "Taglish", verified: true },
  { id: "s13", text: "Neutral lang ako sa bagong uniform policy, walang gaanong pagbabago.", sentiment: "Neutral", aspect: "Polisiya", language: "Taglish", verified: true },
  { id: "s49", text: "The class follows the standard syllabus provided during orientation week.", sentiment: "Neutral", aspect: "Kurso", language: "English", verified: true },
  { id: "s50", text: "Submitted the evaluation according to the departmental timeline.", sentiment: "Neutral", aspect: "Administrasyon", language: "English", verified: true },
  { id: "s51", text: "Walang gaanong pagbabago sa pasilidad kumpara noong nakaraang semestre.", sentiment: "Neutral", aspect: "Pasilidad", language: "Tagalog", verified: true },
  { id: "s52", text: "Standard academic procedures were followed during our laboratory sessions.", sentiment: "Neutral", aspect: "Kurso", language: "English", verified: true },
  { id: "s53", text: "Average facilities, identical to the previous academic school year.", sentiment: "Neutral", aspect: "Pasilidad", language: "English", verified: true },
  { id: "s54", text: "Normal lang ang takbo ng lecture at natatapos sa takdang oras.", sentiment: "Neutral", aspect: "Pagtuturo", language: "Tagalog", verified: true },
  { id: "s55", text: "Received official notification regarding the schedule adjustment.", sentiment: "Neutral", aspect: "Administrasyon", language: "English", verified: true },
];

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

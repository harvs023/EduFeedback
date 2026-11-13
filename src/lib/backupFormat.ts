/**
 * The full backup file (made and restored by the server, see server/backup.ts).
 * Shared by the browser (to check a file and show what is in it before restoring) and the
 * server (to check it again before changing anything).
 */
export const BACKUP_FORMAT = "edufeedback-full-backup";
export const BACKUP_VERSION = 1;

/** Top-level collections included in a backup. */
export const TOP_COLLECTIONS = [
  "users",
  "surveys",
  "responses",
  "topics",
  "news",
  "notifications",
  "logs",
  "academic_calendar",
  "settings",
  "evaluation_runs",
] as const;

/** Private per-person lists stored under each user profile. */
export const USER_SUBCOLLECTIONS = ["receipts", "newsLikes"] as const;

/** Old collections that a restore clears but never writes. */
export const RETIRED_COLLECTIONS = ["ml_dataset"] as const;

/** Every group of documents in a backup, in display order. */
export const BACKUP_GROUPS = [
  "users",
  "users/receipts",
  "users/newsLikes",
  "surveys",
  "responses",
  "topics",
  "news",
  "notifications",
  "logs",
  "academic_calendar",
  "settings",
  "evaluation_runs",
] as const;

export type BackupGroup = (typeof BACKUP_GROUPS)[number];

export const BACKUP_GROUP_LABELS: Record<BackupGroup, string> = {
  users: "User profiles",
  "users/receipts": '"Already answered" records',
  "users/newsLikes": "News likes",
  surveys: "Surveys",
  responses: "Responses",
  topics: "Topics",
  news: "News posts",
  notifications: "Notifications",
  logs: "Activity log entries",
  academic_calendar: "School years (calendar)",
  settings: "App settings",
  evaluation_runs: "Saved evaluation results",
};

export const MAX_BACKUP_DOCUMENTS = 200_000;

export interface BackupFile {
  format: typeof BACKUP_FORMAT;
  version: number;
  createdAt: number;
  createdBy: string;
  projectId: string;
  counts: Record<BackupGroup, number>;
  /** Every document, keyed by its path, e.g. "surveys/abc" or "users/x/receipts/abc". */
  documents: Record<string, Record<string, unknown>>;
}

function validId(id: string): boolean {
  return id.length > 0 && id.length <= 700 && id !== "." && id !== ".." && !/^__.*__$/.test(id);
}

/** Which group a document path belongs to, or null if the path is not allowed in a backup. */
export function groupOfPath(path: string): BackupGroup | null {
  const parts = path.split("/");
  if (!parts.every(validId)) return null;
  if (parts.length === 2 && (TOP_COLLECTIONS as readonly string[]).includes(parts[0])) {
    return parts[0] as BackupGroup;
  }
  if (parts.length === 4 && parts[0] === "users" && (USER_SUBCOLLECTIONS as readonly string[]).includes(parts[2])) {
    return `users/${parts[2]}` as BackupGroup;
  }
  return null;
}

export function emptyCounts(): Record<BackupGroup, number> {
  return Object.fromEntries(BACKUP_GROUPS.map((g) => [g, 0])) as Record<BackupGroup, number>;
}

export type BackupCheck =
  | { ok: true; backup: BackupFile; counts: Record<BackupGroup, number>; total: number }
  | { ok: false; error: string };

/** Checks a parsed backup file completely. Nothing is changed when this fails. */
export function checkBackup(raw: unknown): BackupCheck {
  const notBackup = { ok: false as const, error: "This file is not an EduFeedback backup." };
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return notBackup;
  const b = raw as Partial<BackupFile> & { app?: unknown; data?: unknown };

  if (b.format !== BACKUP_FORMAT) {
    if (b.app && b.data) {
      return {
        ok: false,
        error:
          'This backup was made by an older version of EduFeedback. It is missing parts such as the "already answered" records, so it cannot be restored safely. Make a new backup with the Download button.',
      };
    }
    return notBackup;
  }
  if (b.version !== BACKUP_VERSION) {
    return {
      ok: false,
      error: `This backup uses format version ${String(b.version)}. This version of EduFeedback can only restore version ${BACKUP_VERSION}.`,
    };
  }
  if (typeof b.createdAt !== "number" || typeof b.createdBy !== "string" || typeof b.projectId !== "string") {
    return { ok: false, error: "The backup's header (date, made by, project) is missing or damaged." };
  }
  const docs = b.documents;
  if (!docs || typeof docs !== "object" || Array.isArray(docs)) {
    return { ok: false, error: "The backup has no data section. The file may be damaged." };
  }

  const paths = Object.keys(docs);
  if (paths.length > MAX_BACKUP_DOCUMENTS) {
    return { ok: false, error: `The backup has more than ${MAX_BACKUP_DOCUMENTS.toLocaleString()} items, which is more than this tool supports.` };
  }

  const counts = emptyCounts();
  for (const path of paths) {
    const group = groupOfPath(path);
    if (!group) {
      return { ok: false, error: `The file contains an unexpected item "${path.slice(0, 80)}". It may have been edited or damaged.` };
    }
    const data = docs[path];
    if (!data || typeof data !== "object" || Array.isArray(data)) {
      return { ok: false, error: `The item "${path.slice(0, 80)}" is damaged.` };
    }
    counts[group]++;
  }

  if (counts.users === 0) {
    return { ok: false, error: "The backup has no user profiles, so it is probably incomplete." };
  }
  for (const group of BACKUP_GROUPS) {
    if (b.counts?.[group] !== counts[group]) {
      return {
        ok: false,
        error: "The numbers recorded in the backup do not match its contents. The file may be incomplete or edited.",
      };
    }
  }
  return { ok: true, backup: b as BackupFile, counts, total: paths.length };
}

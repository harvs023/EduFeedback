import { Timestamp, type Firestore } from "firebase-admin/firestore";
import appletConfig from "../firebase-applet-config.json";
import type { UserProfile } from "../src/types";
import {
  BACKUP_FORMAT,
  BACKUP_VERSION,
  RETIRED_COLLECTIONS,
  TOP_COLLECTIONS,
  USER_SUBCOLLECTIONS,
  checkBackup,
  emptyCounts,
  groupOfPath,
  type BackupFile,
} from "../src/lib/backupFormat";
import { adminDb } from "./firestoreAdmin";

/**
 * Full backup and "wipe and restore", done on the server with the service account because the
 * browser cannot see everything (each person's private "already answered" records and likes)
 * and the security rules rightly stop anyone, even the admin, from creating other people's
 * responses. Admin only. No security rule is changed or bypassed for anyone else.
 */

const emailKey = (email: string) => email.trim().toLowerCase().replace(/[^a-z0-9_-]/g, "_");

export type AdminCheck = { ok: true; db: Firestore; email: string } | { ok: false; status: number; error: string };

/** The caller must be an active admin (checked in the database, not trusted from the browser). */
export async function requireAdmin(callerEmail: string): Promise<AdminCheck> {
  const db = adminDb();
  if (!db) {
    return { ok: false, status: 503, error: "The server cannot reach the database (the service account key is missing or wrong)." };
  }
  const email = callerEmail.trim().toLowerCase();
  if (!email) return { ok: false, status: 401, error: "Please sign in again." };
  const profile = (await db.collection("users").doc(emailKey(email)).get()).data() as UserProfile | undefined;
  if (!profile || profile.status !== "active" || profile.role !== "superadmin") {
    return { ok: false, status: 403, error: "Only the admin can do this." };
  }
  return { ok: true, db, email };
}

/** Firestore dates are not plain JSON; keep them recognisable in the file. */
function encode(value: unknown): unknown {
  if (value instanceof Timestamp) return { __type: "timestamp", seconds: value.seconds, nanoseconds: value.nanoseconds };
  if (Array.isArray(value)) return value.map(encode);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([k, v]) => [k, encode(v)]));
  }
  return value;
}

function decode(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(decode);
  if (value && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    if (obj.__type === "timestamp" && typeof obj.seconds === "number" && typeof obj.nanoseconds === "number") {
      return new Timestamp(obj.seconds, obj.nanoseconds);
    }
    return Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, decode(v)]));
  }
  return value;
}

/** Every document path currently in the database that a restore manages (paths only, no data). */
async function currentPaths(db: Firestore): Promise<string[]> {
  const paths: string[] = [];
  for (const name of [...TOP_COLLECTIONS, ...RETIRED_COLLECTIONS]) {
    const snap = await db.collection(name).select().get();
    snap.docs.forEach((d) => paths.push(d.ref.path));
  }
  for (const sub of USER_SUBCOLLECTIONS) {
    const snap = await db.collectionGroup(sub).select().get();
    snap.docs.forEach((d) => {
      if (groupOfPath(d.ref.path) === `users/${sub}`) paths.push(d.ref.path);
    });
  }
  return paths;
}

export async function makeBackup(db: Firestore, adminEmail: string): Promise<BackupFile> {
  const documents: BackupFile["documents"] = {};
  const counts = emptyCounts();
  const add = (path: string, data: Record<string, unknown>) => {
    const group = groupOfPath(path);
    if (!group) return;
    documents[path] = encode(data) as Record<string, unknown>;
    counts[group]++;
  };
  for (const name of TOP_COLLECTIONS) {
    const snap = await db.collection(name).get();
    snap.docs.forEach((d) => add(d.ref.path, d.data()));
  }
  for (const sub of USER_SUBCOLLECTIONS) {
    const snap = await db.collectionGroup(sub).get();
    snap.docs.forEach((d) => add(d.ref.path, d.data()));
  }
  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    createdAt: Date.now(),
    createdBy: adminEmail,
    projectId: appletConfig.projectId,
    counts,
    documents,
  };
}

let restoring = false;

export type RestoreResult =
  | { ok: true; written: number; deleted: number; failed: number }
  | { ok: false; status: number; error: string };

/**
 * Replaces the database with the backup: every document in the file is written exactly as saved,
 * then every document that is not in the file is deleted. Writing first means the database is
 * never left empty halfway. The calling admin's own profile is kept as it is now.
 */
export async function restoreBackup(db: Firestore, adminEmail: string, raw: unknown): Promise<RestoreResult> {
  if (restoring) return { ok: false, status: 409, error: "A restore is already running. Please wait for it to finish." };
  const check = checkBackup(raw);
  if (!check.ok) return { ok: false, status: 400, error: check.error };

  restoring = true;
  try {
    const adminPath = `users/${emailKey(adminEmail)}`;
    const adminProfile = (await db.doc(adminPath).get()).data();
    const existing = await currentPaths(db);
    const incoming = check.backup.documents;

    let failed = 0;
    const writer = db.bulkWriter();
    writer.onWriteError((err) => {
      if (err.failedAttempts < 3) return true;
      failed++;
      console.error("[Restore] Could not write", err.documentRef.path, err.message);
      return false;
    });

    let written = 0;
    for (const [path, data] of Object.entries(incoming)) {
      if (path === adminPath) continue;
      void writer.set(db.doc(path), decode(data) as Record<string, unknown>).catch(() => undefined);
      written++;
    }
    if (adminProfile) void writer.set(db.doc(adminPath), adminProfile).catch(() => undefined);

    let deleted = 0;
    for (const path of existing) {
      if (path === adminPath || Object.prototype.hasOwnProperty.call(incoming, path)) continue;
      void writer.delete(db.doc(path)).catch(() => undefined);
      deleted++;
    }
    await writer.close();

    const now = Date.now();
    await db
      .collection("logs")
      .add({
        time: new Date(now).toLocaleString(),
        timestamp: now,
        user: adminEmail,
        pos: "Superadmin",
        action: "Database Restored",
        details: `Database replaced with the backup made on ${new Date(check.backup.createdAt).toLocaleString()} (${written} items written, ${deleted} removed, ${failed} failed).`,
      })
      .catch(() => undefined);

    return { ok: true, written, deleted, failed };
  } finally {
    restoring = false;
  }
}

/** Logs that a backup was downloaded (who and when; the file itself is not stored). */
export async function logBackup(db: Firestore, adminEmail: string, total: number): Promise<void> {
  const now = Date.now();
  await db
    .collection("logs")
    .add({
      time: new Date(now).toLocaleString(),
      timestamp: now,
      user: adminEmail,
      pos: "Superadmin",
      action: "Backup Downloaded",
      details: `Full backup downloaded (${total} items).`,
    })
    .catch(() => undefined);
}

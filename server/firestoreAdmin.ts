import fs from "fs";
import { cert, getApps, initializeApp, type ServiceAccount } from "firebase-admin/app";
import { getFirestore, type Firestore } from "firebase-admin/firestore";
import appletConfig from "../firebase-applet-config.json";

/**
 * Server-only connection to Firestore with a service account, so the server can save sentiment
 * results into a response itself (the respondent's browser is not allowed to change a saved
 * response). It bypasses the security rules, so it is used for that one job only.
 *
 * The key comes from FIREBASE_SERVICE_ACCOUNT_FILE (path to the downloaded JSON file) or
 * FIREBASE_SERVICE_ACCOUNT_JSON (the file's contents, for hosting services). Never a VITE_ setting,
 * never committed.
 */
let db: Firestore | null = null;
let lastError: string | null = null;

/**
 * .env readers turn the key's "\n" into real line breaks, which JSON does not allow inside text.
 * Put them back as "\n" (only inside quoted text; line breaks between fields are fine).
 */
function parsePastedJson(raw: string): any {
  try {
    return JSON.parse(raw);
  } catch {
    let out = "";
    let inString = false;
    for (let i = 0; i < raw.length; i++) {
      const ch = raw[i];
      if (inString && ch === "\\") {
        out += ch + (raw[i + 1] ?? "");
        i++;
        continue;
      }
      if (ch === '"') inString = !inString;
      if (inString && ch === "\r") continue;
      out += inString && ch === "\n" ? "\\n" : ch;
    }
    return JSON.parse(out);
  }
}

function readServiceAccount(): ServiceAccount & { project_id?: string } {
  const inline = (process.env.FIREBASE_SERVICE_ACCOUNT_JSON || "").trim();
  if (inline) return parsePastedJson(inline.replace(/^'|'$/g, ""));
  const file = (process.env.FIREBASE_SERVICE_ACCOUNT_FILE || "").trim().replace(/^["']|["']$/g, "");
  if (!file) throw new Error("FIREBASE_SERVICE_ACCOUNT_FILE is not set.");
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

/** The admin Firestore connection, or null if the key is missing or wrong (see adminError()). */
export function adminDb(): Firestore | null {
  if (db) return db;
  try {
    const account = readServiceAccount();
    if (account.project_id && account.project_id !== appletConfig.projectId) {
      throw new Error(
        `The service account belongs to project "${account.project_id}", but the app uses "${appletConfig.projectId}".`
      );
    }
    const app = getApps()[0] || initializeApp({ credential: cert(account), projectId: appletConfig.projectId });
    // The (default) database, the same one the app uses.
    db = getFirestore(app);
    db.settings({ ignoreUndefinedProperties: true });
    lastError = null;
    return db;
  } catch (err: any) {
    lastError = err?.message || String(err);
    return null;
  }
}

export function adminReady(): boolean {
  return adminDb() !== null;
}

export function adminError(): string | null {
  adminDb();
  return lastError;
}

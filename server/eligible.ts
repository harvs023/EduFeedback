import type { Survey, UserProfile } from "../src/types";
import { countEligibleUsers, eligibilityCutoff } from "../src/lib/surveyReview";
import { adminDb } from "./firestoreAdmin";

/**
 * How many people a survey is for, counted on the server so survey owners get an up-to-date
 * number without being allowed to read the user list. Only the number leaves the server.
 */
const CACHE_MS = 5 * 60 * 1000;
const cache = new Map<string, { at: number; eligible: number; cutoff: number | null }>();

const emailKey = (email: string) => email.trim().toLowerCase().replace(/[^a-z0-9_-]/g, "_");

export type EligibleResult =
  | { ok: true; eligible: number; cutoff: number | null }
  | { ok: false; status: number; error: string };

export async function eligibleCountFor(surveyId: string, callerEmail: string): Promise<EligibleResult> {
  const db = adminDb();
  if (!db) return { ok: false, status: 503, error: "The server cannot read the database yet." };
  const me = callerEmail.trim().toLowerCase();

  const surveySnap = await db.collection("surveys").doc(surveyId).get();
  if (!surveySnap.exists) return { ok: false, status: 404, error: "Survey not found." };
  const survey = { ...(surveySnap.data() as Survey), id: surveyId };

  // Only the survey's owner or an active admin may ask.
  if ((survey.owner || "").trim().toLowerCase() !== me) {
    const profile = (await db.collection("users").doc(emailKey(me)).get()).data() as UserProfile | undefined;
    if (!profile || profile.status !== "active" || profile.role !== "superadmin") {
      return { ok: false, status: 403, error: "Only the survey owner or the admin can see this." };
    }
  }

  const cutoff = eligibilityCutoff(survey);
  const cached = cache.get(surveyId);
  if (cached && Date.now() - cached.at < CACHE_MS && cached.cutoff === cutoff) {
    return { ok: true, eligible: cached.eligible, cutoff };
  }
  // Only the fields the count needs; names and other profile details are not even loaded.
  const usersSnap = await db.collection("users").select("email", "status", "pos", "joined").get();
  const users = usersSnap.docs.map((d) => d.data() as Pick<UserProfile, "email" | "status" | "pos" | "joined">);
  const eligible = countEligibleUsers(survey, users, cutoff);
  cache.set(surveyId, { at: Date.now(), eligible, cutoff });
  return { ok: true, eligible, cutoff };
}

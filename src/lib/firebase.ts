/**
 * ==============================================================================
 * FIREBASE DATABASE & AUTHENTICATION CONFIGURATION
 * ==============================================================================
 * Production-ready Firebase Firestore Database and Firebase Authentication service.
 * Supports environment variables (VITE_FIREBASE_*) with automatic fallback when
 * running in offline or local mode.
 */

import { initializeApp, getApps, getApp, FirebaseApp } from "firebase/app";
import {
  initializeFirestore,
  collection,
  getDocs,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  deleteField,
  increment,
  writeBatch,
  query,
  where,
  orderBy,
  limit,
  Firestore,
} from "firebase/firestore";
import {
  getAuth,
  Auth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  deleteUser,
  sendPasswordResetEmail,
  sendEmailVerification,
  User as FirebaseUser,
} from "firebase/auth";
import {
  Survey,
  SurveyResponse,
  UserProfile,
  NewsAnnouncement,
  ActivityLog,
  NotificationItem,
  Topic,
  AcademicYearTerms,
  EvaluationRun,
  ResponseReview,
  AppSettings,
  SchoolLists,
  SurveyReport,
  SurveyTopicBlock,
  TopicMoveRecord,
  ProfileChangeRequest,
} from "../types";
import appletConfig from "../../firebase-applet-config.json";

// Firebase Web Configuration loaded from applet config and environment variables
export const firebaseConfig = {
  apiKey: appletConfig.apiKey || import.meta.env.VITE_FIREBASE_API_KEY || "",
  authDomain: appletConfig.authDomain || import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "",
  projectId: appletConfig.projectId || import.meta.env.VITE_FIREBASE_PROJECT_ID || "",
  storageBucket: appletConfig.storageBucket || import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "",
  messagingSenderId: appletConfig.messagingSenderId || import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "",
  appId: appletConfig.appId || import.meta.env.VITE_FIREBASE_APP_ID || "",
};

export const firestoreDatabaseId: string =
  appletConfig.firestoreDatabaseId ||
  import.meta.env.VITE_FIREBASE_DATABASE_ID ||
  "";

/**
 * Check if the user has provided valid Firebase configuration keys.
 */
export function isFirebaseConfigured(): boolean {
  return (
    Boolean(firebaseConfig.apiKey) &&
    firebaseConfig.apiKey !== "YOUR_API_KEY_HERE" &&
    firebaseConfig.apiKey.length > 5 &&
    Boolean(firebaseConfig.projectId) &&
    firebaseConfig.projectId !== "your-project-id" &&
    firebaseConfig.projectId !== "remixed-project-id"
  );
}

// Lazy initialization of Firebase to prevent crashes if credentials are blank
let app: FirebaseApp | null = null;
let db: Firestore | null = null;
let auth: Auth | null = null;

export function getFirebaseApp(): FirebaseApp | null {
  if (!isFirebaseConfigured()) return null;
  if (!app) {
    app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
  }
  return app;
}

export function getFirebaseDb(): Firestore | null {
  if (!db) {
    const firebaseApp = getFirebaseApp();
    if (firebaseApp) {
      db = firestoreDatabaseId
        ? initializeFirestore(firebaseApp, { ignoreUndefinedProperties: true }, firestoreDatabaseId)
        : initializeFirestore(firebaseApp, { ignoreUndefinedProperties: true });
    }
  }
  return db;
}

export function getFirebaseAuth(): Auth | null {
  if (!auth) {
    const firebaseApp = getFirebaseApp();
    if (firebaseApp) {
      auth = getAuth(firebaseApp);
    }
  }
  return auth;
}

/**
 * Executes a fetch request with the current user's auth.currentUser.getIdToken()
 * as the Bearer token in the Authorization header.
 */
export async function authFetch(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
  const authInstance = getFirebaseAuth();
  let token = "";
  if (authInstance?.currentUser) {
    try {
      token = await authInstance.currentUser.getIdToken();
    } catch (e) {
      console.warn("Failed to retrieve Firebase ID token:", e);
    }
  }

  const headers = new Headers(init.headers || {});
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  return fetch(input, {
    ...init,
    headers,
  });
}

// Error handling conforming to Firebase Integration Skill
export enum OperationType {
  CREATE = "create",
  UPDATE = "update",
  DELETE = "delete",
  LIST = "list",
  GET = "get",
  WRITE = "write",
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const currentAuth = getFirebaseAuth();
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: currentAuth?.currentUser?.uid || null,
      email: currentAuth?.currentUser?.email || null,
      emailVerified: currentAuth?.currentUser?.emailVerified || null,
      isAnonymous: currentAuth?.currentUser?.isAnonymous || null,
    },
    operationType,
    path,
  };
  console.error("Firestore Error: ", JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Firestore Collection Names
export const COLLECTIONS = {
  SURVEYS: "surveys",
  RESPONSES: "responses",
  USERS: "users",
  NEWS: "news",
  ML_DATASET: "ml_dataset",
  LOGS: "logs",
  NOTIFICATIONS: "notifications",
  TOPICS: "topics",
  ACADEMIC_CALENDAR: "academic_calendar",
  EVALUATION_RUNS: "evaluation_runs",
  SETTINGS: "settings",
  SCHOOL_SETUP: "school_setup",
  SURVEY_REPORTS: "survey_reports",
  PROFILE_REQUESTS: "profile_requests",
};

/**
 * Firebase Authentication Service
 */
export const FirebaseAuthService = {
  async signIn(email: string, pass: string): Promise<FirebaseUser | null> {
    const authInstance = getFirebaseAuth();
    if (!authInstance) return null;
    const cred = await signInWithEmailAndPassword(authInstance, email, pass);
    return cred.user;
  },

  async register(email: string, pass: string): Promise<FirebaseUser | null> {
    const authInstance = getFirebaseAuth();
    if (!authInstance) return null;
    const cred = await createUserWithEmailAndPassword(authInstance, email, pass);
    return cred.user;
  },

  async signOut(): Promise<void> {
    const authInstance = getFirebaseAuth();
    if (!authInstance) return;
    await signOut(authInstance);
  },

  /** Firebase emails the person a link to choose a new password (nobody else sees the password). */
  async sendPasswordReset(email: string): Promise<void> {
    const authInstance = getFirebaseAuth();
    if (!authInstance) throw new Error("Sign-in is not available.");
    await sendPasswordResetEmail(authInstance, email.trim().toLowerCase());
  },

  /** True when the signed-in person has clicked the verification link Firebase emailed them. */
  isEmailVerified(): boolean {
    return getFirebaseAuth()?.currentUser?.emailVerified === true;
  },

  /** Emails the signed-in person a link to verify their address (opens this app afterwards). */
  async sendVerificationEmail(): Promise<void> {
    const user = getFirebaseAuth()?.currentUser;
    if (!user) throw new Error("Please sign in again.");
    try {
      await sendEmailVerification(user, { url: window.location.origin });
    } catch (err: any) {
      // The app's address may not be on Firebase's list of allowed sites: send the plain link instead.
      if (String(err?.code || "").includes("unauthorized-continue-uri") || String(err?.code || "").includes("invalid-continue-uri")) {
        await sendEmailVerification(user);
      } else {
        throw err;
      }
    }
  },

  /** Asks Firebase again and refreshes the sign-in token, so the security rules see the new state. */
  async refreshEmailVerified(): Promise<boolean> {
    const user = getFirebaseAuth()?.currentUser;
    if (!user) return false;
    await user.reload();
    const fresh = getFirebaseAuth()?.currentUser;
    if (!fresh?.emailVerified) return false;
    await fresh.getIdToken(true);
    return true;
  },

  /** Removes the login that was just created (used when saving the profile fails). */
  async deleteCurrentUser(): Promise<void> {
    const authInstance = getFirebaseAuth();
    if (!authInstance?.currentUser) return;
    await deleteUser(authInstance.currentUser);
  },

  onAuthChanged(callback: (user: FirebaseUser | null) => void) {
    const authInstance = getFirebaseAuth();
    if (!authInstance) {
      callback(null);
      return () => {};
    }
    return onAuthStateChanged(authInstance, callback);
  },
};

/**
 * Firestore Surveys Collection Service
 */
export const FirestoreSurveyService = {
  async getSurveys(currentUser?: UserProfile | null): Promise<Survey[]> {
    const firestore = getFirebaseDb();
    if (!firestore) return [];

    const isSuperadmin =
      currentUser?.role === "superadmin" || currentUser?.pos === "Superadmin";

    if (isSuperadmin) {
      try {
        const snap = await getDocs(collection(firestore, COLLECTIONS.SURVEYS));
        return snap.docs.map((docSnap) => ({
          id: docSnap.id,
          ...docSnap.data(),
        })) as Survey[];
      } catch (err) {
        handleFirestoreError(err, OperationType.LIST, COLLECTIONS.SURVEYS);
        return [];
      }
    }

    const userEmail = (currentUser?.email || "").trim().toLowerCase();
    const results: Survey[] = [];
    const seenIds = new Set<string>();

    // Query 1: where("status", "in", ["published", "scheduled"])
    try {
      const q1 = query(
        collection(firestore, COLLECTIONS.SURVEYS),
        where("status", "in", ["published", "scheduled"])
      );
      const snap1 = await getDocs(q1);
      for (const docSnap of snap1.docs) {
        const id = docSnap.id;
        if (!seenIds.has(id)) {
          seenIds.add(id);
          results.push({ id, ...docSnap.data() } as Survey);
        }
      }
    } catch (err) {
      console.warn("Firestore public/scheduled surveys query failed:", err);
    }

    // Query 2: where("owner", "==", userEmail)
    if (userEmail) {
      try {
        const q2 = query(
          collection(firestore, COLLECTIONS.SURVEYS),
          where("owner", "==", userEmail)
        );
        const snap2 = await getDocs(q2);
        for (const docSnap of snap2.docs) {
          const id = docSnap.id;
          if (!seenIds.has(id)) {
            seenIds.add(id);
            results.push({ id, ...docSnap.data() } as Survey);
          }
        }
      } catch (err) {
        console.warn("Firestore owner surveys query failed:", err);
      }
    }

    return results;
  },

  async getAll(currentUser?: UserProfile | null): Promise<Survey[]> {
    return this.getSurveys(currentUser);
  },

  /** Admin: change only the topic blocks of a survey (topics and topic requests). Questions stay untouched. */
  async updateTopicBlocks(surveyId: string | number, topicBlocks: SurveyTopicBlock[]): Promise<void> {
    const firestore = getFirebaseDb();
    if (!firestore) throw new Error("Firestore is not initialized.");
    await updateDoc(doc(firestore, COLLECTIONS.SURVEYS, String(surveyId)), { topicBlocks });
  },

  async save(survey: Survey): Promise<void> {
    const firestore = getFirebaseDb();
    if (!firestore) return;
    const docId = String(survey.id);
    const normalizedSurvey: Survey = {
      ...survey,
      owner: (survey.owner || "").trim().toLowerCase(),
    };
    try {
      await setDoc(doc(firestore, COLLECTIONS.SURVEYS, docId), normalizedSurvey, { merge: true });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `${COLLECTIONS.SURVEYS}/${docId}`);
    }
  },

  async delete(surveyId: string | number): Promise<void> {
    const firestore = getFirebaseDb();
    if (!firestore) throw new Error("Firestore is not initialized.");
    const docId = String(surveyId);
    try {
      await deleteDoc(doc(firestore, COLLECTIONS.SURVEYS, docId));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `${COLLECTIONS.SURVEYS}/${docId}`);
    }
  },

  /** Archives a survey by changing only the archive fields (the rules allow owners exactly this). */
  async archive(surveyId: string | number, archivedBy: string, archiveReason: string, archivedAt: number): Promise<void> {
    const firestore = getFirebaseDb();
    if (!firestore) throw new Error("Firestore is not initialized.");
    const docId = String(surveyId);
    try {
      await updateDoc(doc(firestore, COLLECTIONS.SURVEYS, docId), {
        status: "archived",
        archivedAt,
        archivedBy,
        archiveReason,
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `${COLLECTIONS.SURVEYS}/${docId}`);
    }
  },

  /** Owner takes a pending survey back to draft (the rules allow exactly this change). */
  async withdraw(surveyId: string | number): Promise<void> {
    const firestore = getFirebaseDb();
    if (!firestore) throw new Error("Firestore is not initialized.");
    const docId = String(surveyId);
    try {
      await updateDoc(doc(firestore, COLLECTIONS.SURVEYS, docId), { status: "draft" });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `${COLLECTIONS.SURVEYS}/${docId}`);
    }
  },
};

/**
 * Firestore Responses Collection Service
 */
export const FirestoreResponseService = {
  async getAll(): Promise<SurveyResponse[]> {
    const firestore = getFirebaseDb();
    if (!firestore) return [];
    try {
      const q = query(collection(firestore, COLLECTIONS.RESPONSES), orderBy("timestamp", "desc"));
      const snap = await getDocs(q);
      return snap.docs.map((docSnap) => ({
        id: docSnap.id,
        ...docSnap.data(),
      })) as SurveyResponse[];
    } catch (err) {
      handleFirestoreError(err, OperationType.LIST, COLLECTIONS.RESPONSES);
      return [];
    }
  },

  /**
   * Saves the response, the "already answered" record and the response count together:
   * either all three are saved or none. The record holds only the survey id.
   */
  async submitWithReceipt(response: SurveyResponse, email: string): Promise<void> {
    const firestore = getFirebaseDb();
    if (!firestore) throw new Error("The database is not available. Please try again.");
    const userKey = email.trim().toLowerCase().replace(/[^a-z0-9_-]/g, "_");
    const surveyDocId = String(response.surveyId);
    const receiptRef = doc(firestore, COLLECTIONS.USERS, userKey, "receipts", surveyDocId);

    let alreadyAnswered = false;
    try {
      const batch = writeBatch(firestore);
      alreadyAnswered = (await getDoc(receiptRef)).exists();
      if (!alreadyAnswered) {
        batch.set(doc(firestore, COLLECTIONS.RESPONSES, String(response.id)), response);
        batch.set(receiptRef, { surveyId: surveyDocId });
        batch.update(doc(firestore, COLLECTIONS.SURVEYS, surveyDocId), { responses: increment(1) });
        await batch.commit();
      }
    } catch (err) {
      console.warn("Could not save the survey response:", err);
      throw new Error("We could not save your answers. Please check your connection and try again.");
    }
    if (alreadyAnswered) throw new Error("You have already answered this survey. Each person can answer once.");
  },

  /** Survey owner or admin: flag a response for the admin to review (only the "review" field). */
  async flagResponse(responseId: string, review: ResponseReview): Promise<void> {
    const firestore = getFirebaseDb();
    if (!firestore) throw new Error("Firestore is not initialized.");
    try {
      await updateDoc(doc(firestore, COLLECTIONS.RESPONSES, responseId), { review });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `${COLLECTIONS.RESPONSES}/${responseId}`);
      throw err;
    }
  },

  /** Admin: replace a response's sentiment results after a re-run. */
  async updateAnalysis(
    responseId: string,
    update: Pick<SurveyResponse, "answers" | "commentStatus" | "sentimentAnalysis" | "previousSentimentAnalyses">
  ): Promise<void> {
    const firestore = getFirebaseDb();
    if (!firestore) throw new Error("Firestore is not initialized.");
    try {
      await updateDoc(doc(firestore, COLLECTIONS.RESPONSES, responseId), {
        answers: update.answers,
        commentStatus: update.commentStatus,
        sentimentAnalysis: update.sentimentAnalysis ?? deleteField(),
        previousSentimentAnalyses: update.previousSentimentAnalyses ?? [],
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `${COLLECTIONS.RESPONSES}/${responseId}`);
    }
  },

  /** The surveys this person has answered, named or anonymous. */
  async getAnsweredSurveyIds(email: string): Promise<string[]> {
    const firestore = getFirebaseDb();
    if (!firestore) return [];
    const userKey = email.trim().toLowerCase().replace(/[^a-z0-9_-]/g, "_");
    try {
      const snap = await getDocs(collection(firestore, COLLECTIONS.USERS, userKey, "receipts"));
      return snap.docs.map((docSnap) => docSnap.id);
    } catch (err) {
      console.warn("Could not load answered surveys:", err);
      return [];
    }
  },

  async getBySurveyId(surveyId: string | number): Promise<SurveyResponse[]> {
    const firestore = getFirebaseDb();
    if (!firestore) return [];
    try {
      const q = query(collection(firestore, COLLECTIONS.RESPONSES), where("surveyId", "==", surveyId));
      const snap = await getDocs(q);
      return snap.docs.map((docSnap) => ({
        id: docSnap.id,
        ...docSnap.data(),
      })) as SurveyResponse[];
    } catch {
      return [];
    }
  },

  async getByUserEmail(email: string): Promise<SurveyResponse[]> {
    const firestore = getFirebaseDb();
    if (!firestore) return [];
    try {
      const q = query(collection(firestore, COLLECTIONS.RESPONSES), where("userEmail", "==", email.trim().toLowerCase()));
      const snap = await getDocs(q);
      return snap.docs
        .map((docSnap) => ({
          id: docSnap.id,
          ...docSnap.data(),
        }))
        .filter((r: any) => !r.isAnonymous && r.userEmail) as SurveyResponse[];
    } catch {
      return [];
    }
  },
};

/**
 * Firestore Users Collection Service
 */
export const FirestoreUserService = {
  /** Records "last seen now" on the signed-in person's own profile (allowed by the rules). */
  async touchLastSeen(email: string): Promise<void> {
    const firestore = getFirebaseDb();
    if (!firestore) return;
    const userKey = email.trim().toLowerCase().replace(/[^a-z0-9_-]/g, "_");
    await updateDoc(doc(firestore, COLLECTIONS.USERS, userKey), { lastSeenAt: Date.now() });
  },

  async getAll(): Promise<UserProfile[]> {
    const firestore = getFirebaseDb();
    if (!firestore) return [];
    const authInstance = getFirebaseAuth();
    if (!authInstance?.currentUser) {
      // Users collection is protected and requires an active authenticated session
      return [];
    }
    try {
      const snap = await getDocs(collection(firestore, COLLECTIONS.USERS));
      return snap.docs.map((docSnap) => {
        const u = docSnap.data() as UserProfile;
        return {
          canCreateSurveys: u.canCreateSurveys !== undefined ? u.canCreateSurveys : true,
          canPostNews: u.canPostNews !== undefined ? u.canPostNews : true,
          ...u,
        };
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.LIST, COLLECTIONS.USERS);
      return [];
    }
  },

  async getByEmail(email: string): Promise<UserProfile | null> {
    const firestore = getFirebaseDb();
    if (!firestore) return null;
    const authInstance = getFirebaseAuth();
    if (!authInstance?.currentUser) {
      return null;
    }
    const cleanEmail = email.trim().toLowerCase();
    const docId = cleanEmail.replace(/[^a-z0-9_-]/g, "_");
    try {
      const snap = await getDoc(doc(firestore, COLLECTIONS.USERS, docId));
      if (snap.exists()) {
        const u = snap.data() as UserProfile;
        if (u.email.toLowerCase() === cleanEmail) {
          return {
            canCreateSurveys: u.canCreateSurveys !== undefined ? u.canCreateSurveys : true,
            canPostNews: u.canPostNews !== undefined ? u.canPostNews : true,
            ...u,
            email: cleanEmail,
          };
        }
      }
      return null;
    } catch (err) {
      handleFirestoreError(err, OperationType.GET, `${COLLECTIONS.USERS}/${docId}`);
      return null;
    }
  },

  async save(user: UserProfile): Promise<void> {
    const firestore = getFirebaseDb();
    if (!firestore) return;
    const cleanEmail = user.email.trim().toLowerCase();
    const docId = cleanEmail.replace(/[^a-z0-9_-]/g, "_");
    const normalizedUser: UserProfile = {
      canCreateSurveys: user.canCreateSurveys !== undefined ? user.canCreateSurveys : true,
      canPostNews: user.canPostNews !== undefined ? user.canPostNews : true,
      ...user,
      email: cleanEmail,
    };
    try {
      await setDoc(doc(firestore, COLLECTIONS.USERS, docId), normalizedUser, { merge: true });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `${COLLECTIONS.USERS}/${docId}`);
    }
  },

  /**
   * Updates only the given fields of one's own profile, so a self-edit never touches the locked
   * school fields (name, profileRequestSeenAt, or the one-time section pick).
   */
  async updateOwnFields(
    email: string,
    fields: Partial<Pick<UserProfile, "name" | "profileRequestSeenAt" | "section" | "sectionPickNeeded" | "privacyAcceptedAt" | "privacyNoticeVersion" | "emailVerifiedAt">>
  ): Promise<void> {
    const firestore = getFirebaseDb();
    if (!firestore) throw new Error("The database is not available. Please try again.");
    const docId = email.trim().toLowerCase().replace(/[^a-z0-9_-]/g, "_");
    await updateDoc(doc(firestore, COLLECTIONS.USERS, docId), fields);
  },

  /** Admin: update only some fields of many profiles, in batches (Firestore allows 500 writes per batch). */
  async updateMany(updates: { email: string; fields: Partial<UserProfile> }[]): Promise<void> {
    const firestore = getFirebaseDb();
    if (!firestore) throw new Error("Firestore is not initialized.");
    for (let i = 0; i < updates.length; i += 400) {
      const batch = writeBatch(firestore);
      for (const u of updates.slice(i, i + 400)) {
        const docId = u.email.trim().toLowerCase().replace(/[^a-z0-9_-]/g, "_");
        batch.update(doc(firestore, COLLECTIONS.USERS, docId), u.fields);
      }
      await batch.commit();
    }
  },

  async delete(email: string): Promise<void> {
    const firestore = getFirebaseDb();
    if (!firestore) return;
    const cleanEmail = email.trim().toLowerCase();
    const docId = cleanEmail.replace(/[^a-z0-9_-]/g, "_");
    try {
      await deleteDoc(doc(firestore, COLLECTIONS.USERS, docId));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `${COLLECTIONS.USERS}/${docId}`);
    }
  },
};

/**
 * Firestore Campus News Collection Service
 */
export const FirestoreNewsService = {
  /** Admin: every post. Everyone else: published posts plus their own, as the rules allow. */
  async getVisible(currentUser?: UserProfile | null): Promise<NewsAnnouncement[]> {
    const firestore = getFirebaseDb();
    if (!firestore || !currentUser) return [];
    const newsRef = collection(firestore, COLLECTIONS.NEWS);
    const isAdmin = currentUser.role === "superadmin" || currentUser.pos === "Superadmin";
    const queries = isAdmin
      ? [newsRef]
      : [
          query(newsRef, where("status", "==", "published")),
          query(newsRef, where("authorEmail", "==", currentUser.email.trim().toLowerCase())),
        ];
    const byId = new Map<string, NewsAnnouncement>();
    for (const q of queries) {
      try {
        const snap = await getDocs(q);
        snap.docs.forEach((docSnap) => {
          byId.set(docSnap.id, { ...(docSnap.data() as NewsAnnouncement), id: docSnap.id });
        });
      } catch (err) {
        console.warn("Could not load news:", err);
      }
    }
    return Array.from(byId.values()).sort((a, b) => (b.submittedAt || 0) - (a.submittedAt || 0));
  },

  async delete(id: string): Promise<void> {
    const firestore = getFirebaseDb();
    if (!firestore) throw new Error("Firestore is not initialized.");
    try {
      await deleteDoc(doc(firestore, COLLECTIONS.NEWS, id));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `${COLLECTIONS.NEWS}/${id}`);
    }
  },

  async save(newsItem: NewsAnnouncement): Promise<void> {
    const firestore = getFirebaseDb();
    if (!firestore) return;
    try {
      await setDoc(doc(firestore, COLLECTIONS.NEWS, newsItem.id), newsItem, { merge: true });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `${COLLECTIONS.NEWS}/${newsItem.id}`);
    }
  },

  /**
   * Like or un-like a post. The person's own like record and the post's count change
   * together (all or nothing), so each person can like a post only once.
   */
  async setLiked(id: string, email: string, liked: boolean): Promise<void> {
    const firestore = getFirebaseDb();
    if (!firestore) throw new Error("The database is not available. Please try again.");
    const userKey = email.trim().toLowerCase().replace(/[^a-z0-9_-]/g, "_");
    const likeRef = doc(firestore, COLLECTIONS.USERS, userKey, "newsLikes", id);
    const batch = writeBatch(firestore);
    if (liked) batch.set(likeRef, { newsId: id });
    else batch.delete(likeRef);
    batch.update(doc(firestore, COLLECTIONS.NEWS, id), { likesCount: increment(liked ? 1 : -1) });
    try {
      await batch.commit();
    } catch (err) {
      console.warn("Could not save the like:", err);
      throw new Error("Could not save your like. Please refresh the page and try again.");
    }
  },

  /** The news posts this person has liked (read from their own private list). */
  async getLikedNewsIds(email: string): Promise<string[]> {
    const firestore = getFirebaseDb();
    if (!firestore) return [];
    const userKey = email.trim().toLowerCase().replace(/[^a-z0-9_-]/g, "_");
    try {
      const snap = await getDocs(collection(firestore, COLLECTIONS.USERS, userKey, "newsLikes"));
      return snap.docs.map((docSnap) => docSnap.id);
    } catch (err) {
      console.warn("Could not load liked posts:", err);
      return [];
    }
  },
};

/**
 * Firestore Audit Logs Service
 */
export const FirestoreLogsService = {
  async getAll(): Promise<ActivityLog[]> {
    const firestore = getFirebaseDb();
    if (!firestore) return [];
    try {
      const q = query(collection(firestore, COLLECTIONS.LOGS), orderBy("timestamp", "desc"), limit(200));
      const snap = await getDocs(q);
      return snap.docs.map((docSnap) => ({
        id: docSnap.id,
        ...docSnap.data(),
      })) as ActivityLog[];
    } catch (err) {
      handleFirestoreError(err, OperationType.LIST, COLLECTIONS.LOGS);
      return [];
    }
  },

  /** Admin: mark a topic move in the log as undone. */
  async markTopicMoveUndone(logId: string, record: TopicMoveRecord): Promise<void> {
    const firestore = getFirebaseDb();
    if (!firestore) throw new Error("Firestore is not initialized.");
    await updateDoc(doc(firestore, COLLECTIONS.LOGS, logId), { topicMove: { ...record, undone: true } });
  },

  async add(log: Omit<ActivityLog, "id" | "time"> | ActivityLog): Promise<void> {
    const firestore = getFirebaseDb();
    if (!firestore) throw new Error("Firestore is not initialized.");
    const now = Date.now();
    const logId = ("id" in log && log.id) ? log.id : `log_${now}_${Math.random().toString(36).slice(2, 7)}`;
    const fullLog: ActivityLog = {
      id: logId,
      ...log,
      timestamp: log.timestamp || now,
      time: ("time" in log && log.time) ? log.time : new Date(log.timestamp || now).toLocaleString(),
    };
    try {
      await setDoc(doc(firestore, COLLECTIONS.LOGS, logId), fullLog);
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `${COLLECTIONS.LOGS}/${logId}`);
    }
  },
};

/**
 * Firestore Notifications Collection Service
 */
export const FirestoreNotificationService = {
  async getByEmail(email: string): Promise<NotificationItem[]> {
    const firestore = getFirebaseDb();
    if (!firestore || !email) return [];
    const cleanEmail = email.trim().toLowerCase();
    try {
      const q = query(
        collection(firestore, COLLECTIONS.NOTIFICATIONS),
        where("to", "==", cleanEmail)
      );
      const snap = await getDocs(q);
      const items = snap.docs.map((docSnap) => {
        const d = docSnap.data();
        return {
          id: docSnap.id,
          to: d.to,
          userEmail: d.to,
          title: d.title || "",
          message: d.message || "",
          read: Boolean(d.read),
          timestamp: d.timestamp || Date.now(),
          icon: d.icon || "🔔",
          type: d.type || "general",
          data: d.data,
        } as NotificationItem;
      });
      items.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
      return items;
    } catch (err) {
      console.warn("Failed to get notifications:", err);
      return [];
    }
  },

  async add(item: {
    to: string;
    title: string;
    message: string;
    icon?: string;
    type?: string;
    data?: any;
  }): Promise<void> {
    const firestore = getFirebaseDb();
    if (!firestore) return;
    const cleanEmail = item.to.trim().toLowerCase();
    const docId = `notif_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const newDoc = {
      to: cleanEmail,
      title: item.title,
      message: item.message,
      read: false,
      timestamp: Date.now(),
      ...(item.icon ? { icon: item.icon } : {}),
      ...(item.type ? { type: item.type } : {}),
      ...(item.data ? { data: item.data } : {}),
    };
    try {
      await setDoc(doc(firestore, COLLECTIONS.NOTIFICATIONS, docId), newDoc);
    } catch (err) {
      console.warn("Failed to add notification:", err);
    }
  },

  async markAsRead(id: string): Promise<void> {
    const firestore = getFirebaseDb();
    if (!firestore) return;
    try {
      await updateDoc(doc(firestore, COLLECTIONS.NOTIFICATIONS, id), {
        read: true,
      });
    } catch (err) {
      console.warn("Failed to mark notification read:", err);
    }
  },

  async markAllAsRead(notifications: NotificationItem[]): Promise<void> {
    const firestore = getFirebaseDb();
    if (!firestore) return;
    const unread = notifications.filter((n) => !n.read);
    await Promise.all(
      unread.map((n) =>
        updateDoc(doc(firestore, COLLECTIONS.NOTIFICATIONS, n.id), {
          read: true,
        }).catch((err) => console.warn("Failed to mark notification read:", err))
      )
    );
  },

  async delete(id: string): Promise<void> {
    const firestore = getFirebaseDb();
    if (!firestore) return;
    try {
      await deleteDoc(doc(firestore, COLLECTIONS.NOTIFICATIONS, id));
    } catch (err) {
      console.warn("Failed to delete notification:", err);
    }
  },
};

/**
 * Academic calendar: one document per school year, written by the admin only.
 */
/** Admin switches in `settings/app`. A missing document means the defaults (creation open). */
export const FirestoreSettingsService = {
  async get(): Promise<AppSettings> {
    const firestore = getFirebaseDb();
    if (!firestore) return { surveyCreationOpen: true };
    const snap = await getDoc(doc(firestore, COLLECTIONS.SETTINGS, "app"));
    const data = snap.exists() ? (snap.data() as Partial<AppSettings>) : {};
    return { ...data, surveyCreationOpen: data.surveyCreationOpen !== false };
  },

  async save(settings: AppSettings): Promise<void> {
    const firestore = getFirebaseDb();
    if (!firestore) throw new Error("Firestore is not initialized.");
    try {
      await setDoc(doc(firestore, COLLECTIONS.SETTINGS, "app"), settings, { merge: true });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `${COLLECTIONS.SETTINGS}/app`);
      throw err;
    }
  },
};

/** School setup lists in `school_setup/lists` (anyone can read; admin writes). Missing = empty. */
export const FirestoreSchoolService = {
  async get(): Promise<SchoolLists> {
    const firestore = getFirebaseDb();
    if (!firestore) return { departments: [] };
    const snap = await getDoc(doc(firestore, COLLECTIONS.SCHOOL_SETUP, "lists"));
    const data = snap.exists() ? (snap.data() as Partial<SchoolLists>) : {};
    return { ...data, departments: Array.isArray(data.departments) ? data.departments : [] };
  },

  async save(lists: SchoolLists): Promise<void> {
    const firestore = getFirebaseDb();
    if (!firestore) throw new Error("Firestore is not initialized.");
    try {
      await setDoc(doc(firestore, COLLECTIONS.SCHOOL_SETUP, "lists"), lists);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `${COLLECTIONS.SCHOOL_SETUP}/lists`);
      throw err;
    }
  },
};

/** Users' reports about live surveys. One per person per survey; admin decides. */
export const FirestoreReportService = {
  idFor(surveyId: string | number, email: string): string {
    return `${String(surveyId)}_${email.trim().toLowerCase().replace(/[^a-z0-9_-]/g, "_")}`;
  },

  async create(report: Omit<SurveyReport, "id" | "status">): Promise<void> {
    const firestore = getFirebaseDb();
    if (!firestore) throw new Error("The database is not available. Please try again.");
    const id = FirestoreReportService.idFor(report.surveyId, report.reportedBy);
    try {
      await setDoc(doc(firestore, COLLECTIONS.SURVEY_REPORTS, id), { ...report, status: "open" });
    } catch (err) {
      console.warn("Could not save the report:", err);
      throw new Error("Could not send your report. You may have reported this survey already, or it is no longer open.");
    }
  },

  /** Admin: every report. */
  async getAll(): Promise<SurveyReport[]> {
    const firestore = getFirebaseDb();
    if (!firestore) return [];
    const snap = await getDocs(collection(firestore, COLLECTIONS.SURVEY_REPORTS));
    return snap.docs.map((d) => ({ ...(d.data() as Omit<SurveyReport, "id">), id: d.id }));
  },

  /** The surveys this person has reported. */
  async getMine(email: string): Promise<SurveyReport[]> {
    const firestore = getFirebaseDb();
    if (!firestore) return [];
    try {
      const q = query(
        collection(firestore, COLLECTIONS.SURVEY_REPORTS),
        where("reportedBy", "==", email.trim().toLowerCase())
      );
      const snap = await getDocs(q);
      return snap.docs.map((d) => ({ ...(d.data() as Omit<SurveyReport, "id">), id: d.id }));
    } catch (err) {
      console.warn("Could not load your reports:", err);
      return [];
    }
  },

  /** Admin: record a decision on several reports at once. */
  async decide(ids: string[], decision: Pick<SurveyReport, "status" | "decidedBy" | "decidedAt" | "decisionNote">): Promise<void> {
    const firestore = getFirebaseDb();
    if (!firestore) throw new Error("Firestore is not initialized.");
    const batch = writeBatch(firestore);
    ids.forEach((id) => batch.update(doc(firestore, COLLECTIONS.SURVEY_REPORTS, id), decision));
    await batch.commit();
  },
};

/** Requests to change one's own locked school fields. One per person (id = email key). */
export const FirestoreProfileRequestService = {
  idFor(email: string): string {
    return email.trim().toLowerCase().replace(/[^a-z0-9_-]/g, "_");
  },

  /** This person's latest request, or null. */
  async getMine(email: string): Promise<ProfileChangeRequest | null> {
    const firestore = getFirebaseDb();
    if (!firestore) return null;
    try {
      const snap = await getDoc(doc(firestore, COLLECTIONS.PROFILE_REQUESTS, FirestoreProfileRequestService.idFor(email)));
      return snap.exists() ? { ...(snap.data() as Omit<ProfileChangeRequest, "id">), id: snap.id } : null;
    } catch (err) {
      console.warn("Could not load your change request:", err);
      return null;
    }
  },

  /** Admin: every request. */
  async getAll(): Promise<ProfileChangeRequest[]> {
    const firestore = getFirebaseDb();
    if (!firestore) return [];
    const snap = await getDocs(collection(firestore, COLLECTIONS.PROFILE_REQUESTS));
    return snap.docs.map((d) => ({ ...(d.data() as Omit<ProfileChangeRequest, "id">), id: d.id }));
  },

  /** Sends a new request, replacing an already decided one (the rules refuse it while one is waiting). */
  async send(request: Omit<ProfileChangeRequest, "id" | "status">): Promise<ProfileChangeRequest> {
    const firestore = getFirebaseDb();
    if (!firestore) throw new Error("The database is not available. Please try again.");
    const id = FirestoreProfileRequestService.idFor(request.email);
    const data = { ...request, status: "pending" as const };
    try {
      await setDoc(doc(firestore, COLLECTIONS.PROFILE_REQUESTS, id), data);
    } catch (err) {
      console.warn("Could not send the change request:", err);
      throw new Error("Could not send your request. You may already have one waiting for the admin.");
    }
    return { ...data, id };
  },

  /** Cancels this person's waiting request. */
  async cancel(email: string): Promise<void> {
    const firestore = getFirebaseDb();
    if (!firestore) throw new Error("The database is not available. Please try again.");
    await deleteDoc(doc(firestore, COLLECTIONS.PROFILE_REQUESTS, FirestoreProfileRequestService.idFor(email)));
  },

  /** Admin: record the decision. */
  async decide(
    id: string,
    decision: Pick<ProfileChangeRequest, "status" | "decidedBy" | "decidedAt" | "decisionNote">
  ): Promise<void> {
    const firestore = getFirebaseDb();
    if (!firestore) throw new Error("Firestore is not initialized.");
    await updateDoc(doc(firestore, COLLECTIONS.PROFILE_REQUESTS, id), decision);
  },
};

/** Saved evaluation results (admin only; never edited, only added or deleted). */
export const FirestoreEvaluationService = {
  async getAll(): Promise<EvaluationRun[]> {
    const firestore = getFirebaseDb();
    if (!firestore) return [];
    try {
      const snap = await getDocs(collection(firestore, COLLECTIONS.EVALUATION_RUNS));
      return snap.docs
        .map((d) => ({ ...(d.data() as EvaluationRun), id: d.id }))
        .sort((a, b) => b.savedAt - a.savedAt);
    } catch (err) {
      handleFirestoreError(err, OperationType.LIST, COLLECTIONS.EVALUATION_RUNS);
      throw err;
    }
  },

  async save(run: EvaluationRun): Promise<void> {
    const firestore = getFirebaseDb();
    if (!firestore) throw new Error("Firestore is not initialized.");
    try {
      const { id, ...data } = run;
      await setDoc(doc(firestore, COLLECTIONS.EVALUATION_RUNS, id), data);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `${COLLECTIONS.EVALUATION_RUNS}/${run.id}`);
      throw err;
    }
  },

  async delete(id: string): Promise<void> {
    const firestore = getFirebaseDb();
    if (!firestore) throw new Error("Firestore is not initialized.");
    try {
      await deleteDoc(doc(firestore, COLLECTIONS.EVALUATION_RUNS, id));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `${COLLECTIONS.EVALUATION_RUNS}/${id}`);
      throw err;
    }
  },
};

export const FirestoreAcademicCalendarService = {
  async getAll(): Promise<AcademicYearTerms[]> {
    const firestore = getFirebaseDb();
    if (!firestore) return [];
    try {
      const snap = await getDocs(collection(firestore, COLLECTIONS.ACADEMIC_CALENDAR));
      return snap.docs
        .map((docSnap) => ({ ...docSnap.data(), schoolYear: docSnap.id }) as AcademicYearTerms)
        .sort((a, b) => a.sem1Start - b.sem1Start);
    } catch (err) {
      handleFirestoreError(err, OperationType.LIST, COLLECTIONS.ACADEMIC_CALENDAR);
      throw err;
    }
  },

  async save(terms: AcademicYearTerms): Promise<void> {
    const firestore = getFirebaseDb();
    if (!firestore) throw new Error("Firestore is not initialized.");
    try {
      // Full replace (no merge): the rule only accepts exactly these fields.
      await setDoc(doc(firestore, COLLECTIONS.ACADEMIC_CALENDAR, terms.schoolYear), {
        schoolYear: terms.schoolYear,
        sem1Start: terms.sem1Start,
        sem1End: terms.sem1End,
        sem2Start: terms.sem2Start,
        sem2End: terms.sem2End,
        updatedAt: terms.updatedAt,
        updatedBy: terms.updatedBy,
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `${COLLECTIONS.ACADEMIC_CALENDAR}/${terms.schoolYear}`);
      throw err;
    }
  },

  async delete(schoolYear: string): Promise<void> {
    const firestore = getFirebaseDb();
    if (!firestore) throw new Error("Firestore is not initialized.");
    try {
      await deleteDoc(doc(firestore, COLLECTIONS.ACADEMIC_CALENDAR, schoolYear));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `${COLLECTIONS.ACADEMIC_CALENDAR}/${schoolYear}`);
      throw err;
    }
  },
};

/**
 * Firestore Topics Collection Service
 */
export const FirestoreTopicService = {
  async getAll(): Promise<Topic[]> {
    const firestore = getFirebaseDb();
    if (!firestore) return [];
    try {
      const snap = await getDocs(collection(firestore, COLLECTIONS.TOPICS));
      const topics = snap.docs.map((docSnap) => ({
        id: docSnap.id,
        ...docSnap.data(),
      })) as Topic[];
      return topics.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    } catch (err) {
      handleFirestoreError(err, OperationType.LIST, COLLECTIONS.TOPICS);
      throw err;
    }
  },

  async save(topic: Topic): Promise<void> {
    const firestore = getFirebaseDb();
    if (!firestore) throw new Error("Firestore is not initialized.");
    try {
      await setDoc(doc(firestore, COLLECTIONS.TOPICS, topic.id), topic, { merge: true });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `${COLLECTIONS.TOPICS}/${topic.id}`);
      throw err;
    }
  },

  async delete(topicId: string): Promise<void> {
    const firestore = getFirebaseDb();
    if (!firestore) throw new Error("Firestore is not initialized.");
    try {
      await deleteDoc(doc(firestore, COLLECTIONS.TOPICS, topicId));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `${COLLECTIONS.TOPICS}/${topicId}`);
      throw err;
    }
  },
};

/**
 * Seed Firestore with Initial Data from seed datasets
 */
export async function seedFirestoreWithData(data: {
  surveys: Survey[];
  responses: SurveyResponse[];
  users: UserProfile[];
  news: NewsAnnouncement[];
  logs: ActivityLog[];
}): Promise<{ success: boolean; message: string }> {
  let currentCollection = "";
  try {
    const firestore = getFirebaseDb();
    if (!firestore) {
      return { success: false, message: "Firebase is not initialized. Please verify configuration keys." };
    }

    // Ensure Firebase Auth session exists and user has role === 'superadmin'
    const authInstance = getFirebaseAuth();
    if (!authInstance?.currentUser) {
      return { success: false, message: "Admin login is required to perform this action." };
    }

    const currentEmail = authInstance.currentUser.email?.toLowerCase() || "";
    let userRole = "";

    try {
      const userDocId = currentEmail.replace(/[^a-z0-9_-]/g, "_");
      const userDoc = await getDoc(doc(firestore, COLLECTIONS.USERS, userDocId));
      if (userDoc.exists()) {
        userRole = userDoc.data()?.role || "";
      }
    } catch {}

    if (userRole !== "superadmin") {
      return { success: false, message: "Admin login is required to perform this action." };
    }

    currentCollection = "";
    let currentDocId = "";

    currentCollection = COLLECTIONS.SURVEYS;
    for (const survey of data.surveys) {
      currentDocId = String(survey.id);
      await setDoc(doc(firestore, COLLECTIONS.SURVEYS, currentDocId), survey);
    }

    currentCollection = COLLECTIONS.RESPONSES;
    for (const resp of data.responses) {
      currentDocId = String(resp.id);
      await setDoc(doc(firestore, COLLECTIONS.RESPONSES, currentDocId), resp);
    }

    currentCollection = COLLECTIONS.USERS;
    for (const user of data.users) {
      const cleanEmail = user.email.trim().toLowerCase();
      currentDocId = cleanEmail.replace(/[^a-z0-9_-]/g, "_");
      await setDoc(doc(firestore, COLLECTIONS.USERS, currentDocId), { ...user, email: cleanEmail });
    }

    currentCollection = COLLECTIONS.NEWS;
    for (const news of data.news) {
      currentDocId = news.id;
      await setDoc(doc(firestore, COLLECTIONS.NEWS, currentDocId), news);
    }

    currentCollection = COLLECTIONS.LOGS;
    for (const log of data.logs) {
      currentDocId = log.id || doc(collection(firestore, COLLECTIONS.LOGS)).id;
      await setDoc(doc(firestore, COLLECTIONS.LOGS, currentDocId), log);
    }

    return {
      success: true,
      message: `Successfully populated Firestore with ${data.surveys.length} surveys, ${data.responses.length} responses, and ${data.users.length} users!`,
    };
  } catch (error: any) {
    console.error("Firestore seeding failed:", error);
    const msg = String(error?.message || "");
    const isPermissionError = error?.code === "permission-denied" || msg.includes("insufficient permissions");
    
    if (isPermissionError) {
      return {
        success: false,
        message: `Missing or insufficient permissions on collection '${currentCollection || "unknown"}'. Please ensure the rules are published in Firebase Console and you are signed in as an administrator.`,
      };
    }

    return {
      success: false,
      message: error?.message || "Failed to seed Firestore data.",
    };
  }
}

/**
 * Wipe all cloud Firestore collections to 0 records (Clean Production Slate).
 * Preserves the Superadmin account so administrative access remains active.
 */
export async function wipeFirestoreCloudData(): Promise<{
  success: boolean;
  message: string;
  deletedCounts?: Record<string, number>;
}> {
  try {
    const firestore = getFirebaseDb();
    if (!firestore) {
      return { success: false, message: "Firebase is not initialized. Please verify configuration keys." };
    }

    // Ensure Firebase Auth session exists and user has role === 'superadmin'
    const authInstance = getFirebaseAuth();
    if (!authInstance?.currentUser) {
      return { success: false, message: "Admin login is required to perform this action." };
    }

    const currentEmail = authInstance.currentUser.email?.toLowerCase() || "";
    let userRole = "";

    try {
      const userDocId = currentEmail.replace(/[^a-z0-9_-]/g, "_");
      const userDoc = await getDoc(doc(firestore, COLLECTIONS.USERS, userDocId));
      if (userDoc.exists()) {
        userRole = userDoc.data()?.role || "";
      }
    } catch {}

    if (userRole !== "superadmin") {
      return { success: false, message: "Admin login is required to perform this action." };
    }

    const collectionsToClear = [
      COLLECTIONS.SURVEYS,
      COLLECTIONS.RESPONSES,
      COLLECTIONS.NEWS,
      COLLECTIONS.ML_DATASET,
      COLLECTIONS.LOGS,
    ];

    const counts: Record<string, number> = {};

    for (const colName of collectionsToClear) {
      const snap = await getDocs(collection(firestore, colName));
      counts[colName] = snap.size;
      for (const d of snap.docs) {
        await deleteDoc(doc(firestore, colName, d.id));
      }
    }

    // In users collection: remove non-superadmin accounts
    const usersSnap = await getDocs(collection(firestore, COLLECTIONS.USERS));
    let deletedUsers = 0;
    for (const d of usersSnap.docs) {
      const uData = d.data();
      if (uData.role !== "superadmin") {
        await deleteDoc(doc(firestore, COLLECTIONS.USERS, d.id));
        deletedUsers++;
      }
    }
    counts[COLLECTIONS.USERS] = deletedUsers;

    return {
      success: true,
      message: `Cloud Firestore successfully wiped! Removed ${counts[COLLECTIONS.SURVEYS] || 0} surveys, ${counts[COLLECTIONS.RESPONSES] || 0} responses, and ${deletedUsers} demo users. Admin credentials preserved.`,
      deletedCounts: counts,
    };
  } catch (error: any) {
    console.error("Firestore cloud wipe failed:", error);
    return {
      success: false,
      message: error?.message || "Failed to wipe Cloud Firestore data.",
    };
  }
}


/**
 * ==============================================================================
 * FIREBASE DATABASE & AUTHENTICATION CONFIGURATION
 * ==============================================================================
 * 
 * This file is prepared and ready for your Firebase Firestore Database and Auth!
 * Currently, it is configured in "Standby" mode so your application continues to
 * use the local demo datasets without crashing.
 * 
 * ------------------------------------------------------------------------------
 * HOW TO ACTIVATE FIREBASE WHEN YOUR PROJECT IS READY:
 * ------------------------------------------------------------------------------
 * 1. Go to https://console.firebase.google.com and create or open your project.
 * 2. Add a "Web App" (</>) to get your firebaseConfig keys.
 * 3. In the Firebase Console, go to "Firestore Database" and click "Create database"
 *    (choose "Start in test mode" for quick development).
 * 4. Paste your configuration values into `firebaseConfig` below (or add them to `.env`).
 * 5. In `/src/lib/databaseService.ts`, change:
 *       `export const USE_FIREBASE = false;` 
 *    to:
 *       `export const USE_FIREBASE = true;`
 * 
 * That's it! The system will then automatically read and write all surveys,
 * responses, accounts, news, and logs directly to your live Firebase Firestore.
 * ==============================================================================
 */

import { initializeApp, getApps, getApp, FirebaseApp } from "firebase/app";
import {
  getFirestore,
  collection,
  getDocs,
  doc,
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  orderBy,
  limit,
  Firestore,
} from "firebase/firestore";
import { getAuth, Auth } from "firebase/auth";
import {
  Survey,
  SurveyResponse,
  UserProfile,
  NewsAnnouncement,
  TagalogMLSample,
  ActivityLog,
} from "../types";
import {
  INITIAL_SURVEYS,
  INITIAL_RESPONSES,
  DEFAULT_USERS,
  INITIAL_NEWS,
  INITIAL_TAGALOG_ML_DATASET,
  INITIAL_LOGS,
} from "../data/initialData";

// ==============================================================================
// STEP 1: PASTE YOUR FIREBASE WEB CONFIGURATION HERE
// ==============================================================================
export const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "YOUR_API_KEY_HERE",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "your-project-id.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "your-project-id",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "your-project-id.appspot.com",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "1234567890",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:1234567890:web:abcdef123456",
};

/**
 * Check if the user has replaced placeholder credentials with real Firebase keys.
 */
export function isFirebaseConfigured(): boolean {
  return (
    Boolean(firebaseConfig.apiKey) &&
    firebaseConfig.apiKey !== "YOUR_API_KEY_HERE" &&
    Boolean(firebaseConfig.projectId) &&
    firebaseConfig.projectId !== "your-project-id"
  );
}

// Lazy initialization of Firebase to prevent crashes if credentials are blank
let app: FirebaseApp | null = null;
let db: Firestore | null = null;
let auth: Auth | null = null;

export function getFirebaseApp(): FirebaseApp {
  if (!app) {
    app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
  }
  return app;
}

export function getFirebaseDb(): Firestore {
  if (!db) {
    db = getFirestore(getFirebaseApp());
  }
  return db;
}

export function getFirebaseAuth(): Auth {
  if (!auth) {
    auth = getAuth(getFirebaseApp());
  }
  return auth;
}

// ==============================================================================
// FIRESTORE COLLECTIONS DEFINITIONS
// ==============================================================================
export const COLLECTIONS = {
  SURVEYS: "surveys",
  RESPONSES: "responses",
  USERS: "users",
  NEWS: "news",
  ML_DATASET: "ml_dataset",
  LOGS: "logs",
  CATEGORIES: "categories",
};

// ==============================================================================
// FIRESTORE CRUD SERVICES (READY TO USE)
// ==============================================================================

/**
 * Surveys Collection Operations
 */
export const FirestoreSurveyService = {
  async getAll(): Promise<Survey[]> {
    const firestore = getFirebaseDb();
    const snap = await getDocs(collection(firestore, COLLECTIONS.SURVEYS));
    return snap.docs.map((docSnap) => ({
      id: docSnap.id,
      ...docSnap.data(),
    })) as Survey[];
  },

  async save(survey: Survey): Promise<void> {
    const firestore = getFirebaseDb();
    const docId = String(survey.id);
    await setDoc(doc(firestore, COLLECTIONS.SURVEYS, docId), survey, { merge: true });
  },

  async delete(surveyId: string | number): Promise<void> {
    const firestore = getFirebaseDb();
    await deleteDoc(doc(firestore, COLLECTIONS.SURVEYS, String(surveyId)));
  },
};

/**
 * Survey Responses Collection Operations
 */
export const FirestoreResponseService = {
  async getAll(): Promise<SurveyResponse[]> {
    const firestore = getFirebaseDb();
    const q = query(collection(firestore, COLLECTIONS.RESPONSES), orderBy("timestamp", "desc"));
    const snap = await getDocs(q);
    return snap.docs.map((docSnap) => ({
      id: docSnap.id,
      ...docSnap.data(),
    })) as SurveyResponse[];
  },

  async add(response: SurveyResponse): Promise<void> {
    const firestore = getFirebaseDb();
    const docId = String(response.id);
    await setDoc(doc(firestore, COLLECTIONS.RESPONSES, docId), response);
  },
};

/**
 * User Profiles Collection Operations
 */
export const FirestoreUserService = {
  async getAll(): Promise<UserProfile[]> {
    const firestore = getFirebaseDb();
    const snap = await getDocs(collection(firestore, COLLECTIONS.USERS));
    return snap.docs.map((docSnap) => docSnap.data() as UserProfile);
  },

  async save(user: UserProfile): Promise<void> {
    const firestore = getFirebaseDb();
    const docId = user.email.replace(/\./g, "_"); // sanitize email for doc ID
    await setDoc(doc(firestore, COLLECTIONS.USERS, docId), user, { merge: true });
  },

  async delete(email: string): Promise<void> {
    const firestore = getFirebaseDb();
    const docId = email.replace(/\./g, "_");
    await deleteDoc(doc(firestore, COLLECTIONS.USERS, docId));
  },
};

/**
 * Campus News & Announcements Operations
 */
export const FirestoreNewsService = {
  async getAll(): Promise<NewsAnnouncement[]> {
    const firestore = getFirebaseDb();
    const snap = await getDocs(collection(firestore, COLLECTIONS.NEWS));
    return snap.docs.map((docSnap) => ({
      id: docSnap.id,
      ...docSnap.data(),
    })) as NewsAnnouncement[];
  },

  async save(newsItem: NewsAnnouncement): Promise<void> {
    const firestore = getFirebaseDb();
    await setDoc(doc(firestore, COLLECTIONS.NEWS, newsItem.id), newsItem, { merge: true });
  },

  async incrementLike(id: string): Promise<void> {
    const firestore = getFirebaseDb();
    const newsRef = doc(firestore, COLLECTIONS.NEWS, id);
    // Reads current and increments
    const snap = await getDocs(collection(firestore, COLLECTIONS.NEWS));
    const target = snap.docs.find((d) => d.id === id);
    if (target) {
      const curLikes = target.data().likesCount || 0;
      await updateDoc(newsRef, { likesCount: curLikes + 1 });
    }
  },
};

/**
 * Tagalog ML Dataset Operations
 */
export const FirestoreMLService = {
  async getAll(): Promise<TagalogMLSample[]> {
    const firestore = getFirebaseDb();
    const snap = await getDocs(collection(firestore, COLLECTIONS.ML_DATASET));
    return snap.docs.map((docSnap) => ({
      id: docSnap.id,
      ...docSnap.data(),
    })) as TagalogMLSample[];
  },

  async add(sample: TagalogMLSample): Promise<void> {
    const firestore = getFirebaseDb();
    await setDoc(doc(firestore, COLLECTIONS.ML_DATASET, sample.id), sample);
  },
};

/**
 * Audit Activity Logs Operations
 */
export const FirestoreLogsService = {
  async getAll(): Promise<ActivityLog[]> {
    const firestore = getFirebaseDb();
    const q = query(collection(firestore, COLLECTIONS.LOGS), orderBy("timestamp", "desc"), limit(200));
    const snap = await getDocs(q);
    return snap.docs.map((docSnap) => ({
      id: docSnap.id,
      ...docSnap.data(),
    })) as ActivityLog[];
  },

  async add(log: ActivityLog): Promise<void> {
    const firestore = getFirebaseDb();
    await setDoc(doc(firestore, COLLECTIONS.LOGS, log.id), log);
  },
};

/**
 * One-Click Migration Tool:
 * Call this function from your browser console or admin screen to upload
 * all initial demo surveys, questions, users, and ML samples into your fresh Firestore!
 */
export async function seedFirestoreWithInitialDemoData(): Promise<{ success: boolean; message: string }> {
  try {
    const firestore = getFirebaseDb();

    // 1. Seed Surveys
    for (const survey of INITIAL_SURVEYS) {
      await setDoc(doc(firestore, COLLECTIONS.SURVEYS, String(survey.id)), survey);
    }

    // 2. Seed Responses
    for (const resp of INITIAL_RESPONSES) {
      await setDoc(doc(firestore, COLLECTIONS.RESPONSES, String(resp.id)), resp);
    }

    // 3. Seed Users
    for (const user of DEFAULT_USERS) {
      const docId = user.email.replace(/\./g, "_");
      await setDoc(doc(firestore, COLLECTIONS.USERS, docId), user);
    }

    // 4. Seed News
    for (const news of INITIAL_NEWS) {
      await setDoc(doc(firestore, COLLECTIONS.NEWS, news.id), news);
    }

    // 5. Seed ML Dataset
    for (const ml of INITIAL_TAGALOG_ML_DATASET) {
      await setDoc(doc(firestore, COLLECTIONS.ML_DATASET, ml.id), ml);
    }

    // 6. Seed Logs
    for (const log of INITIAL_LOGS) {
      await setDoc(doc(firestore, COLLECTIONS.LOGS, log.id), log);
    }

    return {
      success: true,
      message: "Successfully populated Firestore with all initial institutional demo data!",
    };
  } catch (error: any) {
    console.error("Firestore seeding failed:", error);
    return {
      success: false,
      message: error?.message || "Failed to seed Firestore data.",
    };
  }
}

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
  getFirestore,
  collection,
  getDocs,
  doc,
  getDoc,
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
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
  User as FirebaseUser,
} from "firebase/auth";
import {
  Survey,
  SurveyResponse,
  UserProfile,
  NewsAnnouncement,
  TagalogMLSample,
  ActivityLog,
} from "../types";

// Firebase Web Configuration loaded from environment variables
export const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "",
};

/**
 * Check if the user has provided valid Firebase configuration keys.
 */
export function isFirebaseConfigured(): boolean {
  return (
    Boolean(firebaseConfig.apiKey) &&
    firebaseConfig.apiKey !== "YOUR_API_KEY_HERE" &&
    firebaseConfig.apiKey.length > 5 &&
    Boolean(firebaseConfig.projectId) &&
    firebaseConfig.projectId !== "your-project-id"
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
      db = getFirestore(firebaseApp);
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
  console.error("Firestore Error:", JSON.stringify(errInfo));
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
  async getAll(): Promise<Survey[]> {
    const firestore = getFirebaseDb();
    if (!firestore) return [];
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
  },

  async save(survey: Survey): Promise<void> {
    const firestore = getFirebaseDb();
    if (!firestore) return;
    const docId = String(survey.id);
    try {
      await setDoc(doc(firestore, COLLECTIONS.SURVEYS, docId), survey, { merge: true });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `${COLLECTIONS.SURVEYS}/${docId}`);
    }
  },

  async delete(surveyId: string | number): Promise<void> {
    const firestore = getFirebaseDb();
    if (!firestore) return;
    const docId = String(surveyId);
    try {
      await deleteDoc(doc(firestore, COLLECTIONS.SURVEYS, docId));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `${COLLECTIONS.SURVEYS}/${docId}`);
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

  async add(response: SurveyResponse): Promise<void> {
    const firestore = getFirebaseDb();
    if (!firestore) return;
    const docId = String(response.id);
    try {
      await setDoc(doc(firestore, COLLECTIONS.RESPONSES, docId), response);
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `${COLLECTIONS.RESPONSES}/${docId}`);
    }
  },
};

/**
 * Firestore Users Collection Service
 */
export const FirestoreUserService = {
  async getAll(): Promise<UserProfile[]> {
    const firestore = getFirebaseDb();
    if (!firestore) return [];
    try {
      const snap = await getDocs(collection(firestore, COLLECTIONS.USERS));
      return snap.docs.map((docSnap) => docSnap.data() as UserProfile);
    } catch (err) {
      handleFirestoreError(err, OperationType.LIST, COLLECTIONS.USERS);
      return [];
    }
  },

  async getByEmail(email: string): Promise<UserProfile | null> {
    const firestore = getFirebaseDb();
    if (!firestore) return null;
    const docId = email.toLowerCase().replace(/[^a-zA-Z0-9_-]/g, "_");
    try {
      const snap = await getDoc(doc(firestore, COLLECTIONS.USERS, docId));
      if (snap.exists()) {
        return snap.data() as UserProfile;
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
    const docId = user.email.toLowerCase().replace(/[^a-zA-Z0-9_-]/g, "_");
    try {
      await setDoc(doc(firestore, COLLECTIONS.USERS, docId), user, { merge: true });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `${COLLECTIONS.USERS}/${docId}`);
    }
  },

  async delete(email: string): Promise<void> {
    const firestore = getFirebaseDb();
    if (!firestore) return;
    const docId = email.toLowerCase().replace(/[^a-zA-Z0-9_-]/g, "_");
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
  async getAll(): Promise<NewsAnnouncement[]> {
    const firestore = getFirebaseDb();
    if (!firestore) return [];
    try {
      const snap = await getDocs(collection(firestore, COLLECTIONS.NEWS));
      return snap.docs.map((docSnap) => ({
        id: docSnap.id,
        ...docSnap.data(),
      })) as NewsAnnouncement[];
    } catch (err) {
      handleFirestoreError(err, OperationType.LIST, COLLECTIONS.NEWS);
      return [];
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

  async incrementLike(id: string): Promise<void> {
    const firestore = getFirebaseDb();
    if (!firestore) return;
    const newsRef = doc(firestore, COLLECTIONS.NEWS, id);
    try {
      const snap = await getDoc(newsRef);
      if (snap.exists()) {
        const curLikes = snap.data().likesCount || 0;
        await updateDoc(newsRef, { likesCount: curLikes + 1 });
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `${COLLECTIONS.NEWS}/${id}`);
    }
  },
};

/**
 * Firestore Tagalog ML Dataset Service
 */
export const FirestoreMLService = {
  async getAll(): Promise<TagalogMLSample[]> {
    const firestore = getFirebaseDb();
    if (!firestore) return [];
    try {
      const snap = await getDocs(collection(firestore, COLLECTIONS.ML_DATASET));
      return snap.docs.map((docSnap) => ({
        id: docSnap.id,
        ...docSnap.data(),
      })) as TagalogMLSample[];
    } catch (err) {
      handleFirestoreError(err, OperationType.LIST, COLLECTIONS.ML_DATASET);
      return [];
    }
  },

  async add(sample: TagalogMLSample): Promise<void> {
    const firestore = getFirebaseDb();
    if (!firestore) return;
    try {
      await setDoc(doc(firestore, COLLECTIONS.ML_DATASET, sample.id), sample);
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `${COLLECTIONS.ML_DATASET}/${sample.id}`);
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

  async add(log: ActivityLog): Promise<void> {
    const firestore = getFirebaseDb();
    if (!firestore) return;
    try {
      await setDoc(doc(firestore, COLLECTIONS.LOGS, log.id), log);
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `${COLLECTIONS.LOGS}/${log.id}`);
    }
  },
};

/**
 * Seed Firestore with Initial Data from active datasets
 */
export async function seedFirestoreWithInitialDemoData(): Promise<{ success: boolean; message: string }> {
  try {
    const { LocalStorageManager } = await import("./storage");
    return seedFirestoreWithData({
      surveys: LocalStorageManager.getSurveys(),
      responses: LocalStorageManager.getResponses(),
      users: LocalStorageManager.getUsers(),
      news: LocalStorageManager.getNews(),
      mlDataset: LocalStorageManager.getMlDataset(),
      logs: LocalStorageManager.getLogs(),
    });
  } catch (err: any) {
    return { success: false, message: err?.message || "Failed to load datasets for seeding." };
  }
}

/**
 * Seed Firestore with Initial Data from seed datasets
 */
export async function seedFirestoreWithData(data: {
  surveys: Survey[];
  responses: SurveyResponse[];
  users: UserProfile[];
  news: NewsAnnouncement[];
  mlDataset: TagalogMLSample[];
  logs: ActivityLog[];
}): Promise<{ success: boolean; message: string }> {
  try {
    const firestore = getFirebaseDb();
    if (!firestore) {
      return { success: false, message: "Firebase is not initialized. Please verify configuration keys." };
    }

    for (const survey of data.surveys) {
      await setDoc(doc(firestore, COLLECTIONS.SURVEYS, String(survey.id)), survey);
    }
    for (const resp of data.responses) {
      await setDoc(doc(firestore, COLLECTIONS.RESPONSES, String(resp.id)), resp);
    }
    for (const user of data.users) {
      const docId = user.email.toLowerCase().replace(/[^a-zA-Z0-9_-]/g, "_");
      await setDoc(doc(firestore, COLLECTIONS.USERS, docId), user);
    }
    for (const news of data.news) {
      await setDoc(doc(firestore, COLLECTIONS.NEWS, news.id), news);
    }
    for (const ml of data.mlDataset) {
      await setDoc(doc(firestore, COLLECTIONS.ML_DATASET, ml.id), ml);
    }
    for (const log of data.logs) {
      await setDoc(doc(firestore, COLLECTIONS.LOGS, log.id), log);
    }

    return {
      success: true,
      message: `Successfully populated Firestore with ${data.surveys.length} surveys, ${data.responses.length} responses, and ${data.users.length} users!`,
    };
  } catch (error: any) {
    console.error("Firestore seeding failed:", error);
    return {
      success: false,
      message: error?.message || "Failed to seed Firestore data.",
    };
  }
}

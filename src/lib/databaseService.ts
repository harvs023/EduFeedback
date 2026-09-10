/**
 * ==============================================================================
 * UNIFIED DATABASE SERVICE LAYER (BRIDGE BETWEEN DEMO DATA & FIREBASE)
 * ==============================================================================
 * 
 * This service controls where the entire system gets its data from.
 * 
 * ------------------------------------------------------------------------------
 * CURRENT STATUS: [DEMO DATA MODE (LOCAL STORAGE)]
 * ------------------------------------------------------------------------------
 * Right now, `USE_FIREBASE = false`. The app uses the demo data stored in:
 *   - `/src/data/initialData.ts` (the seed demo datasets)
 *   - `/src/lib/storage.ts` (LocalStorageManager)
 * 
 * ------------------------------------------------------------------------------
 * HOW TO SWITCH TO FIREBASE IN THE FUTURE:
 * ------------------------------------------------------------------------------
 * 1. Open `/src/lib/firebase.ts` and fill in your Firebase project credentials.
 * 2. In this file (`/src/lib/databaseService.ts`), locate Line 35:
 * 
 *      Change:
 *        export const USE_FIREBASE = false;
 *      To:
 *        export const USE_FIREBASE = true;
 * 
 * 3. In `/src/App.tsx`, see the comment block in `useEffect(() => { ... })`:
 *    Uncomment the `loadFromFirebase()` call and comment out `LocalStorageManager.init()`.
 *    (Full instructions are also written in App.tsx right above that block!)
 * ==============================================================================
 */

import { LocalStorageManager } from "./storage";
import {
  FirestoreSurveyService,
  FirestoreResponseService,
  FirestoreUserService,
  FirestoreNewsService,
  FirestoreMLService,
  FirestoreLogsService,
  isFirebaseConfigured,
} from "./firebase";
import {
  Survey,
  SurveyResponse,
  UserProfile,
  NewsAnnouncement,
  TagalogMLSample,
  ActivityLog,
} from "../types";

// ==============================================================================
// ⭐️ MAIN TOGGLE: CHANGE THIS BOOLEAN TO SWITCH BETWEEN DEMO DATA & FIREBASE
// ==============================================================================
// Set to TRUE when your Firebase credentials are added to src/lib/firebase.ts:
export const USE_FIREBASE = false; 

export class DatabaseService {
  /**
   * Status check of active persistence mode
   */
  static getMode(): "demo_local" | "firebase" {
    if (USE_FIREBASE && isFirebaseConfigured()) {
      return "firebase";
    }
    return "demo_local";
  }

  // ==========================================
  // SURVEYS
  // ==========================================
  static async getSurveys(): Promise<Survey[]> {
    if (USE_FIREBASE && isFirebaseConfigured()) {
      try {
        const surveys = await FirestoreSurveyService.getAll();
        if (surveys.length > 0) return surveys;
      } catch (err) {
        console.warn("Firestore error, falling back to local demo surveys:", err);
      }
    }
    // DEMO DATA FALLBACK
    return LocalStorageManager.getSurveys();
  }

  static async saveSurvey(survey: Survey): Promise<void> {
    if (USE_FIREBASE && isFirebaseConfigured()) {
      try {
        await FirestoreSurveyService.save(survey);
        return;
      } catch (err) {
        console.warn("Firestore save failed, saving to local storage:", err);
      }
    }
    // DEMO DATA FALLBACK
    const current = LocalStorageManager.getSurveys();
    const updated = [survey, ...current.filter((s) => s.id !== survey.id)];
    LocalStorageManager.saveSurveys(updated);
  }

  // ==========================================
  // SURVEY RESPONSES
  // ==========================================
  static async getResponses(): Promise<SurveyResponse[]> {
    if (USE_FIREBASE && isFirebaseConfigured()) {
      try {
        const responses = await FirestoreResponseService.getAll();
        return responses;
      } catch (err) {
        console.warn("Firestore error, falling back to local demo responses:", err);
      }
    }
    // DEMO DATA FALLBACK
    return LocalStorageManager.getResponses();
  }

  static async saveResponse(response: SurveyResponse): Promise<void> {
    if (USE_FIREBASE && isFirebaseConfigured()) {
      try {
        await FirestoreResponseService.add(response);
        return;
      } catch (err) {
        console.warn("Firestore save response failed, saving to local storage:", err);
      }
    }
    // DEMO DATA FALLBACK
    LocalStorageManager.saveResponse(response);
  }

  // ==========================================
  // USERS
  // ==========================================
  static async getUsers(): Promise<UserProfile[]> {
    if (USE_FIREBASE && isFirebaseConfigured()) {
      try {
        const users = await FirestoreUserService.getAll();
        if (users.length > 0) return users;
      } catch (err) {
        console.warn("Firestore error, falling back to local demo users:", err);
      }
    }
    // DEMO DATA FALLBACK
    return LocalStorageManager.getUsers();
  }

  static async saveUser(user: UserProfile): Promise<void> {
    if (USE_FIREBASE && isFirebaseConfigured()) {
      try {
        await FirestoreUserService.save(user);
        return;
      } catch (err) {
        console.warn("Firestore save user failed, saving to local storage:", err);
      }
    }
    // DEMO DATA FALLBACK
    const current = LocalStorageManager.getUsers();
    const updated = [user, ...current.filter((u) => u.email !== user.email)];
    LocalStorageManager.saveUsers(updated);
  }

  // ==========================================
  // NEWS & ANNOUNCEMENTS
  // ==========================================
  static async getNews(): Promise<NewsAnnouncement[]> {
    if (USE_FIREBASE && isFirebaseConfigured()) {
      try {
        const news = await FirestoreNewsService.getAll();
        if (news.length > 0) return news;
      } catch (err) {
        console.warn("Firestore error, falling back to local demo news:", err);
      }
    }
    // DEMO DATA FALLBACK
    return LocalStorageManager.getNews();
  }

  static async saveNews(newsItem: NewsAnnouncement): Promise<void> {
    if (USE_FIREBASE && isFirebaseConfigured()) {
      try {
        await FirestoreNewsService.save(newsItem);
        return;
      } catch (err) {
        console.warn("Firestore save news failed, saving to local storage:", err);
      }
    }
    // DEMO DATA FALLBACK
    const current = LocalStorageManager.getNews();
    const updated = [newsItem, ...current.filter((n) => n.id !== newsItem.id)];
    LocalStorageManager.saveNews(updated);
  }

  // ==========================================
  // MACHINE LEARNING DATASET SAMPLES
  // ==========================================
  static async getMLDataset(): Promise<TagalogMLSample[]> {
    if (USE_FIREBASE && isFirebaseConfigured()) {
      try {
        const dataset = await FirestoreMLService.getAll();
        if (dataset.length > 0) return dataset;
      } catch (err) {
        console.warn("Firestore error, falling back to local demo ML samples:", err);
      }
    }
    // DEMO DATA FALLBACK
    return LocalStorageManager.getMLDataset();
  }

  static async addMLSample(sample: TagalogMLSample): Promise<void> {
    if (USE_FIREBASE && isFirebaseConfigured()) {
      try {
        await FirestoreMLService.add(sample);
        return;
      } catch (err) {
        console.warn("Firestore add ML sample failed, saving to local storage:", err);
      }
    }
    // DEMO DATA FALLBACK
    const current = LocalStorageManager.getMLDataset();
    LocalStorageManager.saveMlDataset([sample, ...current]);
  }

  // ==========================================
  // ACTIVITY LOGS
  // ==========================================
  static async getLogs(): Promise<ActivityLog[]> {
    if (USE_FIREBASE && isFirebaseConfigured()) {
      try {
        const logs = await FirestoreLogsService.getAll();
        if (logs.length > 0) return logs;
      } catch (err) {
        console.warn("Firestore error, falling back to local demo logs:", err);
      }
    }
    // DEMO DATA FALLBACK
    return LocalStorageManager.getLogs();
  }

  static async addLog(log: ActivityLog): Promise<void> {
    if (USE_FIREBASE && isFirebaseConfigured()) {
      try {
        await FirestoreLogsService.add(log);
        return;
      } catch (err) {
        console.warn("Firestore add log failed, saving to local storage:", err);
      }
    }
    // DEMO DATA FALLBACK
    LocalStorageManager.addLog(log);
  }
}

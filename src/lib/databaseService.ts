/**
 * ==============================================================================
 * UNIFIED DATABASE & AUTHENTICATION SERVICE LAYER
 * ==============================================================================
 * Manages persistent storage and authentication.
 * Automatically utilizes Google Firebase (Firestore + Auth) when configured,
 * or persistent local storage for local deployment and testing.
 */

import { LocalStorageManager } from "./storage";
import {
  FirestoreSurveyService,
  FirestoreResponseService,
  FirestoreUserService,
  FirestoreNewsService,
  FirestoreMLService,
  FirestoreLogsService,
  FirebaseAuthService,
  isFirebaseConfigured,
  seedFirestoreWithData,
} from "./firebase";
import {
  Survey,
  SurveyResponse,
  UserProfile,
  NewsAnnouncement,
  TagalogMLSample,
  ActivityLog,
} from "../types";

// Automatically activates Firebase if valid configuration environment keys are present
export const USE_FIREBASE = isFirebaseConfigured();

export class DatabaseService {
  /**
   * Check current active storage engine
   */
  static getMode(): "local" | "firebase" {
    return isFirebaseConfigured() ? "firebase" : "local";
  }

  // ==========================================
  // AUTHENTICATION
  // ==========================================
  static async login(email: string, password: string): Promise<{ success: boolean; user?: UserProfile; error?: string }> {
    const cleanEmail = email.trim().toLowerCase();

    if (!cleanEmail) {
      return { success: false, error: "Please enter your university email address." };
    }
    if (!password) {
      return { success: false, error: "Please enter your account password." };
    }

    // If Firebase Auth is configured, attempt Firebase login
    if (isFirebaseConfigured()) {
      try {
        await FirebaseAuthService.signIn(cleanEmail, password);
        // Fetch user profile from Firestore or local
        const cloudUser = await FirestoreUserService.getByEmail(cleanEmail);
        if (cloudUser) {
          if (cloudUser.status === "suspended") {
            return { success: false, error: "This university account has been suspended by system administration." };
          }
          return { success: true, user: cloudUser };
        }
      } catch (err: any) {
        console.warn("Firebase Auth attempt failed:", err?.message);
        // Fall through to verify local registered users if Firebase call returned user-not-found
      }
    }

    // Verify password first
    const isValidPassword = LocalStorageManager.verifyPassword(cleanEmail, password);
    if (!isValidPassword) {
      return {
        success: false,
        error: "Incorrect password. Please verify your credentials or select a demo user card.",
      };
    }

    // Verify against local registered accounts
    const localUsers = LocalStorageManager.getUsers();
    let foundUser = localUsers.find((u) => u.email.toLowerCase() === cleanEmail);

    // Special check for superadmin initial credential
    if (!foundUser && cleanEmail === "admin@edufeedback.edu") {
      const adminUser: UserProfile = {
        email: "admin@edufeedback.edu",
        name: "System Administrator",
        pos: "Superadmin",
        role: "superadmin",
        status: "active",
        joined: "Jan 15, 2024",
      };
      LocalStorageManager.addUser(adminUser);
      foundUser = adminUser;
    }

    if (foundUser) {
      if (foundUser.status === "suspended") {
        return { success: false, error: "This university account has been suspended by system administration." };
      }
      return { success: true, user: foundUser };
    }

    return {
      success: false,
      error: "Account not found with this email. Please check your credentials or register a new account.",
    };
  }

  static async register(userProfile: UserProfile, password: string): Promise<{ success: boolean; user?: UserProfile; error?: string }> {
    const cleanEmail = userProfile.email.trim().toLowerCase();

    // Check for existing account
    const existing = LocalStorageManager.getUsers().find((u) => u.email.toLowerCase() === cleanEmail);
    if (existing) {
      return { success: false, error: "An account with this university email address already exists. Please sign in." };
    }

    const newUser: UserProfile = {
      ...userProfile,
      email: cleanEmail,
      status: "active",
      joined: new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
    };

    // Save password locally
    LocalStorageManager.savePassword(cleanEmail, password);

    // If Firebase is available, register to Firebase Auth & Firestore
    if (isFirebaseConfigured()) {
      try {
        await FirebaseAuthService.register(cleanEmail, password);
        await FirestoreUserService.save(newUser);
      } catch (err: any) {
        console.warn("Firebase registration warning:", err?.message);
      }
    }

    // Always persist to local accounts registry
    LocalStorageManager.addUser(newUser);
    return { success: true, user: newUser };
  }

  static async signOut(): Promise<void> {
    if (isFirebaseConfigured()) {
      try {
        await FirebaseAuthService.signOut();
      } catch (err) {
        console.warn("Firebase signout error:", err);
      }
    }
    LocalStorageManager.setCurrentUser(null);
  }

  // ==========================================
  // SURVEYS
  // ==========================================
  static async getSurveys(): Promise<Survey[]> {
    if (isFirebaseConfigured()) {
      try {
        const cloudSurveys = await FirestoreSurveyService.getAll();
        if (cloudSurveys.length > 0) return cloudSurveys;
      } catch (err) {
        console.warn("Firestore survey fetch failed:", err);
      }
    }
    return LocalStorageManager.getSurveys();
  }

  static async saveSurvey(survey: Survey): Promise<void> {
    if (isFirebaseConfigured()) {
      try {
        await FirestoreSurveyService.save(survey);
      } catch (err) {
        console.warn("Firestore survey save failed:", err);
      }
    }
    const current = LocalStorageManager.getSurveys();
    const updated = [survey, ...current.filter((s) => s.id !== survey.id)];
    LocalStorageManager.saveSurveys(updated);
  }

  static async deleteSurvey(surveyId: string | number): Promise<void> {
    if (isFirebaseConfigured()) {
      try {
        await FirestoreSurveyService.delete(surveyId);
      } catch (err) {
        console.warn("Firestore survey delete failed:", err);
      }
    }
    const current = LocalStorageManager.getSurveys();
    const updated = current.filter((s) => s.id !== surveyId);
    LocalStorageManager.saveSurveys(updated);
  }

  // ==========================================
  // SURVEY RESPONSES
  // ==========================================
  static async getResponses(): Promise<SurveyResponse[]> {
    if (isFirebaseConfigured()) {
      try {
        const cloudResponses = await FirestoreResponseService.getAll();
        if (cloudResponses.length > 0) return cloudResponses;
      } catch (err) {
        console.warn("Firestore response fetch failed:", err);
      }
    }
    return LocalStorageManager.getResponses();
  }

  static async saveResponse(response: SurveyResponse): Promise<void> {
    if (isFirebaseConfigured()) {
      try {
        await FirestoreResponseService.add(response);
      } catch (err) {
        console.warn("Firestore response save failed:", err);
      }
    }
    LocalStorageManager.saveResponse(response);
  }

  // ==========================================
  // USERS
  // ==========================================
  static async getUsers(): Promise<UserProfile[]> {
    if (isFirebaseConfigured()) {
      try {
        const cloudUsers = await FirestoreUserService.getAll();
        if (cloudUsers.length > 0) return cloudUsers;
      } catch (err) {
        console.warn("Firestore users fetch failed:", err);
      }
    }
    return LocalStorageManager.getUsers();
  }

  static async saveUser(user: UserProfile): Promise<void> {
    if (isFirebaseConfigured()) {
      try {
        await FirestoreUserService.save(user);
      } catch (err) {
        console.warn("Firestore user save failed:", err);
      }
    }
    const current = LocalStorageManager.getUsers();
    const updated = [user, ...current.filter((u) => u.email.toLowerCase() !== user.email.toLowerCase())];
    LocalStorageManager.saveUsers(updated);
  }

  static async deleteUser(email: string): Promise<void> {
    if (isFirebaseConfigured()) {
      try {
        await FirestoreUserService.delete(email);
      } catch (err) {
        console.warn("Firestore user delete failed:", err);
      }
    }
    LocalStorageManager.deleteUser(email);
  }

  // ==========================================
  // NEWS & ANNOUNCEMENTS
  // ==========================================
  static async getNews(): Promise<NewsAnnouncement[]> {
    if (isFirebaseConfigured()) {
      try {
        const cloudNews = await FirestoreNewsService.getAll();
        if (cloudNews.length > 0) return cloudNews;
      } catch (err) {
        console.warn("Firestore news fetch failed:", err);
      }
    }
    return LocalStorageManager.getNews();
  }

  static async saveNews(newsItem: NewsAnnouncement): Promise<void> {
    if (isFirebaseConfigured()) {
      try {
        await FirestoreNewsService.save(newsItem);
      } catch (err) {
        console.warn("Firestore news save failed:", err);
      }
    }
    const current = LocalStorageManager.getNews();
    const updated = [newsItem, ...current.filter((n) => n.id !== newsItem.id)];
    LocalStorageManager.saveNews(updated);
  }

  static async likeNews(id: string): Promise<void> {
    if (isFirebaseConfigured()) {
      try {
        await FirestoreNewsService.incrementLike(id);
      } catch (err) {
        console.warn("Firestore like increment failed:", err);
      }
    }
    const current = LocalStorageManager.getNews();
    const updated = current.map((n) => (n.id === id ? { ...n, likesCount: n.likesCount + 1 } : n));
    LocalStorageManager.saveNews(updated);
  }

  // ==========================================
  // MACHINE LEARNING DATASET SAMPLES
  // ==========================================
  static async getMLDataset(): Promise<TagalogMLSample[]> {
    if (isFirebaseConfigured()) {
      try {
        const cloudDataset = await FirestoreMLService.getAll();
        if (cloudDataset.length > 0) return cloudDataset;
      } catch (err) {
        console.warn("Firestore ML fetch failed:", err);
      }
    }
    return LocalStorageManager.getMLDataset();
  }

  static async addMLSample(sample: TagalogMLSample): Promise<void> {
    if (isFirebaseConfigured()) {
      try {
        await FirestoreMLService.add(sample);
      } catch (err) {
        console.warn("Firestore ML sample add failed:", err);
      }
    }
    const current = LocalStorageManager.getMLDataset();
    LocalStorageManager.saveMlDataset([sample, ...current]);
  }

  // ==========================================
  // ACTIVITY LOGS
  // ==========================================
  static async getLogs(): Promise<ActivityLog[]> {
    if (isFirebaseConfigured()) {
      try {
        const cloudLogs = await FirestoreLogsService.getAll();
        if (cloudLogs.length > 0) return cloudLogs;
      } catch (err) {
        console.warn("Firestore logs fetch failed:", err);
      }
    }
    return LocalStorageManager.getLogs();
  }

  static async addLog(log: ActivityLog): Promise<void> {
    if (isFirebaseConfigured()) {
      try {
        await FirestoreLogsService.add(log);
      } catch (err) {
        console.warn("Firestore log add failed:", err);
      }
    }
    LocalStorageManager.addLog(log);
  }

  /**
   * Migrate and seed Firebase Firestore from current data
   */
  static async seedFirebaseCloud(data: {
    surveys: Survey[];
    responses: SurveyResponse[];
    users: UserProfile[];
    news: NewsAnnouncement[];
    mlDataset: TagalogMLSample[];
    logs: ActivityLog[];
  }) {
    return seedFirestoreWithData(data);
  }
}

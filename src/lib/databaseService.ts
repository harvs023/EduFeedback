/**
 * ==============================================================================
 * UNIFIED DATABASE & AUTHENTICATION SERVICE LAYER
 * ==============================================================================
 * Manages persistent storage and authentication.
 * Automatically utilizes Google Firebase (Firestore + Auth) when configured,
 * or persistent local storage for local deployment and testing.
 */

import {
  FirestoreSurveyService,
  FirestoreResponseService,
  FirestoreUserService,
  FirestoreNewsService,
  FirestoreMLService,
  FirestoreLogsService,
  FirestoreNotificationService,
  FirebaseAuthService,
  isFirebaseConfigured,
  getFirebaseAuth,
  firebaseConfig,
  seedFirestoreWithData,
  wipeFirestoreCloudData,
} from "./firebase";
import {
  Survey,
  SurveyResponse,
  UserProfile,
  NewsAnnouncement,
  TagalogMLSample,
  ActivityLog,
  AccountStatus,
  NotificationItem,
} from "../types";
import {
  MASTER_ADMIN_EMAIL,
  MASTER_ADMIN_USER,
} from "../data/initialData";

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
    const cleanEmail = (email || "").trim().toLowerCase();

    if (!cleanEmail) {
      return { success: false, error: "Please enter your university email address." };
    }
    if (!password) {
      return { success: false, error: "Please enter your account password." };
    }

    try {
      await FirebaseAuthService.signIn(cleanEmail, password);
    } catch (firebaseError: any) {
      if (
        firebaseError?.code === "auth/operation-not-allowed" ||
        firebaseError?.message?.includes("PASSWORD_LOGIN_DISABLED") ||
        firebaseError?.message?.includes("operation-not-allowed")
      ) {
        return {
          success: false,
          error: "Email/Password sign-in is disabled in your Firebase project. In the Firebase Console, navigate to Build > Authentication > Sign-in method, click 'Email/Password', and enable it.",
        };
      }
      if (firebaseError?.code === "auth/user-not-found") {
        return {
          success: false,
          error: `No account found for "${cleanEmail}" in Firebase Authentication. If you haven't registered yet, click "Create Account".`,
        };
      }
      if (
        firebaseError?.code === "auth/wrong-password" ||
        firebaseError?.code === "auth/invalid-credential" ||
        firebaseError?.code === "auth/invalid-login-credentials"
      ) {
        return {
          success: false,
          error: "Incorrect password for this account. Please verify your credentials and try again.",
        };
      }
      if (firebaseError?.code === "auth/too-many-requests") {
        return {
          success: false,
          error: "Too many failed attempts. Access to this account has been temporarily disabled. Please reset your password or try again later.",
        };
      }
      return {
        success: false,
        error: firebaseError?.message || "Invalid email or password.",
      };
    }

    // Auth succeeded: retrieve profile from Firestore
    let cloudUser = await FirestoreUserService.getByEmail(cleanEmail);
    if (!cloudUser) {
      if (cleanEmail === MASTER_ADMIN_EMAIL.toLowerCase()) {
        cloudUser = MASTER_ADMIN_USER;
        await FirestoreUserService.save(MASTER_ADMIN_USER).catch(() => {});
      } else {
        await FirebaseAuthService.signOut();
        return {
          success: false,
          error: "User profile record was not found in Firestore. Please contact your system administrator.",
        };
      }
    }

    if (cloudUser.status === "suspended") {
      await FirebaseAuthService.signOut();
      return { success: false, error: "This university account has been suspended by system administration." };
    }
    if (cloudUser.status === "pending_approval") {
      await FirebaseAuthService.signOut();
      return {
        success: false,
        error: "Your account is currently awaiting administrative approval from the System Administrator. Please check back once an administrator verifies your faculty/officer credentials.",
      };
    }

    return { success: true, user: cloudUser };
  }

  static async register(userProfile: UserProfile, password: string): Promise<{ success: boolean; user?: UserProfile; error?: string }> {
    const cleanEmail = userProfile.email.trim().toLowerCase();
    const isFacultyOrOfficer = userProfile.pos === "Faculty" || userProfile.pos === "Student Officer";
    const initialStatus: AccountStatus = userProfile.status || (isFacultyOrOfficer ? "pending_approval" : "active");

    const newUser: UserProfile = {
      ...userProfile,
      email: cleanEmail,
      status: initialStatus,
      joined: new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
    };

    try {
      await FirebaseAuthService.register(cleanEmail, password);
      await FirestoreUserService.save(newUser);
      return { success: true, user: newUser };
    } catch (err: any) {
      return { success: false, error: err?.message || "Failed to create account with Firebase." };
    }
  }

  static async signOut(): Promise<void> {
    await FirebaseAuthService.signOut();
  }

  // ==========================================
  // SURVEYS
  // ==========================================
  static async getSurveys(): Promise<Survey[]> {
    return await FirestoreSurveyService.getAll();
  }

  static async saveSurvey(survey: Survey): Promise<void> {
    await FirestoreSurveyService.save(survey);
  }

  static async deleteSurvey(surveyId: string | number): Promise<void> {
    await FirestoreSurveyService.delete(surveyId);
  }

  // ==========================================
  // SURVEY RESPONSES
  // ==========================================
  static async getResponses(currentUser?: UserProfile | null, ownedSurveys?: Survey[]): Promise<SurveyResponse[]> {
    if (!currentUser) return [];

    const isSuperadmin = currentUser.role === "superadmin" || currentUser.pos === "Superadmin";

    if (isSuperadmin) {
      return await FirestoreResponseService.getAll();
    }

    const userEmail = currentUser.email.trim().toLowerCase();
    const myOwnedSurveyIds = (ownedSurveys || [])
      .filter((s) => (s.owner || "").trim().toLowerCase() === userEmail)
      .map((s) => s.id);

    const promises: Promise<SurveyResponse[]>[] = [];
    for (const id of myOwnedSurveyIds) {
      promises.push(FirestoreResponseService.getBySurveyId(id));
    }
    promises.push(FirestoreResponseService.getByUserEmail(userEmail));

    const results = await Promise.all(promises);
    const combined = results.flat();
    const seen = new Set<string>();
    return combined.filter((r) => {
      const key = String(r.id);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  static async saveResponse(response: SurveyResponse): Promise<void> {
    await FirestoreResponseService.add(response);
    await FirestoreSurveyService.incrementResponses(response.surveyId);
  }

  // ==========================================
  // USERS
  // ==========================================
  static async getUsers(currentUser?: UserProfile | null): Promise<UserProfile[]> {
    if (!currentUser || (currentUser.role !== "superadmin" && currentUser.pos !== "Superadmin")) {
      return [];
    }
    return await FirestoreUserService.getAll();
  }

  static async saveUser(user: UserProfile): Promise<void> {
    const cleanEmail = user.email.trim().toLowerCase();
    const normalizedUser: UserProfile = { ...user, email: cleanEmail };
    await FirestoreUserService.save(normalizedUser);
  }

  static async deleteUser(email: string): Promise<void> {
    const cleanEmail = email.trim().toLowerCase();
    if (cleanEmail === MASTER_ADMIN_EMAIL.toLowerCase()) {
      throw new Error("The root System Administrator account is permanent and cannot be deleted.");
    }
    await FirestoreUserService.delete(cleanEmail);
  }

  // ==========================================
  // NEWS & ANNOUNCEMENTS
  // ==========================================
  static async getNews(): Promise<NewsAnnouncement[]> {
    return await FirestoreNewsService.getAll();
  }

  static async saveNews(newsItem: NewsAnnouncement): Promise<void> {
    await FirestoreNewsService.save(newsItem);
  }

  static async likeNews(id: string): Promise<void> {
    await FirestoreNewsService.incrementLike(id);
  }

  // ==========================================
  // MACHINE LEARNING DATASET SAMPLES
  // ==========================================
  static async getMLDataset(currentUser?: UserProfile | null): Promise<TagalogMLSample[]> {
    return await FirestoreMLService.getAll();
  }

  static async addMLSample(sample: TagalogMLSample): Promise<void> {
    await FirestoreMLService.add(sample);
  }

  static async deleteMLSample(id: string): Promise<void> {
    await FirestoreMLService.delete(id);
  }

  // ==========================================
  // ACTIVITY LOGS
  // ==========================================
  static async getLogs(currentUser?: UserProfile | null): Promise<ActivityLog[]> {
    if (!currentUser || currentUser.role !== "superadmin") {
      return [];
    }
    return await FirestoreLogsService.getAll();
  }

  static async addLog(log: Omit<ActivityLog, "id" | "time"> | ActivityLog): Promise<void> {
    try {
      await FirestoreLogsService.add(log);
    } catch (err) {
      console.warn("Failed to write activity log:", err);
    }
  }

  // ==========================================
  // NOTIFICATIONS
  // ==========================================
  static async getNotifications(email: string): Promise<NotificationItem[]> {
    return await FirestoreNotificationService.getByEmail(email);
  }

  static async addNotification(item: {
    to: string;
    title: string;
    message: string;
    icon?: string;
    type?: string;
    data?: any;
  }): Promise<void> {
    await FirestoreNotificationService.add(item);
  }

  static async markNotificationRead(id: string): Promise<void> {
    await FirestoreNotificationService.markAsRead(id);
  }

  static async markAllNotificationsRead(notifications: NotificationItem[]): Promise<void> {
    await FirestoreNotificationService.markAllAsRead(notifications);
  }

  static async deleteNotification(id: string): Promise<void> {
    await FirestoreNotificationService.delete(id);
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

  /**
   * Wipe all collections from Cloud Firestore
   */
  static async wipeFirebaseCloud() {
    return wipeFirestoreCloudData();
  }
}

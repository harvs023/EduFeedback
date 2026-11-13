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
  FirestoreLogsService,
  FirestoreNotificationService,
  FirestoreTopicService,
  FirestoreAcademicCalendarService,
  FirestoreEvaluationService,
  FirestoreSettingsService,
  FirebaseAuthService,
  isFirebaseConfigured,
  seedFirestoreWithData,
  wipeFirestoreCloudData,
} from "./firebase";
import {
  Survey,
  SurveyResponse,
  UserProfile,
  NewsAnnouncement,
  ActivityLog,
  AccountStatus,
  NotificationItem,
  Topic,
  AcademicYearTerms,
  EvaluationRun,
  ResponseReview,
  AppSettings,
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
          error: "Your profile was not found. If you signed up recently, please register again with the same email and password. If that does not work, contact the system administrator.",
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

  /** True while a sign-up is running, so the app's login listener does not sign the new user out early. */
  static isRegistering = false;

  static async register(userProfile: UserProfile, password: string): Promise<{ success: boolean; user?: UserProfile; error?: string }> {
    const cleanEmail = userProfile.email.trim().toLowerCase();
    const isFacultyOrOfficer = userProfile.pos === "Faculty" || userProfile.pos === "Student Officer";
    // Role and status always follow the position. The security rules check these exact pairs.
    const role: UserProfile["role"] =
      userProfile.pos === "Faculty" ? "faculty" : userProfile.pos === "Student Officer" ? "officer" : "user";
    const initialStatus: AccountStatus = isFacultyOrOfficer ? "pending_approval" : "active";

    const newUser: UserProfile = {
      canCreateSurveys: true,
      canPostNews: true,
      ...userProfile,
      email: cleanEmail,
      role,
      status: initialStatus,
      joined: new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
    };

    DatabaseService.isRegistering = true;
    let createdNewLogin = false;
    try {
      try {
        await FirebaseAuthService.register(cleanEmail, password);
        createdNewLogin = true;
      } catch (authErr: any) {
        if (authErr?.code !== "auth/email-already-in-use") throw authErr;
        // The login exists already. If it has no profile (an earlier sign-up that broke halfway),
        // let the person finish it with the same email and password.
        try {
          await FirebaseAuthService.signIn(cleanEmail, password);
        } catch {
          return { success: false, error: "This email is already registered. Please sign in instead." };
        }
        const existing = await FirestoreUserService.getByEmail(cleanEmail);
        if (existing) {
          await FirebaseAuthService.signOut();
          return { success: false, error: "This email is already registered. Please sign in instead." };
        }
      }

      try {
        await FirestoreUserService.save(newUser);
      } catch (saveErr) {
        // Do not leave a login without a profile behind.
        if (createdNewLogin) await FirebaseAuthService.deleteCurrentUser().catch(() => {});
        await FirebaseAuthService.signOut().catch(() => {});
        throw saveErr;
      }

      // Accounts waiting for approval must not stay signed in.
      if (initialStatus !== "active") await FirebaseAuthService.signOut();
      return { success: true, user: newUser };
    } catch (err: any) {
      console.warn("Registration failed:", err);
      const messages: Record<string, string> = {
        "auth/invalid-email": "Please enter a valid email address.",
        "auth/weak-password": "Please choose a stronger password (at least 6 characters).",
        "auth/operation-not-allowed": "Email/password sign-up is switched off in Firebase. Ask the administrator to enable it.",
        "auth/network-request-failed": "No internet connection. Please try again.",
      };
      return {
        success: false,
        error: messages[err?.code] || "We could not create your account. Please check your details and try again.",
      };
    } finally {
      DatabaseService.isRegistering = false;
    }
  }

  static async signOut(): Promise<void> {
    await FirebaseAuthService.signOut();
  }

  // ==========================================
  // SURVEYS
  // ==========================================
  static async getSurveys(currentUser?: UserProfile | null): Promise<Survey[]> {
    return await FirestoreSurveyService.getSurveys(currentUser);
  }

  static async saveSurvey(survey: Survey): Promise<void> {
    const normalizedSurvey: Survey = {
      ...survey,
      owner: (survey.owner || "").trim().toLowerCase(),
    };
    await FirestoreSurveyService.save(normalizedSurvey);
  }

  static async archiveSurvey(surveyId: string | number, archivedBy: string, archiveReason: string, archivedAt: number): Promise<void> {
    await FirestoreSurveyService.archive(surveyId, archivedBy.trim().toLowerCase(), archiveReason, archivedAt);
  }

  static async withdrawSurvey(surveyId: string | number): Promise<void> {
    await FirestoreSurveyService.withdraw(surveyId);
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

  static async saveResponse(response: SurveyResponse, respondentEmail: string): Promise<void> {
    await FirestoreResponseService.submitWithReceipt(response, respondentEmail);
  }

  static async flagResponse(responseId: string, review: ResponseReview): Promise<void> {
    await FirestoreResponseService.flagResponse(responseId, review);
  }

  /** Admin only (the rules allow only the admin to set kept / excluded). */
  static async decideResponseFlag(responseId: string, review: ResponseReview): Promise<void> {
    await FirestoreResponseService.flagResponse(responseId, review);
  }

  static async updateResponseAnalysis(
    responseId: string,
    update: Pick<SurveyResponse, "answers" | "commentStatus" | "sentimentAnalysis" | "previousSentimentAnalyses">
  ): Promise<void> {
    await FirestoreResponseService.updateAnalysis(responseId, update);
  }

  static async getAnsweredSurveyIds(email: string): Promise<string[]> {
    return await FirestoreResponseService.getAnsweredSurveyIds(email);
  }

  // ==========================================
  // USERS
  // ==========================================
  static async getSettings(): Promise<AppSettings> {
    return await FirestoreSettingsService.get();
  }

  static async saveSettings(settings: AppSettings): Promise<void> {
    await FirestoreSettingsService.save(settings);
  }

  static async touchLastSeen(email: string): Promise<void> {
    await FirestoreUserService.touchLastSeen(email);
  }

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
  static async getNews(currentUser?: UserProfile | null): Promise<NewsAnnouncement[]> {
    return await FirestoreNewsService.getVisible(currentUser);
  }

  static async deleteNews(id: string): Promise<void> {
    await FirestoreNewsService.delete(id);
  }

  static async saveNews(newsItem: NewsAnnouncement): Promise<void> {
    await FirestoreNewsService.save(newsItem);
  }

  static async setNewsLiked(id: string, email: string, liked: boolean): Promise<void> {
    await FirestoreNewsService.setLiked(id, email, liked);
  }

  static async getLikedNewsIds(email: string): Promise<string[]> {
    return await FirestoreNewsService.getLikedNewsIds(email);
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

  // ==========================================
  // TOPICS
  // ==========================================
  static async getTopics(): Promise<Topic[]> {
    return await FirestoreTopicService.getAll();
  }

  static async saveTopic(topic: Topic): Promise<void> {
    await FirestoreTopicService.save(topic);
  }

  static async deleteTopic(topicId: string): Promise<void> {
    await FirestoreTopicService.delete(topicId);
  }

  // ==========================================
  // ACADEMIC CALENDAR
  // ==========================================
  static async getAcademicCalendar(): Promise<AcademicYearTerms[]> {
    return await FirestoreAcademicCalendarService.getAll();
  }

  static async saveAcademicYear(terms: AcademicYearTerms): Promise<void> {
    await FirestoreAcademicCalendarService.save(terms);
  }

  static async deleteAcademicYear(schoolYear: string): Promise<void> {
    await FirestoreAcademicCalendarService.delete(schoolYear);
  }

  // ==========================================
  // EVALUATION RESULTS (admin only)
  // ==========================================
  static async getEvaluationRuns(): Promise<EvaluationRun[]> {
    return await FirestoreEvaluationService.getAll();
  }

  static async saveEvaluationRun(run: EvaluationRun): Promise<void> {
    await FirestoreEvaluationService.save(run);
  }

  static async deleteEvaluationRun(id: string): Promise<void> {
    await FirestoreEvaluationService.delete(id);
  }

  /**
   * Migrate and seed Firebase Firestore from current data
   */
  static async seedFirebaseCloud(data: {
    surveys: Survey[];
    responses: SurveyResponse[];
    users: UserProfile[];
    news: NewsAnnouncement[];
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

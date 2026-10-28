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

    const isAdminIdentifier =
      cleanEmail === MASTER_ADMIN_EMAIL.toLowerCase() ||
      cleanEmail === "admin" ||
      cleanEmail === "administrator";

    const localUsers = LocalStorageManager.getUsers();
    // Case-insensitive user lookup
    let foundUser = localUsers.find((u) => {
      const uEmail = u.email.trim().toLowerCase();
      if (isAdminIdentifier && (uEmail === MASTER_ADMIN_EMAIL.toLowerCase() || u.role === "superadmin")) {
        return true;
      }
      return uEmail === cleanEmail;
    });

    // Special check for master root admin initial credential
    if (!foundUser && isAdminIdentifier) {
      foundUser = MASTER_ADMIN_USER;
      try {
        LocalStorageManager.addUser(MASTER_ADMIN_USER);
      } catch {}
    }

    // If Firebase Auth is configured, attempt Firebase login
    if (isFirebaseConfigured()) {
      let firebaseAuthSuccess = false;
      let firebaseError: any = null;

      try {
        await FirebaseAuthService.signIn(cleanEmail, password);
        firebaseAuthSuccess = true;
      } catch (err: any) {
        firebaseError = err;
        console.warn("Firebase Auth signIn error:", err?.code, err?.message);
      }

      if (firebaseAuthSuccess) {
        // Fetch user profile from Firestore or construct it
        let cloudUser = await FirestoreUserService.getByEmail(cleanEmail);
        if (!cloudUser) {
          // If master admin, initialize MASTER_ADMIN_USER in Firestore
          if (isAdminIdentifier || cleanEmail === MASTER_ADMIN_EMAIL.toLowerCase()) {
            cloudUser = MASTER_ADMIN_USER;
          } else if (foundUser) {
            cloudUser = foundUser;
          } else {
            const authInstance = getFirebaseAuth();
            cloudUser = {
              name: authInstance?.currentUser?.displayName || cleanEmail.split("@")[0],
              email: cleanEmail,
              department: "General Administration",
              pos: "Superadmin",
              role: "superadmin",
              status: "active",
              joined: new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
            };
          }
          await FirestoreUserService.save(cloudUser).catch(() => {});
        }

        if (cloudUser.status === "suspended") {
          return { success: false, error: "This university account has been suspended by system administration." };
        }
        if (cloudUser.status === "pending_approval") {
          return {
            success: false,
            error: "Your account is currently awaiting administrative approval from the System Administrator. Please check back once an administrator verifies your faculty/officer credentials.",
          };
        }
        return { success: true, user: cloudUser };
      }

      // If Firebase Auth sign in failed:
      // 1. Check if admin password matches local credentials as a fallback
      if (isAdminIdentifier && LocalStorageManager.verifyPassword(MASTER_ADMIN_EMAIL, password)) {
        return { success: true, user: MASTER_ADMIN_USER };
      }

      // 2. Specific message if Email/Password sign-in method is disabled in Firebase Console
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

      // 3. User not found in Firebase Auth
      if (firebaseError?.code === "auth/user-not-found") {
        return {
          success: false,
          error: `No account found for "${cleanEmail}" in Firebase Authentication (Project: ${firebaseConfig.projectId}). If you configured this account in a different Firebase project, ensure the project configuration is synced, or click "Create Account".`,
        };
      }

      // 4. Invalid credentials / wrong password
      if (
        firebaseError?.code === "auth/wrong-password" ||
        firebaseError?.code === "auth/invalid-credential" ||
        firebaseError?.code === "auth/invalid-login-credentials"
      ) {
        return {
          success: false,
          error: "Incorrect password for this Firebase account. Please verify your credentials and try again.",
        };
      }

      // 5. Too many requests
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

    if (!foundUser) {
      return {
        success: false,
        error: `No account found for "${cleanEmail}". If you haven't registered yet, click "Create Account" above to register, or sign in using the System Administrator credentials (${MASTER_ADMIN_EMAIL}).`,
      };
    }

    // Verify password for email or admin alias
    const isValidPassword = LocalStorageManager.verifyPassword(
      isAdminIdentifier ? MASTER_ADMIN_EMAIL : foundUser.email,
      password
    );
    if (!isValidPassword) {
      return {
        success: false,
        error: "Incorrect password. Please verify your credentials and try again.",
      };
    }

    if (foundUser.status === "suspended") {
      return { success: false, error: "This university account has been suspended by system administration." };
    }
    if (foundUser.status === "pending_approval") {
      return {
        success: false,
        error: "Your account is currently awaiting administrative approval from the System Administrator. Please check back once an administrator verifies your faculty/officer credentials.",
      };
    }
    return { success: true, user: foundUser };
  }

  static async register(userProfile: UserProfile, password: string): Promise<{ success: boolean; user?: UserProfile; error?: string }> {
    const cleanEmail = userProfile.email.trim().toLowerCase();

    // Check for existing account
    const localUsers = LocalStorageManager.getUsers();
    const exactExisting = localUsers.find((u) => u.email.trim().toLowerCase() === cleanEmail);
    if (exactExisting) {
      return { success: false, error: "An account with this university email address already exists. Please sign in." };
    }

    const isFacultyOrOfficer = userProfile.pos === "Faculty" || userProfile.pos === "Student Officer";
    const initialStatus: AccountStatus = userProfile.status || (isFacultyOrOfficer ? "pending_approval" : "active");

    const newUser: UserProfile = {
      ...userProfile,
      email: cleanEmail,
      status: initialStatus,
      joined: new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
    };

    // Save password locally with lowercase email
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
    const authInstance = getFirebaseAuth();
    if (isFirebaseConfigured() && authInstance?.currentUser) {
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
  static async getResponses(currentUser?: UserProfile | null, ownedSurveys?: Survey[]): Promise<SurveyResponse[]> {
    if (!currentUser) return [];

    const isSuperadmin = currentUser.role === "superadmin" || currentUser.pos === "Superadmin";

    // 1. Superadmin: loads everything with getAll()
    if (isSuperadmin) {
      if (isFirebaseConfigured()) {
        try {
          const cloudResponses = await FirestoreResponseService.getAll();
          return cloudResponses;
        } catch {
          return [];
        }
      }
      return LocalStorageManager.getResponses();
    }

    // 2. All non-admin users (any position):
    // (1) responses where surveyId is one of the surveys they own (queried with where('surveyId','==',id) per survey, using survey's owner email)
    // (2) their own named responses where userEmail equals their email, skipping anonymous ones
    const userEmail = currentUser.email.trim().toLowerCase();
    const myOwnedSurveyIds = (ownedSurveys || [])
      .filter((s) => (s.owner || "").trim().toLowerCase() === userEmail)
      .map((s) => s.id);

    if (isFirebaseConfigured()) {
      try {
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
      } catch {
        return [];
      }
    }

    const localAll = LocalStorageManager.getResponses();
    const seen = new Set<string>();
    return localAll.filter((r) => {
      const isOwnedSurvey = myOwnedSurveyIds.includes(r.surveyId);
      const isOwnNamedResponse = !r.isAnonymous && r.userEmail && r.userEmail.trim().toLowerCase() === userEmail;
      if (isOwnedSurvey || isOwnNamedResponse) {
        const key = String(r.id);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      }
      return false;
    });
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
  static async getUsers(currentUser?: UserProfile | null): Promise<UserProfile[]> {
    // For students and non-admins, do not load the users list at all
    if (!currentUser || (currentUser.role !== "superadmin" && currentUser.pos !== "Superadmin")) {
      return [];
    }

    if (isFirebaseConfigured()) {
      try {
        const cloudUsers = await FirestoreUserService.getAll();
        if (cloudUsers.length > 0) {
          const localUsers = LocalStorageManager.getUsers();
          // Reconcile: If a user was approved locally (status === "active"), ensure it's not reverted back to pending_approval
          const merged = cloudUsers.map((cu) => {
            const local = localUsers.find(
              (lu) => lu.email.trim().toLowerCase() === cu.email.trim().toLowerCase()
            );
            if (local && local.status === "active" && cu.status === "pending_approval") {
              // Local was approved by admin; auto-heal Firestore to match active status
              FirestoreUserService.save({ ...cu, status: "active" }).catch(() => {});
              return { ...cu, status: "active" as const };
            }
            return cu;
          });

          // Also keep any registered users that exist locally but haven't synced to cloud
          localUsers.forEach((lu) => {
            if (!merged.some((m) => m.email.trim().toLowerCase() === lu.email.trim().toLowerCase())) {
              merged.push(lu);
            }
          });

          LocalStorageManager.saveUsers(merged);
          return merged;
        }
      } catch {
        return [];
      }
    }
    return LocalStorageManager.getUsers();
  }

  static async saveUser(user: UserProfile): Promise<void> {
    const cleanEmail = user.email.trim().toLowerCase();
    const normalizedUser: UserProfile = { ...user, email: cleanEmail };

    if (isFirebaseConfigured()) {
      try {
        await FirestoreUserService.save(normalizedUser);
      } catch (err) {
        console.warn("Firestore user save failed:", err);
      }
    }
    const current = LocalStorageManager.getUsers();
    const updated = [
      normalizedUser,
      ...current.filter((u) => u.email.trim().toLowerCase() !== cleanEmail),
    ];
    LocalStorageManager.saveUsers(updated);
  }

  static async deleteUser(email: string): Promise<void> {
    const cleanEmail = email.trim().toLowerCase();
    if (cleanEmail === MASTER_ADMIN_EMAIL.toLowerCase()) {
      throw new Error("The root System Administrator account is permanent and cannot be deleted.");
    }
    if (isFirebaseConfigured()) {
      try {
        await FirestoreUserService.delete(cleanEmail);
      } catch (err) {
        console.warn("Firestore user delete failed:", err);
      }
    }
    LocalStorageManager.deleteUser(cleanEmail);
  }

  // ==========================================
  // NEWS & ANNOUNCEMENTS
  // ==========================================
  static async getNews(): Promise<NewsAnnouncement[]> {
    const authInstance = getFirebaseAuth();
    if (isFirebaseConfigured() && authInstance?.currentUser) {
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
    const authInstance = getFirebaseAuth();
    if (isFirebaseConfigured() && authInstance?.currentUser) {
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
    const authInstance = getFirebaseAuth();
    if (isFirebaseConfigured() && authInstance?.currentUser) {
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
  static async getMLDataset(currentUser?: UserProfile | null): Promise<TagalogMLSample[]> {
    const authInstance = getFirebaseAuth();
    const isAuthor =
      currentUser?.role === "superadmin" ||
      currentUser?.pos === "Superadmin" ||
      currentUser?.role === "faculty" ||
      currentUser?.role === "officer";

    if (isFirebaseConfigured() && authInstance?.currentUser && isAuthor) {
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
    const authInstance = getFirebaseAuth();
    if (isFirebaseConfigured() && authInstance?.currentUser) {
      try {
        await FirestoreMLService.add(sample);
      } catch (err) {
        console.warn("Firestore ML sample add failed:", err);
      }
    }
    const current = LocalStorageManager.getMLDataset();
    LocalStorageManager.saveMlDataset([sample, ...current]);
  }

  static async deleteMLSample(id: string): Promise<void> {
    const authInstance = getFirebaseAuth();
    if (isFirebaseConfigured() && authInstance?.currentUser) {
      try {
        await FirestoreMLService.delete(id);
      } catch (err) {
        console.warn("Firestore ML sample delete failed:", err);
      }
    }
    LocalStorageManager.deleteMlSample(id);
  }

  // ==========================================
  // ACTIVITY LOGS
  // ==========================================
  static async getLogs(currentUser?: UserProfile | null): Promise<ActivityLog[]> {
    const authInstance = getFirebaseAuth();
    const isAdmin = currentUser?.role === "superadmin" || currentUser?.pos === "Superadmin";

    if (isFirebaseConfigured() && authInstance?.currentUser && isAdmin) {
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

  /**
   * Wipe all collections from Cloud Firestore
   */
  static async wipeFirebaseCloud() {
    return wipeFirestoreCloudData();
  }
}

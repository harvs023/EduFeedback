import {
  Survey,
  SurveyResponse,
  UserProfile,
  ActivityLog,
  NewsAnnouncement,
  TagalogMLSample,
  NotificationItem,
  SystemBackupData,
  DatabaseSnapshot,
} from "../types";
import {
  INITIAL_SURVEYS,
  INITIAL_RESPONSES,
  DEFAULT_USERS,
  INITIAL_NEWS,
  INITIAL_TAGALOG_ML_DATASET,
  INITIAL_LOGS,
} from "../data/initialData";

const STORAGE_KEYS = {
  USERS: "edufeedback_users_v2",
  CURRENT_USER: "edufeedback_current_user_v2",
  SURVEYS: "edufeedback_surveys_v2",
  RESPONSES: "edufeedback_responses_v2",
  NEWS: "edufeedback_news_v2",
  ML_DATASET: "edufeedback_ml_dataset_v3",
  LOGS: "edufeedback_logs_v2",
  NOTIFICATIONS: "edufeedback_notifications_v2",
  CATEGORIES: "edufeedback_categories_v2",
  SNAPSHOTS: "edufeedback_db_snapshots_v2",
};

export class LocalStorageManager {
  static init() {
    LocalStorageManager.getUsers();
    LocalStorageManager.getSurveys();
    LocalStorageManager.getResponses();
    LocalStorageManager.getMLDataset();
    LocalStorageManager.getNews();
    LocalStorageManager.getLogs();
    if (!LocalStorageManager.getCurrentUser()) {
      LocalStorageManager.setCurrentUser(DEFAULT_USERS[1]); // Default to Juan Dela Cruz (Student)
    }
  }

  static getUsers(): UserProfile[] {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.USERS);
      if (data) return JSON.parse(data);
    } catch {}
    LocalStorageManager.setUsers(DEFAULT_USERS);
    return DEFAULT_USERS;
  }

  static setUsers(users: UserProfile[]) {
    try {
      localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));
    } catch {}
  }

  static saveUsers(users: UserProfile[]) {
    LocalStorageManager.setUsers(users);
  }

  static getCurrentUser(): UserProfile | null {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.CURRENT_USER);
      if (data) return JSON.parse(data);
    } catch {}
    return DEFAULT_USERS[1];
  }

  static setCurrentUser(user: UserProfile | null) {
    try {
      if (user) {
        localStorage.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(user));
      } else {
        localStorage.removeItem(STORAGE_KEYS.CURRENT_USER);
      }
    } catch {}
  }

  static getSurveys(): Survey[] {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.SURVEYS);
      if (data) return JSON.parse(data);
    } catch {}
    LocalStorageManager.setSurveys(INITIAL_SURVEYS);
    return INITIAL_SURVEYS;
  }

  static setSurveys(surveys: Survey[]) {
    try {
      localStorage.setItem(STORAGE_KEYS.SURVEYS, JSON.stringify(surveys));
    } catch {}
  }

  static saveSurveys(surveys: Survey[]) {
    LocalStorageManager.setSurveys(surveys);
  }

  static getResponses(): SurveyResponse[] {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.RESPONSES);
      if (data) return JSON.parse(data);
    } catch {}
    LocalStorageManager.setResponses(INITIAL_RESPONSES);
    return INITIAL_RESPONSES;
  }

  static setResponses(responses: SurveyResponse[]) {
    try {
      localStorage.setItem(STORAGE_KEYS.RESPONSES, JSON.stringify(responses));
    } catch {}
  }

  static saveResponse(response: SurveyResponse) {
    const current = LocalStorageManager.getResponses();
    const updated = [response, ...current];
    LocalStorageManager.setResponses(updated);
  }

  static getNews(): NewsAnnouncement[] {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.NEWS);
      if (data) return JSON.parse(data);
    } catch {}
    LocalStorageManager.setNews(INITIAL_NEWS);
    return INITIAL_NEWS;
  }

  static setNews(news: NewsAnnouncement[]) {
    try {
      localStorage.setItem(STORAGE_KEYS.NEWS, JSON.stringify(news));
    } catch {}
  }

  static saveNews(news: NewsAnnouncement[]) {
    LocalStorageManager.setNews(news);
  }

  static getMLDataset(): TagalogMLSample[] {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.ML_DATASET);
      if (data) return JSON.parse(data);
    } catch {}
    LocalStorageManager.setMLDataset(INITIAL_TAGALOG_ML_DATASET);
    return INITIAL_TAGALOG_ML_DATASET;
  }

  static getMlDataset(): TagalogMLSample[] {
    return LocalStorageManager.getMLDataset();
  }

  static setMLDataset(dataset: TagalogMLSample[]) {
    try {
      localStorage.setItem(STORAGE_KEYS.ML_DATASET, JSON.stringify(dataset));
    } catch {}
  }

  static saveMlDataset(dataset: TagalogMLSample[]) {
    LocalStorageManager.setMLDataset(dataset);
  }

  static getLogs(): ActivityLog[] {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.LOGS);
      if (data) return JSON.parse(data);
    } catch {}
    LocalStorageManager.setLogs(INITIAL_LOGS);
    return INITIAL_LOGS;
  }

  static setLogs(logs: ActivityLog[]) {
    try {
      localStorage.setItem(STORAGE_KEYS.LOGS, JSON.stringify(logs));
    } catch {}
  }

  static addLog(
    userOrObj: string | { user: string; pos: string; action: string; details: string },
    pos?: string,
    action?: string,
    details?: string
  ) {
    const logs = LocalStorageManager.getLogs();
    let newLog: ActivityLog;

    if (typeof userOrObj === "object") {
      newLog = {
        id: `log-${Date.now()}`,
        time: new Date().toLocaleString(),
        user: userOrObj.user,
        pos: userOrObj.pos,
        action: userOrObj.action,
        details: userOrObj.details,
        ip: "10.0.12.5",
        timestamp: Date.now(),
      };
    } else {
      newLog = {
        id: `log-${Date.now()}`,
        time: new Date().toLocaleString(),
        user: userOrObj,
        pos: pos || "User",
        action: action || "Action",
        details: details || "",
        ip: "10.0.12.5",
        timestamp: Date.now(),
      };
    }

    logs.unshift(newLog);
    LocalStorageManager.setLogs(logs.slice(0, 300));
  }

  static getNotifications(userEmail: string): NotificationItem[] {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.NOTIFICATIONS);
      if (data) {
        const all: NotificationItem[] = JSON.parse(data);
        return all.filter((n) => n.userEmail === userEmail || n.userEmail === "all");
      }
    } catch {}
    const defaultNotifs: NotificationItem[] = [
      {
        id: "notif-welcome",
        userEmail: userEmail,
        title: "🎉 Maligayang Pagdating sa EduFeedback!",
        message: "Your voice shapes the future of our institution. Start exploring themed surveys and campus updates.",
        icon: "🎉",
        time: new Date().toLocaleString(),
        displayTime: "Just now",
        read: false,
        type: "welcome",
      },
    ];
    LocalStorageManager.setNotifications(defaultNotifs);
    return defaultNotifs;
  }

  static setNotifications(notifs: NotificationItem[]) {
    try {
      localStorage.setItem(STORAGE_KEYS.NOTIFICATIONS, JSON.stringify(notifs));
    } catch {}
  }

  static addNotification(
    userEmail: string,
    title: string,
    message: string,
    icon: string,
    type: NotificationItem["type"] = "general",
    data?: any
  ) {
    const notifs: NotificationItem[] = [];
    try {
      const existing = localStorage.getItem(STORAGE_KEYS.NOTIFICATIONS);
      if (existing) notifs.push(...JSON.parse(existing));
    } catch {}

    const newNotif: NotificationItem = {
      id: `notif-${Date.now()}`,
      userEmail,
      title,
      message,
      icon,
      time: new Date().toLocaleString(),
      displayTime: "Just now",
      read: false,
      type,
      data,
    };
    notifs.unshift(newNotif);
    LocalStorageManager.setNotifications(notifs);
  }

  static getCategories(): string[] {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.CATEGORIES);
      if (data) return JSON.parse(data);
    } catch {}
    const defaults = ["Course", "Instructor", "Facilities", "Student Services", "General", "Others"];
    localStorage.setItem(STORAGE_KEYS.CATEGORIES, JSON.stringify(defaults));
    return defaults;
  }

  static setCategories(categories: string[]) {
    try {
      localStorage.setItem(STORAGE_KEYS.CATEGORIES, JSON.stringify(categories));
    } catch {}
  }

  // ==========================================
  // USER MANAGEMENT HELPERS
  // ==========================================
  static addUser(newUser: UserProfile): UserProfile[] {
    const current = LocalStorageManager.getUsers();
    // Check if email already exists
    const exists = current.some((u) => u.email.toLowerCase() === newUser.email.toLowerCase());
    if (exists) {
      throw new Error(`A user with email ${newUser.email} already exists.`);
    }
    const updated = [newUser, ...current];
    LocalStorageManager.saveUsers(updated);
    LocalStorageManager.addLog({
      user: "System Administrator",
      pos: "Superadmin",
      action: "User Created",
      details: `Registered new account for ${newUser.name} (${newUser.email}) with role ${newUser.pos}`,
    });
    return updated;
  }

  static updateUser(email: string, changes: Partial<UserProfile>): UserProfile[] {
    const current = LocalStorageManager.getUsers();
    const updated = current.map((u) => {
      if (u.email.toLowerCase() === email.toLowerCase()) {
        return { ...u, ...changes };
      }
      return u;
    });
    LocalStorageManager.saveUsers(updated);

    // If current logged in user was modified, sync session
    const cur = LocalStorageManager.getCurrentUser();
    if (cur && cur.email.toLowerCase() === email.toLowerCase()) {
      LocalStorageManager.setCurrentUser({ ...cur, ...changes });
    }

    LocalStorageManager.addLog({
      user: "System Administrator",
      pos: "Superadmin",
      action: "User Updated",
      details: `Modified profile details for account ${email}`,
    });
    return updated;
  }

  static deleteUser(email: string): UserProfile[] {
    const current = LocalStorageManager.getUsers();
    const target = current.find((u) => u.email.toLowerCase() === email.toLowerCase());
    const updated = current.filter((u) => u.email.toLowerCase() !== email.toLowerCase());
    LocalStorageManager.saveUsers(updated);

    LocalStorageManager.addLog({
      user: "System Administrator",
      pos: "Superadmin",
      action: "User Removed",
      details: `Permanently removed user account: ${target?.name || email}`,
    });
    return updated;
  }

  // ==========================================
  // SYSTEM DATABASE BACKUP & RESTORE
  // ==========================================
  static exportFullDatabase(exportedBy: string = "admin@edufeedback.edu"): SystemBackupData {
    const surveys = LocalStorageManager.getSurveys();
    const responses = LocalStorageManager.getResponses();
    const users = LocalStorageManager.getUsers();
    const mlDataset = LocalStorageManager.getMlDataset();
    const logs = LocalStorageManager.getLogs();
    const news = LocalStorageManager.getNews();
    const categories = LocalStorageManager.getCategories();

    const backup: SystemBackupData = {
      app: "EduFeedback Institutional Evaluation Platform",
      version: "2.5.0-production",
      exportedAt: new Date().toISOString(),
      exportTimestamp: Date.now(),
      exportedBy,
      stats: {
        surveysCount: surveys.length,
        responsesCount: responses.length,
        usersCount: users.length,
        mlSamplesCount: mlDataset.length,
        logsCount: logs.length,
        newsCount: news.length,
      },
      data: {
        surveys,
        responses,
        users,
        mlDataset,
        logs,
        news,
        categories,
      },
    };

    LocalStorageManager.addLog({
      user: exportedBy,
      pos: "Superadmin",
      action: "Database Backup Exported",
      details: `Full JSON snapshot created with ${surveys.length} surveys and ${responses.length} responses`,
    });

    return backup;
  }

  static importFullDatabase(
    backup: SystemBackupData,
    mode: "overwrite" | "merge" = "overwrite",
    importedBy: string = "admin@edufeedback.edu"
  ): {
    surveys: Survey[];
    responses: SurveyResponse[];
    users: UserProfile[];
    mlDataset: TagalogMLSample[];
    logs: ActivityLog[];
    news: NewsAnnouncement[];
  } {
    if (!backup || !backup.data) {
      throw new Error("Invalid backup structure: missing core data object.");
    }

    const { data } = backup;

    if (mode === "overwrite") {
      if (Array.isArray(data.surveys)) LocalStorageManager.saveSurveys(data.surveys);
      if (Array.isArray(data.responses)) LocalStorageManager.setResponses(data.responses);
      if (Array.isArray(data.users)) LocalStorageManager.saveUsers(data.users);
      if (Array.isArray(data.mlDataset)) LocalStorageManager.saveMlDataset(data.mlDataset);
      if (Array.isArray(data.logs)) LocalStorageManager.setLogs(data.logs);
      if (Array.isArray(data.news)) LocalStorageManager.saveNews(data.news);
      if (Array.isArray(data.categories)) LocalStorageManager.setCategories(data.categories);
    } else {
      // Smart Merge
      if (Array.isArray(data.surveys)) {
        const existing = LocalStorageManager.getSurveys();
        const existingIds = new Set(existing.map((s) => String(s.id)));
        const toAdd = data.surveys.filter((s) => !existingIds.has(String(s.id)));
        LocalStorageManager.saveSurveys([...toAdd, ...existing]);
      }

      if (Array.isArray(data.responses)) {
        const existing = LocalStorageManager.getResponses();
        const existingIds = new Set(existing.map((r) => String(r.id)));
        const toAdd = data.responses.filter((r) => !existingIds.has(String(r.id)));
        LocalStorageManager.setResponses([...toAdd, ...existing]);
      }

      if (Array.isArray(data.users)) {
        const existing = LocalStorageManager.getUsers();
        const existingEmails = new Set(existing.map((u) => u.email.toLowerCase()));
        const toAdd = data.users.filter((u) => !existingEmails.has(u.email.toLowerCase()));
        LocalStorageManager.saveUsers([...existing, ...toAdd]);
      }

      if (Array.isArray(data.mlDataset)) {
        const existing = LocalStorageManager.getMlDataset();
        const existingTexts = new Set(existing.map((m) => m.text.trim().toLowerCase()));
        const toAdd = data.mlDataset.filter((m) => !existingTexts.has(m.text.trim().toLowerCase()));
        LocalStorageManager.saveMlDataset([...existing, ...toAdd]);
      }

      if (Array.isArray(data.news)) {
        const existing = LocalStorageManager.getNews();
        const existingIds = new Set(existing.map((n) => n.id));
        const toAdd = data.news.filter((n) => !existingIds.has(n.id));
        LocalStorageManager.saveNews([...toAdd, ...existing]);
      }
    }

    LocalStorageManager.addLog({
      user: importedBy,
      pos: "Superadmin",
      action: "Database Restored",
      details: `Database restored from backup snapshot (Mode: ${mode.toUpperCase()})`,
    });

    return {
      surveys: LocalStorageManager.getSurveys(),
      responses: LocalStorageManager.getResponses(),
      users: LocalStorageManager.getUsers(),
      mlDataset: LocalStorageManager.getMlDataset(),
      logs: LocalStorageManager.getLogs(),
      news: LocalStorageManager.getNews(),
    };
  }

  // ==========================================
  // LOCAL SNAPSHOTS MANAGEMENT
  // ==========================================
  static getSnapshots(): DatabaseSnapshot[] {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.SNAPSHOTS);
      if (data) return JSON.parse(data);
    } catch {}
    return [];
  }

  static saveSnapshots(snapshots: DatabaseSnapshot[]) {
    try {
      localStorage.setItem(STORAGE_KEYS.SNAPSHOTS, JSON.stringify(snapshots));
    } catch {}
  }

  static createSnapshot(name: string, createdBy: string = "admin@edufeedback.edu"): DatabaseSnapshot {
    const backup = LocalStorageManager.exportFullDatabase(createdBy);
    const jsonString = JSON.stringify(backup);
    const sizeBytes = new Blob([jsonString]).size;

    const newSnapshot: DatabaseSnapshot = {
      id: `snap_${Date.now()}`,
      name: name || `Snapshot ${new Date().toLocaleDateString()}`,
      createdAt: new Date().toLocaleString(),
      timestamp: Date.now(),
      createdBy,
      stats: backup.stats,
      sizeBytes,
      data: backup.data,
    };

    const current = LocalStorageManager.getSnapshots();
    const updated = [newSnapshot, ...current].slice(0, 10); // keep up to 10 snapshots
    LocalStorageManager.saveSnapshots(updated);

    LocalStorageManager.addLog({
      user: createdBy,
      pos: "Superadmin",
      action: "Snapshot Created",
      details: `Saved institutional snapshot "${newSnapshot.name}" (${(sizeBytes / 1024).toFixed(1)} KB)`,
    });

    return newSnapshot;
  }

  static restoreSnapshot(snapshotId: string, importedBy: string = "admin@edufeedback.edu"): boolean {
    const snapshots = LocalStorageManager.getSnapshots();
    const snapshot = snapshots.find((s) => s.id === snapshotId);
    if (!snapshot) return false;

    const backupData: SystemBackupData = {
      app: "EduFeedback Institutional Evaluation Platform",
      version: "2.5.0-production",
      exportedAt: snapshot.createdAt,
      exportTimestamp: snapshot.timestamp,
      exportedBy: snapshot.createdBy,
      stats: snapshot.stats,
      data: snapshot.data,
    };

    LocalStorageManager.importFullDatabase(backupData, "overwrite", importedBy);
    return true;
  }

  static deleteSnapshot(snapshotId: string): DatabaseSnapshot[] {
    const current = LocalStorageManager.getSnapshots();
    const updated = current.filter((s) => s.id !== snapshotId);
    LocalStorageManager.saveSnapshots(updated);
    return updated;
  }

  static resetToInitialDemoData(resetBy: string = "admin@edufeedback.edu") {
    LocalStorageManager.saveSurveys(INITIAL_SURVEYS);
    LocalStorageManager.setResponses(INITIAL_RESPONSES);
    LocalStorageManager.saveUsers(DEFAULT_USERS);
    LocalStorageManager.saveNews(INITIAL_NEWS);
    LocalStorageManager.saveMlDataset(INITIAL_TAGALOG_ML_DATASET);
    LocalStorageManager.setLogs(INITIAL_LOGS);

    LocalStorageManager.addLog({
      user: resetBy,
      pos: "Superadmin",
      action: "Database Reset",
      details: "Institutional database reset to pristine factory seed demo datasets",
    });

    return {
      surveys: INITIAL_SURVEYS,
      responses: INITIAL_RESPONSES,
      users: DEFAULT_USERS,
      news: INITIAL_NEWS,
      mlDataset: INITIAL_TAGALOG_ML_DATASET,
      logs: INITIAL_LOGS,
    };
  }

  static calculateStorageMetrics(): { totalBytes: number; formattedSize: string } {
    let total = 0;
    try {
      for (const key of Object.values(STORAGE_KEYS)) {
        const item = localStorage.getItem(key);
        if (item) {
          total += new Blob([item]).size;
        }
      }
    } catch {}
    const kb = total / 1024;
    const formatted = kb > 1024 ? `${(kb / 1024).toFixed(2)} MB` : `${kb.toFixed(1)} KB`;
    return { totalBytes: total, formattedSize: formatted };
  }
}

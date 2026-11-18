import React, { useState, useEffect, useCallback, useRef } from "react";
import { Survey, SurveyStatus, SurveyResponse, UserProfile, NewsAnnouncement, ActivityLog, NotificationItem, Topic, AcademicYearTerms, ResponseReview, AppSettings, SchoolLists, SurveyReport, ReportReason, TopicBlockMove, TopicMoveRecord, ProfileChangeRequest, ProfileSchoolFields } from "./types";
import { DatabaseService } from "./lib/databaseService";
import { schoolYearFor } from "./lib/schoolYear";
import { isFirebaseConfigured, FirebaseAuthService, FirestoreUserService } from "./lib/firebase";
import { countEligibleUsers, getSurveyAvailability, isInAudience } from "./lib/surveyReview";
import {
  analyzeResponse,
  initialCommentStatus,
  needsReanalysis,
  requestServerAnalysis,
  resultKey,
  trustedResponses,
  verifySavedResults,
} from "./lib/sentiment";
import { MASTER_ADMIN_EMAIL } from "./data/initialData";
import { activeCategoryNames } from "./lib/schoolLists";
import { describeChanges, fieldKeysFor, schoolFieldsOf } from "./lib/profileRequests";
import { planUpdates, planYearMove } from "./lib/schoolYearMove";
import { SectionPickPrompt } from "./components/SectionPickPrompt";
import { OTHER_TOPIC_ID, OTHER_TOPIC_NAME } from "./lib/topicBlocks";
import { applicableCount, applyMoves } from "./lib/topicMoves";
import { Navbar } from "./components/Navbar";
import { ThemedSurveySections } from "./components/ThemedSurveySections";
import { AnalyticsPage } from "./components/analytics/AnalyticsPage";
import { SentimentAnalysisView } from "./components/SentimentAnalysisView";
import { MAX_PENDING_NEWS } from "./components/NewsAnnouncementsFeed";
import { Dashboard } from "./components/Dashboard";
import { SurveyBuilder } from "./components/SurveyBuilder";
import { MySurveysScreen } from "./components/MySurveysScreen";
import { SuperadminDashboard, type ReviewTab } from "./components/SuperadminDashboard";
import { TakeSurveyModal } from "./components/TakeSurveyModal";
import { UserProfileModal } from "./components/UserProfileModal";
import { StandaloneAuthPage } from "./components/StandaloneAuthPage";
import { notificationTarget } from "./lib/notificationTarget";
import { PrivacyNoticeModal, PRIVACY_NOTICE_VERSION } from "./components/PrivacyNotice";
import { VerifyEmailScreen } from "./components/VerifyEmailScreen";
import {
  LayoutDashboard,
  ClipboardList,
  BarChart3,
  BrainCircuit,
  PlusCircle,
  ShieldAlert,
  Sparkles,
  UserCheck,
} from "lucide-react";

export default function App() {
  // Navigation State
  const [currentView, setCurrentView] = useState<string>("dashboard");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [analyticsTargetSurveyId, setAnalyticsTargetSurveyId] = useState<string | number | "all">("all");
  const [editingSurvey, setEditingSurvey] = useState<Survey | null>(null);

  // Core Data State
  const [surveys, setSurveys] = useState<Survey[]>([]);
  const [responses, setResponses] = useState<SurveyResponse[]>([]);
  const [newsList, setNewsList] = useState<NewsAnnouncement[]>([]);
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  // Signed in, but the email is not verified yet: only the "Verify your email" screen is shown.
  const [verifyUser, setVerifyUser] = useState<UserProfile | null>(null);
  // True until Firebase says whether someone is still signed in (avoids flashing the login page on reload).
  const [authChecking, setAuthChecking] = useState<boolean>(isFirebaseConfigured());
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [academicCalendar, setAcademicCalendar] = useState<AcademicYearTerms[]>([]);
  /** Admin switches (survey creation open/closed). Defaults to open until loaded. */
  const [appSettings, setAppSettings] = useState<AppSettings>({ surveyCreationOpen: true });
  const [schoolLists, setSchoolLists] = useState<SchoolLists | null>(null);
  /** When surveys and responses were last loaded from the database (shown on Analytics). */
  const [dataLoadedAt, setDataLoadedAt] = useState<number | null>(null);

  // Modals State
  const [activeSurveyForTaking, setActiveSurveyForTaking] = useState<Survey | null>(null);
  const [previewSurvey, setPreviewSurvey] = useState<Survey | null>(null);
  const [answeredSurveyIds, setAnsweredSurveyIds] = useState<string[]>([]);
  const [likedNewsIds, setLikedNewsIds] = useState<string[]>([]);
  // Surveys this person has reported; the admin also loads every report.
  const [myReportedSurveyIds, setMyReportedSurveyIds] = useState<string[]>([]);
  const [surveyReports, setSurveyReports] = useState<SurveyReport[]>([]);
  // Locked school details: this person's latest change request, and (admin) everyone's.
  const [myProfileRequest, setMyProfileRequest] = useState<ProfileChangeRequest | null>(null);
  const [profileRequests, setProfileRequests] = useState<ProfileChangeRequest[]>([]);
  const [showRequestDecision, setShowRequestDecision] = useState(false);
  // Which Review Center page opens next (Dashboard admin cards open a specific page).
  const [reviewStartTab, setReviewStartTab] = useState<ReviewTab>("home");
  const [reviewOpenCount, setReviewOpenCount] = useState(0);
  // The one-time section pick after a "New school year" move; "Later" hides it until the next login.
  const [sectionPickLater, setSectionPickLater] = useState(false);
  const [showPrivacyNotice, setShowPrivacyNotice] = useState(false);
  // Saved sentiment results confirmed by the server's signature check (see lib/sentiment.ts).
  const [validResultKeys, setValidResultKeys] = useState<Set<string>>(new Set());
  const [signatureCheck, setSignatureCheck] = useState<"checking" | "done" | "unavailable">("done");
  const checkedResultKeys = useRef<Set<string>>(new Set());
  const [showProfileModal, setShowProfileModal] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<{ text: string; type: "success" | "info" } | null>(null);

  const showToast = (text: string, type: "success" | "info" = "success") => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 3500);
  };

  const handleMarkAllNotificationsRead = async () => {
    try {
      await DatabaseService.markAllNotificationsRead(notifications);
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      showToast("All notifications marked as read.", "info");
    } catch (err: any) {
      console.warn("Failed to mark all notifications read:", err);
    }
  };

  const handleMarkNotificationRead = async (id: string) => {
    try {
      await DatabaseService.markNotificationRead(id);
      setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
    } catch (err: any) {
      console.warn("Failed to mark notification read:", err);
    }
  };

  const handleClearAllNotifications = async () => {
    try {
      await Promise.all(notifications.map((n) => DatabaseService.deleteNotification(n.id)));
      setNotifications([]);
      showToast("Notifications cleared.", "info");
    } catch (err: any) {
      console.warn("Failed to clear notifications:", err);
    }
  };

  const loadDataForUser = useCallback(async (user: UserProfile | null) => {
    try {
      const cloudSurveys = await DatabaseService.getSurveys(user);
      setSurveys(cloudSurveys);

      const isAdmin = user?.role === "superadmin" || user?.pos === "Superadmin";
      const isSuperadmin = user?.role === "superadmin";

      const [cloudResponses, cloudUsers, cloudNews, cloudLogs] = await Promise.all([
        DatabaseService.getResponses(user, cloudSurveys).catch(() => []),
        isAdmin ? DatabaseService.getUsers(user).catch(() => []) : Promise.resolve([]),
        DatabaseService.getNews(user).catch(() => []),
        isSuperadmin ? DatabaseService.getLogs(user).catch(() => []) : Promise.resolve([]),
      ]);

      setResponses(cloudResponses);
      setDataLoadedAt(Date.now());
      setUsers(cloudUsers);
      setNewsList(cloudNews);
      setLogs(isSuperadmin ? cloudLogs : []);

      let freshTopics: Topic[] = [];
      try {
        freshTopics = await DatabaseService.getTopics();
        if (user?.role === "superadmin" && !freshTopics.some((t) => t.id === OTHER_TOPIC_ID)) {
          const other: Topic = { id: OTHER_TOPIC_ID, name: OTHER_TOPIC_NAME, status: "active", order: 9999, createdAt: Date.now() };
          await DatabaseService.saveTopic(other);
          freshTopics = [...freshTopics, other];
        }
      } catch (topicErr) {
        console.warn("Failed to load topics:", topicErr);
        freshTopics = [];
      }
      setTopics(freshTopics);
      setAcademicCalendar(await DatabaseService.getAcademicCalendar().catch(() => []));
      setAppSettings(await DatabaseService.getSettings().catch(() => ({ surveyCreationOpen: true })));
      setSchoolLists(await DatabaseService.getSchoolLists().catch(() => null));
      setAnsweredSurveyIds(user?.email ? await DatabaseService.getAnsweredSurveyIds(user.email) : []);
      setLikedNewsIds(user?.email ? await DatabaseService.getLikedNewsIds(user.email) : []);
      setMyReportedSurveyIds(
        user?.email ? (await DatabaseService.getMySurveyReports(user.email)).map((r) => String(r.surveyId)) : []
      );
      setSurveyReports(user?.role === "superadmin" ? await DatabaseService.getSurveyReports().catch(() => []) : []);
      setMyProfileRequest(user?.email ? await DatabaseService.getMyProfileRequest(user.email) : null);
      setProfileRequests(user?.role === "superadmin" ? await DatabaseService.getProfileRequests().catch(() => []) : []);
    } catch (err: any) {
      showToast(err?.message || "Failed to load data from Firestore.", "info");
    }
  }, []);

  // "Last seen" heartbeat for the admin's Active users counter: while the app is open and the tab
  // is visible, at most one tiny write to the person's own profile every 5 minutes.
  useEffect(() => {
    const email = currentUser?.email;
    if (!email || currentUser?.status !== "active") return;
    const HEARTBEAT_MS = 5 * 60 * 1000;
    let lastSent = 0;
    const beat = () => {
      if (document.visibilityState !== "visible" || Date.now() - lastSent < HEARTBEAT_MS) return;
      lastSent = Date.now();
      DatabaseService.touchLastSeen(email).catch((err) => console.warn("Could not record last seen:", err));
    };
    beat();
    const timer = setInterval(beat, 60 * 1000);
    document.addEventListener("visibilitychange", beat);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", beat);
    };
  }, [currentUser?.email, currentUser?.status]);

  /** The admin is never asked; others need a verified email unless the admin marked it as checked. */
  function needsEmailCheck(profile: UserProfile): boolean {
    if (profile.role === "superadmin" || profile.emailCheckWaived) return false;
    return !DatabaseService.isEmailVerified();
  }

  /** Remembers on the profile that the email is verified (shown in the admin's user list). */
  function noteEmailVerified(profile: UserProfile) {
    if (profile.emailVerifiedAt || !DatabaseService.isEmailVerified()) return;
    DatabaseService.markEmailVerified(profile.email, Date.now()).catch(() => {});
  }

  // Firebase Auth State Listener & Profile Synchronization
  useEffect(() => {
    if (!isFirebaseConfigured()) return;

    const unsubscribe = FirebaseAuthService.onAuthChanged(async (fbUser) => {
      try {
        await syncAuthUser(fbUser);
      } finally {
        setAuthChecking(false);
      }
    });

    async function syncAuthUser(fbUser: Parameters<Parameters<typeof FirebaseAuthService.onAuthChanged>[0]>[0]) {
      // During sign-up the profile is not saved yet; the sign-up screen finishes the login itself.
      if (DatabaseService.isRegistering) return;
      if (fbUser && fbUser.email) {
        const cleanEmail = fbUser.email.trim().toLowerCase();
        try {
          const profile = await FirestoreUserService.getByEmail(cleanEmail);
          if (!profile) {
            await FirebaseAuthService.signOut();
            setCurrentUser(null);
            setNotifications([]);
            showToast("Your profile was not found. If you signed up recently, please register again with the same email and password. If that does not work, contact the system administrator.", "info");
            return;
          }
          if (profile.status !== "active") {
            await FirebaseAuthService.signOut();
            setCurrentUser(null);
            setNotifications([]);
            showToast(
              profile.status === "suspended" && profile.graduatedAt
                ? "This account was closed because you have graduated. If this is a mistake, please contact the administrator."
                : profile.status === "suspended"
                ? "This university account has been suspended by system administration."
                : "Your account is currently awaiting administrative approval.",
              "info"
            );
            return;
          }
          if (needsEmailCheck(profile)) {
            setVerifyUser(profile);
            setCurrentUser(null);
            return;
          }
          setVerifyUser(null);
          noteEmailVerified(profile);
          setCurrentUser(profile);
          const userNotifs = await DatabaseService.getNotifications(cleanEmail);
          setNotifications(userNotifs);
          loadDataForUser(profile);
        } catch (err: any) {
          console.warn("Auth state sync error:", err);
          await FirebaseAuthService.signOut();
          setCurrentUser(null);
          setNotifications([]);
        }
      } else {
        setCurrentUser(null);
        setNotifications([]);
        setUsers([]);
        setResponses([]);
        setLogs([]);
        setTopics([]);
        setAcademicCalendar([]);
        setAnsweredSurveyIds([]);
        setLikedNewsIds([]);
        setMyReportedSurveyIds([]);
        setSurveyReports([]);
        setMyProfileRequest(null);
        setProfileRequests([]);
        setSectionPickLater(false);
        setVerifyUser(null);
      }
    }

    return () => {
      unsubscribe();
    };
  }, [loadDataForUser]);

  // One-time auto-archive effect after surveys load for closed surveys
  const archivedClosedSurveysRef = useRef<Set<string | number>>(new Set());

  useEffect(() => {
    if (!currentUser || surveys.length === 0) return;

    const isSuperadmin =
      currentUser.role === "superadmin" ||
      currentUser.pos === "Superadmin" ||
      currentUser.email?.toLowerCase() === MASTER_ADMIN_EMAIL.toLowerCase();
    const userEmail = (currentUser.email || "").trim().toLowerCase();

    const closedToArchive = surveys.filter((s) => {
      if (archivedClosedSurveysRef.current.has(s.id)) return false;
      if (s.status !== "published" && s.status !== "scheduled") return false;
      if (getSurveyAvailability(s) !== "closed") return false;
      const isOwner = (s.owner || "").trim().toLowerCase() === userEmail;
      return isSuperadmin || isOwner;
    });

    if (closedToArchive.length === 0) return;

    // Immediately record in ref to guard against loops
    closedToArchive.forEach((s) => archivedClosedSurveysRef.current.add(s.id));

    const now = Date.now();
    const updatedSurveys = closedToArchive.map((s) => ({
      ...s,
      status: "archived" as SurveyStatus,
      archivedAt: now,
      archivedBy: "system (closing date)",
      archiveReason: "Closing date reached",
    }));

    (async () => {
      for (const updated of updatedSurveys) {
        try {
          await DatabaseService.archiveSurvey(updated.id, updated.archivedBy, updated.archiveReason, updated.archivedAt);
        } catch (err) {
          console.warn("Failed to auto-archive closed survey:", err);
        }
      }
      setSurveys((prev) =>
        prev.map((s) => {
          const match = updatedSurveys.find((u) => u.id === s.id);
          return match ? match : s;
        })
      );
    })();
  }, [surveys, currentUser]);

  const handleLogin = async (user: UserProfile) => {
    if (needsEmailCheck(user)) {
      setVerifyUser(user);
      return;
    }
    setVerifyUser(null);
    setCurrentUser(user);
    setCurrentView("dashboard");
    const isAdmin = user.role === "superadmin" || user.pos === "Superadmin";
    const isSuperadmin = user.role === "superadmin";

    try {
      await DatabaseService.addLog({
        user: user.name,
        pos: user.pos,
        action: "User Authentication",
        details: `User signed in: ${user.name} (${user.email})`,
      });
    } catch (err: any) {
      console.warn("Failed to write sign-in log:", err);
    }

    showToast(`Welcome back, ${user.name}!`, "success");

    try {
      const userNotifs = await DatabaseService.getNotifications(user.email);
      setNotifications(userNotifs);

      const activeSurveys = await DatabaseService.getSurveys(user);
      setSurveys(activeSurveys);
      const [scopedResponses, scopedUsers, freshNews, freshLogs] = await Promise.all([
        DatabaseService.getResponses(user, activeSurveys).catch(() => []),
        isAdmin ? DatabaseService.getUsers(user).catch(() => []) : Promise.resolve([]),
        DatabaseService.getNews(user).catch(() => []),
        isSuperadmin ? DatabaseService.getLogs(user).catch(() => []) : Promise.resolve([]),
      ]);
      setResponses(scopedResponses);
      setDataLoadedAt(Date.now());
      setUsers(scopedUsers);
      setNewsList(freshNews);
      setLogs(isSuperadmin ? freshLogs : []);

      let freshTopics: Topic[] = [];
      try {
        freshTopics = await DatabaseService.getTopics();
        if (user?.role === "superadmin" && !freshTopics.some((t) => t.id === OTHER_TOPIC_ID)) {
          const other: Topic = { id: OTHER_TOPIC_ID, name: OTHER_TOPIC_NAME, status: "active", order: 9999, createdAt: Date.now() };
          await DatabaseService.saveTopic(other);
          freshTopics = [...freshTopics, other];
        }
      } catch (topicErr) {
        console.warn("Failed to load topics:", topicErr);
        freshTopics = [];
      }
      setTopics(freshTopics);
      setAcademicCalendar(await DatabaseService.getAcademicCalendar().catch(() => []));
      setAppSettings(await DatabaseService.getSettings().catch(() => ({ surveyCreationOpen: true })));
      setSchoolLists(await DatabaseService.getSchoolLists().catch(() => null));
      setAnsweredSurveyIds(user?.email ? await DatabaseService.getAnsweredSurveyIds(user.email) : []);
      setLikedNewsIds(user?.email ? await DatabaseService.getLikedNewsIds(user.email) : []);
      setMyReportedSurveyIds(
        user?.email ? (await DatabaseService.getMySurveyReports(user.email)).map((r) => String(r.surveyId)) : []
      );
      setSurveyReports(user?.role === "superadmin" ? await DatabaseService.getSurveyReports().catch(() => []) : []);
      setMyProfileRequest(user?.email ? await DatabaseService.getMyProfileRequest(user.email) : null);
      setProfileRequests(user?.role === "superadmin" ? await DatabaseService.getProfileRequests().catch(() => []) : []);
    } catch (err: any) {
      showToast(err?.message || "Failed to load Firestore data for user.", "info");
    }
  };

  /** Pressed "I've verified it": ask Firebase again, then continue into the app. */
  const handleCheckVerified = async (): Promise<boolean> => {
    if (!verifyUser) return false;
    const ok = await DatabaseService.refreshEmailVerified();
    if (!ok) return false;
    const at = Date.now();
    await DatabaseService.markEmailVerified(verifyUser.email, at).catch(() => {});
    await handleLogin({ ...verifyUser, emailVerifiedAt: at });
    return true;
  };

  const handleAcceptPrivacy = async () => {
    if (!currentUser) return;
    const at = Date.now();
    await DatabaseService.acceptPrivacyNotice(currentUser.email, PRIVACY_NOTICE_VERSION, at);
    setCurrentUser({ ...currentUser, privacyAcceptedAt: at, privacyNoticeVersion: PRIVACY_NOTICE_VERSION });
  };

  const handleSignOut = async () => {
    if (currentUser) {
      try {
        await DatabaseService.addLog({
          user: currentUser.name,
          pos: currentUser.pos,
          action: "User Sign Out",
          details: `User signed out: ${currentUser.name}`,
        });
      } catch {}
    }
    await DatabaseService.signOut();
    setCurrentUser(null);
    setNotifications([]);
    setUsers([]);
    setResponses([]);
    setLogs([]);
    setTopics([]);
    setAcademicCalendar([]);
    setAnsweredSurveyIds([]);
    setLikedNewsIds([]);
    setMyReportedSurveyIds([]);
    setSurveyReports([]);
    setMyProfileRequest(null);
    setProfileRequests([]);
    setSectionPickLater(false);
    showToast("Signed out successfully.", "info");
  };

  const logActivityAndRefresh = async (logData: Omit<ActivityLog, "id" | "time"> | ActivityLog) => {
    try {
      await DatabaseService.addLog(logData);
    } catch (err) {
      console.warn("Activity log write failed:", err);
    }
    if (currentUser?.role === "superadmin") {
      try {
        const refreshedLogs = await DatabaseService.getLogs(currentUser);
        setLogs(refreshedLogs);
      } catch (err) {
        console.warn("Failed to load logs:", err);
      }
    } else {
      setLogs([]);
    }
  };

  // Submit Survey Response Handler
  // Check signatures of saved results we have not checked yet (new responses, re-runs).
  useEffect(() => {
    const items = responses.flatMap((r) =>
      r.answers.flatMap((a, i) =>
        a.analysis && !checkedResultKeys.current.has(resultKey(r.id, i, a.analysis))
          ? [{ key: resultKey(r.id, i, a.analysis), text: a.answer, analysis: a.analysis }]
          : []
      )
    );
    if (items.length === 0) return;
    let cancelled = false;
    setSignatureCheck("checking");
    verifySavedResults(items).then((outcome) => {
      if (cancelled) return;
      if (!outcome) {
        setSignatureCheck("unavailable");
        return;
      }
      outcome.checked.forEach((k) => checkedResultKeys.current.add(k));
      setValidResultKeys((prev) => new Set([...prev, ...outcome.valid]));
      setSignatureCheck("done");
    });
    return () => {
      cancelled = true;
    };
  }, [responses]);

  // What Analytics and the Sentiment Analysis screen may count: confirmed results only.
  const trustedResponseList = React.useMemo(
    () => trustedResponses(responses, validResultKeys),
    [responses, validResultKeys]
  );

  const handleSubmitSurveyResponse = async (answers: any[], isAnonymous: boolean = true) => {
    if (!activeSurveyForTaking) return;

    // Saved at once, without waiting for Gemini: comments are "pending" and the server analyzes them
    // and saves the results itself. A response without comments is "no_comment", never "Positive".
    const commentStatus = initialCommentStatus(activeSurveyForTaking, answers);

    const newResponse: SurveyResponse = {
      id: `resp_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
      surveyId: activeSurveyForTaking.id,
      surveyTitle: activeSurveyForTaking.title,
      category: activeSurveyForTaking.cat,
      userEmail: isAnonymous
        ? "anonymous@school.edu.ph"
        : (currentUser?.email || "anonymous@school.edu.ph").trim().toLowerCase(),
      userName: isAnonymous ? "Anonymous Respondent" : currentUser?.name,
      isAnonymous,
      date: new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
      timestamp: Date.now(),
      // The school year it was answered in (from the academic calendar), not the survey's.
      academicYear: schoolYearFor(Date.now(), academicCalendar),
      // Only real profile details; nothing is made up for people who have none (e.g. faculty).
      ...(currentUser?.department ? { department: currentUser.department } : {}),
      ...(currentUser?.program ? { program: currentUser.program } : {}),
      ...(currentUser?.year ? { year: currentUser.year } : {}),
      // Respondents are told only department, program and year level stay with anonymous answers.
      ...(!isAnonymous && currentUser?.section ? { section: currentUser.section } : {}),
      answers,
      commentStatus,
    };

    await DatabaseService.saveResponse(newResponse, currentUser?.email || "");
    if (commentStatus === "pending") requestServerAnalysis(newResponse.id);

    // The answer window stays open here so it can show the receipt; "Done" closes it.
    setSurveys((prev) =>
      prev.map((s) => (s.id === activeSurveyForTaking.id ? { ...s, responses: (s.responses || 0) + 1 } : s))
    );
    setResponses((prev) => [newResponse, ...prev]);
    setAnsweredSurveyIds((prev) => [...prev, String(activeSurveyForTaking.id)]);

    try {
      // An anonymous answer must never put the person's name in the activity log.
      await logActivityAndRefresh({
        user: isAnonymous ? "Anonymous Respondent" : currentUser?.name || "Student",
        pos: isAnonymous ? "Anonymous" : currentUser?.pos || "Student",
        action: "Survey Response Submitted",
        details: `Submitted response for survey: "${activeSurveyForTaking.title}"`,
      });

      // Dynamic Notification: Notify survey owner
      const targetOwner = activeSurveyForTaking.owner;
      if (targetOwner && targetOwner.toLowerCase() !== currentUser?.email.toLowerCase()) {
        try {
          await DatabaseService.addNotification({
            to: targetOwner.toLowerCase(),
            title: "📝 New Survey Response",
            message: `A new response was submitted for "${activeSurveyForTaking.title}".`,
            icon: "📝",
            type: "response",
            data: { surveyId: activeSurveyForTaking.id },
          });
        } catch {}
      }
      // Dynamic Notification: Notify system admin desk if not admin
      if (currentUser?.email.toLowerCase() !== MASTER_ADMIN_EMAIL.toLowerCase()) {
        try {
          await DatabaseService.addNotification({
            to: MASTER_ADMIN_EMAIL.toLowerCase(),
            title: "📊 Response Recorded",
            message: `New response recorded for "${activeSurveyForTaking.title}" (${isAnonymous ? "Anonymous Student" : currentUser?.name || "Student"}).`,
            icon: "📊",
            type: "response",
            data: { surveyId: activeSurveyForTaking.id },
          });
        } catch {}
      }
      if (currentUser?.email) {
        const refreshed = await DatabaseService.getNotifications(currentUser.email);
        setNotifications(refreshed);
      }
    } catch (err) {
      console.warn("Response saved, but a follow-up step failed:", err);
    }
  };

  // Create / Edit Survey Handler
  const handleSaveSurvey = async (
    surveyData: Partial<Survey>,
    status: "draft" | "pending" | "published" | "scheduled"
  ) => {
    const isAdminUser = currentUser?.role === "superadmin" || currentUser?.pos === "Superadmin";

    if (!isAdminUser && currentUser?.canCreateSurveys === false) {
      showToast("Survey creation is switched off for your account. Please contact the administrator.", "info");
      return;
    }

    // Only the administrator can publish directly; everyone else goes through approval.
    const finalStatus: SurveyStatus =
      !isAdminUser && (status === "published" || status === "scheduled") ? "pending" : status;
    const now = Date.now();

    // Approval bookkeeping
    const approvalFields: Partial<Survey> =
      finalStatus === "pending"
        ? { submittedAt: now, rejectionReason: "", reviewedBy: "", reviewedAt: 0 }
        : finalStatus === "published" || finalStatus === "scheduled"
        ? {
            submittedAt: now,
            reviewedBy: (currentUser?.email || "").trim().toLowerCase(),
            reviewedAt: now,
            rejectionReason: "",
          }
        : {};

    const toastText = (title: string) =>
      finalStatus === "pending"
        ? `Survey "${title}" submitted for approval. You will be notified once it is reviewed.`
        : finalStatus === "draft"
        ? `Draft "${title}" saved.`
        : finalStatus === "scheduled"
        ? `Survey "${title}" scheduled.`
        : `Survey "${title}" published.`;

    const notifyAdminIfPending = async (survey: Survey) => {
      if (finalStatus !== "pending") return;
      try {
        await DatabaseService.addNotification({
          to: MASTER_ADMIN_EMAIL.toLowerCase(),
          title: "📝 Survey awaiting approval",
          message: `"${survey.title}" by ${survey.ownerName} is waiting for your review.`,
          icon: "📝",
          type: "survey_pending",
          data: { surveyId: survey.id },
        });
      } catch {}
    };

    // Editing an existing survey
    if (surveyData.id) {
      const existing = surveys.find((s) => s.id === surveyData.id);
      if (existing && existing.status !== "draft" && existing.status !== "rejected") {
        showToast("This survey is locked and can no longer be edited.", "info");
        return;
      }
      const updatedSurvey = {
        ...existing,
        ...surveyData,
        ...approvalFields,
        status: finalStatus,
        openDate: surveyData.openDate,
        closeDate: surveyData.closeDate,
        closes: surveyData.closeDate ? new Date(surveyData.closeDate).toLocaleDateString() : (existing?.closes || "Open"),
        questions: surveyData.questions || existing?.questions || [],
        questionCount: surveyData.questions?.length || existing?.questionCount || 0,
      } as Survey;

      try {
        await DatabaseService.saveSurvey(updatedSurvey);
        setSurveys((prev) => prev.map((s) => (s.id === surveyData.id ? updatedSurvey : s)));

        await logActivityAndRefresh({
          user: currentUser?.name || "Member",
          pos: currentUser?.pos || "Faculty",
          action: finalStatus === "pending" ? "Survey Submitted for Approval" : "Survey Updated",
          details: `${finalStatus === "pending" ? "Submitted" : "Edited"} survey "${surveyData.title || surveyData.id}"`,
        });

        await notifyAdminIfPending(updatedSurvey);
        setEditingSurvey(null);
        showToast(toastText(updatedSurvey.title), "success");
        setCurrentView("my-surveys");
      } catch (err: any) {
        showToast(err.message || "Failed to update survey.", "info");
      }
      return;
    }

    // Creating a brand new survey
    const newSurvey: Survey = {
      ...surveyData,
      ...approvalFields,
      id: `srv_${now}`,
      title: surveyData.title || "Untitled Survey",
      cat: surveyData.cat || "General",
      desc: surveyData.desc || "",
      isTrending: surveyData.isTrending || false,
      academicYear: surveyData.academicYear || schoolYearFor(now, academicCalendar),
      created: new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
      createdAtTimestamp: now,
      responses: 0,
      status: finalStatus,
      openDate: surveyData.openDate,
      closeDate: surveyData.closeDate,
      closes: surveyData.closeDate ? new Date(surveyData.closeDate).toLocaleDateString() : "Open",
      questions: surveyData.questions || [],
      questionCount: surveyData.questions?.length || 0,
      owner: (currentUser?.email || "faculty@school.edu.ph").trim().toLowerCase(),
      ownerName: currentUser?.name || "Campus Instructor",
      targetAudience: surveyData.targetAudience,
      tags: surveyData.tags || [surveyData.cat || "General"],
    };

    try {
      await DatabaseService.saveSurvey(newSurvey);
      setSurveys((prev) => [newSurvey, ...prev]);

      await logActivityAndRefresh({
        user: currentUser?.name || "Admin",
        pos: currentUser?.pos || "Faculty",
        action: finalStatus === "pending" ? "Survey Submitted for Approval" : "Survey Created",
        details: `${finalStatus === "pending" ? "Submitted" : "Created"} new survey "${newSurvey.title}"`,
      });

      await notifyAdminIfPending(newSurvey);
      setEditingSurvey(null);

      if (currentUser?.email) {
        const refreshed = await DatabaseService.getNotifications(currentUser.email);
        setNotifications(refreshed);
      }

      showToast(toastText(newSurvey.title), "success");
      setCurrentView("my-surveys");
    } catch (err: any) {
      showToast(err.message || "Failed to save survey.", "info");
    }
  };

  const handleEditSurvey = (survey: Survey) => {
    if (survey.status !== "draft" && survey.status !== "rejected") {
      showToast("Only drafts and rejected surveys can be edited. Published and pending surveys are locked.", "info");
      return;
    }
    setEditingSurvey(survey);
    setCurrentView("create");
  };

  // Admin: re-run sentiment for responses saved before this version, never analyzed, or analyzed by
  // the fallback word list. Paced at about one response every 2 seconds to stay under the server's
  // limit of 30 requests per minute.
  const handleReanalyzeResponses = async (
    onProgress: (done: number, total: number) => void
  ): Promise<{ updated: number; failed: number }> => {
    const targets = trustedResponseList
      .filter(needsReanalysis)
      .map((t) => responses.find((r) => r.id === t.id) || t);
    let updated = 0;
    let failed = 0;
    for (let i = 0; i < targets.length; i++) {
      const r = targets[i];
      const survey = surveys.find((s) => String(s.id) === String(r.surveyId));
      if (!survey) {
        failed++;
      } else {
        // The old result moves into history; it is never thrown away.
        const plainAnswers = r.answers.map(({ analysis: old, ...a }) =>
          old ? { ...a, previousAnalyses: [...(a.previousAnalyses || []), old] } : a
        );
        const previousSentimentAnalyses = [
          ...(r.previousSentimentAnalyses || []),
          ...(r.sentimentAnalysis ? [r.sentimentAnalysis] : []),
        ];
        const result = await analyzeResponse(survey, plainAnswers);
        if (result.commentStatus === "not_analyzed") {
          failed++;
        } else {
          try {
            await DatabaseService.updateResponseAnalysis(r.id, { ...result, previousSentimentAnalyses });
            setResponses((prev) =>
              prev.map((x) =>
                x.id === r.id
                  ? {
                      ...x,
                      answers: result.answers,
                      commentStatus: result.commentStatus,
                      sentimentAnalysis: result.sentimentAnalysis,
                      previousSentimentAnalyses,
                    }
                  : x
              )
            );
            updated++;
          } catch (err) {
            console.warn("Could not save re-run result:", err);
            failed++;
          }
        }
      }
      onProgress(i + 1, targets.length);
      if (i < targets.length - 1) await new Promise((res) => setTimeout(res, 2100));
    }
    if (updated > 0) {
      await logActivityAndRefresh({
        user: currentUser?.name || "Administrator",
        pos: currentUser?.pos || "Superadmin",
        action: "Sentiment Re-run",
        details: `Re-ran sentiment analysis for ${updated} response(s)`,
      });
    }
    return { updated, failed };
  };

  // Returns true when the post was saved, so the form knows it can close.
  const handleAddNews = async (news: Omit<NewsAnnouncement, "id" | "likesCount">): Promise<boolean> => {
    const isAdminUser = currentUser?.role === "superadmin" || currentUser?.pos === "Superadmin";
    const myEmail = (currentUser?.email || "").trim().toLowerCase();
    if (!isAdminUser && currentUser?.canPostNews === false) {
      showToast("Posting news is switched off for your account. Please contact the administrator.", "info");
      return false;
    }
    const myPending = newsList.filter((n) => n.status === "pending" && n.authorEmail === myEmail).length;
    if (!isAdminUser && myPending >= MAX_PENDING_NEWS) {
      showToast(`You already have ${MAX_PENDING_NEWS} posts waiting for review.`, "info");
      return false;
    }

    const now = Date.now();
    const newPost: NewsAnnouncement = {
      ...news,
      id: `news_${now}_${Math.random().toString(36).slice(2, 9)}`,
      likesCount: 0,
      authorEmail: myEmail,
      submittedAt: now,
      // Only the administrator publishes directly or pins; everyone else goes through approval.
      status: isAdminUser ? "published" : "pending",
      isPinned: isAdminUser ? Boolean(news.isPinned) : false,
      ...(isAdminUser ? { reviewedBy: myEmail, reviewedAt: now } : {}),
    };

    try {
      await DatabaseService.saveNews(newPost);
    } catch (err: any) {
      console.warn("Could not save the news post:", err);
      showToast("Could not save your post. Please try again.", "info");
      return false;
    }
    setNewsList((prev) => [newPost, ...prev]);
    showToast(
      isAdminUser ? "Announcement published!" : "Post submitted. The administrator will review it.",
      "success"
    );

    try {
      await logActivityAndRefresh({
        user: currentUser?.name || "User",
        pos: currentUser?.pos || "User",
        action: isAdminUser ? "Campus News Published" : "Campus News Submitted",
        details: `${isAdminUser ? "Published" : "Submitted for review"}: "${newPost.title}"`,
      });
      if (!isAdminUser) {
        await DatabaseService.addNotification({
          to: MASTER_ADMIN_EMAIL.toLowerCase(),
          title: "📢 News awaiting approval",
          message: `"${newPost.title}" by ${newPost.author} is waiting for your review.`,
          icon: "📢",
          type: "news",
          data: { newsId: newPost.id },
        });
      }
    } catch (err) {
      console.warn("Post saved, but a follow-up step failed:", err);
    }
    return true;
  };

  const handleReviewNews = async (id: string, decision: "approve" | "reject", reason: string = "") => {
    const post = newsList.find((n) => n.id === id);
    if (!post || post.status !== "pending") {
      showToast("Only posts waiting for review can be approved or rejected.", "info");
      return;
    }
    const cleanReason = reason.trim();
    const updated: NewsAnnouncement = {
      ...post,
      status: decision === "approve" ? "published" : "rejected",
      reviewedBy: (currentUser?.email || "").trim().toLowerCase(),
      reviewedAt: Date.now(),
      rejectionReason: decision === "reject" ? cleanReason : "",
    };
    try {
      await DatabaseService.saveNews(updated);
    } catch (err: any) {
      console.warn("Could not review the news post:", err);
      showToast("Could not save your decision. Please try again.", "info");
      return;
    }
    setNewsList((prev) => prev.map((n) => (n.id === id ? updated : n)));
    showToast(decision === "approve" ? `"${post.title}" is now published.` : `"${post.title}" was rejected.`, "success");

    try {
      await logActivityAndRefresh({
        user: currentUser?.name || "Administrator",
        pos: currentUser?.pos || "Superadmin",
        action: decision === "approve" ? "News Approved" : "News Rejected",
        details: `${decision === "approve" ? "Approved" : "Rejected"} "${post.title}"${cleanReason ? `. Reason: ${cleanReason}` : ""}`,
      });
      if (post.authorEmail) {
        await DatabaseService.addNotification({
          to: post.authorEmail,
          title: decision === "approve" ? "✅ News post approved" : "❌ News post rejected",
          message:
            decision === "approve"
              ? `Your post "${post.title}" is now published.`
              : `Your post "${post.title}" was rejected: ${cleanReason}`,
          icon: decision === "approve" ? "✅" : "❌",
          type: "news",
          data: { newsId: id },
        });
      }
    } catch (err) {
      console.warn("Decision saved, but a follow-up step failed:", err);
    }
  };

  const handleDeleteNews = async (id: string) => {
    const post = newsList.find((n) => n.id === id);
    try {
      await DatabaseService.deleteNews(id);
    } catch (err: any) {
      console.warn("Could not delete the news post:", err);
      showToast("Could not delete the post. Please try again.", "info");
      return;
    }
    setNewsList((prev) => prev.filter((n) => n.id !== id));
    showToast("Post deleted.", "info");
    await logActivityAndRefresh({
      user: currentUser?.name || "User",
      pos: currentUser?.pos || "User",
      action: "News Deleted",
      details: `Deleted news post "${post?.title || id}"`,
    });
  };

  // Like or un-like: each person can like a post once; clicking again removes the like.
  const handleLikeNews = async (id: string) => {
    if (!currentUser?.email) return;
    const liked = !likedNewsIds.includes(id);
    try {
      await DatabaseService.setNewsLiked(id, currentUser.email, liked);
      setLikedNewsIds((prev) => (liked ? [...prev, id] : prev.filter((x) => x !== id)));
      setNewsList((prev) =>
        prev.map((n) => (n.id === id ? { ...n, likesCount: Math.max(0, (n.likesCount || 0) + (liked ? 1 : -1)) } : n))
      );
    } catch (err: any) {
      showToast(err.message || "Could not save your like.", "info");
    }
  };

  const handleDeleteSurvey = async (surveyId: string | number, surveyTitle?: string) => {
    try {
      await DatabaseService.deleteSurvey(surveyId);
      setSurveys((prev) => prev.filter((s) => s.id !== surveyId));

      await logActivityAndRefresh({
        user: currentUser?.name || "User",
        pos: currentUser?.pos || "Faculty",
        action: "Survey Deleted",
        details: `Removed survey "${surveyTitle || surveyId}"`,
      });

      showToast("Survey permanently removed.", "info");
    } catch (err: any) {
      showToast(err.message || "Failed to delete survey.", "info");
    }
  };

  const handleApproveSurvey = async (surveyId: string | number) => {
    const isSuperadmin =
      currentUser?.role === "superadmin" ||
      currentUser?.pos === "Superadmin" ||
      currentUser?.email?.toLowerCase() === MASTER_ADMIN_EMAIL.toLowerCase();

    if (!isSuperadmin) {
      showToast("Unauthorized: Superadmin access required.", "info");
      return;
    }

    const srv = surveys.find((s) => s.id === surveyId);
    if (!srv) {
      showToast("Survey not found.", "info");
      return;
    }
    if (srv.status !== "pending") {
      showToast("Only pending surveys can be approved.", "info");
      return;
    }

    const now = Date.now();
    let isScheduled = false;
    if (srv.openDate) {
      const openTime = Date.parse(srv.openDate);
      if (!isNaN(openTime) && openTime > now) {
        isScheduled = true;
      }
    }

    const newStatus: SurveyStatus = isScheduled ? "scheduled" : "published";
    const adminEmail = (currentUser?.email || MASTER_ADMIN_EMAIL).trim().toLowerCase();
    const eligibleCount = countEligibleUsers(srv, users);

    const updated: Survey = {
      ...srv,
      status: newStatus,
      reviewedBy: adminEmail,
      reviewedAt: now,
      rejectionReason: "",
      eligibleCount,
    };

    try {
      await DatabaseService.saveSurvey(updated);
      setSurveys((prev) => prev.map((s) => (s.id === surveyId ? updated : s)));

      if (srv.owner) {
        try {
          const formattedOpen = srv.openDate ? new Date(srv.openDate).toLocaleDateString() : "";
          const msg = isScheduled
            ? `Your survey "${srv.title}" has been approved and is scheduled to open on ${formattedOpen}.`
            : `Your survey "${srv.title}" has been approved and published to the campus community.`;

          await DatabaseService.addNotification({
            to: srv.owner.toLowerCase(),
            title: isScheduled ? "📅 Survey Approved & Scheduled" : "✅ Survey Approved",
            message: msg,
            icon: isScheduled ? "📅" : "✅",
            type: "survey_approved",
            data: { surveyId },
          });
        } catch {}

        if (currentUser?.email) {
          const refreshed = await DatabaseService.getNotifications(currentUser.email);
          setNotifications(refreshed);
        }
      }

      await logActivityAndRefresh({
        user: currentUser?.name || "System Administrator",
        pos: currentUser?.pos || "Superadmin",
        action: "Survey Approved",
        details: `Approved survey "${srv.title}" (Status: ${newStatus}, Eligible: ${eligibleCount})`,
      });

      showToast(`Survey "${srv.title}" approved (${newStatus})!`, "success");
    } catch (err: any) {
      showToast(err.message || "Failed to approve survey.", "info");
    }
  };

  const handleRejectSurvey = async (surveyId: string | number, reason: string) => {
    const isSuperadmin =
      currentUser?.role === "superadmin" ||
      currentUser?.pos === "Superadmin" ||
      currentUser?.email?.toLowerCase() === MASTER_ADMIN_EMAIL.toLowerCase();

    if (!isSuperadmin) {
      showToast("Unauthorized: Superadmin access required.", "info");
      return;
    }

    if (!reason || reason.trim().length < 10) {
      showToast("Rejection reason must be at least 10 characters.", "info");
      return;
    }

    const srv = surveys.find((s) => s.id === surveyId);
    if (!srv) {
      showToast("Survey not found.", "info");
      return;
    }

    const now = Date.now();
    const adminEmail = (currentUser?.email || MASTER_ADMIN_EMAIL).trim().toLowerCase();
    const cleanReason = reason.trim();

    const updated: Survey = {
      ...srv,
      status: "rejected",
      rejectionReason: cleanReason,
      reviewedBy: adminEmail,
      reviewedAt: now,
    };

    try {
      await DatabaseService.saveSurvey(updated);
      setSurveys((prev) => prev.map((s) => (s.id === surveyId ? updated : s)));

      if (srv.owner) {
        try {
          await DatabaseService.addNotification({
            to: srv.owner.toLowerCase(),
            title: "❌ Survey Rejected",
            message: `Your survey "${srv.title}" was not approved: ${cleanReason}`,
            icon: "❌",
            type: "survey_rejected",
            data: { surveyId, reason: cleanReason },
          });
        } catch {}

        if (currentUser?.email) {
          const refreshed = await DatabaseService.getNotifications(currentUser.email);
          setNotifications(refreshed);
        }
      }

      await logActivityAndRefresh({
        user: currentUser?.name || "System Administrator",
        pos: currentUser?.pos || "Superadmin",
        action: "Survey Rejected",
        details: `Rejected survey "${srv.title}". Reason: ${cleanReason}`,
      });

      showToast(`Survey "${srv.title}" rejected.`, "info");
    } catch (err: any) {
      showToast(err.message || "Failed to reject survey.", "info");
    }
  };

  const handleTakedownSurvey = async (surveyId: string | number, reason: string): Promise<boolean> => {
    const isSuperadmin =
      currentUser?.role === "superadmin" ||
      currentUser?.pos === "Superadmin" ||
      currentUser?.email?.toLowerCase() === MASTER_ADMIN_EMAIL.toLowerCase();

    if (!isSuperadmin) {
      showToast("Unauthorized: Superadmin access required.", "info");
      return false;
    }

    if (!reason || reason.trim().length < 10) {
      showToast("Takedown reason must be at least 10 characters.", "info");
      return false;
    }

    const srv = surveys.find((s) => s.id === surveyId);
    if (!srv) {
      showToast("Survey not found.", "info");
      return false;
    }

    if (srv.status !== "published" && srv.status !== "scheduled") {
      showToast("Only published or scheduled surveys can be taken down.", "info");
      return false;
    }

    const now = Date.now();
    const adminEmail = (currentUser?.email || MASTER_ADMIN_EMAIL).trim().toLowerCase();
    const cleanReason = reason.trim();

    const updated: Survey = {
      ...srv,
      status: "archived",
      archivedAt: now,
      archivedBy: adminEmail,
      archiveReason: cleanReason,
    };

    try {
      await DatabaseService.saveSurvey(updated);
      setSurveys((prev) => prev.map((s) => (s.id === surveyId ? updated : s)));

      if (srv.owner) {
        try {
          await DatabaseService.addNotification({
            to: srv.owner.toLowerCase(),
            title: "⛔ Survey Taken Down",
            message: `Your survey "${srv.title}" has been taken down and archived: ${cleanReason}`,
            icon: "⛔",
            type: "survey_takedown",
            data: { surveyId, reason: cleanReason },
          });
        } catch {}

        if (currentUser?.email) {
          const refreshed = await DatabaseService.getNotifications(currentUser.email);
          setNotifications(refreshed);
        }
      }

      await logActivityAndRefresh({
        user: currentUser?.name || "System Administrator",
        pos: currentUser?.pos || "Superadmin",
        action: "Survey Taken Down",
        details: `Took down survey "${srv.title}". Reason: ${cleanReason}`,
      });

      showToast(`Survey "${srv.title}" taken down and archived.`, "info");
      return true;
    } catch (err: any) {
      showToast(err.message || "Failed to take down survey.", "info");
      return false;
    }
  };

  // Owner takes a pending survey back to draft so it can be edited again.
  const handleWithdrawSurvey = async (surveyId: string | number) => {
    const srv = surveys.find((s) => s.id === surveyId);
    if (!srv || srv.status !== "pending") {
      showToast("Only surveys waiting for review can be withdrawn.", "info");
      return;
    }
    try {
      await DatabaseService.withdrawSurvey(surveyId);
      setSurveys((prev) => prev.map((s) => (s.id === surveyId ? { ...s, status: "draft" } : s)));
      await logActivityAndRefresh({
        user: currentUser?.name || "User",
        pos: currentUser?.pos || "Faculty",
        action: "Survey Withdrawn",
        details: `Withdrew "${srv.title}" from review (back to draft)`,
      });
      showToast(`"${srv.title}" is back in your drafts. You can edit it and submit again.`, "success");
    } catch (err: any) {
      console.warn("Failed to withdraw survey:", err);
      showToast("Could not withdraw the survey. Please try again.", "info");
    }
  };

  // Owner closes their own live survey early. Only the archive fields change, as the rules require.
  const handleArchiveSurvey = async (surveyId: string | number, reason: string) => {
    const srv = surveys.find((s) => s.id === surveyId);
    if (!srv) return;
    if (srv.status !== "published" && srv.status !== "scheduled") {
      showToast("Only live or scheduled surveys can be archived.", "info");
      return;
    }
    const now = Date.now();
    const by = (currentUser?.email || "").trim().toLowerCase();
    const cleanReason = reason.trim() || "Closed early by the owner";
    try {
      await DatabaseService.archiveSurvey(surveyId, by, cleanReason, now);
      setSurveys((prev) =>
        prev.map((s) =>
          s.id === surveyId ? { ...s, status: "archived", archivedAt: now, archivedBy: by, archiveReason: cleanReason } : s
        )
      );
      await logActivityAndRefresh({
        user: currentUser?.name || "User",
        pos: currentUser?.pos || "Faculty",
        action: "Survey Archived",
        details: `Archived survey "${srv.title}". Reason: ${cleanReason}`,
      });
      showToast(`"${srv.title}" is archived. It no longer accepts responses.`, "success");
    } catch (err: any) {
      console.warn("Failed to archive survey:", err);
      showToast("Could not archive the survey. Please try again.", "info");
    }
  };

  const handleDuplicateSurvey = async (survey: Survey) => {
    if (!appSettings.surveyCreationOpen && currentUser?.role !== "superadmin") {
      showToast("Survey creation is turned off by the admin right now, so copies cannot be made.", "info");
      return;
    }
    const newId = `srv_${Date.now()}`;
    // A copy is a new, independent survey: same questions and blocks, no link to the original,
    // and none of the original's review / archive / flag details.
    const {
      submittedAt: _submittedAt,
      reviewedBy: _reviewedBy,
      reviewedAt: _reviewedAt,
      rejectionReason: _rejectionReason,
      archivedAt: _archivedAt,
      archivedBy: _archivedBy,
      archiveReason: _archiveReason,
      flagReason: _flagReason,
      flaggedBy: _flaggedBy,
      flaggedAt: _flaggedAt,
      eligibleCount: _eligibleCount,
      criteriaAcceptedAt: _criteriaAcceptedAt,
      previousSurveyId: _previousSurveyId,
      seriesId: _seriesId,
      ratingAverage: _ratingAverage,
      ...base
    } = survey;
    const duplicated: Survey = {
      ...base,
      id: newId,
      title: `${survey.title} (Copy)`,
      status: "draft",
      responses: 0,
      created: new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
      createdAtTimestamp: Date.now(),
      isTrending: false,
      openDate: null,
      closeDate: null,
      closes: survey.openEnded ? "Until archived" : "Open",
      owner: (currentUser?.email || survey.owner).trim().toLowerCase(),
      ownerName: currentUser?.name || survey.ownerName,
    };
    try {
      await DatabaseService.saveSurvey(duplicated);
      setSurveys((prev) => [duplicated, ...prev]);
      await logActivityAndRefresh({
        user: currentUser?.name || "Admin",
        pos: currentUser?.pos || "Admin",
        action: "Survey Duplicated",
        details: `Copied survey "${survey.title}" as a new draft`,
      });
      showToast("Survey copied as a new draft. Set its dates, then submit it.", "success");
    } catch (err: any) {
      showToast(err.message || "Failed to duplicate survey.", "info");
    }
  };

  const handleToggleUserStatus = async (email: string, newStatus: "active" | "suspended" | "pending_approval") => {
    const cleanEmail = email.trim();
    const targetUser = users.find((u) => u.email.trim().toLowerCase() === cleanEmail.toLowerCase());
    if (!targetUser) return;
    const updatedUser: UserProfile = { ...targetUser, status: newStatus };

    try {
      await DatabaseService.saveUser(updatedUser);
      setUsers((prev) => prev.map((u) => (u.email.trim().toLowerCase() === cleanEmail.toLowerCase() ? updatedUser : u)));

      if (newStatus === "active") {
        try {
          await DatabaseService.addNotification({
            to: cleanEmail.toLowerCase(),
            title: "🛡️ Account Verified & Approved",
            message: "Your institutional credentials have been verified and approved by the System Administrator. You can now access full authoring permissions.",
            icon: "🛡️",
            type: "approval",
          });
        } catch {}
        if (currentUser?.email) {
          const refreshed = await DatabaseService.getNotifications(currentUser.email);
          setNotifications(refreshed);
        }
      }

      await logActivityAndRefresh({
        user: currentUser?.name || "System Administrator",
        pos: "Superadmin",
        action: newStatus === "active" ? "User Approved" : "User Status Changed",
        details: `${newStatus === "active" ? "Approved and authorized" : `Changed status to ${newStatus} for`} account: ${cleanEmail}`,
      });

      showToast(
        newStatus === "active"
          ? `Account ${cleanEmail} approved and activated successfully!`
          : `User status updated to ${newStatus.replace("_", " ")}.`,
        "success"
      );
    } catch (err: any) {
      showToast(err.message || "Failed to update user status.", "info");
    }
  };

  const handlePromoteUser = async (email: string, newPos: UserProfile["pos"]) => {
    const cleanEmail = email.trim();
    const targetUser = users.find((u) => u.email.trim().toLowerCase() === cleanEmail.toLowerCase());
    if (!targetUser) return;
    // Same roles as sign-up: Faculty -> faculty, Student Officer -> officer, Student -> user.
    const role: UserProfile["role"] =
      newPos === "Superadmin" ? "superadmin" : newPos === "Faculty" ? "faculty" : newPos === "Student Officer" ? "officer" : "user";
    const updatedUser: UserProfile = { ...targetUser, pos: newPos, role };

    try {
      await DatabaseService.saveUser(updatedUser);
      setUsers((prev) => prev.map((u) => (u.email.trim().toLowerCase() === cleanEmail.toLowerCase() ? updatedUser : u)));
      showToast(`${targetUser.name} is now ${newPos === "Superadmin" ? "an administrator" : `a ${newPos}`}.`, "success");
    } catch (err: any) {
      showToast(err.message || "Failed to promote user.", "info");
    }
  };

  /** Admin: Firebase sends the person an email with a link to set a new password. */
  const handleSendPasswordReset = async (email: string) => {
    try {
      await DatabaseService.sendPasswordReset(email);
      // Firebase may not say whether the email has a login (email enumeration protection).
      showToast(`If ${email} has a login, Firebase has emailed it a reset link (check spam too).`, "success");
    } catch (err: any) {
      const code = String(err?.code || "");
      showToast(
        code.includes("user-not-found")
          ? "This email has no login yet (the person has not registered), so no email was sent."
          : "Could not send the reset email. Please try again later.",
        "info"
      );
    }
  };

  /** Admin: let these accounts use the app without a verified email (e.g. they cannot receive email). */
  const handleMarkEmailsChecked = async (emails: string[]) => {
    if (emails.length === 0) return;
    try {
      await DatabaseService.updateUsersFields(emails.map((email) => ({ email, fields: { emailCheckWaived: true } })));
      const set = new Set(emails.map((e) => e.toLowerCase()));
      setUsers((prev) => prev.map((u) => (set.has(u.email.toLowerCase()) ? { ...u, emailCheckWaived: true } : u)));
      await logActivityAndRefresh({
        user: currentUser?.name || "Admin",
        pos: "Superadmin",
        action: "User Updated",
        details: `Marked the email of ${emails.length} account${emails.length === 1 ? "" : "s"} as checked by the admin.`,
      });
      showToast(`${emails.length} account${emails.length === 1 ? "" : "s"} can now sign in without verifying their email.`, "success");
    } catch (err: any) {
      showToast(err.message || "Could not update the accounts.", "info");
    }
  };

  const handleAddUser = async (newUser: UserProfile) => {
    try {
      await DatabaseService.saveUser(newUser);
      setUsers((prev) => [newUser, ...prev]);
      await logActivityAndRefresh({
        user: currentUser?.name || "Admin",
        pos: "Superadmin",
        action: "User Created",
        details: `Created new user ${newUser.name} (${newUser.email})`,
      });
      showToast(`User ${newUser.name} created successfully!`, "success");
    } catch (err: any) {
      showToast(err.message || "Failed to create user.", "info");
    }
  };

  const handleUpdateUser = async (email: string, changes: Partial<UserProfile>) => {
    try {
      const cleanEmail = email.trim();
      const targetUser = users.find((u) => u.email.trim().toLowerCase() === cleanEmail.toLowerCase());
      if (targetUser) {
        const modified = { ...targetUser, ...changes };
        await DatabaseService.saveUser(modified);
        setUsers((prev) => prev.map((u) => (u.email.trim().toLowerCase() === cleanEmail.toLowerCase() ? modified : u)));
      }
      await logActivityAndRefresh({
        user: currentUser?.name || "Admin",
        pos: "Superadmin",
        action: "User Updated",
        details: `Updated details for ${cleanEmail}`,
      });
      if (currentUser && currentUser.email.trim().toLowerCase() === cleanEmail.toLowerCase()) {
        setCurrentUser({ ...currentUser, ...changes });
      }
      showToast("User details updated successfully.", "success");
    } catch (err: any) {
      showToast(err.message || "Failed to update user.", "info");
    }
  };

  const handleDeleteUser = async (email: string) => {
    try {
      const cleanEmail = email.trim();
      await DatabaseService.deleteUser(cleanEmail);
      setUsers((prev) => prev.filter((u) => u.email.trim().toLowerCase() !== cleanEmail.toLowerCase()));
      await logActivityAndRefresh({
        user: currentUser?.name || "Admin",
        pos: "Superadmin",
        action: "User Deleted",
        details: `Deleted user account ${cleanEmail}`,
      });
      showToast("User account permanently removed.", "info");
    } catch (err: any) {
      showToast(err.message || "Failed to remove user.", "info");
    }
  };

  const handleSaveTopic = async (topic: Topic) => {
    try {
      await DatabaseService.saveTopic(topic);
      setTopics((prev) => {
        const exists = prev.some((t) => t.id === topic.id);
        if (exists) {
          return prev.map((t) => (t.id === topic.id ? topic : t));
        }
        return [...prev, topic].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
      });
      await logActivityAndRefresh({
        user: currentUser?.name || "Admin",
        pos: currentUser?.pos || "Admin",
        action: "Topic Updated",
        details: `Saved topic "${topic.name}" (${topic.status})`,
      });
      showToast(`Topic "${topic.name}" saved.`, "success");
    } catch (err: any) {
      showToast(err.message || "Failed to save topic.", "info");
      throw err;
    }
  };

  /** Tell each affected creator once about blocks the admin moved. */
  const notifyMovedOwners = async (moves: TopicBlockMove[], text: (count: number, title: string) => string) => {
    const bySurvey = new Map<string, number>();
    moves.forEach((m) => bySurvey.set(m.surveyId, (bySurvey.get(m.surveyId) || 0) + 1));
    const byOwner = new Map<string, string[]>();
    bySurvey.forEach((count, surveyId) => {
      const s = surveys.find((x) => String(x.id) === surveyId);
      const owner = (s?.owner || "").trim().toLowerCase();
      if (!s || !owner) return;
      byOwner.set(owner, [...(byOwner.get(owner) || []), text(count, s.title)]);
    });
    for (const [owner, lines] of byOwner) {
      try {
        await DatabaseService.addNotification({
          to: owner,
          title: "🏷️ Topics updated in your surveys",
          message: lines.join(" "),
          icon: "🏷️",
          type: "general",
        });
      } catch {}
    }
  };

  /** Admin: write the new topic blocks of each changed survey. Returns how many blocks really moved. */
  const writeMoves = async (moves: TopicBlockMove[], reverse = false): Promise<number> => {
    const changed = applyMoves(surveys, moves, reverse);
    const count = applicableCount(surveys, moves, reverse);
    for (const [surveyId, blocks] of changed) {
      await DatabaseService.updateTopicBlocks(surveyId, blocks);
    }
    setSurveys((prev) => prev.map((s) => (changed.has(String(s.id)) ? { ...s, topicBlocks: changed.get(String(s.id)) } : s)));
    return count;
  };

  const topicName = (id: string) => topics.find((t) => t.id === id)?.name || id;

  /** Admin: move blocks to another topic (a "merge" also retires the old topic). Only the topic changes. */
  const handleMoveTopicBlocks = async (moves: TopicBlockMove[], kind: "move" | "merge", retireTopicId?: string) => {
    if (!currentUser || moves.length === 0) return;
    const to = moves[0].to;
    try {
      const moved = await writeMoves(moves);
      if (kind === "merge" && retireTopicId) {
        const old = topics.find((t) => t.id === retireTopicId);
        if (old) {
          const retired: Topic = { ...old, status: "retired" };
          await DatabaseService.saveTopic(retired);
          setTopics((prev) => prev.map((t) => (t.id === retired.id ? retired : t)));
        }
      }
      const surveysCount = new Set(moves.map((m) => m.surveyId)).size;
      const record: TopicMoveRecord = { kind, moves, ...(kind === "merge" && retireTopicId ? { retiredTopicId: retireTopicId } : {}) };
      await logActivityAndRefresh({
        user: currentUser.name,
        pos: currentUser.pos,
        action: kind === "merge" ? "Topics Merged" : "Topic Blocks Moved",
        details:
          kind === "merge" && retireTopicId
            ? `Merged "${topicName(retireTopicId)}" into "${topicName(to)}": ${moved} block(s) from ${surveysCount} survey(s); "${topicName(retireTopicId)}" retired.`
            : `Moved ${moved} block(s) from ${surveysCount} survey(s) to "${topicName(to)}".`,
        topicMove: record,
      });
      await notifyMovedOwners(moves, (n, title) => `The administrator moved ${n} question block(s) in "${title}" to the topic "${topicName(to)}". Your questions did not change.`);
      showToast(`Moved ${moved} block(s) to "${topicName(to)}".`, "success");
    } catch (err: any) {
      showToast(err.message || "Could not move the blocks. Some may have moved; check and try again.", "info");
    }
  };

  /** Admin: undo the last bulk move or merge (blocks changed since then are left alone). */
  const handleUndoTopicMove = async (logId: string, record: TopicMoveRecord) => {
    if (!currentUser) return;
    try {
      const moved = await writeMoves(record.moves, true);
      if (record.retiredTopicId) {
        const old = topics.find((t) => t.id === record.retiredTopicId);
        if (old && old.status === "retired") {
          const back: Topic = { ...old, status: "active" };
          await DatabaseService.saveTopic(back);
          setTopics((prev) => prev.map((t) => (t.id === back.id ? back : t)));
        }
      }
      await DatabaseService.markTopicMoveUndone(logId, record);
      await logActivityAndRefresh({
        user: currentUser.name,
        pos: currentUser.pos,
        action: "Topic Move Undone",
        details: `Undid a ${record.kind}: ${moved} of ${record.moves.length} block(s) moved back.`,
      });
      await notifyMovedOwners(record.moves, (n, title) => `The administrator undid a topic change for ${n} question block(s) in "${title}".`);
      const skipped = record.moves.length - moved;
      showToast(
        skipped > 0 ? `Undone. ${skipped} block(s) had changed since and were left as they are.` : "Undone.",
        "success"
      );
    } catch (err: any) {
      showToast(err.message || "Could not undo. Please try again.", "info");
    }
  };

  /**
   * Admin: decide a creator's topic suggestion. approve = create the topic (name may be adjusted)
   * and use it; map = use an existing topic; keep = stay under Other.
   */
  const handleDecideTopicRequest = async (
    surveyId: string,
    blockId: string,
    decision: { kind: "approve"; name: string } | { kind: "map"; topicId: string } | { kind: "keep" },
    note: string
  ) => {
    if (!currentUser) return;
    const survey = surveys.find((s) => String(s.id) === surveyId);
    const block = survey?.topicBlocks?.find((b) => b.id === blockId);
    if (!survey || !block?.topicRequest) {
      showToast("This suggestion is no longer there. Refresh and try again.", "info");
      return;
    }
    try {
      let resultTopicId: string | undefined;
      if (decision.kind === "approve") {
        const name = decision.name.trim();
        if (topics.some((t) => t.name.trim().toLowerCase() === name.toLowerCase())) {
          showToast(`A topic named "${name}" already exists. Use "Put under an existing topic" instead.`, "info");
          return;
        }
        const topic: Topic = {
          id: `topic_${name.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 40) || "new"}_${Date.now().toString(36)}`,
          name,
          status: "active",
          order: topics.reduce((m, t) => Math.max(m, t.id === OTHER_TOPIC_ID ? 0 : t.order ?? 0), 0) + 1,
          createdAt: Date.now(),
        };
        await DatabaseService.saveTopic(topic);
        setTopics((prev) => [...prev, topic]);
        resultTopicId = topic.id;
      } else if (decision.kind === "map") {
        resultTopicId = decision.topicId;
      }
      const status = decision.kind === "approve" ? "approved" : decision.kind === "map" ? "mapped" : "kept_other";
      const blocks = (survey.topicBlocks || []).map((b) =>
        b.id !== blockId
          ? b
          : {
              ...b,
              topicId: resultTopicId || b.topicId,
              topicRequest: {
                ...block.topicRequest!,
                status: status as "approved" | "mapped" | "kept_other",
                decidedBy: currentUser.email.trim().toLowerCase(),
                decidedAt: Date.now(),
                ...(note.trim() ? { decisionNote: note.trim() } : {}),
                ...(resultTopicId ? { resultTopicId } : {}),
              },
            }
      );
      await DatabaseService.updateTopicBlocks(surveyId, blocks);
      setSurveys((prev) => prev.map((s) => (String(s.id) === surveyId ? { ...s, topicBlocks: blocks } : s)));

      const req = block.topicRequest;
      const message =
        status === "approved"
          ? `Your suggested topic "${req.name}" was approved as "${decision.kind === "approve" ? decision.name.trim() : ""}" and is used in "${survey.title}".`
          : status === "mapped"
          ? `For "${survey.title}", the administrator used the existing topic "${topicName(resultTopicId!)}" instead of "${req.name}".`
          : `For "${survey.title}", the administrator kept the block under "Other" instead of adding "${req.name}".`;
      try {
        await DatabaseService.addNotification({
          to: req.requestedBy.trim().toLowerCase(),
          title: "🏷️ Topic suggestion reviewed",
          message: note.trim() ? `${message} Note: ${note.trim()}` : message,
          icon: "🏷️",
          type: "general",
          data: { surveyId },
        });
      } catch {}
      await logActivityAndRefresh({
        user: currentUser.name,
        pos: currentUser.pos,
        action: "Topic Suggestion Decided",
        details: `"${req.name}" in "${survey.title}": ${status.replace("_", " ")}${resultTopicId ? ` (${topicName(resultTopicId)})` : ""}.`,
      });
      showToast("Decision saved and the creator was notified.", "success");
    } catch (err: any) {
      showToast(err.message || "Could not save the decision.", "info");
    }
  };

  const handleDeleteTopic = async (topicId: string) => {
    try {
      await DatabaseService.deleteTopic(topicId);
      setTopics((prev) => prev.filter((t) => t.id !== topicId));
      await logActivityAndRefresh({
        user: currentUser?.name || "Admin",
        pos: currentUser?.pos || "Admin",
        action: "Topic Deleted",
        details: `Deleted topic with ID ${topicId}`,
      });
      showToast("Topic deleted successfully.", "success");
    } catch (err: any) {
      showToast(err.message || "Failed to delete topic.", "info");
      throw err;
    }
  };

  /**
   * Survey owner (or admin) flags a response for the admin to review. It keeps counting until the
   * admin excludes it. Nothing about the respondent goes into the log or the notification.
   */
  const handleFlagResponse = async (responseId: string, reasons: string[], note: string) => {
    if (!currentUser) return;
    const target = responses.find((r) => r.id === responseId);
    if (!target) throw new Error("This response is no longer loaded. Press Refresh and try again.");
    const me = currentUser.email.trim().toLowerCase();
    const review: ResponseReview = { status: "flagged", reasons, note, flaggedBy: me, flaggedAt: Date.now() };
    await DatabaseService.flagResponse(responseId, review);
    setResponses((prev) => prev.map((r) => (r.id === responseId ? { ...r, review } : r)));
    const surveyTitle = surveys.find((s) => String(s.id) === String(target.surveyId))?.title || target.surveyTitle || "a survey";
    if (me !== MASTER_ADMIN_EMAIL.toLowerCase()) {
      try {
        await DatabaseService.addNotification({
          to: MASTER_ADMIN_EMAIL.toLowerCase(),
          title: "🚩 Response flagged for review",
          message: `${currentUser.name || "A survey owner"} flagged a response in "${surveyTitle}": ${reasons.join(", ")}.`,
          icon: "🚩",
          type: "response",
          data: { surveyId: target.surveyId },
        });
      } catch (err) {
        console.warn("Could not notify the admin about the flag:", err);
      }
    }
    try {
      await logActivityAndRefresh({
        user: currentUser.name,
        pos: currentUser.pos,
        action: "Response Flagged",
        details: `Flagged a response in "${surveyTitle}" for admin review (${reasons.join(", ")})`,
      });
    } catch {}
    showToast("Flagged. The admin will review it; it keeps counting until then.", "success");
  };

  /** Admin decides on a flagged response: kept (counted) or excluded (never counted). */
  const handleDecideFlag = async (responseId: string, decision: "kept" | "excluded", note: string) => {
    if (!currentUser) return;
    const target = responses.find((r) => r.id === responseId);
    if (!target?.review) throw new Error("This flag is no longer loaded. Please reload the page.");
    const review: ResponseReview = {
      ...target.review,
      status: decision,
      decidedBy: currentUser.email.trim().toLowerCase(),
      decidedAt: Date.now(),
      decisionNote: note,
    };
    await DatabaseService.decideResponseFlag(responseId, review);
    setResponses((prev) => prev.map((r) => (r.id === responseId ? { ...r, review } : r)));
    const surveyTitle = surveys.find((s) => String(s.id) === String(target.surveyId))?.title || target.surveyTitle || "a survey";
    const flagger = target.review.flaggedBy.trim().toLowerCase();
    if (flagger && flagger !== currentUser.email.trim().toLowerCase()) {
      try {
        await DatabaseService.addNotification({
          to: flagger,
          title: decision === "excluded" ? "🚫 Flagged response excluded" : "✅ Flagged response kept",
          message:
            decision === "excluded"
              ? `The admin excluded the response you flagged in "${surveyTitle}". It is no longer counted.${note ? ` Reason: ${note}` : ""}`
              : `The admin kept the response you flagged in "${surveyTitle}". It stays counted.${note ? ` Note: ${note}` : ""}`,
          icon: decision === "excluded" ? "🚫" : "✅",
          type: "response",
          data: { surveyId: target.surveyId },
        });
      } catch (err) {
        console.warn("Could not notify the survey owner about the decision:", err);
      }
    }
    try {
      await logActivityAndRefresh({
        user: currentUser.name,
        pos: currentUser.pos,
        action: decision === "excluded" ? "Response Excluded" : "Flagged Response Kept",
        details: `${decision === "excluded" ? "Excluded" : "Kept"} a flagged response in "${surveyTitle}"${note ? ` (${note})` : ""}`,
      });
    } catch {}
    showToast(decision === "excluded" ? "Excluded: it is no longer counted in Analytics." : "Kept: it stays counted.", "success");
  };

  /** Admin: open or close survey creation for everyone except the admin. */
  const handleSetSurveyCreation = async (open: boolean) => {
    if (!currentUser) return;
    const next: AppSettings = {
      surveyCreationOpen: open,
      updatedAt: Date.now(),
      updatedBy: currentUser.email.trim().toLowerCase(),
    };
    await DatabaseService.saveSettings(next);
    setAppSettings((prev) => ({ ...prev, ...next }));
    try {
      await logActivityAndRefresh({
        user: currentUser.name,
        pos: currentUser.pos,
        action: open ? "Survey Creation Opened" : "Survey Creation Closed",
        details: open ? "Turned survey creation on for everyone" : "Turned survey creation off for everyone except the admin",
      });
    } catch {}
    showToast(open ? "Survey creation is open again." : "Survey creation is now off (admin excepted).", "success");
  };

  /** A user reports a live survey (once). The admin is notified; the creator is not told who. */
  const handleReportSurvey = async (survey: Survey, reasons: ReportReason[], note: string): Promise<boolean> => {
    if (!currentUser?.email) return false;
    const me = currentUser.email.trim().toLowerCase();
    try {
      await DatabaseService.reportSurvey({
        surveyId: String(survey.id),
        surveyTitle: survey.title,
        reasons,
        note,
        reportedBy: me,
        reportedAt: Date.now(),
      });
    } catch (err: any) {
      showToast(err.message || "Could not send your report.", "info");
      return false;
    }
    setMyReportedSurveyIds((prev) => [...prev, String(survey.id)]);
    try {
      await DatabaseService.addNotification({
        to: MASTER_ADMIN_EMAIL.toLowerCase(),
        title: "🚩 Survey Reported",
        message: `A user reported the survey "${survey.title}". Review it in Review Center > Reported Surveys.`,
        icon: "🚩",
        type: "survey_report",
        data: { surveyId: String(survey.id) },
      });
    } catch {}
    showToast("Thank you. The administrator will review your report.", "success");
    return true;
  };

  /** Admin: close the open reports of one survey and tell each reporter the decision. */
  const closeReports = async (surveyId: string, status: "dismissed" | "taken_down", note: string) => {
    if (!currentUser?.email) return;
    const open = surveyReports.filter((r) => String(r.surveyId) === surveyId && r.status === "open");
    if (open.length === 0) return;
    const decision = {
      status,
      decidedBy: currentUser.email.trim().toLowerCase(),
      decidedAt: Date.now(),
      decisionNote: note,
    };
    await DatabaseService.decideSurveyReports(open.map((r) => r.id), decision);
    setSurveyReports((prev) => prev.map((r) => (open.some((o) => o.id === r.id) ? { ...r, ...decision } : r)));
    const title = open[0].surveyTitle;
    for (const r of open) {
      try {
        await DatabaseService.addNotification({
          to: r.reportedBy.toLowerCase(),
          title: status === "taken_down" ? "✅ Reported survey taken down" : "ℹ️ Your report was reviewed",
          message:
            status === "taken_down"
              ? `Thank you. The survey "${title}" you reported was taken down.`
              : `Thank you. The administrator reviewed "${title}" and kept it.${note ? ` Note: ${note}` : ""}`,
          icon: status === "taken_down" ? "✅" : "ℹ️",
          type: "survey_report",
          data: { surveyId },
        });
      } catch {}
    }
    try {
      await logActivityAndRefresh({
        user: currentUser.name,
        pos: currentUser.pos,
        action: status === "taken_down" ? "Reported Survey Taken Down" : "Survey Reports Dismissed",
        details: `${open.length} report(s) on "${title}" ${status === "taken_down" ? "led to a takedown" : "dismissed"}.`,
      });
    } catch {}
  };

  const handleDismissReports = async (surveyId: string, note: string) => {
    try {
      await closeReports(surveyId, "dismissed", note);
      showToast("Reports dismissed. The survey stays live.", "success");
    } catch {
      showToast("Could not save the decision. Please try again.", "info");
    }
  };

  const handleTakedownReported = async (surveyId: string, reason: string) => {
    const done = await handleTakedownSurvey(surveyId, reason);
    if (!done) return;
    try {
      await closeReports(surveyId, "taken_down", reason);
    } catch {
      showToast("The survey was taken down, but the reports could not be closed. Try again.", "info");
    }
  };

  /** Admin: save the School Setup lists (departments, programs, sections). */
  const handleSaveSchoolLists = async (lists: SchoolLists) => {
    if (!currentUser) return;
    const next: SchoolLists = { ...lists, updatedAt: Date.now(), updatedBy: currentUser.email.trim().toLowerCase() };
    try {
      await DatabaseService.saveSchoolLists(next);
    } catch {
      showToast("Could not save the school lists. Please try again.", "info");
      return;
    }
    setSchoolLists(next);
    try {
      await logActivityAndRefresh({
        user: currentUser.name,
        pos: currentUser.pos,
        action: "School Setup Updated",
        details: `Saved ${next.departments.length} department(s) and ${next.departments.reduce((n, d) => n + d.programs.length, 0)} program(s).`,
      });
    } catch {}
    showToast("School lists saved.", "success");
  };

  /** Admin: reload only the user list (for the "Active users" counter). */
  const handleRefreshUsers = async () => {
    if (!currentUser) return;
    setUsers(await DatabaseService.getUsers(currentUser));
  };

  /** Analytics "Refresh": reloads only surveys, responses and (admin) the user list. */
  const handleRefreshAnalytics = async () => {
    if (!currentUser) return;
    const adminViewer = currentUser.role === "superadmin" || currentUser.pos === "Superadmin";
    const freshSurveys = await DatabaseService.getSurveys(currentUser);
    const [freshResponses, freshUsers] = await Promise.all([
      DatabaseService.getResponses(currentUser, freshSurveys),
      adminViewer ? DatabaseService.getUsers(currentUser) : Promise.resolve(null),
    ]);
    setSurveys(freshSurveys);
    setResponses(freshResponses);
    if (freshUsers) setUsers(freshUsers);
    setDataLoadedAt(Date.now());
  };

  const handleSaveAcademicYear = async (terms: AcademicYearTerms) => {
    await DatabaseService.saveAcademicYear(terms);
    setAcademicCalendar((prev) =>
      [...prev.filter((y) => y.schoolYear !== terms.schoolYear), terms].sort((a, b) => a.sem1Start - b.sem1Start)
    );
    await logActivityAndRefresh({
      user: currentUser?.name || "Admin",
      pos: currentUser?.pos || "Admin",
      action: "Academic Calendar Updated",
      details: `Saved semester dates for SY ${terms.schoolYear}`,
    });
  };

  const handleDeleteAcademicYear = async (schoolYear: string) => {
    await DatabaseService.deleteAcademicYear(schoolYear);
    setAcademicCalendar((prev) => prev.filter((y) => y.schoolYear !== schoolYear));
    await logActivityAndRefresh({
      user: currentUser?.name || "Admin",
      pos: currentUser?.pos || "Admin",
      action: "Academic Calendar Updated",
      details: `Deleted semester dates for SY ${schoolYear}`,
    });
  };

  /** The person's own name (the only profile field they may change themselves). */
  const handleUpdateName = async (name: string): Promise<boolean> => {
    if (!currentUser) return false;
    try {
      await DatabaseService.updateOwnName(currentUser.email, name);
    } catch {
      showToast("Could not save your name. Please try again.", "info");
      return false;
    }
    const modifiedUser = { ...currentUser, name };
    setCurrentUser(modifiedUser);
    setUsers((prev) => prev.map((u) => (u.email === currentUser.email ? modifiedUser : u)));
    showToast("Name updated.", "success");
    return true;
  };

  /** Opens My Profile with fresh data (an approved request may have changed the school details). */
  const handleOpenProfile = async () => {
    setShowRequestDecision(false);
    setShowProfileModal(true);
    if (!currentUser?.email) return;
    const [fresh, request] = await Promise.all([
      FirestoreUserService.getByEmail(currentUser.email).catch(() => null),
      DatabaseService.getMyProfileRequest(currentUser.email),
    ]);
    const me = fresh || currentUser;
    setMyProfileRequest(request);
    // A decision is shown once: the first time My Profile is opened after it was made.
    const decidedAt = request && request.status !== "pending" ? request.decidedAt || 0 : 0;
    const unseen = decidedAt > 0 && decidedAt > (me.profileRequestSeenAt || 0);
    setShowRequestDecision(unseen);
    if (unseen) {
      DatabaseService.markProfileRequestSeen(me.email, decidedAt).catch((err) =>
        console.warn("Could not remember that the decision was seen:", err)
      );
      setCurrentUser({ ...me, profileRequestSeenAt: decidedAt });
    } else if (fresh) {
      setCurrentUser(fresh);
    }
  };

  /** Sends a request to change the locked school details. */
  const handleSendProfileRequest = async (requested: ProfileSchoolFields, reason: string): Promise<boolean> => {
    if (!currentUser) return false;
    const email = currentUser.email.trim().toLowerCase();
    let saved: ProfileChangeRequest;
    try {
      saved = await DatabaseService.sendProfileRequest({
        email,
        name: currentUser.name,
        current: schoolFieldsOf(currentUser),
        requested,
        reason,
        requestedAt: Date.now(),
      });
    } catch (err: any) {
      showToast(err.message || "Could not send your request.", "info");
      return false;
    }
    setMyProfileRequest(saved);
    try {
      await DatabaseService.addNotification({
        to: MASTER_ADMIN_EMAIL.toLowerCase(),
        title: "📝 Profile change request",
        message: `${currentUser.name} asked to change their school details (${describeChanges(saved.current, saved.requested)}). Review it in Review Center > Profile Requests.`,
        icon: "📝",
        type: "profile_request",
        data: { email },
      });
    } catch {}
    showToast("Request sent. The administrator will review it.", "success");
    return true;
  };

  const handleCancelProfileRequest = async () => {
    if (!currentUser) return;
    try {
      await DatabaseService.cancelProfileRequest(currentUser.email);
      setMyProfileRequest(null);
      showToast("Request cancelled.", "info");
    } catch {
      showToast("Could not cancel the request. It may have been decided already.", "info");
    }
  };

  /** Admin: "New school year": move students up one year, mark last-year students graduated. */
  const handleNewSchoolYear = async () => {
    if (!currentUser) return;
    const plan = planYearMove(users, schoolLists);
    const now = Date.now();
    const updates = planUpdates(plan, now);
    if (updates.length === 0) return;
    try {
      await DatabaseService.updateUsersFields(updates);
    } catch {
      showToast("The move stopped partway because of an error. Check the user list, then try again (people already moved will move again).", "info");
      setUsers(await DatabaseService.getUsers(currentUser).catch(() => users));
      return;
    }
    const byEmail = new Map(updates.map((u) => [u.email, u.fields]));
    setUsers((prev) => prev.map((u) => (byEmail.has(u.email) ? { ...u, ...byEmail.get(u.email) } : u)));
    const settings = { lastYearMoveAt: now, lastYearMoveBy: currentUser.email.trim().toLowerCase() };
    try {
      await DatabaseService.saveSettings({ ...appSettings, ...settings });
      setAppSettings((prev) => ({ ...prev, ...settings }));
    } catch {}
    for (let i = 0; i < plan.moveUp.length; i += 20) {
      await Promise.all(
        plan.moveUp.slice(i, i + 20).map((m) =>
          DatabaseService.addNotification({
            to: m.user.email.toLowerCase(),
            title: "🎓 New school year",
            message: `You moved up to ${m.to}. Please choose your new section when you next open EduFeedback.`,
            icon: "🎓",
            type: "school_year",
          }).catch(() => {})
        )
      );
    }
    try {
      await logActivityAndRefresh({
        user: currentUser.name,
        pos: currentUser.pos,
        action: "New School Year",
        details: `${plan.moveUp.length} student(s) moved up one year; ${plan.graduate.length} marked graduated and suspended; ${plan.skipped.length} skipped.`,
      });
    } catch {}
    showToast(`${plan.moveUp.length} moved up, ${plan.graduate.length} marked graduated.`, "success");
  };

  /** Student: the one-time section pick after the move. */
  const handlePickNewSection = async (section: string): Promise<boolean> => {
    if (!currentUser) return false;
    try {
      await DatabaseService.pickNewSection(currentUser.email, section);
    } catch {
      showToast("Could not save your section. Please try again.", "info");
      return false;
    }
    const updated = { ...currentUser, section, sectionPickNeeded: false };
    setCurrentUser(updated);
    setUsers((prev) => prev.map((u) => (u.email === currentUser.email ? updated : u)));
    showToast(`Section saved: ${section}.`, "success");
    return true;
  };

  /** Admin: approve (update the profile) or reject a school-details change request. */
  const handleDecideProfileRequest = async (request: ProfileChangeRequest, approve: boolean, note: string) => {
    if (!currentUser) return;
    const person = users.find((u) => u.email.toLowerCase() === request.email.toLowerCase());
    if (approve) {
      if (!person) {
        showToast("This account no longer exists, so the request cannot be approved.", "info");
        return;
      }
      const updated: UserProfile = { ...person };
      for (const k of fieldKeysFor(person.pos)) {
        if (k in request.requested) updated[k] = request.requested[k] || "";
      }
      // An approved section replaces the one-time section pick after a "New school year" move.
      if (updated.sectionPickNeeded && updated.section) updated.sectionPickNeeded = false;
      try {
        await DatabaseService.saveUser(updated);
      } catch {
        showToast("Could not update the profile. Nothing was changed.", "info");
        return;
      }
      setUsers((prev) => prev.map((u) => (u.email === person.email ? updated : u)));
    }
    const decision = {
      status: approve ? ("approved" as const) : ("rejected" as const),
      decidedBy: currentUser.email.trim().toLowerCase(),
      decidedAt: Date.now(),
      decisionNote: note,
    };
    try {
      await DatabaseService.decideProfileRequest(request.id, decision);
    } catch {
      showToast(
        approve
          ? "The profile was updated, but the request could not be marked as approved. Please try again."
          : "Could not save the decision. Please try again.",
        "info"
      );
      return;
    }
    setProfileRequests((prev) => prev.map((r) => (r.id === request.id ? { ...r, ...decision } : r)));
    const changes = describeChanges(request.current, request.requested);
    try {
      await DatabaseService.addNotification({
        to: request.email.toLowerCase(),
        title: approve ? "✅ Profile change approved" : "ℹ️ Profile change not approved",
        message: approve
          ? `Your school details were updated (${changes}).${note ? ` Note: ${note}` : ""}`
          : `Your request (${changes}) was not approved. Reason: ${note}`,
        icon: approve ? "✅" : "ℹ️",
        type: "profile_request",
      });
    } catch {}
    try {
      await logActivityAndRefresh({
        user: currentUser.name,
        pos: currentUser.pos,
        action: approve ? "Profile Change Approved" : "Profile Change Rejected",
        details: `${request.name} (${request.email}): ${changes}${note ? `. Note: ${note}` : ""}`,
      });
    } catch {}
    showToast(approve ? "Approved. The profile was updated." : "Request rejected.", "success");
  };

  const isSuperadmin = currentUser?.role === "superadmin" || currentUser?.pos === "Superadmin";
  // All authenticated users can author surveys (Students, Officers, Faculty, Admins)
  const canCreateSurvey = Boolean(currentUser);
  // Review Center badge: surveys with user reports waiting for a decision.
  const reportedSurveyCount = new Set(surveyReports.filter((r) => r.status === "open").map((r) => String(r.surveyId))).size;

  // A shared survey link (#survey-<id>): once signed in and the surveys are loaded, open that survey
  // to answer, or say plainly why it cannot be opened. The link is then removed from the address bar.
  useEffect(() => {
    const match = /^#survey-(.+)$/.exec(window.location.hash);
    if (!match || !currentUser || surveys.length === 0) return;
    window.history.replaceState(null, "", window.location.pathname + window.location.search);
    const survey = surveys.find((s) => String(s.id) === decodeURIComponent(match[1]));
    const mine = (survey?.owner || "").trim().toLowerCase() === currentUser.email.trim().toLowerCase();
    if (!survey || getSurveyAvailability(survey) !== "open") {
      showToast("This survey link is not open right now. The survey may have closed.", "info");
    } else if (mine) {
      setCurrentView("my-surveys");
      showToast("This is your own survey. You can see it in My Surveys.", "info");
    } else if (currentUser.role === "superadmin" || currentUser.pos === "Superadmin") {
      showToast("The admin account does not answer surveys. Open it in the Review Center instead.", "info");
    } else if (!isInAudience(survey, currentUser)) {
      showToast("This survey is meant for a different group, so you cannot answer it.", "info");
    } else {
      setCurrentView("take-survey");
      handleTakeSurvey(survey);
    }
    // Runs when the person or the survey list changes; the link is used once.
  }, [currentUser, surveys]);

  /** Opens a survey to answer (Take a Survey and the Dashboard's Trending list). */
  const handleTakeSurvey = (survey: Survey) => {
    if (!currentUser) {
      showToast("Please sign in or register to take this survey.", "info");
      return;
    }
    const myEmail = currentUser.email.trim().toLowerCase();
    const hasNamedAnswer = responses.some(
      (r) => String(r.surveyId) === String(survey.id) && (r.userEmail || "").trim().toLowerCase() === myEmail
    );
    if (answeredSurveyIds.includes(String(survey.id)) && !hasNamedAnswer) {
      showToast("You already answered this survey anonymously. Each person can answer once.", "info");
      return;
    }
    setActiveSurveyForTaking(survey);
  };

  // Admin: everything waiting in the Review Center (same items as its Home page).
  const adminWaitingCount = isSuperadmin
    ? surveys.filter((s) => s.status === "pending").length +
      newsList.filter((n) => n.status === "pending").length +
      reportedSurveyCount +
      responses.filter((r) => r.review?.status === "flagged").length +
      profileRequests.filter((r) => r.status === "pending").length
    : 0;

  /** Opens the Review Center on one page (from the Dashboard's admin cards). */
  const handleOpenReviewCenter = (tab: string) => {
    setReviewStartTab(tab as ReviewTab);
    setReviewOpenCount((n) => n + 1);
    setEditingSurvey(null);
    setCurrentView("admin");
  };

  /** A notification was clicked: mark it read and open the page it is about. */
  const handleOpenNotification = (n: NotificationItem) => {
    if (!n.read) handleMarkNotificationRead(n.id);
    const target = notificationTarget(n, isSuperadmin);
    if (!target) return;
    if (target.kind === "review") handleOpenReviewCenter(target.tab);
    else if (target.kind === "analytics") {
      setAnalyticsTargetSurveyId(target.surveyId);
      setEditingSurvey(null);
      setCurrentView("analytics");
    } else if (target.kind === "profile") handleOpenProfile();
    else handleNavigate(target.view);
  };

  const handleNavigate = (view: string) => {
    if (view === "take-survey" && isSuperadmin) view = "admin";
    if (view === "admin") {
      setReviewStartTab("home");
      setReviewOpenCount((n) => n + 1);
    }
    if (view !== "create") {
      setEditingSurvey(null);
    }
    setCurrentView(view);
  };

  const sidebarNavItems = [
    { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
    ...(isSuperadmin ? [] : [{ id: "take-survey", label: "Take a Survey", icon: ClipboardList }]),
    ...(currentUser
      ? [
          {
            id: "my-surveys",
            label: "My Surveys",
            icon: UserCheck,
          },
        ]
      : []),
    { id: "analytics", label: "Analytics", icon: BarChart3 },
    ...(isSuperadmin ? [{ id: "tagalog-ml", label: "Sentiment Analysis", icon: BrainCircuit }] : []),
    ...(canCreateSurvey
      ? [
          {
            id: "create",
            label: "Create Survey",
            icon: PlusCircle,
          },
        ]
      : []),
    ...(isSuperadmin ? [{ id: "admin", label: "Review Center", icon: ShieldAlert, badge: reportedSurveyCount }] : []),
  ];

  // If Firebase is not configured, show a full-page message instead of running
  if (!isFirebaseConfigured()) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-6 text-white text-center">
        <div className="max-w-md w-full bg-slate-800 border border-slate-700 rounded-2xl p-8 shadow-2xl flex flex-col items-center">
          <div className="w-16 h-16 rounded-2xl bg-amber-500/20 text-amber-400 flex items-center justify-center mb-4">
            <ShieldAlert className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-bold text-slate-100 mb-2">Firebase is not configured</h1>
          <p className="text-slate-400 text-sm">
            The application requires a configured Firebase connection to operate.
          </p>
        </div>
      </div>
    );
  }

  // Still checking a saved login (page reload): show a short loading screen, not the login page.
  if (authChecking && !currentUser) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center gap-4 text-slate-300" role="status">
        <div className="w-10 h-10 border-4 border-indigo-500/30 border-t-indigo-400 rounded-full animate-spin" />
        <p className="text-sm">Loading EduFeedback...</p>
      </div>
    );
  }

  if (verifyUser && !currentUser) {
    return (
      <VerifyEmailScreen
        email={verifyUser.email}
        onCheck={handleCheckVerified}
        onResend={() => DatabaseService.sendVerificationEmail()}
        onSignOut={async () => {
          setVerifyUser(null);
          await DatabaseService.signOut();
        }}
      />
    );
  }

  // If no user is logged in, show the standalone sign in / registration page as the first screen!
  if (!currentUser) {
    return (
      <>
        {toastMessage && (
          <div className="fixed top-5 right-5 z-50 animate-in fade-in slide-in-from-top-3 duration-200">
            <div
              className={`px-4 py-3 rounded-xl shadow-2xl border flex items-center gap-2 text-xs font-bold ${
                toastMessage.type === "success"
                  ? "bg-slate-900 text-white border-slate-700"
                  : "bg-indigo-600 text-white border-indigo-500"
              }`}
            >
              <Sparkles className="w-4 h-4 text-amber-300" />
              <span>{toastMessage.text}</span>
            </div>
          </div>
        )}
        <StandaloneAuthPage
          onLogin={handleLogin}
          defaultMode="login"
        />
      </>
    );
  }

  return (
    <div className="flex h-screen w-full bg-slate-50 font-sans text-slate-900 overflow-hidden">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 animate-bounce">
          <div
            className={`px-4 py-3 rounded-xl shadow-lg border flex items-center gap-2 text-xs font-bold ${
              toastMessage.type === "success"
                ? "bg-slate-900 text-white border-slate-700"
                : "bg-indigo-600 text-white border-indigo-500"
            }`}
          >
            <Sparkles className="w-4 h-4 text-amber-300" />
            <span>{toastMessage.text}</span>
          </div>
        </div>
      )}

      {/* Sleek Sidebar (Desktop) */}
      <aside className="hidden lg:flex w-64 bg-white border-r border-slate-200 flex-col shrink-0 justify-between">
        <div>
          {/* Brand Header */}
          <div
            className="p-6 border-b border-slate-100 flex items-center gap-3 cursor-pointer"
            onClick={() => handleNavigate("dashboard")}
          >
            <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white font-bold italic shadow-xs">
              E
            </div>
            <h1 className="font-bold text-xl tracking-tight text-slate-900">EduFeedback</h1>
          </div>

          {/* Nav Items */}
          <nav className="p-4 space-y-1.5 text-sm font-medium">
            {sidebarNavItems.map((item) => {
              const Icon = item.icon;
              const isActive = currentView === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => handleNavigate(item.id)}
                  className={`w-full flex items-center justify-between px-4 py-2.5 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
                    isActive
                      ? "bg-indigo-50 text-indigo-700 font-semibold"
                      : "hover:bg-slate-50 text-slate-600 hover:text-slate-900"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Icon className={`w-5 h-5 ${isActive ? "text-indigo-600" : "text-slate-400"}`} />
                    <span>{item.label}</span>
                  </div>
                  {Boolean(item.badge && item.badge > 0) && (
                    <span className="px-2 py-0.5 text-xs font-bold text-white bg-rose-500 rounded-full">
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col h-full overflow-hidden min-w-0">
        {/* Sleek Top Header */}
        <Navbar
          currentView={currentView}
          onNavigate={handleNavigate}
          currentUser={currentUser}
          onSignOut={handleSignOut}
          onOpenProfile={handleOpenProfile}
          onOpenPrivacy={() => setShowPrivacyNotice(true)}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          selectedCategory={selectedCategory}
          onCategoryChange={setSelectedCategory}
          notifications={notifications}
          unreadNotifsCount={notifications.filter((n) => !n.read).length}
          flaggedSurveysCount={reportedSurveyCount}
          onMarkAllNotificationsRead={handleMarkAllNotificationsRead}
          onMarkNotificationRead={handleMarkNotificationRead}
          onClearAllNotifications={handleClearAllNotifications}
          onOpenNotification={handleOpenNotification}
        />

        {/* View Router */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          {/* One page width and bottom space for every screen. */}
          <div className="max-w-7xl mx-auto pb-12">
          {currentView === "dashboard" && (
            <Dashboard
              surveys={surveys}
              responses={responses}
              newsList={newsList}
              notifications={notifications}
              users={isSuperadmin ? users : []}
              currentUser={currentUser}
              answeredSurveyIds={answeredSurveyIds}
              onNavigate={handleNavigate}
              onLikeNews={handleLikeNews}
              likedNewsIds={likedNewsIds}
              adminWaitingCount={adminWaitingCount}
              onOpenReviewCenter={handleOpenReviewCenter}
              onTakeSurvey={handleTakeSurvey}
              academicCalendar={academicCalendar}
              onDeleteNews={handleDeleteNews}
              onAddNews={handleAddNews}
              onMarkNotificationRead={handleMarkNotificationRead}
              onMarkAllNotificationsRead={handleMarkAllNotificationsRead}
              onOpenNotification={handleOpenNotification}
            />
          )}

          {currentView === "take-survey" && !isSuperadmin && (
            <ThemedSurveySections
              categories={activeCategoryNames(schoolLists)}
              surveys={
                currentUser?.email
                  ? surveys.filter(
                      (s) =>
                        (s.owner || "").trim().toLowerCase() !==
                        currentUser.email.trim().toLowerCase()
                    )
                  : surveys
              }
              currentUser={currentUser}
              userResponses={responses}
              answeredSurveyIds={answeredSurveyIds}
              searchQuery={searchQuery}
              selectedCategory={selectedCategory}
              onTakeSurvey={handleTakeSurvey}
              onViewAnalytics={(surveyId) => {
                setAnalyticsTargetSurveyId(surveyId);
                setCurrentView("analytics");
              }}
              onCreateSurvey={() => {
                if (!currentUser) {
                  showToast("Please sign in to author surveys.", "info");
                  return;
                }
                if (canCreateSurvey) {
                  setEditingSurvey(null);
                  setCurrentView("create");
                }
              }}
              onCreateNewSurvey={() => {
                if (!currentUser) {
                  showToast("Please sign in to author surveys.", "info");
                  return;
                }
                if (canCreateSurvey) {
                  setEditingSurvey(null);
                  setCurrentView("create");
                }
              }}
              onTakedownSurvey={handleTakedownSurvey}
            />
          )}

          {currentView === "my-surveys" && (
            <MySurveysScreen
              surveys={surveys}
              currentUser={currentUser}
              userResponses={responses}
              onCreateNewSurvey={() => {
                setEditingSurvey(null);
                setCurrentView("create");
              }}
              onEditSurvey={handleEditSurvey}
              onDeleteSurvey={handleDeleteSurvey}
              onViewAnalytics={(surveyId) => {
                setAnalyticsTargetSurveyId(surveyId);
                setCurrentView("analytics");
              }}
              onPreviewSurvey={(survey) => setPreviewSurvey(survey)}
              onArchiveSurvey={handleArchiveSurvey}
              onWithdrawSurvey={handleWithdrawSurvey}
              onDuplicateSurvey={handleDuplicateSurvey}
            />
          )}

          {currentView === "analytics" && (
            <AnalyticsPage
              surveys={surveys}
              responses={trustedResponseList}
              academicCalendar={academicCalendar}
              topics={topics}
              users={users}
              dataLoadedAt={dataLoadedAt}
              onRefresh={handleRefreshAnalytics}
              onFlagResponse={handleFlagResponse}
              initialSurveyId={analyticsTargetSurveyId}
              isAdmin={isSuperadmin}
              currentUser={currentUser}
              onCreateSurvey={canCreateSurvey ? () => { setEditingSurvey(null); setCurrentView("create"); } : undefined}
            />
          )}

          {currentView === "tagalog-ml" && (
            isSuperadmin ? (
              <SentimentAnalysisView
                responses={trustedResponseList}
                signatureCheck={signatureCheck}
                surveys={surveys}
                onReanalyze={handleReanalyzeResponses}
              />
            ) : (
              <div className="bg-white rounded-3xl p-10 text-center border border-slate-200 shadow-xs max-w-lg mx-auto mt-12 space-y-4">
                <div className="w-14 h-14 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto">
                  <BrainCircuit className="w-7 h-7" />
                </div>
                <h3 className="font-serif text-lg font-bold text-slate-900">Administrator Access Required</h3>
                <p className="text-xs text-slate-500 leading-relaxed">
                  The Sentiment Analysis screen is only available to the System Administrator.
                </p>
                <button
                  onClick={() => setCurrentView("take-survey")}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer"
                >
                  Return to Take a Survey
                </button>
              </div>
            )
          )}

          {currentView === "create" && (
            canCreateSurvey ? (
              <SurveyBuilder
                currentUser={currentUser}
                creationOpen={appSettings.surveyCreationOpen}
                categories={activeCategoryNames(schoolLists)}
                schoolLists={schoolLists}
                topics={topics}
                academicCalendar={academicCalendar}
                myPendingCount={
                  surveys.filter(
                    (s) =>
                      s.status === "pending" &&
                      (s.owner || "").trim().toLowerCase() === (currentUser?.email || "").trim().toLowerCase() &&
                      s.id !== editingSurvey?.id
                  ).length
                }
                onSaveSurvey={handleSaveSurvey}
                initialSurvey={editingSurvey || undefined}
                onCancel={() => {
                  setEditingSurvey(null);
                  setCurrentView("my-surveys");
                }}
              />
            ) : (
              <div className="bg-white rounded-3xl p-10 text-center border border-slate-200 shadow-xs max-w-lg mx-auto mt-12 space-y-4">
                <div className="w-14 h-14 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto">
                  <ClipboardList className="w-7 h-7" />
                </div>
                <h3 className="font-serif text-lg font-bold text-slate-900">Administrator Role Notice</h3>
                <p className="text-xs text-slate-500 leading-relaxed">
                  As System Administrator, your primary responsibilities are system configuration, content moderation, sentiment analysis review, and macro institutional analytics. Survey authoring is delegated to university community members (Students, Student Officers, and Faculty).
                </p>
                <div className="flex items-center justify-center gap-3 pt-2">
                  <button
                    onClick={() => setCurrentView("admin")}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer"
                  >
                    Go to Review Center
                  </button>
                  <button
                    onClick={() => setCurrentView("analytics")}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all cursor-pointer"
                  >
                    View Analytics
                  </button>
                </div>
              </div>
            )
          )}

          {currentView === "admin" && (
            <SuperadminDashboard
              key={reviewOpenCount}
              initialTab={reviewStartTab}
              surveys={surveys}
              users={users}
              logs={logs}
              responses={responses}
              newsList={newsList}
              topics={topics}
              currentUser={currentUser}
              onDeleteSurvey={handleDeleteSurvey}
              onTakedownSurvey={handleTakedownSurvey}
              onToggleUserStatus={handleToggleUserStatus}
              onSendPasswordReset={handleSendPasswordReset}
              onPromoteUser={handlePromoteUser}
              onAddUser={handleAddUser}
              onUpdateUser={handleUpdateUser}
              onDeleteUser={handleDeleteUser}
              onReviewNews={handleReviewNews}
              onDecideFlag={handleDecideFlag}
              onRefreshUsers={handleRefreshUsers}
              surveyCreationOpen={appSettings.surveyCreationOpen}
              onSetSurveyCreation={handleSetSurveyCreation}
              lastYearMoveAt={appSettings.lastYearMoveAt}
              onNewSchoolYear={handleNewSchoolYear}
              onMarkEmailsChecked={handleMarkEmailsChecked}
              schoolLists={schoolLists}
              onSaveSchoolLists={handleSaveSchoolLists}
              surveyReports={surveyReports}
              profileRequests={profileRequests}
              onDecideProfileRequest={handleDecideProfileRequest}
              onMoveTopicBlocks={handleMoveTopicBlocks}
              onUndoTopicMove={handleUndoTopicMove}
              onDecideTopicRequest={handleDecideTopicRequest}
              onDismissReports={handleDismissReports}
              onTakedownReported={handleTakedownReported}
              onSaveTopic={handleSaveTopic}
              onDeleteTopic={handleDeleteTopic}
              academicCalendar={academicCalendar}
              onSaveAcademicYear={handleSaveAcademicYear}
              onDeleteAcademicYear={handleDeleteAcademicYear}
              onApproveSurvey={handleApproveSurvey}
              onRejectSurvey={handleRejectSurvey}
              showToast={showToast}
              onNavigateToAnalytics={(surveyId) => {
                setAnalyticsTargetSurveyId(surveyId || "all");
                setCurrentView("analytics");
              }}
              onNavigateToML={() => setCurrentView("tagalog-ml")}
            />
          )}
          </div>
        </main>
      </div>

      {/* Modals */}
      {activeSurveyForTaking && (
        <TakeSurveyModal
          survey={activeSurveyForTaking}
          currentUser={currentUser}
          existingAnswers={
            responses.find(
              (r) =>
                String(r.surveyId) === String(activeSurveyForTaking.id) &&
                (r.userEmail || "").trim().toLowerCase() === (currentUser?.email || "").trim().toLowerCase()
            )?.answers
          }
          onClose={() => setActiveSurveyForTaking(null)}
          onReport={
            (activeSurveyForTaking.owner || "").trim().toLowerCase() !== (currentUser?.email || "").trim().toLowerCase()
              ? (reasons, note) => handleReportSurvey(activeSurveyForTaking, reasons, note)
              : undefined
          }
          alreadyReported={myReportedSurveyIds.includes(String(activeSurveyForTaking.id))}
          onSubmit={handleSubmitSurveyResponse}
        />
      )}

      {showProfileModal && currentUser && (
        <UserProfileModal
          currentUser={currentUser}
          schoolLists={schoolLists}
          onClose={() => setShowProfileModal(false)}
          profileRequest={myProfileRequest}
          showRequestDecision={showRequestDecision}
          onUpdateName={handleUpdateName}
          onSendProfileRequest={handleSendProfileRequest}
          onCancelProfileRequest={handleCancelProfileRequest}
        />
      )}

      {/* Everyone agrees to the current Privacy Notice once (accounts made before it existed too). */}
      {currentUser && currentUser.privacyNoticeVersion !== PRIVACY_NOTICE_VERSION && (
        <PrivacyNoticeModal mode="agree" onAgree={handleAcceptPrivacy} onSignOut={handleSignOut} />
      )}
      {showPrivacyNotice && <PrivacyNoticeModal mode="read" onClose={() => setShowPrivacyNotice(false)} />}

      {currentUser?.sectionPickNeeded &&
        currentUser.privacyNoticeVersion === PRIVACY_NOTICE_VERSION &&
        !sectionPickLater &&
        !showProfileModal && (
        <SectionPickPrompt
          user={currentUser}
          lists={schoolLists}
          onSave={handlePickNewSection}
          onLater={() => setSectionPickLater(true)}
        />
      )}

      {previewSurvey && (
        <TakeSurveyModal
          survey={previewSurvey}
          currentUser={currentUser}
          previewOnly
          onClose={() => setPreviewSurvey(null)}
          onSubmit={async () => {}}
        />
      )}

    </div>
  );
}
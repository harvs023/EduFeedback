import React, { useState, useEffect, useCallback, useRef } from "react";
import { Survey, SurveyStatus, SurveyResponse, UserProfile, TagalogMLSample, NewsAnnouncement, ActivityLog, NotificationItem, Topic, AcademicYearTerms, ResponseReview, AppSettings } from "./types";
import { DatabaseService, USE_FIREBASE } from "./lib/databaseService";
import { schoolYearFor } from "./lib/schoolYear";
import { authFetch, getFirebaseAuth, isFirebaseConfigured, FirebaseAuthService, FirestoreUserService, INITIAL_TOPICS } from "./lib/firebase";
import { countEligibleUsers, getSurveyAvailability } from "./lib/surveyReview";
import {
  analyzeResponse,
  initialCommentStatus,
  needsReanalysis,
  requestServerAnalysis,
  resultKey,
  trustedResponses,
  verifySavedResults,
} from "./lib/sentiment";
import { MASTER_ADMIN_EMAIL, DEFAULT_SURVEY_CATEGORIES } from "./data/initialData";
import { Navbar } from "./components/Navbar";
import { ThemedSurveySections } from "./components/ThemedSurveySections";
import { AnalyticsPage } from "./components/analytics/AnalyticsPage";
import { SentimentAnalysisView } from "./components/SentimentAnalysisView";
import { NewsAnnouncementsFeed, MAX_PENDING_NEWS } from "./components/NewsAnnouncementsFeed";
import { Dashboard } from "./components/Dashboard";
import { SurveyBuilder } from "./components/SurveyBuilder";
import { MySurveysScreen } from "./components/MySurveysScreen";
import { SuperadminDashboard } from "./components/SuperadminDashboard";
import { TakeSurveyModal } from "./components/TakeSurveyModal";
import { UserProfileModal } from "./components/UserProfileModal";
import { AuthModal } from "./components/AuthModal";
import { StandaloneAuthPage } from "./components/StandaloneAuthPage";
import {
  LayoutDashboard,
  ClipboardList,
  BarChart3,
  BrainCircuit,
  Newspaper,
  PlusCircle,
  ShieldAlert,
  Sparkles,
  UserCheck,
  SlidersHorizontal,
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
  const [mlDataset, setMlDataset] = useState<TagalogMLSample[]>([]);
  const [newsList, setNewsList] = useState<NewsAnnouncement[]>([]);
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [academicCalendar, setAcademicCalendar] = useState<AcademicYearTerms[]>([]);
  /** Admin switches (survey creation open/closed). Defaults to open until loaded. */
  const [appSettings, setAppSettings] = useState<AppSettings>({ surveyCreationOpen: true });
  /** When surveys and responses were last loaded from the database (shown on Analytics). */
  const [dataLoadedAt, setDataLoadedAt] = useState<number | null>(null);

  // Modals State
  const [activeSurveyForTaking, setActiveSurveyForTaking] = useState<Survey | null>(null);
  const [previewSurvey, setPreviewSurvey] = useState<Survey | null>(null);
  const [answeredSurveyIds, setAnsweredSurveyIds] = useState<string[]>([]);
  // Saved sentiment results confirmed by the server's signature check (see lib/sentiment.ts).
  const [validResultKeys, setValidResultKeys] = useState<Set<string>>(new Set());
  const [signatureCheck, setSignatureCheck] = useState<"checking" | "done" | "unavailable">("done");
  const checkedResultKeys = useRef<Set<string>>(new Set());
  const [showProfileModal, setShowProfileModal] = useState<boolean>(false);
  const [showAuthModal, setShowAuthModal] = useState<boolean>(false);
  const [authModalMode, setAuthModalMode] = useState<"login" | "register">("login");
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
      const isAuthor = isAdmin || user?.role === "faculty" || user?.role === "officer";

      const [cloudResponses, cloudUsers, cloudNews, cloudMl, cloudLogs] = await Promise.all([
        DatabaseService.getResponses(user, cloudSurveys).catch(() => []),
        isAdmin ? DatabaseService.getUsers(user).catch(() => []) : Promise.resolve([]),
        DatabaseService.getNews(user).catch(() => []),
        isAuthor ? DatabaseService.getMLDataset(user).catch(() => []) : Promise.resolve([]),
        isSuperadmin ? DatabaseService.getLogs(user).catch(() => []) : Promise.resolve([]),
      ]);

      setResponses(cloudResponses);
      setDataLoadedAt(Date.now());
      setUsers(cloudUsers);
      setNewsList(cloudNews);
      setMlDataset(cloudMl);
      setLogs(isSuperadmin ? cloudLogs : []);

      let freshTopics: Topic[] = [];
      try {
        freshTopics = await DatabaseService.getTopics();
        if (freshTopics.length === 0 && (isAdmin || isSuperadmin)) {
          for (const t of INITIAL_TOPICS) {
            await DatabaseService.saveTopic(t);
          }
          freshTopics = await DatabaseService.getTopics();
        }
      } catch (topicErr) {
        console.warn("Failed to load topics:", topicErr);
        freshTopics = [];
      }
      setTopics(freshTopics);
      setAcademicCalendar(await DatabaseService.getAcademicCalendar().catch(() => []));
      setAppSettings(await DatabaseService.getSettings().catch(() => ({ surveyCreationOpen: true })));
      setAnsweredSurveyIds(user?.email ? await DatabaseService.getAnsweredSurveyIds(user.email) : []);
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

  // Firebase Auth State Listener & Profile Synchronization
  useEffect(() => {
    if (!isFirebaseConfigured()) return;

    const unsubscribe = FirebaseAuthService.onAuthChanged(async (fbUser) => {
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
            showToast("User profile record not found in Firestore. Signed out.", "info");
            return;
          }
          if (profile.status !== "active") {
            await FirebaseAuthService.signOut();
            setCurrentUser(null);
            setNotifications([]);
            showToast(
              profile.status === "suspended"
                ? "This university account has been suspended by system administration."
                : "Your account is currently awaiting administrative approval.",
              "info"
            );
            return;
          }
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
      }
    });

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
    setCurrentUser(user);
    setCurrentView("dashboard");
    const isAdmin = user.role === "superadmin" || user.pos === "Superadmin";
    const isSuperadmin = user.role === "superadmin";
    const isAuthor = isAdmin || user.role === "faculty" || user.role === "officer";

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
      const [scopedResponses, scopedUsers, freshNews, freshMl, freshLogs] = await Promise.all([
        DatabaseService.getResponses(user, activeSurveys).catch(() => []),
        isAdmin ? DatabaseService.getUsers(user).catch(() => []) : Promise.resolve([]),
        DatabaseService.getNews(user).catch(() => []),
        isAuthor ? DatabaseService.getMLDataset(user).catch(() => []) : Promise.resolve([]),
        isSuperadmin ? DatabaseService.getLogs(user).catch(() => []) : Promise.resolve([]),
      ]);
      setResponses(scopedResponses);
      setDataLoadedAt(Date.now());
      setUsers(scopedUsers);
      setNewsList(freshNews);
      setMlDataset(freshMl);
      setLogs(isSuperadmin ? freshLogs : []);

      let freshTopics: Topic[] = [];
      try {
        freshTopics = await DatabaseService.getTopics();
        if (freshTopics.length === 0 && (isAdmin || isSuperadmin)) {
          for (const t of INITIAL_TOPICS) {
            await DatabaseService.saveTopic(t);
          }
          freshTopics = await DatabaseService.getTopics();
        }
      } catch (topicErr) {
        console.warn("Failed to load topics:", topicErr);
        freshTopics = [];
      }
      setTopics(freshTopics);
      setAcademicCalendar(await DatabaseService.getAcademicCalendar().catch(() => []));
      setAppSettings(await DatabaseService.getSettings().catch(() => ({ surveyCreationOpen: true })));
      setAnsweredSurveyIds(user?.email ? await DatabaseService.getAnsweredSurveyIds(user.email) : []);
    } catch (err: any) {
      showToast(err?.message || "Failed to load Firestore data for user.", "info");
    }
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

  const handleLikeNews = async (id: string) => {
    try {
      await DatabaseService.likeNews(id);
      setNewsList((prev) => prev.map((n) => (n.id === id ? { ...n, likesCount: n.likesCount + 1 } : n)));
    } catch (err: any) {
      showToast(err.message || "Failed to like announcement.", "info");
    }
  };

  // Moderation Handlers
  const handleClearFlag = async (surveyId: string | number) => {
    const srv = surveys.find((s) => s.id === surveyId);
    if (!srv) return;
    const updated = { ...srv, flagged: false, flagReason: undefined };
    try {
      await DatabaseService.saveSurvey(updated);
      setSurveys((prev) => prev.map((s) => (s.id === surveyId ? updated : s)));

      if (srv.owner) {
        try {
          await DatabaseService.addNotification({
            to: srv.owner.toLowerCase(),
            title: "✅ Survey Flag Cleared",
            message: `Your survey "${srv.title}" has been reviewed and approved by administration.`,
            icon: "✅",
            type: "flag_cleared",
            data: { surveyId },
          });
        } catch {}
        if (currentUser?.email) {
          const refreshed = await DatabaseService.getNotifications(currentUser.email);
          setNotifications(refreshed);
        }
      }
      showToast("Survey flag cleared and approved!", "success");
    } catch (err: any) {
      showToast(err.message || "Failed to clear survey flag.", "info");
    }
  };

  const handleFlagSurvey = async (surveyId: string | number, reason: string) => {
    const srv = surveys.find((s) => s.id === surveyId);
    if (!srv) return;
    const updated = { ...srv, flagged: true, flagReason: reason };
    try {
      await DatabaseService.saveSurvey(updated);
      setSurveys((prev) => prev.map((s) => (s.id === surveyId ? updated : s)));

      if (srv.owner) {
        try {
          await DatabaseService.addNotification({
            to: srv.owner.toLowerCase(),
            title: "⚠️ Survey Flagged for Review",
            message: `Your survey "${srv.title}" was flagged: ${reason}`,
            icon: "⚠️",
            type: "flag",
            data: { surveyId },
          });
        } catch {}
        if (currentUser?.email) {
          const refreshed = await DatabaseService.getNotifications(currentUser.email);
          setNotifications(refreshed);
        }
      }
      showToast("Survey flagged for administrative review.", "info");
    } catch (err: any) {
      showToast(err.message || "Failed to flag survey.", "info");
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

  const handleTakedownSurvey = async (surveyId: string | number, reason: string) => {
    const isSuperadmin =
      currentUser?.role === "superadmin" ||
      currentUser?.pos === "Superadmin" ||
      currentUser?.email?.toLowerCase() === MASTER_ADMIN_EMAIL.toLowerCase();

    if (!isSuperadmin) {
      showToast("Unauthorized: Superadmin access required.", "info");
      return;
    }

    if (!reason || reason.trim().length < 10) {
      showToast("Takedown reason must be at least 10 characters.", "info");
      return;
    }

    const srv = surveys.find((s) => s.id === surveyId);
    if (!srv) {
      showToast("Survey not found.", "info");
      return;
    }

    if (srv.status !== "published" && srv.status !== "scheduled") {
      showToast("Only published or scheduled surveys can be taken down.", "info");
      return;
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
    } catch (err: any) {
      showToast(err.message || "Failed to take down survey.", "info");
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
      flagged: false,
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
    const updatedUser: UserProfile = { ...targetUser, pos: newPos, role: newPos === "Superadmin" ? "superadmin" : "user" };

    try {
      await DatabaseService.saveUser(updatedUser);
      setUsers((prev) => prev.map((u) => (u.email.trim().toLowerCase() === cleanEmail.toLowerCase() ? updatedUser : u)));
      showToast(`User promoted to ${newPos}.`, "success");
    } catch (err: any) {
      showToast(err.message || "Failed to promote user.", "info");
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

  const handleRestoreBackup = async (backupData: any, mode: "overwrite" | "merge") => {
    try {
      if (backupData?.data) {
        if (backupData.data.surveys) {
          for (const s of backupData.data.surveys) {
            await DatabaseService.saveSurvey(s);
          }
          setSurveys(backupData.data.surveys);
        }
        if (backupData.data.users) {
          for (const u of backupData.data.users) {
            await DatabaseService.saveUser(u);
          }
          setUsers(backupData.data.users);
        }
        if (backupData.data.newsList) {
          for (const n of backupData.data.newsList) {
            await DatabaseService.saveNews(n);
          }
          setNewsList(backupData.data.newsList);
        }
      }
      showToast(
        mode === "overwrite"
          ? "Database successfully restored from snapshot!"
          : "Database records successfully merged with snapshot!",
        "success"
      );
    } catch (err: any) {
      showToast(err.message || "Failed to restore database backup.", "info");
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
    setAppSettings(next);
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

  const handleUpdateProfile = async (updated: Partial<UserProfile>) => {
    if (!currentUser) return;
    const modifiedUser = { ...currentUser, ...updated };
    try {
      await DatabaseService.saveUser(modifiedUser);
      setCurrentUser(modifiedUser);
      setUsers((prev) => prev.map((u) => (u.email === currentUser.email ? modifiedUser : u)));
      showToast("Profile details updated!", "success");
    } catch (err: any) {
      showToast(err.message || "Failed to update profile.", "info");
    }
  };

  const isSuperadmin = currentUser?.role === "superadmin" || currentUser?.pos === "Superadmin";
  // All authenticated users can author surveys (Students, Officers, Faculty, Admins)
  const canCreateSurvey = Boolean(currentUser);
  const flaggedCount = surveys.filter((s) => s.flagged).length;

  const handleNavigate = (view: string) => {
    if (view !== "create") {
      setEditingSurvey(null);
    }
    setCurrentView(view);
  };

  const sidebarNavItems = [
    { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
    { id: "take-survey", label: "Take a Survey", icon: ClipboardList },
    ...(currentUser
      ? [
          {
            id: "my-surveys",
            label: isSuperadmin ? "Survey Management" : "My Surveys",
            icon: isSuperadmin ? SlidersHorizontal : UserCheck,
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
    ...(isSuperadmin ? [{ id: "admin", label: "Review Center", icon: ShieldAlert, badge: flaggedCount }] : []),
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
          defaultMode={authModalMode}
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
          onSwitchUser={handleLogin}
          onSignOut={handleSignOut}
          onOpenProfile={() => setShowProfileModal(true)}
          onOpenAuth={() => {
            setAuthModalMode("login");
            setShowAuthModal(true);
          }}
          onOpenRegister={() => {
            setAuthModalMode("register");
            setShowAuthModal(true);
          }}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          selectedCategory={selectedCategory}
          onCategoryChange={setSelectedCategory}
          notifications={notifications}
          unreadNotifsCount={notifications.filter((n) => !n.read).length}
          unreadNewsCount={newsList.filter((n) => n.status === "published" || !n.status).length}
          flaggedSurveysCount={flaggedCount}
          onMarkAllNotificationsRead={handleMarkAllNotificationsRead}
          onMarkNotificationRead={handleMarkNotificationRead}
          onClearAllNotifications={handleClearAllNotifications}
        />

        {/* View Router */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
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
              onDeleteNews={handleDeleteNews}
              onAddNews={handleAddNews}
              onMarkNotificationRead={handleMarkNotificationRead}
              onMarkAllNotificationsRead={handleMarkAllNotificationsRead}
            />
          )}

          {currentView === "take-survey" && (
            <ThemedSurveySections
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
              onTakeSurvey={(survey) => {
                if (!currentUser) {
                  setAuthModalMode("login");
                  setShowAuthModal(true);
                  showToast("Please sign in or register to take this survey.", "info");
                  return;
                }
                const myEmail = currentUser.email.trim().toLowerCase();
                const hasNamedAnswer = responses.some(
                  (r) =>
                    String(r.surveyId) === String(survey.id) && (r.userEmail || "").trim().toLowerCase() === myEmail
                );
                if (answeredSurveyIds.includes(String(survey.id)) && !hasNamedAnswer) {
                  showToast("You already answered this survey anonymously. Each person can answer once.", "info");
                  return;
                }
                setActiveSurveyForTaking(survey);
              }}
              onViewAnalytics={(surveyId) => {
                setAnalyticsTargetSurveyId(surveyId);
                setCurrentView("analytics");
              }}
              onCreateSurvey={() => {
                if (!currentUser) {
                  setAuthModalMode("login");
                  setShowAuthModal(true);
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
                  setAuthModalMode("login");
                  setShowAuthModal(true);
                  showToast("Please sign in to author surveys.", "info");
                  return;
                }
                if (canCreateSurvey) {
                  setEditingSurvey(null);
                  setCurrentView("create");
                }
              }}
              onEditSurvey={handleEditSurvey}
              onDeleteSurvey={handleDeleteSurvey}
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
              onFlagSurvey={handleFlagSurvey}
              onClearFlag={handleClearFlag}
              onDuplicateSurvey={handleDuplicateSurvey}
              onApproveSurvey={handleApproveSurvey}
              onRejectSurvey={handleRejectSurvey}
              onTakedownSurvey={handleTakedownSurvey}
            />
          )}

          {currentView === "analytics" && (
            <AnalyticsPage
              surveys={surveys}
              responses={trustedResponseList}
              academicCalendar={academicCalendar}
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

          {currentView === "news" && (
            <NewsAnnouncementsFeed
              newsList={newsList}
              currentUser={currentUser}
              onAddNews={handleAddNews}
              onLikeNews={handleLikeNews}
              onDeleteNews={handleDeleteNews}
            />
          )}

          {currentView === "create" && (
            canCreateSurvey ? (
              <SurveyBuilder
                currentUser={currentUser}
                creationOpen={appSettings.surveyCreationOpen}
                categories={DEFAULT_SURVEY_CATEGORIES}
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
              surveys={surveys}
              users={users}
              logs={logs}
              responses={responses}
              newsList={newsList}
              mlDataset={mlDataset}
              topics={topics}
              currentUser={currentUser}
              onClearFlag={handleClearFlag}
              onFlagSurvey={handleFlagSurvey}
              onDeleteSurvey={handleDeleteSurvey}
              onToggleUserStatus={handleToggleUserStatus}
              onPromoteUser={handlePromoteUser}
              onAddUser={handleAddUser}
              onUpdateUser={handleUpdateUser}
              onDeleteUser={handleDeleteUser}
              onReviewNews={handleReviewNews}
              onDecideFlag={handleDecideFlag}
              onRefreshUsers={handleRefreshUsers}
              surveyCreationOpen={appSettings.surveyCreationOpen}
              onSetSurveyCreation={handleSetSurveyCreation}
              onRestoreBackup={handleRestoreBackup}
              onSaveTopic={handleSaveTopic}
              onDeleteTopic={handleDeleteTopic}
              academicCalendar={academicCalendar}
              onSaveAcademicYear={handleSaveAcademicYear}
              onDeleteAcademicYear={handleDeleteAcademicYear}
              onApproveSurvey={handleApproveSurvey}
              onRejectSurvey={handleRejectSurvey}
              onTakedownSurvey={handleTakedownSurvey}
              showToast={showToast}
              onNavigateToAnalytics={(surveyId) => {
                setAnalyticsTargetSurveyId(surveyId || "all");
                setCurrentView("analytics");
              }}
              onNavigateToML={() => setCurrentView("tagalog-ml")}
            />
          )}
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
          onSubmit={handleSubmitSurveyResponse}
        />
      )}

      {showProfileModal && currentUser && (
        <UserProfileModal
          currentUser={currentUser}
          onClose={() => setShowProfileModal(false)}
          onUpdateProfile={handleUpdateProfile}
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

      {showAuthModal && (
        <AuthModal
          initialMode={authModalMode}
          onClose={() => setShowAuthModal(false)}
          onLogin={handleLogin}
        />
      )}
    </div>
  );
}
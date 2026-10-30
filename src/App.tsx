import React, { useState, useEffect, useCallback } from "react";
import { Survey, SurveyResponse, UserProfile, TagalogMLSample, NewsAnnouncement, ActivityLog, NotificationItem } from "./types";
import { DatabaseService, USE_FIREBASE } from "./lib/databaseService";
import { authFetch, getFirebaseAuth, isFirebaseConfigured, FirebaseAuthService, FirestoreUserService } from "./lib/firebase";
import { MASTER_ADMIN_EMAIL, DEFAULT_SURVEY_CATEGORIES } from "./data/initialData";
import { Navbar } from "./components/Navbar";
import { ThemedSurveySections } from "./components/ThemedSurveySections";
import { HistoricalAnalyticsView } from "./components/HistoricalAnalyticsView";
import { TagalogMLTrainingStudio } from "./components/TagalogMLTrainingStudio";
import { NewsAnnouncementsFeed } from "./components/NewsAnnouncementsFeed";
import { SurveyBuilder } from "./components/SurveyBuilder";
import { MySurveysScreen } from "./components/MySurveysScreen";
import { SuperadminDashboard } from "./components/SuperadminDashboard";
import { TakeSurveyModal } from "./components/TakeSurveyModal";
import { UserProfileModal } from "./components/UserProfileModal";
import { AuthModal } from "./components/AuthModal";
import { StandaloneAuthPage } from "./components/StandaloneAuthPage";
import {
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
  const [currentView, setCurrentView] = useState<string>("surveys");
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

  // Modals State
  const [activeSurveyForTaking, setActiveSurveyForTaking] = useState<Survey | null>(null);
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
      const cloudSurveys = await DatabaseService.getSurveys();
      setSurveys(cloudSurveys);

      const isAdmin = user?.role === "superadmin" || user?.pos === "Superadmin";
      const isSuperadmin = user?.role === "superadmin";
      const isAuthor = isAdmin || user?.role === "faculty" || user?.role === "officer";

      const [cloudResponses, cloudUsers, cloudNews, cloudMl, cloudLogs] = await Promise.all([
        DatabaseService.getResponses(user, cloudSurveys).catch(() => []),
        isAdmin ? DatabaseService.getUsers(user).catch(() => []) : Promise.resolve([]),
        DatabaseService.getNews().catch(() => []),
        isAuthor ? DatabaseService.getMLDataset(user).catch(() => []) : Promise.resolve([]),
        isSuperadmin ? DatabaseService.getLogs(user).catch(() => []) : Promise.resolve([]),
      ]);

      setResponses(cloudResponses);
      setUsers(cloudUsers);
      setNewsList(cloudNews);
      setMlDataset(cloudMl);
      setLogs(isSuperadmin ? cloudLogs : []);
    } catch (err: any) {
      showToast(err?.message || "Failed to load data from Firestore.", "info");
    }
  }, []);

  // Firebase Auth State Listener & Profile Synchronization
  useEffect(() => {
    if (!isFirebaseConfigured()) return;

    const unsubscribe = FirebaseAuthService.onAuthChanged(async (fbUser) => {
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
      }
    });

    return () => {
      unsubscribe();
    };
  }, [loadDataForUser]);

  const handleLogin = async (user: UserProfile) => {
    setCurrentUser(user);
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

      const activeSurveys = await DatabaseService.getSurveys();
      setSurveys(activeSurveys);
      const [scopedResponses, scopedUsers, freshNews, freshMl, freshLogs] = await Promise.all([
        DatabaseService.getResponses(user, activeSurveys).catch(() => []),
        isAdmin ? DatabaseService.getUsers(user).catch(() => []) : Promise.resolve([]),
        DatabaseService.getNews().catch(() => []),
        isAuthor ? DatabaseService.getMLDataset(user).catch(() => []) : Promise.resolve([]),
        isSuperadmin ? DatabaseService.getLogs(user).catch(() => []) : Promise.resolve([]),
      ]);
      setResponses(scopedResponses);
      setUsers(scopedUsers);
      setNewsList(freshNews);
      setMlDataset(freshMl);
      setLogs(isSuperadmin ? freshLogs : []);
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
  const handleSubmitSurveyResponse = async (answers: any[], isAnonymous: boolean = true) => {
    if (!activeSurveyForTaking) return;

    // Detect if any answers have Tagalog / open feedback
    let detectedSentiment: any = {
      sentiment: "Positive",
      score: 0.9,
      aspects: ["General"],
      language: "Taglish",
      sarcasmDetected: false,
    };
    const paragraphAns = answers.find((a) => a.answer && a.answer.length > 10 && !a.ratingValue);

    if (paragraphAns) {
      try {
        const res = await authFetch("/api/ml/analyze-tagalog", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            text: paragraphAns.answer,
            surveyContext: activeSurveyForTaking.title,
          }),
        });
        const data = await res.json();
        if (data.success && data.result) {
          detectedSentiment = {
            sentiment: data.result.sentiment,
            score: data.result.score,
            aspects: data.result.aspects || ["General"],
            language: data.result.language || "Taglish",
            sarcasmDetected: Boolean(data.result.sarcasmDetected),
            emotion: data.result.emotion,
          };
        }
      } catch (e) {
        console.warn("Tagalog NLP inference fallback used:", e);
      }
    }

    const newResponse: SurveyResponse = {
      id: `resp_${Date.now()}`,
      surveyId: activeSurveyForTaking.id,
      surveyTitle: activeSurveyForTaking.title,
      category: activeSurveyForTaking.cat,
      userEmail: isAnonymous ? "anonymous@school.edu.ph" : currentUser?.email || "anonymous@school.edu.ph",
      userName: isAnonymous ? "Anonymous Respondent" : currentUser?.name,
      isAnonymous,
      date: new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
      timestamp: Date.now(),
      academicYear: activeSurveyForTaking.academicYear || "2025-2026",
      department: currentUser?.department || "College of Computer Studies",
      program: currentUser?.program || "BS Computer Science",
      year: currentUser?.year || "3rd Year",
      section: currentUser?.section || "CS-3A",
      sentimentAnalysis: detectedSentiment,
      answers,
    };

    try {
      await DatabaseService.saveResponse(newResponse);

      // Update in-memory survey responses count
      setSurveys((prev) =>
        prev.map((s) => (s.id === activeSurveyForTaking.id ? { ...s, responses: (s.responses || 0) + 1 } : s))
      );
      setResponses((prev) => [newResponse, ...prev]);

      await logActivityAndRefresh({
        user: currentUser?.name || "Student",
        pos: currentUser?.pos || "Student",
        action: "Survey Response Submitted",
        details: `Submitted response for survey: "${activeSurveyForTaking.title}"`,
      });
      setActiveSurveyForTaking(null);

      // Dynamic Notification: Notify survey owner
      const targetOwner = activeSurveyForTaking.creatorEmail || activeSurveyForTaking.owner;
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

      showToast("Survey response submitted successfully!", "success");
    } catch (err: any) {
      showToast(err.message || "Failed to submit survey response.", "info");
    }
  };

  // Create / Edit Survey Handler
  const handleSaveSurvey = async (surveyData: Partial<Survey>, status: "draft" | "published" | "scheduled") => {
    // If editing an existing survey
    if (surveyData.id) {
      const existing = surveys.find((s) => s.id === surveyData.id);
      const updatedSurvey = {
        ...existing,
        ...surveyData,
        status: status === "draft" ? "draft" : status === "scheduled" ? "scheduled" : "published",
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
          action: "Survey Updated",
          details: `Edited survey "${surveyData.title || surveyData.id}"`,
        });

        setEditingSurvey(null);
        showToast(`Survey "${surveyData.title}" updated successfully!`, "success");
        setCurrentView("surveys");
      } catch (err: any) {
        showToast(err.message || "Failed to update survey.", "info");
      }
      return;
    }

    // Creating a brand new survey
    const newSurvey: Survey = {
      id: `srv_${Date.now()}`,
      title: surveyData.title || "Untitled Survey",
      cat: surveyData.cat || "General",
      desc: surveyData.desc || "",
      themeSection: surveyData.themeSection || "academics",
      isTrending: surveyData.isTrending || false,
      academicYear: surveyData.academicYear || "2025-2026",
      created: new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
      responses: 0,
      status: status === "draft" ? "draft" : status === "scheduled" ? "scheduled" : "published",
      openDate: surveyData.openDate,
      closeDate: surveyData.closeDate,
      closes: surveyData.closeDate ? new Date(surveyData.closeDate).toLocaleDateString() : "Open",
      questions: surveyData.questions || [],
      questionCount: surveyData.questions?.length || 0,
      owner: currentUser?.email || "faculty@school.edu.ph",
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
        action: "Survey Created",
        details: `Created new survey "${newSurvey.title}" in section "${newSurvey.themeSection}"`,
      });

      setEditingSurvey(null);

      // Dynamic Notification: Notify campus admin if survey is published
      if (status === "published") {
        try {
          await DatabaseService.addNotification({
            to: MASTER_ADMIN_EMAIL.toLowerCase(),
            title: "📋 New Survey Available",
            message: `"${newSurvey.title}" is now open for campus feedback.`,
            icon: "📋",
            type: "survey",
            data: { surveyId: newSurvey.id },
          });
        } catch {}
      }
      if (currentUser?.email) {
        const refreshed = await DatabaseService.getNotifications(currentUser.email);
        setNotifications(refreshed);
      }

      showToast(`Survey "${newSurvey.title}" saved successfully!`, "success");
      setCurrentView("surveys");
    } catch (err: any) {
      showToast(err.message || "Failed to save survey.", "info");
    }
  };

  const handleEditSurvey = (survey: Survey) => {
    setEditingSurvey(survey);
    setCurrentView("create");
  };

  // ML Training Sample Handlers
  const handleAddMlSample = async (sample: Omit<TagalogMLSample, "id">) => {
    const newSample: TagalogMLSample = {
      id: `sample_${Date.now()}`,
      ...sample,
    };
    try {
      await DatabaseService.addMLSample(newSample);
      setMlDataset((prev) => [newSample, ...prev]);

      await logActivityAndRefresh({
        user: currentUser?.name || "Admin",
        pos: currentUser?.pos || "Admin",
        action: "ML Dataset Sample Added",
        details: `Added new Tagalog feedback training sample: "${sample.text.slice(0, 30)}..."`,
      });
      showToast("New Tagalog sample added to machine learning corpus!", "success");
    } catch (err: any) {
      showToast(err.message || "Failed to add training sample.", "info");
    }
  };

  const handleDeleteMlSample = async (id: string) => {
    try {
      await DatabaseService.deleteMLSample(id);
      setMlDataset((prev) => prev.filter((s) => s.id !== id));
      await logActivityAndRefresh({
        user: currentUser?.name || "Admin",
        pos: currentUser?.pos || "Superadmin",
        action: "ML Dataset Sample Deleted",
        details: `Deleted training phrase with ID ${id} from NLP corpus`,
      });
      showToast("Training sample removed from corpus.", "info");
    } catch (err: any) {
      showToast(err?.message || "Failed to remove training sample.", "info");
    }
  };

  // News Announcements Handlers
  const handleAddNews = async (news: Omit<NewsAnnouncement, "id" | "likesCount">) => {
    const newPost: NewsAnnouncement = {
      id: `news_${Date.now()}`,
      likesCount: 0,
      ...news,
    };
    try {
      await DatabaseService.saveNews(newPost);
      setNewsList((prev) => [newPost, ...prev]);

      await logActivityAndRefresh({
        user: currentUser?.name || "Admin",
        pos: currentUser?.pos || "Admin",
        action: "Campus News Published",
        details: `Published institutional announcement: "${newPost.title}"`,
      });

      // Dynamic Notification: Broadcast announcement to administrator
      try {
        await DatabaseService.addNotification({
          to: MASTER_ADMIN_EMAIL.toLowerCase(),
          title: "📢 Campus Announcement",
          message: newPost.title,
          icon: "📢",
          type: "news",
          data: { newsId: newPost.id },
        });
      } catch {}
      if (currentUser?.email) {
        const refreshed = await DatabaseService.getNotifications(currentUser.email);
        setNotifications(refreshed);
      }

      showToast("Campus announcement published!", "success");
    } catch (err: any) {
      showToast(err.message || "Failed to publish announcement.", "info");
    }
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

  const handleUpdateSurveyStatus = async (
    surveyId: string | number,
    newStatus: "published" | "draft" | "scheduled" | "closed"
  ) => {
    const srv = surveys.find((s) => s.id === surveyId);
    if (!srv) return;
    const updated = { ...srv, status: newStatus };
    try {
      await DatabaseService.saveSurvey(updated);
      setSurveys((prev) => prev.map((s) => (s.id === surveyId ? updated : s)));
      await logActivityAndRefresh({
        user: currentUser?.name || "Admin",
        pos: currentUser?.pos || "Admin",
        action: "Survey Status Changed",
        details: `Updated survey status to "${newStatus}" for ID: ${surveyId}`,
      });
      showToast(`Survey status updated to ${newStatus}.`, "success");
    } catch (err: any) {
      showToast(err.message || "Failed to update survey status.", "info");
    }
  };

  const handleDuplicateSurvey = async (survey: Survey) => {
    const newId = `srv_${Date.now()}`;
    const duplicated: Survey = {
      ...survey,
      id: newId,
      title: `${survey.title} (Copy)`,
      status: "draft",
      responses: 0,
      created: new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
      createdAtTimestamp: Date.now(),
      flagged: false,
      flagReason: undefined,
      owner: currentUser?.email || survey.owner,
      ownerName: currentUser?.name || survey.ownerName,
    };
    try {
      await DatabaseService.saveSurvey(duplicated);
      setSurveys((prev) => [duplicated, ...prev]);
      await logActivityAndRefresh({
        user: currentUser?.name || "Admin",
        pos: currentUser?.pos || "Admin",
        action: "Survey Duplicated",
        details: `Cloned survey "${survey.title}" into draft instrument`,
      });
      showToast("Survey duplicated as draft!", "success");
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
    { id: "surveys", label: "Dashboard", icon: ClipboardList },
    ...(currentUser
      ? [
          {
            id: "my-surveys",
            label: isSuperadmin ? "Survey Management" : "My Surveys",
            icon: isSuperadmin ? SlidersHorizontal : UserCheck,
          },
        ]
      : []),
    { id: "analytics", label: "Macro Analytics", icon: BarChart3 },
    ...(isSuperadmin ? [{ id: "tagalog-ml", label: "ML Models", icon: BrainCircuit }] : []),
    { id: "news", label: "News Feed", icon: Newspaper },
    ...(canCreateSurvey
      ? [
          {
            id: "create",
            label: isSuperadmin ? "New Instrument" : "Create Survey",
            icon: PlusCircle,
          },
        ]
      : []),
    ...(isSuperadmin ? [{ id: "admin", label: "Admin Oversight", icon: ShieldAlert, badge: flaggedCount }] : []),
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
            onClick={() => handleNavigate("surveys")}
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

        {/* ML Processing Status card */}
        <div className="p-4 bg-slate-50 m-4 rounded-xl border border-slate-200">
          <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">ML Processing</div>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
            <span className="text-xs font-semibold text-slate-800">Tagalog Processor Active</span>
          </div>
          <div className="text-[10px] text-slate-500 leading-relaxed">
            Sentiment analysis for local responses enabled (94.2% accuracy)
          </div>
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
          unreadNewsCount={newsList.length}
          flaggedSurveysCount={flaggedCount}
          onMarkAllNotificationsRead={handleMarkAllNotificationsRead}
          onMarkNotificationRead={handleMarkNotificationRead}
          onClearAllNotifications={handleClearAllNotifications}
        />

        {/* View Router */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          {currentView === "surveys" && (
            <ThemedSurveySections
              surveys={surveys}
              currentUser={currentUser}
              userResponses={responses}
              newsList={newsList}
              searchQuery={searchQuery}
              selectedCategory={selectedCategory}
              onTakeSurvey={(survey) => {
                if (!currentUser) {
                  setAuthModalMode("login");
                  setShowAuthModal(true);
                  showToast("Please sign in or register to take this survey.", "info");
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
              onTakeSurvey={(survey) => setActiveSurveyForTaking(survey)}
              onFlagSurvey={handleFlagSurvey}
              onClearFlag={handleClearFlag}
              onUpdateSurveyStatus={handleUpdateSurveyStatus}
              onDuplicateSurvey={handleDuplicateSurvey}
            />
          )}

          {currentView === "analytics" && (
            <HistoricalAnalyticsView
              surveys={surveys}
              responses={responses}
              initialSurveyId={analyticsTargetSurveyId}
              mlDataset={mlDataset}
              onAddMlSample={handleAddMlSample}
              onNavigateToMLStudio={isSuperadmin ? () => setCurrentView("tagalog-ml") : undefined}
              isAdmin={isSuperadmin}
              currentUser={currentUser}
              onCreateSurvey={canCreateSurvey ? () => { setEditingSurvey(null); setCurrentView("create"); } : undefined}
            />
          )}

          {currentView === "tagalog-ml" && (
            isSuperadmin ? (
              <TagalogMLTrainingStudio
                dataset={mlDataset}
                surveys={surveys}
                responses={responses}
                onAddSample={handleAddMlSample}
                onDeleteSample={handleDeleteMlSample}
              />
            ) : (
              <div className="bg-white rounded-3xl p-10 text-center border border-slate-200 shadow-xs max-w-lg mx-auto mt-12 space-y-4">
                <div className="w-14 h-14 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto">
                  <BrainCircuit className="w-7 h-7" />
                </div>
                <h3 className="font-serif text-lg font-bold text-slate-900">Administrator Access Required</h3>
                <p className="text-xs text-slate-500 leading-relaxed">
                  The Tagalog & Bilingual NLP Machine Learning Studio is restricted to System Administrators for model calibration and institutional dataset supervision.
                </p>
                <button
                  onClick={() => setCurrentView("surveys")}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer"
                >
                  Return to Surveys Dashboard
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
            />
          )}

          {currentView === "create" && (
            canCreateSurvey ? (
              <SurveyBuilder
                currentUser={currentUser}
                categories={DEFAULT_SURVEY_CATEGORIES}
                onSaveSurvey={handleSaveSurvey}
                initialSurvey={editingSurvey || undefined}
                onCancel={() => {
                  setEditingSurvey(null);
                  setCurrentView("surveys");
                }}
              />
            ) : (
              <div className="bg-white rounded-3xl p-10 text-center border border-slate-200 shadow-xs max-w-lg mx-auto mt-12 space-y-4">
                <div className="w-14 h-14 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto">
                  <ClipboardList className="w-7 h-7" />
                </div>
                <h3 className="font-serif text-lg font-bold text-slate-900">Administrator Role Notice</h3>
                <p className="text-xs text-slate-500 leading-relaxed">
                  As System Administrator, your primary responsibilities are system configuration, content moderation, ML model supervision, and macro institutional analytics. Survey authoring is delegated to university community members (Students, Student Officers, and Faculty).
                </p>
                <div className="flex items-center justify-center gap-3 pt-2">
                  <button
                    onClick={() => setCurrentView("admin")}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer"
                  >
                    Go to Admin Moderation
                  </button>
                  <button
                    onClick={() => setCurrentView("analytics")}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all cursor-pointer"
                  >
                    View Macro Analytics
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
              currentUser={currentUser}
              onClearFlag={handleClearFlag}
              onFlagSurvey={handleFlagSurvey}
              onDeleteSurvey={handleDeleteSurvey}
              onToggleUserStatus={handleToggleUserStatus}
              onPromoteUser={handlePromoteUser}
              onAddUser={handleAddUser}
              onUpdateUser={handleUpdateUser}
              onDeleteUser={handleDeleteUser}
              onRestoreBackup={handleRestoreBackup}
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
          existingAnswers={responses.find((r) => String(r.surveyId) === String(activeSurveyForTaking.id) && r.userEmail === currentUser?.email)?.answers}
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

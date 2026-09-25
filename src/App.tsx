import React, { useState, useEffect } from "react";
import { Survey, SurveyResponse, UserProfile, TagalogMLSample, NewsAnnouncement, ActivityLog } from "./types";
import { LocalStorageManager } from "./lib/storage";
import { DatabaseService, USE_FIREBASE } from "./lib/databaseService";
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

  // Initialize Storage Data & Cloud Readiness on Mount
  useEffect(() => {
    LocalStorageManager.init();
    setSurveys(LocalStorageManager.getSurveys());
    setResponses(LocalStorageManager.getResponses());
    setMlDataset(LocalStorageManager.getMlDataset());
    setNewsList(LocalStorageManager.getNews());
    setLogs(LocalStorageManager.getLogs());
    setUsers(LocalStorageManager.getUsers());
    setCurrentUser(LocalStorageManager.getCurrentUser());

    // If Firebase is configured with active keys, sync cloud data
    async function syncCloudIfConfigured() {
      if (USE_FIREBASE) {
        try {
          const [cloudSurveys, cloudResponses, cloudUsers, cloudNews, cloudMl, cloudLogs] = await Promise.all([
            DatabaseService.getSurveys(),
            DatabaseService.getResponses(),
            DatabaseService.getUsers(),
            DatabaseService.getNews(),
            DatabaseService.getMLDataset(),
            DatabaseService.getLogs(),
          ]);
          if (cloudSurveys.length > 0) setSurveys(cloudSurveys);
          if (cloudResponses.length > 0) setResponses(cloudResponses);
          if (cloudUsers.length > 0) setUsers(cloudUsers);
          if (cloudNews.length > 0) setNewsList(cloudNews);
          if (cloudMl.length > 0) setMlDataset(cloudMl);
          if (cloudLogs.length > 0) setLogs(cloudLogs);
        } catch (err) {
          console.warn("Cloud synchronization standby:", err);
        }
      }
    }
    syncCloudIfConfigured();
  }, []);

  const handleLogin = (user: UserProfile) => {
    setCurrentUser(user);
    LocalStorageManager.setCurrentUser(user);
    setUsers(LocalStorageManager.getUsers());
    LocalStorageManager.addLog({
      user: user.name,
      pos: user.pos,
      action: "User Authentication",
      details: `User signed in: ${user.name} (${user.email})`,
    });
    setLogs(LocalStorageManager.getLogs());
    showToast(`Welcome back, ${user.name}!`, "success");
  };

  const handleSignOut = async () => {
    if (currentUser) {
      LocalStorageManager.addLog({
        user: currentUser.name,
        pos: currentUser.pos,
        action: "User Sign Out",
        details: `User signed out: ${currentUser.name}`,
      });
      setLogs(LocalStorageManager.getLogs());
    }
    await DatabaseService.signOut();
    setCurrentUser(null);
    LocalStorageManager.setCurrentUser(null);
    showToast("Signed out successfully.", "info");
  };

  // Submit Survey Response Handler
  const handleSubmitSurveyResponse = async (answers: any[]) => {
    if (!activeSurveyForTaking) return;

    // Detect if any answers have Tagalog / open feedback
    let detectedSentiment: any = { sentiment: "Positive", score: 0.9, aspect: "General" };
    const paragraphAns = answers.find((a) => a.answer && a.answer.length > 10 && !a.ratingValue);

    if (paragraphAns) {
      try {
        const res = await fetch("/api/ml/analyze-tagalog", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: paragraphAns.answer }),
        });
        const data = await res.json();
        if (data.success && data.result) {
          detectedSentiment = {
            sentiment: data.result.sentiment,
            score: data.result.score,
            aspect: data.result.aspects?.[0] || "Pagtuturo",
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
      userEmail: currentUser?.email || "anonymous@school.edu.ph",
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

    // --------------------------------------------------------------------------
    // [ACTIVE: LOCAL STORAGE DEMO MODE]
    // --------------------------------------------------------------------------
    LocalStorageManager.saveResponse(newResponse);

    // --------------------------------------------------------------------------
    // [FIREBASE CLOUD MODE - UNCOMMENT WHEN ACTIVE]: Save directly to Firestore
    // --------------------------------------------------------------------------
    // DatabaseService.saveResponse(newResponse);

    // Update survey responses count
    const updatedSurveys = surveys.map((s) => {
      if (s.id === activeSurveyForTaking.id) {
        return { ...s, responses: (s.responses || 0) + 1 };
      }
      return s;
    });
    LocalStorageManager.saveSurveys(updatedSurveys);

    LocalStorageManager.addLog({
      user: currentUser?.name || "Student",
      pos: currentUser?.pos || "Student",
      action: "Survey Response Submitted",
      details: `Submitted response for survey: "${activeSurveyForTaking.title}"`,
    });

    setSurveys(updatedSurveys);
    setResponses(LocalStorageManager.getResponses());
    setLogs(LocalStorageManager.getLogs());
    setActiveSurveyForTaking(null);
    showToast("Survey response submitted successfully!", "success");
  };

  // Create / Edit Survey Handler
  const handleSaveSurvey = (surveyData: Partial<Survey>, status: "draft" | "published" | "scheduled") => {
    // If editing an existing survey
    if (surveyData.id) {
      const updatedSurveys = surveys.map((s) => {
        if (s.id === surveyData.id) {
          return {
            ...s,
            ...surveyData,
            status: status === "draft" ? "draft" : status === "scheduled" ? "scheduled" : "published",
            openDate: surveyData.openDate,
            closeDate: surveyData.closeDate,
            closes: surveyData.closeDate ? new Date(surveyData.closeDate).toLocaleDateString() : (s.closes || "Open"),
            questions: surveyData.questions || s.questions,
            questionCount: surveyData.questions?.length || s.questionCount,
          } as Survey;
        }
        return s;
      });

      LocalStorageManager.saveSurveys(updatedSurveys);
      setSurveys(updatedSurveys);

      LocalStorageManager.addLog({
        user: currentUser?.name || "Member",
        pos: currentUser?.pos || "Faculty",
        action: "Survey Updated",
        details: `Edited survey "${surveyData.title || surveyData.id}"`,
      });
      setLogs(LocalStorageManager.getLogs());

      setEditingSurvey(null);
      showToast(`Survey "${surveyData.title}" updated successfully!`, "success");
      setCurrentView("surveys");
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

    const updated = [newSurvey, ...surveys];
    // --------------------------------------------------------------------------
    // [ACTIVE: LOCAL STORAGE DEMO MODE]
    // --------------------------------------------------------------------------
    LocalStorageManager.saveSurveys(updated);

    // --------------------------------------------------------------------------
    // [FIREBASE CLOUD MODE - UNCOMMENT WHEN ACTIVE]: Save directly to Firestore
    // --------------------------------------------------------------------------
    // DatabaseService.saveSurvey(newSurvey);

    setSurveys(updated);

    LocalStorageManager.addLog({
      user: currentUser?.name || "Admin",
      pos: currentUser?.pos || "Faculty",
      action: "Survey Created",
      details: `Created new survey "${newSurvey.title}" in section "${newSurvey.themeSection}"`,
    });
    setLogs(LocalStorageManager.getLogs());

    setEditingSurvey(null);
    showToast(`Survey "${newSurvey.title}" saved successfully!`, "success");
    setCurrentView("surveys");
  };

  const handleEditSurvey = (survey: Survey) => {
    setEditingSurvey(survey);
    setCurrentView("create");
  };

  // ML Training Sample Handlers
  const handleAddMlSample = (sample: Omit<TagalogMLSample, "id">) => {
    const newSample: TagalogMLSample = {
      id: `sample_${Date.now()}`,
      ...sample,
    };
    const updated = [newSample, ...mlDataset];
    LocalStorageManager.saveMlDataset(updated);
    setMlDataset(updated);

    LocalStorageManager.addLog({
      user: currentUser?.name || "Admin",
      pos: currentUser?.pos || "Admin",
      action: "ML Dataset Sample Added",
      details: `Added new Tagalog feedback training sample: "${sample.text.slice(0, 30)}..."`,
    });
    setLogs(LocalStorageManager.getLogs());
    showToast("New Tagalog sample added to machine learning corpus!", "success");
  };

  // News Announcements Handlers
  const handleAddNews = (news: Omit<NewsAnnouncement, "id" | "likesCount">) => {
    const newPost: NewsAnnouncement = {
      id: `news_${Date.now()}`,
      likesCount: 0,
      ...news,
    };
    const updated = [newPost, ...newsList];
    LocalStorageManager.saveNews(updated);
    setNewsList(updated);

    LocalStorageManager.addLog({
      user: currentUser?.name || "Admin",
      pos: currentUser?.pos || "Admin",
      action: "Campus News Published",
      details: `Published institutional announcement: "${newPost.title}"`,
    });
    setLogs(LocalStorageManager.getLogs());
    showToast("Campus announcement published!", "success");
  };

  const handleLikeNews = (id: string) => {
    const updated = newsList.map((n) => (n.id === id ? { ...n, likesCount: n.likesCount + 1 } : n));
    LocalStorageManager.saveNews(updated);
    setNewsList(updated);
  };

  // Moderation Handlers
  const handleClearFlag = (surveyId: string | number) => {
    const updated = surveys.map((s) => (s.id === surveyId ? { ...s, flagged: false, flagReason: undefined } : s));
    LocalStorageManager.saveSurveys(updated);
    setSurveys(updated);
    showToast("Survey flag cleared and approved!", "success");
  };

  const handleFlagSurvey = (surveyId: string | number, reason: string) => {
    const updated = surveys.map((s) => (s.id === surveyId ? { ...s, flagged: true, flagReason: reason } : s));
    LocalStorageManager.saveSurveys(updated);
    setSurveys(updated);
    showToast("Survey flagged for administrative review.", "info");
  };

  const handleDeleteSurvey = (surveyId: string | number, surveyTitle?: string) => {
    const updated = surveys.filter((s) => s.id !== surveyId);
    LocalStorageManager.saveSurveys(updated);
    setSurveys(updated);

    LocalStorageManager.addLog({
      user: currentUser?.name || "User",
      pos: currentUser?.pos || "Faculty",
      action: "Survey Deleted",
      details: `Removed survey "${surveyTitle || surveyId}"`,
    });
    setLogs(LocalStorageManager.getLogs());

    showToast("Survey permanently removed.", "info");
  };

  const handleToggleUserStatus = (email: string, newStatus: "active" | "suspended") => {
    const updated = users.map((u) => (u.email === email ? { ...u, status: newStatus } : u));
    LocalStorageManager.saveUsers(updated);
    setUsers(updated);
    showToast(`User status updated to ${newStatus}.`, "info");
  };

  const handlePromoteUser = (email: string, newPos: UserProfile["pos"]) => {
    const updated = users.map((u) => (u.email === email ? { ...u, pos: newPos } : u));
    LocalStorageManager.saveUsers(updated);
    setUsers(updated);
    showToast(`User promoted to ${newPos}.`, "success");
  };

  const handleAddUser = (newUser: UserProfile) => {
    try {
      const updated = LocalStorageManager.addUser(newUser);
      setUsers(updated);
      setLogs(LocalStorageManager.getLogs());
      showToast(`User ${newUser.name} created successfully!`, "success");
    } catch (err: any) {
      showToast(err.message || "Failed to create user.", "info");
    }
  };

  const handleUpdateUser = (email: string, changes: Partial<UserProfile>) => {
    try {
      const updated = LocalStorageManager.updateUser(email, changes);
      setUsers(updated);
      setLogs(LocalStorageManager.getLogs());
      if (currentUser && currentUser.email.toLowerCase() === email.toLowerCase()) {
        setCurrentUser({ ...currentUser, ...changes });
      }
      showToast("User details updated successfully.", "success");
    } catch (err: any) {
      showToast(err.message || "Failed to update user.", "info");
    }
  };

  const handleDeleteUser = (email: string) => {
    try {
      const updated = LocalStorageManager.deleteUser(email);
      setUsers(updated);
      setLogs(LocalStorageManager.getLogs());
      showToast("User account permanently removed.", "info");
    } catch (err: any) {
      showToast(err.message || "Failed to remove user.", "info");
    }
  };

  const handleRestoreBackup = (backupData: any, mode: "overwrite" | "merge") => {
    try {
      const result = LocalStorageManager.importFullDatabase(backupData, mode, currentUser?.email || "admin");
      setSurveys(result.surveys);
      setResponses(result.responses);
      setUsers(result.users);
      setMlDataset(result.mlDataset);
      setLogs(result.logs);
      setNewsList(result.news);
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

  const handleResetDatabase = () => {
    try {
      const resetData = LocalStorageManager.resetToInitialDemoData(currentUser?.email || "admin");
      setSurveys(resetData.surveys);
      setResponses(resetData.responses);
      setUsers(resetData.users);
      setMlDataset(resetData.mlDataset);
      setLogs(resetData.logs);
      setNewsList(resetData.news);
      setCurrentUser(LocalStorageManager.getCurrentUser());
      showToast("System database reset to initial demonstration state.", "info");
    } catch (err: any) {
      showToast(err.message || "Failed to reset database.", "info");
    }
  };

  const handleUpdateProfile = (updated: Partial<UserProfile>) => {
    if (!currentUser) return;
    const modifiedUser = { ...currentUser, ...updated };
    setCurrentUser(modifiedUser);
    LocalStorageManager.setCurrentUser(modifiedUser);
    const updatedUsers = users.map((u) => (u.email === currentUser.email ? modifiedUser : u));
    LocalStorageManager.saveUsers(updatedUsers);
    setUsers(updatedUsers);
    showToast("Profile details updated!", "success");
  };

  const isSuperadmin = currentUser?.role === "superadmin" || currentUser?.pos === "Superadmin";
  // All users except admin can create surveys (Students, Student Officers, Faculty)
  const canCreateSurvey = !isSuperadmin;
  const flaggedCount = surveys.filter((s) => s.flagged).length;

  const handleNavigate = (view: string) => {
    if (view !== "create") {
      setEditingSurvey(null);
    }
    setCurrentView(view);
  };

  const sidebarNavItems = [
    { id: "surveys", label: "Dashboard", icon: ClipboardList },
    ...(currentUser ? [{ id: "my-surveys", label: "My Surveys", icon: UserCheck }] : []),
    { id: "analytics", label: "Macro Analytics", icon: BarChart3 },
    ...(isSuperadmin ? [{ id: "tagalog-ml", label: "ML Models", icon: BrainCircuit }] : []),
    { id: "news", label: "News Feed", icon: Newspaper },
    ...(canCreateSurvey ? [{ id: "create", label: "Create Survey", icon: PlusCircle }] : []),
    ...(isSuperadmin ? [{ id: "admin", label: "Admin Oversight", icon: ShieldAlert, badge: flaggedCount }] : []),
  ];

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
          notifications={LocalStorageManager.getNotifications(currentUser?.email || "")}
          unreadNotifsCount={1}
          unreadNewsCount={newsList.length}
          flaggedSurveysCount={flaggedCount}
        />

        {/* View Router */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          {currentView === "surveys" && (
            <ThemedSurveySections
              surveys={surveys}
              currentUser={currentUser}
              userResponses={responses}
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
                onAddSample={handleAddMlSample}
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
                categories={["Course", "Faculty", "Facilities", "Service", "Student Life", "General"]}
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
              onResetDatabase={handleResetDatabase}
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

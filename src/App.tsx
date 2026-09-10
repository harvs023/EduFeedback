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
import { SuperadminDashboard } from "./components/SuperadminDashboard";
import { TakeSurveyModal } from "./components/TakeSurveyModal";
import { UserProfileModal } from "./components/UserProfileModal";
import { AuthModal } from "./components/AuthModal";
import {
  ClipboardList,
  BarChart3,
  BrainCircuit,
  Newspaper,
  PlusCircle,
  ShieldAlert,
  Sparkles,
} from "lucide-react";

export default function App() {
  // Navigation State
  const [currentView, setCurrentView] = useState<string>("surveys");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [analyticsTargetSurveyId, setAnalyticsTargetSurveyId] = useState<string | number | "all">("all");

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
  const [toastMessage, setToastMessage] = useState<{ text: string; type: "success" | "info" } | null>(null);

  const showToast = (text: string, type: "success" | "info" = "success") => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Initialize Storage Data on Mount
  useEffect(() => {
    /* ========================================================================== */
    /* [MODE A: DEMO DATA (ACTIVE)]                                               */
    /* Reads demo surveys, responses, and users from LocalStorage.               */
    /* KEEP THIS BLOCK ACTIVE WHILE TESTING DEMO DATA.                            */
    /* ========================================================================== */
    LocalStorageManager.init();
    setSurveys(LocalStorageManager.getSurveys());
    setResponses(LocalStorageManager.getResponses());
    setMlDataset(LocalStorageManager.getMlDataset());
    setNewsList(LocalStorageManager.getNews());
    setLogs(LocalStorageManager.getLogs());
    setUsers(LocalStorageManager.getUsers());
    setCurrentUser(LocalStorageManager.getCurrentUser());

    /* ========================================================================== */
    /* [MODE B: FIREBASE CLOUD DATABASE (READY TO UNCOMMENT)]                     */
    /* When you have your Firebase project ready:                                 */
    /* 1. Comment out the MODE A block above.                                     */
    /* 2. Uncomment the loadFromFirebase() function call below.                   */
    /* 3. Set `export const USE_FIREBASE = true;` in src/lib/databaseService.ts.  */
    /* ========================================================================== */
    /*
    async function loadFromFirebase() {
      try {
        const [cloudSurveys, cloudResponses, cloudUsers, cloudNews, cloudMl, cloudLogs] = await Promise.all([
          DatabaseService.getSurveys(),
          DatabaseService.getResponses(),
          DatabaseService.getUsers(),
          DatabaseService.getNews(),
          DatabaseService.getMLDataset(),
          DatabaseService.getLogs(),
        ]);
        setSurveys(cloudSurveys);
        setResponses(cloudResponses);
        setUsers(cloudUsers);
        setNewsList(cloudNews);
        setMlDataset(cloudMl);
        setLogs(cloudLogs);
        if (cloudUsers.length > 0) setCurrentUser(cloudUsers[1] || cloudUsers[0]);
      } catch (err) {
        console.error("Failed loading from Firebase:", err);
      }
    }
    loadFromFirebase();
    */
  }, []);

  const handleSwitchUser = (user: UserProfile) => {
    setCurrentUser(user);
    LocalStorageManager.setCurrentUser(user);
    LocalStorageManager.addLog({
      user: user.name,
      pos: user.pos,
      action: "Session Switch",
      details: `Switched active persona to ${user.name} (${user.pos})`,
    });
    setLogs(LocalStorageManager.getLogs());
    showToast(`Logged in as ${user.name} (${user.pos})`, "info");
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

  // Create Survey Handler
  const handleSaveSurvey = (surveyData: Partial<Survey>, status: "draft" | "published" | "scheduled") => {
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

    showToast(`Survey "${newSurvey.title}" saved successfully!`, "success");
    setCurrentView("surveys");
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

  const handleDeleteSurvey = (surveyId: string | number) => {
    const updated = surveys.filter((s) => s.id !== surveyId);
    LocalStorageManager.saveSurveys(updated);
    setSurveys(updated);
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

  const sidebarNavItems = [
    { id: "surveys", label: "Dashboard", icon: ClipboardList },
    { id: "analytics", label: "Macro Analytics", icon: BarChart3 },
    ...(isSuperadmin ? [{ id: "tagalog-ml", label: "ML Models", icon: BrainCircuit }] : []),
    { id: "news", label: "News Feed", icon: Newspaper },
    ...(canCreateSurvey ? [{ id: "create", label: "Create Survey", icon: PlusCircle }] : []),
    ...(isSuperadmin ? [{ id: "admin", label: "Admin Oversight", icon: ShieldAlert, badge: flaggedCount }] : []),
  ];

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
            onClick={() => setCurrentView("surveys")}
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
                  onClick={() => setCurrentView(item.id)}
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
          onNavigate={setCurrentView}
          currentUser={currentUser}
          onSwitchUser={handleSwitchUser}
          onOpenProfile={() => setShowProfileModal(true)}
          onOpenAuth={() => setShowAuthModal(true)}
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
              onTakeSurvey={(survey) => setActiveSurveyForTaking(survey)}
              onViewAnalytics={(surveyId) => {
                setAnalyticsTargetSurveyId(surveyId);
                setCurrentView("analytics");
              }}
              onCreateSurvey={canCreateSurvey ? () => setCurrentView("create") : undefined}
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
              onCreateSurvey={canCreateSurvey ? () => setCurrentView("create") : undefined}
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
          onClose={() => setShowAuthModal(false)}
          onLogin={handleSwitchUser}
        />
      )}
    </div>
  );
}

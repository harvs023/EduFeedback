import React, { useState } from "react";
import {
  Survey,
  SurveyResponse,
  NewsAnnouncement,
  NotificationItem,
  UserProfile,
} from "../types";
import { NewsAnnouncementsFeed } from "./NewsAnnouncementsFeed";
import { getSurveyAvailability } from "../lib/surveyReview";
import {
  ClipboardList,
  CheckCircle2,
  FolderKanban,
  Bell,
  Layers,
  BarChart3,
  Users,
  AlertTriangle,
  ArrowRight,
  PlusCircle,
  Inbox,
  X,
} from "lucide-react";

interface DashboardProps {
  surveys: Survey[];
  responses: SurveyResponse[];
  newsList: NewsAnnouncement[];
  notifications: NotificationItem[];
  users: UserProfile[];
  currentUser: UserProfile | null;
  answeredSurveyIds?: string[];
  onNavigate: (view: string) => void;
  onLikeNews: (id: string) => void;
  likedNewsIds?: string[];
  onDeleteNews?: (id: string) => Promise<void> | void;
  onAddNews: (news: Omit<NewsAnnouncement, "id" | "likesCount">) => Promise<boolean>;
  onMarkNotificationRead?: (id: string) => void;
  onMarkAllNotificationsRead?: () => void;
}

export const Dashboard: React.FC<DashboardProps> = ({
  surveys,
  responses,
  newsList,
  notifications,
  users,
  currentUser,
  answeredSurveyIds = [],
  onNavigate,
  onLikeNews,
  likedNewsIds = [],
  onDeleteNews,
  onAddNews,
  onMarkNotificationRead,
  onMarkAllNotificationsRead,
}) => {
  const [showNotificationModal, setShowNotificationModal] = useState(false);

  const userEmail = (currentUser?.email || "").trim().toLowerCase();
  const isSuperadmin =
    currentUser?.role === "superadmin" || currentUser?.pos === "Superadmin";

  // Answered survey IDs set
  const answeredSurveyIdSet = new Set([
    ...responses
      .filter((r) => (r.userEmail || "").trim().toLowerCase() === userEmail)
      .map((r) => String(r.surveyId)),
    ...answeredSurveyIds,
  ]);

  // 1. Open surveys for you: availability is "open", not yours, not already answered by you
  const openSurveys = surveys.filter((s) => {
    if (getSurveyAvailability(s) !== "open") return false;
    const ownerEmail = (s.owner || "").trim().toLowerCase();
    if (ownerEmail && userEmail && ownerEmail === userEmail) return false;
    if (answeredSurveyIdSet.has(String(s.id))) return false;
    return true;
  });

  // 2. Answered: unique surveys answered by current user
  const answeredCount = answeredSurveyIdSet.size;

  // 3. My surveys: surveys owned by current user with counts by status
  const mySurveys = surveys.filter(
    (s) => (s.owner || "").trim().toLowerCase() === userEmail
  );
  const myDraftCount = mySurveys.filter((s) => s.status === "draft").length;
  const myPendingCount = mySurveys.filter((s) => s.status === "pending").length;
  const myScheduledCount = mySurveys.filter(
    (s) => s.status === "scheduled"
  ).length;
  const myPublishedCount = mySurveys.filter(
    (s) => s.status === "published"
  ).length;
  const myArchivedCount = mySurveys.filter(
    (s) => s.status === "archived"
  ).length;

  // 4. Unread notifications
  const unreadNotifications = notifications.filter((n) => !n.read);
  const unreadNotifsCount = unreadNotifications.length;

  // Superadmin Metrics
  const totalSurveys = surveys.length;
  const totalResponses = responses.length;
  const totalUsers = users.length;
  const flaggedSurveys = surveys.filter((s) => s.flagged).length;

  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-12">
      {/* 1. Top Section: News Announcements Feed */}
      <section aria-label="Campus News & Announcements">
        <NewsAnnouncementsFeed
          newsList={newsList}
          currentUser={currentUser}
          onAddNews={onAddNews}
          onLikeNews={onLikeNews}
          likedNewsIds={likedNewsIds}
          onDeleteNews={onDeleteNews}
          limit={5}
        />
      </section>

      {/* 2. Overview Cards Section */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-serif text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
              Activity Overview
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 font-medium">
              Real-time summary of your institutional feedback, authored surveys, and updates.
            </p>
          </div>
        </div>

        {/* User Standard Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
          {/* Card 1: Open surveys for you */}
          <div
            onClick={() => onNavigate("take-survey")}
            className="group relative bg-white rounded-3xl p-6 border border-slate-200 shadow-xs hover:shadow-md hover:border-blue-300 transition-all cursor-pointer flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between mb-4">
                <span className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center group-hover:scale-105 transition-transform">
                  <ClipboardList className="w-6 h-6" />
                </span>
                <span
                  className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full ${
                    openSurveys.length > 0
                      ? "bg-blue-100 text-blue-800"
                      : "bg-slate-100 text-slate-600"
                  }`}
                >
                  {openSurveys.length > 0 ? "Action Required" : "Up to date"}
                </span>
              </div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Open Surveys for You
              </p>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="text-3xl font-serif font-extrabold text-slate-900">
                  {openSurveys.length}
                </span>
                <span className="text-xs text-slate-400 font-medium">available now</span>
              </div>
              <p className="text-xs text-slate-500 mt-2 line-clamp-2">
                {openSurveys.length > 0
                  ? "Instruments ready for your input within active dates."
                  : "No open surveys pending your completion."}
              </p>
            </div>
            <div className="pt-4 mt-4 border-t border-slate-100 flex items-center justify-between text-xs font-bold text-blue-600 group-hover:translate-x-0.5 transition-transform">
              <span>Take a Survey</span>
              <ArrowRight className="w-4 h-4" />
            </div>
          </div>

          {/* Card 2: Answered */}
          <div
            onClick={() => onNavigate("take-survey")}
            className="group relative bg-white rounded-3xl p-6 border border-slate-200 shadow-xs hover:shadow-md hover:border-emerald-300 transition-all cursor-pointer flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between mb-4">
                <span className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center group-hover:scale-105 transition-transform">
                  <CheckCircle2 className="w-6 h-6" />
                </span>
                <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                  Completed
                </span>
              </div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Answered
              </p>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="text-3xl font-serif font-extrabold text-slate-900">
                  {answeredCount}
                </span>
                <span className="text-xs text-slate-400 font-medium">
                  {answeredCount === 1 ? "survey" : "surveys"}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-2 line-clamp-2">
                {answeredCount > 0
                  ? "Distinct feedback surveys you have submitted."
                  : "You haven't submitted any survey responses yet."}
              </p>
            </div>
            <div className="pt-4 mt-4 border-t border-slate-100 flex items-center justify-between text-xs font-bold text-emerald-600 group-hover:translate-x-0.5 transition-transform">
              <span>View Available Surveys</span>
              <ArrowRight className="w-4 h-4" />
            </div>
          </div>

          {/* Card 3: My surveys */}
          <div
            onClick={() => onNavigate("my-surveys")}
            className="group relative bg-white rounded-3xl p-6 border border-slate-200 shadow-xs hover:shadow-md hover:border-indigo-300 transition-all cursor-pointer flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between mb-4">
                <span className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center group-hover:scale-105 transition-transform">
                  <FolderKanban className="w-6 h-6" />
                </span>
                <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-indigo-100 text-indigo-800">
                  Authored
                </span>
              </div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                My Surveys
              </p>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="text-3xl font-serif font-extrabold text-slate-900">
                  {mySurveys.length}
                </span>
                <span className="text-xs text-slate-400 font-medium">total owned</span>
              </div>

              {/* Status Breakdown Pills */}
              <div className="mt-3 flex flex-wrap gap-1.5">
                <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md bg-amber-50 text-amber-700 border border-amber-200">
                  Draft: {myDraftCount}
                </span>
                <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md bg-orange-50 text-orange-700 border border-orange-200">
                  Pending: {myPendingCount}
                </span>
                <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 border border-blue-200">
                  Scheduled: {myScheduledCount}
                </span>
                <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200">
                  Published: {myPublishedCount}
                </span>
                <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 border border-slate-200">
                  Archived: {myArchivedCount}
                </span>
              </div>
            </div>
            <div className="pt-4 mt-4 border-t border-slate-100 flex items-center justify-between text-xs font-bold text-indigo-600 group-hover:translate-x-0.5 transition-transform">
              <span>Manage My Surveys</span>
              <ArrowRight className="w-4 h-4" />
            </div>
          </div>

          {/* Card 4: Unread notifications */}
          <div
            onClick={() => setShowNotificationModal(true)}
            className="group relative bg-white rounded-3xl p-6 border border-slate-200 shadow-xs hover:shadow-md hover:border-amber-300 transition-all cursor-pointer flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between mb-4">
                <span className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center group-hover:scale-105 transition-transform">
                  <Bell className="w-6 h-6" />
                </span>
                <span
                  className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full ${
                    unreadNotifsCount > 0
                      ? "bg-rose-100 text-rose-700"
                      : "bg-slate-100 text-slate-600"
                  }`}
                >
                  {unreadNotifsCount > 0 ? `${unreadNotifsCount} New` : "Inbox clear"}
                </span>
              </div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Unread Notifications
              </p>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="text-3xl font-serif font-extrabold text-slate-900">
                  {unreadNotifsCount}
                </span>
                <span className="text-xs text-slate-400 font-medium">unread</span>
              </div>
              <p className="text-xs text-slate-500 mt-2 line-clamp-2">
                {unreadNotifsCount > 0
                  ? "Alerts, approval updates, and institutional memos."
                  : "All caught up! No unread notifications."}
              </p>
            </div>
            <div className="pt-4 mt-4 border-t border-slate-100 flex items-center justify-between text-xs font-bold text-amber-700 group-hover:translate-x-0.5 transition-transform">
              <span>View Notifications</span>
              <ArrowRight className="w-4 h-4" />
            </div>
          </div>
        </div>

        {/* Superadmin Exclusive Cards Grid */}
        {isSuperadmin && (
          <div className="pt-4 space-y-3">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 bg-purple-100 text-purple-800 rounded-md text-[11px] font-extrabold tracking-wide uppercase">
                System Administration
              </span>
              <span className="text-xs text-slate-400 font-medium">
                Campus-wide institutional telemetry
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
              {/* Total Surveys */}
              <div
                onClick={() => onNavigate("my-surveys")}
                className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs hover:shadow-md hover:border-purple-300 transition-all cursor-pointer flex flex-col justify-between group"
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
                      <Layers className="w-5 h-5" />
                    </span>
                    <span className="text-[11px] font-bold text-purple-700 bg-purple-50 px-2 py-0.5 rounded-md">
                      Campus Total
                    </span>
                  </div>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                    Total Surveys
                  </p>
                  <p className="text-2xl sm:text-3xl font-serif font-extrabold text-slate-900 mt-1">
                    {totalSurveys}
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    Instruments across all university departments.
                  </p>
                </div>
                <div className="pt-3 mt-3 border-t border-slate-100 flex items-center justify-between text-xs font-bold text-purple-600 group-hover:translate-x-0.5 transition-transform">
                  <span>Open Survey Management</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </div>
              </div>

              {/* Total Responses */}
              <div
                onClick={() => onNavigate("analytics")}
                className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs hover:shadow-md hover:border-purple-300 transition-all cursor-pointer flex flex-col justify-between group"
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
                      <BarChart3 className="w-5 h-5" />
                    </span>
                    <span className="text-[11px] font-bold text-purple-700 bg-purple-50 px-2 py-0.5 rounded-md">
                      Submissions
                    </span>
                  </div>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                    Total Responses
                  </p>
                  <p className="text-2xl sm:text-3xl font-serif font-extrabold text-slate-900 mt-1">
                    {totalResponses}
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    Verified feedback entries in Firestore.
                  </p>
                </div>
                <div className="pt-3 mt-3 border-t border-slate-100 flex items-center justify-between text-xs font-bold text-purple-600 group-hover:translate-x-0.5 transition-transform">
                  <span>Open Analytics</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </div>
              </div>

              {/* Total Users */}
              <div
                onClick={() => onNavigate("admin")}
                className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs hover:shadow-md hover:border-purple-300 transition-all cursor-pointer flex flex-col justify-between group"
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
                      <Users className="w-5 h-5" />
                    </span>
                    <span className="text-[11px] font-bold text-purple-700 bg-purple-50 px-2 py-0.5 rounded-md">
                      Accounts
                    </span>
                  </div>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                    Total Users
                  </p>
                  <p className="text-2xl sm:text-3xl font-serif font-extrabold text-slate-900 mt-1">
                    {totalUsers}
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    Students, officers, faculty, and admins.
                  </p>
                </div>
                <div className="pt-3 mt-3 border-t border-slate-100 flex items-center justify-between text-xs font-bold text-purple-600 group-hover:translate-x-0.5 transition-transform">
                  <span>User Roster</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </div>
              </div>

              {/* Flagged Surveys */}
              <div
                onClick={() => onNavigate("admin")}
                className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs hover:shadow-md hover:border-rose-300 transition-all cursor-pointer flex flex-col justify-between group"
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span
                      className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                        flaggedSurveys > 0
                          ? "bg-rose-50 text-rose-600"
                          : "bg-slate-50 text-slate-400"
                      }`}
                    >
                      <AlertTriangle className="w-5 h-5" />
                    </span>
                    <span
                      className={`text-[11px] font-bold px-2 py-0.5 rounded-md ${
                        flaggedSurveys > 0
                          ? "bg-rose-100 text-rose-800"
                          : "bg-slate-100 text-slate-600"
                      }`}
                    >
                      {flaggedSurveys > 0 ? "Requires Review" : "Clean"}
                    </span>
                  </div>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                    Flagged Surveys
                  </p>
                  <p
                    className={`text-2xl sm:text-3xl font-serif font-extrabold mt-1 ${
                      flaggedSurveys > 0 ? "text-rose-600" : "text-slate-900"
                    }`}
                  >
                    {flaggedSurveys}
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    {flaggedSurveys > 0
                      ? "Surveys reported for inappropriate content."
                      : "No surveys currently flagged."}
                  </p>
                </div>
                <div className="pt-3 mt-3 border-t border-slate-100 flex items-center justify-between text-xs font-bold text-rose-600 group-hover:translate-x-0.5 transition-transform">
                  <span>Review Center</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </div>
              </div>
            </div>
          </div>
        )}
      </section>

      {/* 3. Quick Actions Section */}
      <section className="space-y-4">
        <div>
          <h2 className="font-serif text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
            Quick Actions
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 font-medium">
            Direct shortcuts to key platform workflows.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
          {/* Quick Action 1: Take a Survey */}
          <div
            onClick={() => onNavigate("take-survey")}
            className="group bg-white rounded-3xl p-6 border border-slate-200 shadow-xs hover:shadow-md hover:border-blue-400 hover:bg-blue-50/20 transition-all cursor-pointer flex flex-col justify-between"
          >
            <div className="space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-blue-500 text-white flex items-center justify-center shadow-md shadow-blue-500/20 group-hover:scale-110 transition-transform">
                <ClipboardList className="w-6 h-6" />
              </div>
              <h3 className="font-serif text-lg font-bold text-slate-900 group-hover:text-blue-700 transition-colors">
                Take a Survey
              </h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                Browse available course, faculty, facility, and governance evaluations to provide constructive campus feedback.
              </p>
            </div>
            <div className="pt-4 mt-4 border-t border-slate-100 flex items-center justify-between text-xs font-bold text-blue-600">
              <span>Start Survey</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </div>
          </div>

          {/* Quick Action 2: Create Survey */}
          <div
            onClick={() => onNavigate("create")}
            className="group bg-white rounded-3xl p-6 border border-slate-200 shadow-xs hover:shadow-md hover:border-emerald-400 hover:bg-emerald-50/20 transition-all cursor-pointer flex flex-col justify-between"
          >
            <div className="space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shadow-md shadow-emerald-500/20 group-hover:scale-110 transition-transform">
                <PlusCircle className="w-6 h-6" />
              </div>
              <h3 className="font-serif text-lg font-bold text-slate-900 group-hover:text-emerald-700 transition-colors">
                Create Survey
              </h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                Build an evaluation instrument with multiple choice, Likert rating scales, comment sentiment analysis, and scheduling.
              </p>
            </div>
            <div className="pt-4 mt-4 border-t border-slate-100 flex items-center justify-between text-xs font-bold text-emerald-600">
              <span>Survey Builder</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </div>
          </div>

          {/* Quick Action 3: My Surveys */}
          <div
            onClick={() => onNavigate("my-surveys")}
            className="group bg-white rounded-3xl p-6 border border-slate-200 shadow-xs hover:shadow-md hover:border-indigo-400 hover:bg-indigo-50/20 transition-all cursor-pointer flex flex-col justify-between"
          >
            <div className="space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-md shadow-indigo-500/20 group-hover:scale-110 transition-transform">
                <FolderKanban className="w-6 h-6" />
              </div>
              <h3 className="font-serif text-lg font-bold text-slate-900 group-hover:text-indigo-700 transition-colors">
                My Surveys
              </h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                Review your authored drafts, track active participation numbers, duplicate instruments, or publish scheduled instruments.
              </p>
            </div>
            <div className="pt-4 mt-4 border-t border-slate-100 flex items-center justify-between text-xs font-bold text-indigo-600">
              <span>View Workspace</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </div>
          </div>

          {/* Quick Action 4: Analytics */}
          <div
            onClick={() => onNavigate("analytics")}
            className="group bg-white rounded-3xl p-6 border border-slate-200 shadow-xs hover:shadow-md hover:border-purple-400 hover:bg-purple-50/20 transition-all cursor-pointer flex flex-col justify-between"
          >
            <div className="space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-purple-600 text-white flex items-center justify-center shadow-md shadow-purple-500/20 group-hover:scale-110 transition-transform">
                <BarChart3 className="w-6 h-6" />
              </div>
              <h3 className="font-serif text-lg font-bold text-slate-900 group-hover:text-purple-700 transition-colors">
                Analytics
              </h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                See average ratings, comment sentiment, per-question results, and recommendations for your surveys.
              </p>
            </div>
            <div className="pt-4 mt-4 border-t border-slate-100 flex items-center justify-between text-xs font-bold text-purple-600">
              <span>Explore Metrics</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </div>
          </div>
        </div>
      </section>

      {/* Notifications Modal */}
      {showNotificationModal && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setShowNotificationModal(false)}
        >
          <div
            className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-8 shadow-2xl border border-slate-200 space-y-4 max-h-[85vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
                  <Bell className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-serif text-lg font-extrabold text-slate-900">
                    Notifications
                  </h3>
                  <p className="text-xs text-slate-400">
                    {unreadNotifsCount} unread of {notifications.length} total
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {unreadNotifsCount > 0 && onMarkAllNotificationsRead && (
                  <button
                    onClick={() => onMarkAllNotificationsRead()}
                    className="px-2.5 py-1 text-[11px] font-bold text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                  >
                    Mark all read
                  </button>
                )}
                <button
                  onClick={() => setShowNotificationModal(false)}
                  className="p-1.5 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Notification List */}
            <div className="flex-1 overflow-y-auto space-y-2.5 pr-1">
              {notifications.length === 0 ? (
                <div className="py-12 text-center">
                  <Inbox className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                  <p className="text-slate-600 font-bold text-sm">No notifications</p>
                  <p className="text-slate-400 text-xs mt-1">
                    When someone reviews or answers your surveys, notices appear here.
                  </p>
                </div>
              ) : (
                notifications.map((notif) => (
                  <div
                    key={notif.id}
                    onClick={() => onMarkNotificationRead?.(notif.id)}
                    className={`p-3.5 rounded-2xl border transition-all cursor-pointer ${
                      notif.read
                        ? "bg-slate-50/60 border-slate-200 text-slate-600"
                        : "bg-blue-50/30 border-blue-200 text-slate-900 font-medium shadow-xs"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <h4 className="text-xs font-bold">{notif.title}</h4>
                      {!notif.read && (
                        <span className="w-2 h-2 rounded-full bg-blue-600 shrink-0 mt-1" />
                      )}
                    </div>
                    <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                      {notif.message}
                    </p>
                    <span className="text-[10px] text-slate-400 mt-2 block">
                      {notif.displayTime || notif.time || "Recently"}
                    </span>
                  </div>
                ))
              )}
            </div>

            <div className="pt-3 border-t border-slate-100 flex justify-end">
              <button
                onClick={() => setShowNotificationModal(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

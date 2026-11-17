import { timeAgo } from "../lib/timeAgo";
import { notificationTarget } from "../lib/notificationTarget";
import React, { useState } from "react";
import {
  Survey,
  SurveyResponse,
  NewsAnnouncement,
  NotificationItem,
  UserProfile,
  AcademicYearTerms,
} from "../types";
import { NewsAnnouncementsFeed } from "./NewsAnnouncementsFeed";
import { DashboardHero } from "./DashboardHero";
import { getSurveyAvailability, isInAudience } from "../lib/surveyReview";
import { trendingSurveys } from "../lib/trending";
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
  Inbox,
  X,
  type LucideIcon,
  LayoutGrid,
  ShieldCheck,
} from "lucide-react";

const TONES = {
  blue: "bg-blue-100 text-blue-700",
  indigo: "bg-indigo-100 text-indigo-700",
  purple: "bg-purple-100 text-purple-700",
  amber: "bg-amber-100 text-amber-700",
} as const;

/** One overview card: icon, label, optional number, one line of detail and an action. */
function OverviewCard({
  icon: Icon,
  tone,
  label,
  value,
  detail,
  action,
  onClick,
}: {
  icon: LucideIcon;
  tone: keyof typeof TONES;
  label: string;
  value?: number;
  detail: string;
  action: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex flex-col justify-between gap-4 p-5 rounded-2xl bg-white border border-slate-200 text-left hover:border-indigo-300 hover:shadow-sm transition-all cursor-pointer"
    >
      <span className="space-y-2">
        <span className="flex items-center gap-3">
          <span className={`p-2.5 rounded-xl ${TONES[tone]}`}>
            <Icon className="w-5 h-5" />
          </span>
          <span className="text-sm font-bold text-slate-700">{label}</span>
        </span>
        {value !== undefined && <span className="block text-3xl font-extrabold text-slate-900">{value}</span>}
        <span className="block text-xs text-slate-500">{detail}</span>
      </span>
      <span className="flex items-center justify-between text-xs font-bold text-indigo-600">
        {action}
        <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
      </span>
    </button>
  );
}

/** A compact admin number that opens its page. */
function AdminStat({
  icon: Icon,
  label,
  value,
  action,
  onClick,
}: {
  icon: LucideIcon;
  label: string;
  value: number;
  action: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex items-center gap-4 p-5 rounded-2xl bg-white border border-slate-200 text-left hover:border-indigo-300 cursor-pointer transition-colors"
    >
      <span className="p-2.5 rounded-xl bg-slate-50 text-slate-500">
        <Icon className="w-5 h-5" />
      </span>
      <span className="flex-1 min-w-0">
        <span className="block text-2xl font-extrabold text-slate-900 leading-none">{value}</span>
        <span className="block text-sm text-slate-600 mt-1">{label}</span>
      </span>
      <span className="text-xs font-bold text-indigo-600 inline-flex items-center gap-1">
        {action} <ArrowRight className="w-3.5 h-3.5" />
      </span>
    </button>
  );
}

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
  /** Admin: everything waiting in the Review Center (surveys, news, reports, flags, profile requests). */
  adminWaitingCount?: number;
  /** Admin: open the Review Center on a given page ("home", "surveys", "users", ...). */
  onOpenReviewCenter?: (tab: string) => void;
  onDeleteNews?: (id: string) => Promise<void> | void;
  onAddNews: (news: Omit<NewsAnnouncement, "id" | "likesCount">) => Promise<boolean>;
  onMarkNotificationRead?: (id: string) => void;
  onMarkAllNotificationsRead?: () => void;
  /** Marks the notification read and opens the page it is about. */
  onOpenNotification?: (n: NotificationItem) => void;
  /** The admin's academic calendar (school year and semester in the welcome banner). */
  academicCalendar?: AcademicYearTerms[];
  /** Opens a survey to answer (from the Trending list). */
  onTakeSurvey?: (survey: Survey) => void;
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
  adminWaitingCount = 0,
  onOpenReviewCenter,
  onDeleteNews,
  onAddNews,
  onMarkNotificationRead,
  onMarkAllNotificationsRead,
  onOpenNotification,
  onTakeSurvey,
  academicCalendar = [],
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

  // Trending among the surveys this person may answer (not their own).
  // The admin sees what is trending across all surveys (information only).
  const trending = trendingSurveys(
    isSuperadmin
      ? surveys
      : surveys.filter(
          (s) => (s.owner || "").trim().toLowerCase() !== userEmail && (!currentUser || isInAudience(s, currentUser))
        )
  );

  const myStatusLine = [
    myPublishedCount + myScheduledCount > 0 ? `${myPublishedCount + myScheduledCount} live` : "",
    myPendingCount > 0 ? `${myPendingCount} pending` : "",
    myDraftCount > 0 ? `${myDraftCount} draft${myDraftCount === 1 ? "" : "s"}` : "",
    myArchivedCount > 0 ? `${myArchivedCount} closed` : "",
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="space-y-8">
      {/* 2. Your overview: one row of cards (the old Quick Actions row repeated these) */}
      <DashboardHero
        name={currentUser?.name}
        openCount={openSurveys.length}
        calendar={academicCalendar}
        onTakeSurvey={() => onNavigate("take-survey")}
        onCreateSurvey={() => onNavigate("create")}
        admin={
          isSuperadmin
            ? { waiting: adminWaitingCount, onOpenReviewCenter: () => onOpenReviewCenter?.("home") }
            : undefined
        }
      />

      <section className="space-y-3" aria-label="Your overview">
        <h2 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-slate-500">
          <LayoutGrid className="w-4 h-4" /> Your overview
        </h2>

        <div className={`grid grid-cols-1 sm:grid-cols-2 gap-4 ${isSuperadmin ? "lg:grid-cols-3" : "lg:grid-cols-4"}`}>
          {!isSuperadmin && (
          <OverviewCard
            icon={ClipboardList}
            tone="blue"
            label="Open surveys for you"
            value={openSurveys.length}
            detail={
              answeredCount > 0
                ? `You have answered ${answeredCount} survey${answeredCount === 1 ? "" : "s"}.`
                : "You have not answered any survey yet."
            }
            action="Take a survey"
            onClick={() => onNavigate("take-survey")}
          />
          )}
          <OverviewCard
            icon={FolderKanban}
            tone="indigo"
            label="My surveys"
            value={mySurveys.length}
            detail={myStatusLine || "You have not created a survey yet."}
            action="Manage my surveys"
            onClick={() => onNavigate("my-surveys")}
          />
          <OverviewCard
            icon={BarChart3}
            tone="purple"
            label="Analytics"
            detail="Ratings, comment sentiment and recommendations for your surveys."
            action="See results"
            onClick={() => onNavigate("analytics")}
          />
          <OverviewCard
            icon={Bell}
            tone="amber"
            label="Unread notifications"
            value={unreadNotifsCount}
            detail={unreadNotifsCount > 0 ? "Approvals, decisions and updates." : "You are all caught up."}
            action="View notifications"
            onClick={() => setShowNotificationModal(true)}
          />
        </div>
      </section>

      {/* 3. Admin strip: each card opens the exact page it names */}
      {isSuperadmin && (
        <section className="space-y-3" aria-label="Administration">
          <h2 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-slate-500">
            <ShieldCheck className="w-4 h-4" /> Administration
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <button
              type="button"
              onClick={() => onOpenReviewCenter?.("home")}
              className={`flex items-center gap-4 p-5 rounded-2xl border text-left cursor-pointer transition-colors ${
                adminWaitingCount > 0
                  ? "bg-rose-50 border-rose-200 hover:border-rose-400"
                  : "bg-emerald-50 border-emerald-200 hover:border-emerald-400"
              }`}
            >
              <span
                className={`p-2.5 rounded-xl ${adminWaitingCount > 0 ? "bg-white text-rose-600" : "bg-white text-emerald-600"}`}
              >
                {adminWaitingCount > 0 ? <AlertTriangle className="w-5 h-5" /> : <CheckCircle2 className="w-5 h-5" />}
              </span>
              <span className="flex-1 min-w-0">
                <span className="block text-2xl font-extrabold text-slate-900 leading-none">{adminWaitingCount}</span>
                <span className="block text-sm text-slate-700 mt-1">
                  {adminWaitingCount === 1 ? "item waiting for review" : "items waiting for review"}
                </span>
              </span>
              <ArrowRight className="w-4 h-4 text-slate-400 shrink-0" />
            </button>
            <AdminStat icon={Layers} label="Surveys" value={surveys.length} action="All surveys" onClick={() => onOpenReviewCenter?.("surveys")} />
            <AdminStat icon={BarChart3} label="Responses" value={responses.length} action="Analytics" onClick={() => onNavigate("analytics")} />
            <AdminStat icon={Users} label="Users" value={users.length} action="Users" onClick={() => onOpenReviewCenter?.("users")} />
          </div>
        </section>
      )}

      {/* 4. News feed with the Trending / Your posts side column */}
      <section aria-label="Campus News & Announcements">
        <NewsAnnouncementsFeed
          newsList={newsList}
          currentUser={currentUser}
          onAddNews={onAddNews}
          onLikeNews={onLikeNews}
          likedNewsIds={likedNewsIds}
          onDeleteNews={onDeleteNews}
          limit={5}
          trending={trending}
          answeredSurveyIds={answeredSurveyIdSet}
          onOpenSurvey={isSuperadmin ? undefined : onTakeSurvey}
        />
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
                notifications.map((notif) => {
                  const target = notificationTarget(notif, isSuperadmin);
                  return (
                  <div
                    key={notif.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => {
                      if (onOpenNotification) onOpenNotification(notif);
                      else onMarkNotificationRead?.(notif.id);
                      if (target) setShowNotificationModal(false);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") (e.currentTarget as HTMLDivElement).click();
                    }}
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
                    <span className="text-[10px] text-slate-400 mt-2 flex items-center justify-between gap-2">
                      <span>{timeAgo(notif.timestamp)}</span>
                      {target && <span className="font-semibold text-indigo-600">{target.label} →</span>}
                    </span>
                  </div>
                  );
                })
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

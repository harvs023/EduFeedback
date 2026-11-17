import { formatDateTime } from "../lib/timeAgo";
import React, { useState, useMemo } from "react";
import { useConfirm } from "./ConfirmDialog";
import SetupChecklist from "./SetupChecklist";
import { AllSurveysPanel } from "./reviewCenter/AllSurveysPanel";
import { ReviewCenterLayout, type ReviewCenterGroup } from "./ReviewCenterLayout";
import { ReviewCenterHome, type WaitingTile } from "./ReviewCenterHome";
import {
  Survey,
  SurveyResponse,
  UserProfile,
  ActivityLog,
  NewsAnnouncement,
  Topic,
  AcademicYearTerms,
  SchoolLists,
  SurveyReport,
  TopicBlockMove,
  TopicMoveRecord,
  ProfileChangeRequest,
} from "../types";
import type { TopicDecision } from "./TopicRequestsPanel";
import { UserManagementView } from "./UserManagementView";
import { DatabaseBackupView } from "./DatabaseBackupView";
import { TopicsManager } from "./TopicsManager";
import { AcademicCalendarManager } from "./AcademicCalendarManager";
import { SchoolSetupManager } from "./SchoolSetupManager";
import { ReportedSurveysPanel } from "./ReportedSurveysPanel";
import { ProfileRequestsPanel } from "./ProfileRequestsPanel";
import { SurveyApprovalsPanel } from "./SurveyApprovalsPanel";
import { NewsApprovalsPanel } from "./NewsApprovalsPanel";
import { FlaggedResponsesPanel, FlagDecision } from "./FlaggedResponsesPanel";
import { ActiveUsersCard } from "./ActiveUsersCard";
import { SurveyCreationSwitch } from "./SurveyCreationSwitch";
import {
  Users,
  Activity,
  Database,
  CheckCircle2,
  Download,
  Flag,
  CalendarDays,
  Tag,
  CalendarRange,
  Newspaper,
  School,
  UserCog,
  Home,
  MessageSquareWarning,
} from "lucide-react";

interface SuperadminDashboardProps {
  surveys: Survey[];
  users: UserProfile[];
  logs: ActivityLog[];
  responses?: SurveyResponse[];
  newsList?: NewsAnnouncement[];
  topics?: Topic[];
  currentUser?: UserProfile | null;
  surveyReports?: SurveyReport[];
  /** Requests to change locked school details (department, program, year, section, student ID). */
  profileRequests?: ProfileChangeRequest[];
  onDecideProfileRequest?: (request: ProfileChangeRequest, approve: boolean, note: string) => Promise<void>;
  onMoveTopicBlocks?: (moves: TopicBlockMove[], kind: "move" | "merge", retireTopicId?: string) => Promise<void>;
  onUndoTopicMove?: (logId: string, record: TopicMoveRecord) => Promise<void>;
  onDecideTopicRequest?: (surveyId: string, blockId: string, decision: TopicDecision, note: string) => Promise<void>;
  onDismissReports?: (surveyId: string, note: string) => Promise<void>;
  onTakedownReported?: (surveyId: string, reason: string) => Promise<void>;
  onDeleteSurvey: (surveyId: string | number) => void;
  /** Take a live survey down (archive with a reason; answers are kept). */
  onTakedownSurvey?: (surveyId: string | number, reason: string) => Promise<boolean> | void;
  onToggleUserStatus: (email: string, newStatus: "active" | "suspended" | "pending_approval") => void;
  onPromoteUser: (email: string, newPos: UserProfile["pos"]) => void;
  onSendPasswordReset?: (email: string) => Promise<void>;
  onAddUser?: (user: UserProfile) => void;
  onUpdateUser?: (email: string, changes: Partial<UserProfile>) => void;
  onDeleteUser?: (email: string) => void;
  onNavigateToAnalytics?: (surveyId?: string | number | "all") => void;
  onNavigateToML?: () => void;
  onSaveTopic?: (topic: Topic) => Promise<void> | void;
  onDeleteTopic?: (topicId: string) => Promise<void> | void;
  academicCalendar?: AcademicYearTerms[];
  schoolLists?: SchoolLists | null;
  onSaveSchoolLists?: (lists: SchoolLists) => Promise<void>;
  onSaveAcademicYear?: (terms: AcademicYearTerms) => Promise<void>;
  onDeleteAcademicYear?: (schoolYear: string) => Promise<void>;
  onApproveSurvey?: (surveyId: string | number) => void;
  onRejectSurvey?: (surveyId: string | number, reason: string) => void;
  onReviewNews?: (id: string, decision: "approve" | "reject", reason?: string) => Promise<void> | void;
  onDecideFlag?: (responseId: string, decision: FlagDecision, note: string) => Promise<void>;
  /** Reload the user list (for the Active users counter). */
  onRefreshUsers?: () => Promise<void>;
  /** Admin switch: survey creation open for everyone (the admin can always create). */
  surveyCreationOpen?: boolean;
  onSetSurveyCreation?: (open: boolean) => Promise<void>;
  /** "New school year: move students up one year" (Users page). */
  lastYearMoveAt?: number;
  onNewSchoolYear?: () => Promise<void>;
  initialTab?: ReviewTab;
  showToast?: (text: string, type?: "success" | "info") => void;
}

export type ReviewTab = "approvals" | "surveys" | "reports" | "users" | "logs" | "backup" | "topics" | "news" | "calendar" | "flagged-responses" | "school" | "profile-requests" | "home";

export const SuperadminDashboard: React.FC<SuperadminDashboardProps> = ({
  surveys,
  users,
  logs,
  responses = [],
  newsList = [],
  topics = [],
  currentUser = null,
  surveyReports = [],
  profileRequests = [],
  onDecideProfileRequest,
  onMoveTopicBlocks,
  onUndoTopicMove,
  onDecideTopicRequest,
  onDismissReports,
  onTakedownReported,
  onDeleteSurvey,
  onTakedownSurvey,
  onToggleUserStatus,
  onPromoteUser,
  onSendPasswordReset,
  onAddUser,
  onUpdateUser,
  onDeleteUser,
  onNavigateToAnalytics,
  onNavigateToML,
  onSaveTopic,
  onDeleteTopic,
  academicCalendar = [],
  onSaveAcademicYear,
  schoolLists = null,
  onSaveSchoolLists,
  onDeleteAcademicYear,
  onApproveSurvey,
  onRejectSurvey,
  onReviewNews,
  onDecideFlag,
  onRefreshUsers,
  surveyCreationOpen = true,
  onSetSurveyCreation,
  lastYearMoveAt,
  onNewSchoolYear,
  initialTab = "home",
  showToast,
}) => {
  const { confirm, confirmDialog } = useConfirm();
  const [activeTab, setActiveTab] = useState<ReviewTab>(initialTab || "home");
  const openTab = (tab: ReviewTab) => {
    setActiveTab(tab);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const pendingSurveys = useMemo(() => surveys.filter((s) => s.status === "pending"), [surveys]);
  const pendingNewsCount = (newsList || []).filter((n) => n.status === "pending").length;
  // Surveys with at least one report waiting for a decision.
  const reportedSurveyCount = useMemo(
    () => new Set(surveyReports.filter((r) => r.status === "open").map((r) => String(r.surveyId))).size,
    [surveyReports]
  );

  const flaggedCount = responses.filter((r) => r.review?.status === "flagged").length;
  const profileRequestCount = profileRequests.filter((r) => r.status === "pending").length;

  const menuGroups: ReviewCenterGroup<ReviewTab>[] = [
    { title: "", items: [{ id: "home", label: "Home", icon: Home }] },
    {
      title: "To review",
      items: [
        { id: "approvals", label: "Survey approvals", icon: CheckCircle2, waiting: pendingSurveys.length },
        { id: "news", label: "News posts", icon: Newspaper, waiting: pendingNewsCount },
        { id: "reports", label: "Reported surveys", icon: Flag, waiting: reportedSurveyCount },
        { id: "flagged-responses", label: "Flagged responses", icon: MessageSquareWarning, waiting: flaggedCount },
        { id: "profile-requests", label: "Profile requests", icon: UserCog, waiting: profileRequestCount },
      ],
    },
    {
      title: "People",
      items: [
        { id: "users", label: "Users", icon: Users },
        { id: "logs", label: "Activity log", icon: Activity },
      ],
    },
    { title: "Surveys", items: [{ id: "surveys", label: "All surveys", icon: CalendarDays }] },
    {
      title: "School setup",
      items: [
        { id: "school", label: "School lists & categories", icon: School },
        { id: "topics", label: "Topics", icon: Tag },
        { id: "calendar", label: "Academic calendar", icon: CalendarRange },
      ],
    },
    { title: "System", items: [{ id: "backup", label: "Backup & restore", icon: Database }] },
  ];

  const waitingTiles: WaitingTile<ReviewTab>[] = [
    { id: "approvals", label: "Survey approvals", noun: "surveys to approve", count: pendingSurveys.length, icon: CheckCircle2 },
    { id: "news", label: "News posts", noun: "news posts to approve", count: pendingNewsCount, icon: Newspaper },
    { id: "reports", label: "Reported surveys", noun: "reported surveys", count: reportedSurveyCount, icon: Flag },
    { id: "flagged-responses", label: "Flagged responses", noun: "flagged responses", count: flaggedCount, icon: MessageSquareWarning },
    { id: "profile-requests", label: "Profile requests", noun: "profile change requests", count: profileRequestCount, icon: UserCog },
  ];

  const handleExportLogs = () => {
    const headers = ["Timestamp", "User", "Position", "Action", "Details", "IP_Address"];
    const rows = logs.map((l) => [
      `"${l.timestamp ? formatDateTime(l.timestamp) : l.time}"`,
      `"${l.user}"`,
      `"${l.pos}"`,
      `"${l.action}"`,
      `"${l.details.replace(/"/g, '""')}"`,
      `"${l.ip || "10.0.1.1"}"`,
    ]);
    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `EduFeedback_Audit_Logs_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {confirmDialog}
      <ReviewCenterLayout<ReviewTab> groups={menuGroups} active={activeTab} onSelect={openTab}>
      {activeTab === "home" && (
        <ReviewCenterHome<ReviewTab>
          waiting={waitingTiles}
          onOpen={openTab}
          status={
            <>
              <ActiveUsersCard users={users} onRefresh={onRefreshUsers} />
              {onSetSurveyCreation && (
                <SurveyCreationSwitch
                  open={surveyCreationOpen}
                  onChange={async (open) => {
                    if (!open) {
                      const ok = await confirm({
                        title: "Turn survey creation off?",
                        message:
                          "Students, student officers and faculty will not be able to create new surveys or send drafts for review until you turn it back on. Their drafts stay safe and live surveys keep running. You can still create surveys.",
                        confirmLabel: "Turn off",
                      });
                      if (!ok) return;
                    }
                    await onSetSurveyCreation(open);
                  }}
                />
              )}
            </>
          }
          numbers={[
            { label: "Live surveys", value: surveys.filter((x) => x.status === "published" || x.status === "scheduled").length, id: "surveys" },
            { label: "Active accounts", value: users.filter((u) => u.status === "active").length, id: "users" },
          ]}
          setup={
            <SetupChecklist schoolLists={schoolLists} topics={topics} academicCalendar={academicCalendar} onOpen={openTab} />
          }
          onNavigateToAnalytics={onNavigateToAnalytics ? () => onNavigateToAnalytics("all") : undefined}
          onNavigateToSentiment={onNavigateToML}
        />
      )}

      {/* TAB 0: SURVEY APPROVALS */}
      {activeTab === "approvals" && (
        <SurveyApprovalsPanel
          surveys={surveys}
          users={users}
          topics={topics}
          onApproveSurvey={onApproveSurvey}
          onRejectSurvey={onRejectSurvey}
          onUpdateUser={onUpdateUser}
          showToast={showToast}
        />
      )}

      {/* TAB 1: CREATION TIMEFRAME DIRECTORY (YEAR, MONTH, DATE) */}
      {activeTab === "surveys" && (
        <AllSurveysPanel
          surveys={surveys}
          calendar={academicCalendar}
          schoolLists={schoolLists}
          onOpenAnalytics={onNavigateToAnalytics}
          onTakedown={onTakedownSurvey}
          onDelete={onDeleteSurvey}
        />
      )}

      {activeTab === "reports" && onDismissReports && onTakedownReported && (
        <ReportedSurveysPanel
          reports={surveyReports}
          surveys={surveys}
          onDismiss={onDismissReports}
          onTakedown={onTakedownReported}
        />
      )}

      {/* TAB 3: USER & ROLE DIRECTORY */}
      {activeTab === "users" && (
        <UserManagementView
          users={users}
          surveys={surveys}
          currentUser={currentUser}
          onAddUser={onAddUser || (() => {})}
          onUpdateUser={onUpdateUser || (() => {})}
          onDeleteUser={onDeleteUser || (() => {})}
          onToggleUserStatus={onToggleUserStatus}
          onApproveUser={(email) => onToggleUserStatus(email, "active")}
          onPromoteUser={onPromoteUser}
          onSendPasswordReset={onSendPasswordReset}
          schoolLists={schoolLists}
          lastYearMoveAt={lastYearMoveAt}
          onNewSchoolYear={onNewSchoolYear}
        />
      )}

      {/* TAB 4: ACTIVITY AUDIT TRAIL */}
      {activeTab === "profile-requests" && onDecideProfileRequest && (
        <ProfileRequestsPanel requests={profileRequests} users={users} onDecide={onDecideProfileRequest} />
      )}

      {activeTab === "logs" && (
        <div className="bg-white p-6 sm:p-8 rounded-3xl border border-slate-200 shadow-xs space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
            <div>
              <h2 className="font-serif text-xl font-bold text-slate-900">
                Activity log
              </h2>
              <p className="text-xs text-slate-500">
                Real-time chronological log of administrative operations, survey creation events, and policy audits.
              </p>
            </div>

            <button
              onClick={handleExportLogs}
              className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl flex items-center gap-2 cursor-pointer transition-all"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export CSV Logs</span>
            </button>
          </div>

          <div className="border border-slate-200 rounded-2xl overflow-hidden max-h-96 overflow-y-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-100 text-slate-700 font-bold uppercase text-[10px] tracking-wider sticky top-0">
                <tr>
                  <th className="p-3.5">Timestamp</th>
                  <th className="p-3.5">User & Position</th>
                  <th className="p-3.5">Action Event</th>
                  <th className="p-3.5">Activity Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700 font-mono text-[11px]">
                {logs.map((log, idx) => (
                  <tr key={log.id || idx} className="hover:bg-slate-50 transition-colors">
                    <td className="p-3.5 text-slate-500 whitespace-nowrap">
                      {log.timestamp ? formatDateTime(log.timestamp) : log.time}
                    </td>
                    <td className="p-3.5">
                      <span className="font-bold text-slate-900 font-sans">{log.user}</span>
                      <span className="text-[10px] text-slate-500 block">({log.pos})</span>
                    </td>
                    <td className="p-3.5 font-bold text-indigo-700">{log.action}</td>
                    <td className="p-3.5 text-slate-700 font-sans">{log.details}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 6: SURVEY TOPICS */}
      {activeTab === "flagged-responses" && onDecideFlag && (
        <FlaggedResponsesPanel responses={responses} surveys={surveys} onDecide={onDecideFlag} />
      )}

      {activeTab === "news" && (
        <NewsApprovalsPanel newsList={newsList || []} onReview={onReviewNews || (() => {})} />
      )}

      {activeTab === "topics" && (
        <TopicsManager
          topics={topics}
          surveys={surveys}
          onSaveTopic={onSaveTopic}
          onDeleteTopic={onDeleteTopic}
          logs={logs}
          onMoveBlocks={onMoveTopicBlocks}
          onUndoMove={onUndoTopicMove}
          onDecideRequest={onDecideTopicRequest}
        />
      )}

      {activeTab === "calendar" && onSaveAcademicYear && onDeleteAcademicYear && (
        <AcademicCalendarManager
          calendar={academicCalendar}
          adminEmail={currentUser?.email || ""}
          onSave={onSaveAcademicYear}
          onDelete={onDeleteAcademicYear}
        />
      )}

      {activeTab === "school" && onSaveSchoolLists && (
        <SchoolSetupManager lists={schoolLists} users={users} surveys={surveys} onSave={onSaveSchoolLists} />
      )}

      {/* TAB 5: BACKUP & DATA SNAPSHOTS */}
      {activeTab === "backup" && (
        <DatabaseBackupView showToast={showToast || (() => {})} />
      )}

      </ReviewCenterLayout>

    </div>
  );
};
import React, { useState, useMemo } from "react";
import { Survey, UserProfile, Topic } from "../types";
import {
  runPreChecks,
  countEligibleUsers,
  getCreatorStats,
  PreCheckResult,
} from "../lib/surveyReview";
import {
  CheckCircle,
  XCircle,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Clock,
  Calendar,
  Users,
  ShieldCheck,
  FileText,
  Tag,
  AlertCircle,
  Check,
  Ban,
  Unlock,
} from "lucide-react";

interface SurveyApprovalsPanelProps {
  surveys: Survey[];
  users: UserProfile[];
  topics?: Topic[];
  onApproveSurvey?: (surveyId: string | number) => Promise<void> | void;
  onRejectSurvey?: (surveyId: string | number, reason: string) => Promise<void> | void;
  onUpdateUser?: (email: string, changes: Partial<UserProfile>) => Promise<void> | void;
  showToast?: (text: string, type?: "success" | "info") => void;
}

function formatReadableAudience(survey: Survey): string {
  const target = survey.targetAudience;
  if (!target || target.type === "all") {
    return "All Campus (Students, Officers, Faculty)";
  }
  if (target.type === "students") {
    return "Students & Student Officers";
  }
  if (target.type === "faculty") {
    return "Faculty Members";
  }
  if (target.type === "officers") {
    return "Student Officers Only";
  }
  if (target.type === "custom") {
    const roles = target.filters?.roles || [];
    if (roles.length === 0) return "Custom (No roles selected)";
    const labels = roles.map((r) => {
      if (r === "students") return "Students";
      if (r === "faculty") return "Faculty";
      if (r === "officers") return "Officers";
      return r;
    });
    return `Custom (${labels.join(", ")})`;
  }
  return "Campus Community";
}

function formatQuestionType(type: string): string {
  switch (type) {
    case "rating":
      return "Rating Scale";
    case "multiple":
      return "Multiple Choice";
    case "checkbox":
      return "Checkbox";
    case "paragraph":
      return "Paragraph";
    default:
      return type;
  }
}

export const SurveyApprovalsPanel: React.FC<SurveyApprovalsPanelProps> = ({
  surveys,
  users,
  topics = [],
  onApproveSurvey,
  onRejectSurvey,
  onUpdateUser,
  showToast,
}) => {
  // Expanded questions state per survey
  const [expandedQuestions, setExpandedQuestions] = useState<Record<string, boolean>>({});

  // Active action modal/inline forms: "approve" | "reject" | "restrict" | "allow"
  const [activeActionSurveyId, setActiveActionSurveyId] = useState<string | number | null>(null);
  const [activeActionType, setActiveActionType] = useState<"approve" | "reject" | "restrict" | "allow" | null>(null);

  // Form input states
  const [rejectReason, setRejectReason] = useState<string>("");
  const [restrictReason, setRestrictReason] = useState<string>("");

  // Loading/busy state
  const [isProcessing, setIsProcessing] = useState<boolean>(false);

  // Filter only pending surveys, sorted oldest first
  const pendingSurveys = useMemo(() => {
    return surveys
      .filter((s) => s.status === "pending")
      .sort((a, b) => {
        const timeA = a.submittedAt || a.createdAtTimestamp || 0;
        const timeB = b.submittedAt || b.createdAtTimestamp || 0;
        return timeA - timeB;
      });
  }, [surveys]);

  // Compute pre-checks for all pending surveys
  const preChecksMap = useMemo(() => {
    const map = new Map<string | number, PreCheckResult>();
    pendingSurveys.forEach((s) => {
      map.set(s.id, runPreChecks(s, surveys));
    });
    return map;
  }, [pendingSurveys, surveys]);

  // Group into "Needs Attention" and "Looks OK"
  const { attentionSurveys, looksOkSurveys } = useMemo(() => {
    const attention: Survey[] = [];
    const looksOk: Survey[] = [];
    pendingSurveys.forEach((s) => {
      const check = preChecksMap.get(s.id);
      if (check && check.level === "attention") {
        attention.push(s);
      } else {
        looksOk.push(s);
      }
    });
    return { attentionSurveys: attention, looksOkSurveys: looksOk };
  }, [pendingSurveys, preChecksMap]);

  const toggleExpand = (surveyId: string | number) => {
    setExpandedQuestions((prev) => ({
      ...prev,
      [surveyId]: !prev[surveyId],
    }));
  };

  const openAction = (
    surveyId: string | number,
    action: "approve" | "reject" | "restrict" | "allow"
  ) => {
    setActiveActionSurveyId(surveyId);
    setActiveActionType(action);
    setRejectReason("");
    setRestrictReason("");
  };

  const closeAction = () => {
    setActiveActionSurveyId(null);
    setActiveActionType(null);
    setRejectReason("");
    setRestrictReason("");
  };

  // Execution Handlers
  const handleConfirmApprove = async (survey: Survey) => {
    if (!onApproveSurvey) return;
    setIsProcessing(true);
    try {
      await onApproveSurvey(survey.id);
      closeAction();
    } catch (err: any) {
      if (showToast) showToast(err.message || "Approval failed.", "info");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleConfirmReject = async (survey: Survey) => {
    if (!onRejectSurvey) return;
    if (rejectReason.trim().length < 10) {
      if (showToast) showToast("Rejection reason must be at least 10 characters.", "info");
      return;
    }
    setIsProcessing(true);
    try {
      await onRejectSurvey(survey.id, rejectReason.trim());
      closeAction();
    } catch (err: any) {
      if (showToast) showToast(err.message || "Rejection failed.", "info");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleConfirmRestrictCreator = async (ownerEmail: string) => {
    if (!onUpdateUser) return;
    if (restrictReason.trim().length < 10) {
      if (showToast) showToast("Restriction reason must be at least 10 characters.", "info");
      return;
    }
    setIsProcessing(true);
    try {
      await onUpdateUser(ownerEmail, {
        canCreateSurveys: false,
        restrictionReason: restrictReason.trim(),
      });
      if (showToast) showToast(`Survey authoring disabled for ${ownerEmail}.`, "success");
      closeAction();
    } catch (err: any) {
      if (showToast) showToast(err.message || "Failed to update author permissions.", "info");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleConfirmAllowCreator = async (ownerEmail: string) => {
    if (!onUpdateUser) return;
    setIsProcessing(true);
    try {
      await onUpdateUser(ownerEmail, {
        canCreateSurveys: true,
        restrictionReason: "",
      });
      if (showToast) showToast(`Survey authoring re-enabled for ${ownerEmail}.`, "success");
      closeAction();
    } catch (err: any) {
      if (showToast) showToast(err.message || "Failed to update author permissions.", "info");
    } finally {
      setIsProcessing(false);
    }
  };

  // Render Card
  const renderSurveyCard = (survey: Survey) => {
    const preCheck = preChecksMap.get(survey.id) || { level: "ok", reasons: [] };
    const isExpanded = Boolean(expandedQuestions[survey.id]);
    const isActionOpen = activeActionSurveyId === survey.id;

    // Creator details & stats
    const ownerEmailNorm = (survey.owner || "").trim().toLowerCase();
    const creatorUser = users.find(
      (u) => (u.email || "").trim().toLowerCase() === ownerEmailNorm
    );
    const creatorStats = getCreatorStats(survey.owner, surveys);
    const eligibleCount = countEligibleUsers(survey, users);

    const isSwitchedOff = creatorUser?.canCreateSurveys === false;
    const hasRejectionWarning = creatorStats.rejected >= 2;

    const formattedSubmittedDate = survey.submittedAt
      ? new Date(survey.submittedAt).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        })
      : survey.created || "Recently";

    const formattedOpenDate = survey.openDate
      ? new Date(survey.openDate).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
        })
      : "Immediate upon approval";

    const formattedCloseDate = survey.closeDate
      ? new Date(survey.closeDate).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
        })
      : "Open-ended (No expiry)";

    return (
      <div
        key={survey.id}
        className={`bg-white rounded-2xl border transition-all shadow-xs ${
          preCheck.level === "attention"
            ? "border-amber-200/90 hover:border-amber-300"
            : "border-slate-200 hover:border-slate-300"
        }`}
      >
        <div className="p-5 sm:p-6 space-y-4">
          {/* Header Row: Title, Badges, Category */}
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
            <div className="space-y-1.5 flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-md text-[11px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-100 flex items-center gap-1">
                  <Tag className="w-3 h-3" />
                  {survey.cat || "General"}
                </span>

                {preCheck.level === "attention" ? (
                  <span className="px-2.5 py-0.5 rounded-md text-[11px] font-bold bg-amber-50 text-amber-800 border border-amber-200 flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3 text-amber-600" />
                    Needs Attention ({preCheck.reasons.length})
                  </span>
                ) : (
                  <span className="px-2.5 py-0.5 rounded-md text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
                    <CheckCircle className="w-3 h-3 text-emerald-600" />
                    Looks OK
                  </span>
                )}

                <span className="text-xs text-slate-400 flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5" />
                  Submitted: {formattedSubmittedDate}
                </span>
              </div>

              <h3 className="font-serif text-lg font-bold text-slate-900 leading-snug break-words">
                {survey.title}
              </h3>
            </div>

            {/* Quick Action Buttons */}
            <div className="flex items-center gap-2 shrink-0 self-start">
              <button
                type="button"
                onClick={() => openAction(survey.id, "approve")}
                disabled={isProcessing}
                className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <Check className="w-3.5 h-3.5" />
                Approve
              </button>
              <button
                type="button"
                onClick={() => openAction(survey.id, "reject")}
                disabled={isProcessing}
                className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <XCircle className="w-3.5 h-3.5" />
                Reject
              </button>
            </div>
          </div>

          {/* Pre-check Warning Chips */}
          {preCheck.reasons.length > 0 && (
            <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-xl space-y-2">
              <div className="text-[11px] font-bold uppercase tracking-wider text-amber-800 flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                Automated Review Observations ({preCheck.reasons.length})
              </div>
              <div className="flex flex-wrap gap-1.5">
                {preCheck.reasons.map((reason, idx) => (
                  <span
                    key={idx}
                    className="px-2.5 py-1 bg-amber-100 text-amber-900 border border-amber-200 text-xs rounded-lg font-medium inline-flex items-center gap-1"
                  >
                    <span>⚠️</span>
                    <span>{reason}</span>
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Details Grid: Purpose, Description, Schedule, Audience */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs bg-slate-50 p-4 rounded-xl border border-slate-200/80">
            <div className="space-y-2">
              <div>
                <span className="font-bold text-slate-400 uppercase tracking-wider text-[10px] block">
                  Author Purpose
                </span>
                <p className="text-slate-800 font-medium mt-0.5 leading-relaxed break-words">
                  {survey.purpose || <span className="italic text-slate-400">No stated purpose</span>}
                </p>
              </div>

              <div>
                <span className="font-bold text-slate-400 uppercase tracking-wider text-[10px] block">
                  Description
                </span>
                <p className="text-slate-600 mt-0.5 leading-relaxed break-words line-clamp-3">
                  {survey.desc || <span className="italic text-slate-400">No description provided</span>}
                </p>
              </div>
            </div>

            <div className="space-y-2 md:border-l md:border-slate-200 md:pl-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <span className="font-bold text-slate-400 uppercase tracking-wider text-[10px] block">
                    Target Audience
                  </span>
                  <div className="text-slate-800 font-semibold mt-0.5 flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                    <span>{formatReadableAudience(survey)}</span>
                  </div>
                </div>
                <span className="px-2 py-0.5 rounded-md bg-white border border-slate-200 text-slate-700 font-bold text-[11px] shrink-0">
                  {eligibleCount} eligible {eligibleCount === 1 ? "user" : "users"}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-200/60">
                <div>
                  <span className="font-bold text-slate-400 uppercase tracking-wider text-[10px] block">
                    Opening Date
                  </span>
                  <div className="text-slate-700 font-medium flex items-center gap-1 mt-0.5">
                    <Calendar className="w-3 h-3 text-slate-400" />
                    <span>{formattedOpenDate}</span>
                  </div>
                </div>
                <div>
                  <span className="font-bold text-slate-400 uppercase tracking-wider text-[10px] block">
                    Closing Date
                  </span>
                  <div className="text-slate-700 font-medium flex items-center gap-1 mt-0.5">
                    <Clock className="w-3 h-3 text-slate-400" />
                    <span>{formattedCloseDate}</span>
                  </div>
                </div>
              </div>

              <div className="pt-1">
                <span className="font-bold text-slate-400 uppercase tracking-wider text-[10px] block">
                  Instrument Size
                </span>
                <span className="text-slate-700 font-medium">
                  {survey.questions?.length || 0} Questions
                </span>
              </div>
            </div>
          </div>

          {/* Creator Profile & Statistics Panel */}
          <div className="p-4 bg-slate-900 text-white rounded-xl space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-indigo-600 flex items-center justify-center text-white font-bold text-sm shrink-0">
                  {survey.ownerName ? survey.ownerName.charAt(0).toUpperCase() : "U"}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm text-white">{survey.ownerName || "Creator"}</span>
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-slate-800 text-indigo-300 border border-slate-700">
                      {creatorUser?.pos || "Author"}
                    </span>
                  </div>
                  <span className="text-xs text-slate-400">{survey.owner}</span>
                </div>
              </div>

              {/* Creator Badges / Warnings / Action Button */}
              <div className="flex flex-wrap items-center gap-2">
                {isSwitchedOff && (
                  <span className="px-2.5 py-1 bg-rose-500/20 text-rose-300 border border-rose-500/40 text-xs rounded-lg font-bold flex items-center gap-1">
                    <Ban className="w-3.5 h-3.5 text-rose-400" />
                    <span>Creation switched off</span>
                    {creatorUser?.restrictionReason && (
                      <span className="font-normal text-rose-200">({creatorUser.restrictionReason})</span>
                    )}
                  </span>
                )}

                {hasRejectionWarning && (
                  <span className="px-2.5 py-1 bg-rose-500/20 text-rose-300 border border-rose-500/40 text-xs rounded-lg font-bold flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5 text-rose-400" />
                    <span>Warning: {creatorStats.rejected} rejected surveys</span>
                  </span>
                )}

                {isSwitchedOff ? (
                  <button
                    type="button"
                    onClick={() => openAction(survey.id, "allow")}
                    disabled={isProcessing}
                    className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer disabled:opacity-50"
                  >
                    <Unlock className="w-3.5 h-3.5" />
                    Allow Creator
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => openAction(survey.id, "restrict")}
                    disabled={isProcessing}
                    className="px-3 py-1 bg-rose-600/80 hover:bg-rose-600 text-white rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer disabled:opacity-50"
                  >
                    <Ban className="w-3.5 h-3.5" />
                    Restrict Creator
                  </button>
                )}
              </div>
            </div>

            {/* Lifetime stats grid */}
            <div className="grid grid-cols-4 gap-2 pt-2 border-t border-slate-800 text-center">
              <div className="bg-slate-800/60 p-2 rounded-lg">
                <span className="text-[10px] text-slate-400 uppercase font-bold block">Submitted</span>
                <span className="font-serif text-base font-bold text-white">{creatorStats.submitted}</span>
              </div>
              <div className="bg-slate-800/60 p-2 rounded-lg">
                <span className="text-[10px] text-emerald-400 uppercase font-bold block">Approved</span>
                <span className="font-serif text-base font-bold text-emerald-400">{creatorStats.approved}</span>
              </div>
              <div className="bg-slate-800/60 p-2 rounded-lg">
                <span className="text-[10px] text-rose-400 uppercase font-bold block">Rejected</span>
                <span className="font-serif text-base font-bold text-rose-400">{creatorStats.rejected}</span>
              </div>
              <div className="bg-slate-800/60 p-2 rounded-lg">
                <span className="text-[10px] text-amber-400 uppercase font-bold block">Pending</span>
                <span className="font-serif text-base font-bold text-amber-400">{creatorStats.pending}</span>
              </div>
            </div>
          </div>

          {/* Action Confirmation & Forms Drawer */}
          {isActionOpen && (
            <div className="p-4 rounded-xl border border-indigo-200 bg-indigo-50/60 space-y-3">
              {activeActionType === "approve" && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-indigo-900 font-bold text-sm">
                    <CheckCircle className="w-4 h-4 text-emerald-600" />
                    <span>Confirm Survey Approval</span>
                  </div>
                  <div className="text-xs text-slate-700 bg-white p-3.5 rounded-lg border border-indigo-100 space-y-1">
                    <p>
                      <strong className="text-slate-900">Eligible Audience:</strong>{" "}
                      <span className="font-bold text-indigo-700">{eligibleCount}</span> active users across the campus.
                    </p>
                    <p>
                      <strong className="text-slate-900">Opening Date:</strong>{" "}
                      <span className="font-bold text-slate-800">{formattedOpenDate}</span>
                    </p>
                    <p className="text-[11px] text-slate-500 pt-1">
                      Approving will publish or schedule this survey and notify {survey.ownerName} ({survey.owner}).
                    </p>
                  </div>
                  <div className="flex items-center gap-2 pt-1">
                    <button
                      type="button"
                      disabled={isProcessing}
                      onClick={() => handleConfirmApprove(survey)}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
                    >
                      <Check className="w-3.5 h-3.5" />
                      {isProcessing ? "Approving..." : "Confirm & Approve"}
                    </button>
                    <button
                      type="button"
                      disabled={isProcessing}
                      onClick={closeAction}
                      className="px-3.5 py-2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-xl text-xs font-semibold cursor-pointer"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {activeActionType === "reject" && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-rose-900 font-bold text-sm">
                    <XCircle className="w-4 h-4 text-rose-600" />
                    <span>Reject Survey Submission</span>
                  </div>
                  <p className="text-xs text-slate-600">
                    Provide a specific reason for rejection. This explanation will be delivered to the author.
                  </p>
                  <div>
                    <textarea
                      value={rejectReason}
                      onChange={(e) => setRejectReason(e.target.value)}
                      placeholder="Enter rejection reason (at least 10 characters)..."
                      rows={3}
                      className="w-full text-xs p-3 rounded-lg border border-slate-300 bg-white focus:outline-hidden focus:ring-2 focus:ring-rose-500"
                    />
                    <div className="flex justify-between items-center text-[11px] text-slate-400 mt-1">
                      <span>Minimum 10 characters required</span>
                      <span className={rejectReason.trim().length >= 10 ? "text-emerald-600 font-bold" : "text-slate-400"}>
                        {rejectReason.trim().length}/10 chars
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 pt-1">
                    <button
                      type="button"
                      disabled={isProcessing || rejectReason.trim().length < 10}
                      onClick={() => handleConfirmReject(survey)}
                      className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
                    >
                      <XCircle className="w-3.5 h-3.5" />
                      {isProcessing ? "Rejecting..." : "Confirm Rejection"}
                    </button>
                    <button
                      type="button"
                      disabled={isProcessing}
                      onClick={closeAction}
                      className="px-3.5 py-2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-xl text-xs font-semibold cursor-pointer"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {activeActionType === "restrict" && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-rose-900 font-bold text-sm">
                    <Ban className="w-4 h-4 text-rose-600" />
                    <span>Restrict Creator Authoring</span>
                  </div>
                  <p className="text-xs text-slate-600">
                    Revoke authoring permissions for <strong>{survey.owner}</strong>. Explain the administrative reason:
                  </p>
                  <div>
                    <input
                      type="text"
                      value={restrictReason}
                      onChange={(e) => setRestrictReason(e.target.value)}
                      placeholder="e.g. Multiple policy violations or spam submissions (min 10 chars)..."
                      className="w-full text-xs p-2.5 rounded-lg border border-slate-300 bg-white focus:outline-hidden focus:ring-2 focus:ring-rose-500"
                    />
                    <div className="flex justify-between items-center text-[11px] text-slate-400 mt-1">
                      <span>Minimum 10 characters required</span>
                      <span className={restrictReason.trim().length >= 10 ? "text-emerald-600 font-bold" : "text-slate-400"}>
                        {restrictReason.trim().length}/10 chars
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 pt-1">
                    <button
                      type="button"
                      disabled={isProcessing || restrictReason.trim().length < 10}
                      onClick={() => handleConfirmRestrictCreator(survey.owner)}
                      className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
                    >
                      <Ban className="w-3.5 h-3.5" />
                      {isProcessing ? "Restricting..." : "Apply Restriction"}
                    </button>
                    <button
                      type="button"
                      disabled={isProcessing}
                      onClick={closeAction}
                      className="px-3.5 py-2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-xl text-xs font-semibold cursor-pointer"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {activeActionType === "allow" && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-emerald-900 font-bold text-sm">
                    <Unlock className="w-4 h-4 text-emerald-600" />
                    <span>Re-enable Creator Authoring</span>
                  </div>
                  <p className="text-xs text-slate-600">
                    Restore full survey creation privileges for <strong>{survey.owner}</strong>?
                  </p>
                  <div className="flex items-center gap-2 pt-1">
                    <button
                      type="button"
                      disabled={isProcessing}
                      onClick={() => handleConfirmAllowCreator(survey.owner)}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
                    >
                      <Unlock className="w-3.5 h-3.5" />
                      {isProcessing ? "Restoring..." : "Confirm & Restore Privileges"}
                    </button>
                    <button
                      type="button"
                      disabled={isProcessing}
                      onClick={closeAction}
                      className="px-3.5 py-2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-xl text-xs font-semibold cursor-pointer"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Questions Expand Toggle Button */}
          <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
            <button
              type="button"
              onClick={() => toggleExpand(survey.id)}
              className="text-xs font-bold text-indigo-600 hover:text-indigo-800 transition-colors flex items-center gap-1.5 cursor-pointer py-1"
            >
              <FileText className="w-3.5 h-3.5" />
              <span>
                {isExpanded
                  ? "Hide Question Breakdown"
                  : `Expand Questions (${survey.questions?.length || 0})`}
              </span>
              {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
          </div>

          {/* Expanded Questions Breakdown */}
          {isExpanded && (
            <div className="pt-2 border-t border-slate-100 space-y-3">
              <div className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Survey Instrument Questions ({survey.questions?.length || 0})
              </div>

              {(!survey.questions || survey.questions.length === 0) ? (
                <div className="p-4 bg-slate-50 rounded-xl text-center text-xs text-slate-400">
                  No questions defined for this survey.
                </div>
              ) : (
                <div className="space-y-2.5">
                  {survey.questions.map((q, qIndex) => {
                    const blocks = survey.topicBlocks || [];
                    const blockIndex = blocks.findIndex((b) => b.id === q.blockId);
                    const block = blockIndex >= 0 ? blocks[blockIndex] : undefined;
                    const startsNewBlock =
                      Boolean(block) && (qIndex === 0 || survey.questions[qIndex - 1].blockId !== q.blockId);
                    const topic = block ? topics.find((t) => t.id === block.topicId) : undefined;
                    return (
                    <React.Fragment key={q.id || qIndex}>
                    {block && startsNewBlock && (
                      <div className={`${qIndex === 0 ? "" : "pt-3"} space-y-1`}>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 text-[10px] font-extrabold uppercase tracking-wider">
                            Section {blockIndex + 1} of {blocks.length}
                          </span>
                          <span className="text-[11px] text-slate-500">
                            Topic: <span className="font-semibold text-slate-700">{topic?.name || "Unknown topic"}</span>
                          </span>
                          {topic?.status === "retired" && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                              Retired topic
                            </span>
                          )}
                        </div>
                        <div className="text-sm font-bold text-slate-900">{block.title || "Untitled section"}</div>
                        {block.description && <p className="text-[11px] text-slate-500">{block.description}</p>}
                      </div>
                    )}
                    <div className="p-3.5 bg-slate-50 border border-slate-200/90 rounded-xl space-y-2 text-xs">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-start gap-2">
                          <span className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-700 font-bold flex items-center justify-center text-[10px] shrink-0 mt-0.5">
                            {qIndex + 1}
                          </span>
                          <span className="font-semibold text-slate-800 leading-snug">
                            {q.text}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <span className="px-2 py-0.5 rounded-md bg-white border border-slate-200 text-slate-600 font-bold text-[10px]">
                            {formatQuestionType(q.type)}
                          </span>
                          {q.required && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                              Required
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Options breakdown for multiple choice or checkbox */}
                      {(q.type === "multiple" || q.type === "checkbox") && q.options && (
                        <div className="pl-7 grid grid-cols-1 sm:grid-cols-2 gap-1.5 pt-1">
                          {q.options.map((opt, optIndex) => (
                            <div
                              key={optIndex}
                              className="px-2.5 py-1 bg-white border border-slate-200 rounded-md text-[11px] text-slate-600 flex items-center gap-2"
                            >
                              <div className="w-2 h-2 rounded-full bg-slate-300"></div>
                              <span>{opt}</span>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Rating details */}
                      {q.type === "rating" && (
                        <div className="pl-7 flex items-center gap-2 text-[11px] text-slate-500 pt-1">
                          <span>Scale: {q.min ?? 1} to {q.max ?? 5}</span>
                          {q.labels && q.labels.length > 0 && (
                            <span>({q.labels.join(" · ")})</span>
                          )}
                        </div>
                      )}
                    </div>
                    </React.Fragment>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Overview Banner */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="font-serif text-xl font-bold text-slate-900 flex items-center gap-2">
            <ShieldCheck className="w-6 h-6 text-indigo-600" />
            <span>Survey Submission Review & Approval Center</span>
          </h2>
          <p className="text-xs text-slate-500 mt-1 max-w-2xl leading-relaxed">
            Review community survey instruments before publication. Automated pre-checks audit quality, test keywords, duration, and content standards.
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <div className="px-4 py-2.5 rounded-2xl bg-indigo-50 border border-indigo-100 text-center">
            <span className="text-[10px] font-bold text-indigo-500 uppercase tracking-wider block">
              Pending Queue
            </span>
            <span className="font-serif text-xl font-bold text-indigo-900">
              {pendingSurveys.length}
            </span>
          </div>

          <div className="px-4 py-2.5 rounded-2xl bg-amber-50 border border-amber-100 text-center">
            <span className="text-[10px] font-bold text-amber-600 uppercase tracking-wider block">
              Needs Attention
            </span>
            <span className="font-serif text-xl font-bold text-amber-900">
              {attentionSurveys.length}
            </span>
          </div>

          <div className="px-4 py-2.5 rounded-2xl bg-emerald-50 border border-emerald-100 text-center">
            <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider block">
              Looks OK
            </span>
            <span className="font-serif text-xl font-bold text-emerald-900">
              {looksOkSurveys.length}
            </span>
          </div>
        </div>
      </div>

      {/* Empty State */}
      {pendingSurveys.length === 0 ? (
        <div className="bg-white rounded-3xl p-12 text-center border border-slate-200 shadow-xs space-y-4 max-w-lg mx-auto">
          <div className="w-16 h-16 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto">
            <CheckCircle className="w-8 h-8" />
          </div>
          <h3 className="font-serif text-lg font-bold text-slate-900">
            No Surveys Awaiting Approval
          </h3>
          <p className="text-xs text-slate-500 leading-relaxed">
            All submitted survey instruments have been reviewed and processed. New submissions from faculty, students, or officers will appear here automatically.
          </p>
        </div>
      ) : (
        <div className="space-y-8">
          {/* GROUP 1: Needs Attention */}
          {attentionSurveys.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-amber-200/80 pb-2">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-amber-500"></div>
                  <h3 className="font-serif text-base font-bold text-slate-900">
                    Needs Attention
                  </h3>
                  <span className="px-2 py-0.5 rounded-full text-xs font-extrabold bg-amber-100 text-amber-800">
                    {attentionSurveys.length}
                  </span>
                </div>
                <span className="text-xs text-slate-500">
                  Surveys flagged with content or configuration warnings
                </span>
              </div>

              <div className="space-y-4">
                {attentionSurveys.map(renderSurveyCard)}
              </div>
            </div>
          )}

          {/* GROUP 2: Looks OK */}
          {looksOkSurveys.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-emerald-200/80 pb-2">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-500"></div>
                  <h3 className="font-serif text-base font-bold text-slate-900">
                    Looks OK
                  </h3>
                  <span className="px-2 py-0.5 rounded-full text-xs font-extrabold bg-emerald-100 text-emerald-800">
                    {looksOkSurveys.length}
                  </span>
                </div>
                <span className="text-xs text-slate-500">
                  Surveys passing all automated pre-checks
                </span>
              </div>

              <div className="space-y-4">
                {looksOkSurveys.map(renderSurveyCard)}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

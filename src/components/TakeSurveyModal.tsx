import React, { useState } from "react";
import { Survey, Question, UserProfile, Answer } from "../types";
import confetti from "canvas-confetti";
import {
  X,
  CheckCircle2,
  Lock,
  Calendar,
  Sparkles,
  HelpCircle,
  MessageSquare,
  Star,
  Send,
  ShieldCheck,
  UserCheck,
  FileCheck,
  ArrowRight,
  AlertTriangle,
} from "lucide-react";

interface TakeSurveyModalProps {
  survey: Survey;
  currentUser: UserProfile | null;
  existingAnswers?: Answer[];
  /** Creator preview: shows the survey as respondents see it, but nothing can be submitted. */
  previewOnly?: boolean;
  onClose: () => void;
  onSubmit: (answers: Answer[], isAnonymous?: boolean) => Promise<void>;
}

export const TakeSurveyModal: React.FC<TakeSurveyModalProps> = ({
  survey,
  currentUser,
  existingAnswers,
  previewOnly = false,
  onClose,
  onSubmit,
}) => {
  const isReadOnly = Boolean(existingAnswers && existingAnswers.length > 0);

  // Topic blocks become section headings. Questions are saved in block order by the builder.
  const blocks = survey.topicBlocks || [];
  const blockIndexById = new Map<string, number>(blocks.map((b, i) => [b.id, i]));

  // Form State: question index -> answer string / selected rating / array
  const [answersState, setAnswersState] = useState<Record<string, any>>(() => {
    if (existingAnswers && existingAnswers.length > 0) {
      const initial: Record<string, any> = {};
      survey.questions.forEach((q, idx) => {
        const found = existingAnswers.find((a) => a.question === q.text);
        if (found) {
          initial[idx] = found.answer;
        }
      });
      return initial;
    }
    return {};
  });

  // Surveys that require names never offer the anonymous option.
  const requiresName = survey.allowAnonymous === false;
  const [isAnonymous, setIsAnonymous] = useState<boolean>(!requiresName);
  const [showConfirmModal, setShowConfirmModal] = useState<boolean>(false);
  const [submittedReceipt, setSubmittedReceipt] = useState<{
    receiptId: string;
    timestamp: string;
    isAnonymous: boolean;
    questionsCount: number;
  } | null>(null);

    const [submitting, setSubmitting] = useState<boolean>(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  const handleRatingSelect = (qIdx: number, val: number, label?: string) => {
    if (isReadOnly) return;
    setAnswersState((prev) => ({
      ...prev,
      [qIdx]: `${val} stars${label ? ` (${label})` : ""}`,
      [`${qIdx}_raw`]: val,
    }));
  };

  const handleMultipleSelect = (qIdx: number, val: string) => {
    if (isReadOnly) return;
    setAnswersState((prev) => ({ ...prev, [qIdx]: val }));
  };

  const handleCheckboxToggle = (qIdx: number, val: string) => {
    if (isReadOnly) return;
    const current: string[] = Array.isArray(answersState[qIdx])
      ? answersState[qIdx]
      : typeof answersState[qIdx] === "string"
      ? answersState[qIdx].split(", ").filter(Boolean)
      : [];

    let updated: string[];
    if (current.includes(val)) {
      updated = current.filter((item) => item !== val);
    } else {
      updated = [...current, val];
    }
    setAnswersState((prev) => ({ ...prev, [qIdx]: updated }));
  };

  const handleParagraphChange = (qIdx: number, val: string) => {
    if (isReadOnly) return;
    setAnswersState((prev) => ({ ...prev, [qIdx]: val }));
  };

  const validateForm = (): boolean => {
    setValidationError(null);
    for (let i = 0; i < survey.questions.length; i++) {
      const q = survey.questions[i];
      const ans = answersState[i];
      if (q.type === "rating" && !ans) {
        setValidationError(`Please provide a rating for Question #${i + 1}.`);
        return false;
      }
      if (q.type === "multiple" && !ans) {
        setValidationError(`Please select an option for Question #${i + 1}.`);
        return false;
      }
      if (q.type === "paragraph" && (!ans || !ans.trim())) {
        setValidationError(`Please provide your feedback response for Question #${i + 1}.`);
        return false;
      }
    }
    return true;
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isReadOnly || previewOnly) return;
    if (validateForm()) {
      setShowConfirmModal(true);
    }
  };

  const handleConfirmedSubmit = async () => {
    setSubmitting(true);
    try {
      const answers: Answer[] = survey.questions.map((q, idx) => {
        let answerStr = "";
        let ratingVal: number | undefined;

        if (q.type === "checkbox") {
          answerStr = Array.isArray(answersState[idx]) ? answersState[idx].join(", ") : answersState[idx] || "None selected";
        } else if (q.type === "rating") {
          answerStr = answersState[idx] || "No rating";
          ratingVal = answersState[`${idx}_raw`];
        } else {
          answerStr = answersState[idx] || "No response";
        }

        return {
          question: q.text,
          answer: answerStr,
          ratingValue: ratingVal,
        };
      });

      await onSubmit(answers, isAnonymous);

      const receiptId = `EVAL-${Math.random().toString(36).substring(2, 7).toUpperCase()}-${Date.now().toString(36).toUpperCase()}`;
      setSubmittedReceipt({
        receiptId,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", month: "short", day: "numeric", year: "numeric" }),
        isAnonymous,
        questionsCount: survey.questions.length,
      });

      setShowConfirmModal(false);

      // Trigger celebratory confetti
      confetti({
        particleCount: 90,
        spread: 70,
        origin: { y: 0.6 },
      });
    } catch (err: any) {
      setValidationError(err?.message || "Failed to submit survey");
      setShowConfirmModal(false);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-3xl max-w-2xl w-full p-6 sm:p-8 shadow-2xl border border-slate-200 my-8 space-y-6 relative max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* SUCCESS RECEIPT WINDOW */}
        {submittedReceipt ? (
          <div className="py-6 text-center space-y-6 animate-in fade-in zoom-in-95">
            <div className="w-16 h-16 rounded-3xl bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto shadow-inner">
              <CheckCircle2 className="w-9 h-9" />
            </div>

            <div className="space-y-1.5">
              <span className="px-3 py-1 bg-emerald-50 text-emerald-700 text-xs font-bold rounded-full border border-emerald-200 uppercase tracking-wider">
                Submission Confirmed
              </span>
              <h2 className="font-serif text-2xl font-extrabold text-slate-900">
                Evaluation Successfully Recorded!
              </h2>
              <p className="text-xs sm:text-sm text-slate-600 max-w-md mx-auto">
                Thank you for contributing to our institutional quality improvement. Your feedback has been safely stored and processed.
              </p>
            </div>

            {/* Official Receipt Card */}
            <div className="max-w-md mx-auto p-4 bg-slate-50 border border-slate-200 rounded-2xl text-left space-y-3">
              <div className="flex items-center justify-between border-b border-slate-200/80 pb-2.5">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Official Receipt Reference</span>
                <span className="font-mono text-xs font-bold text-slate-800">{submittedReceipt.receiptId}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-500">Survey Title:</span>
                <span className="font-bold text-slate-900 truncate max-w-[220px]">{survey.title}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-500">Category:</span>
                <span className="font-semibold text-blue-700">{survey.cat}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-500">Submission Timestamp:</span>
                <span className="font-medium text-slate-700">{submittedReceipt.timestamp}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-500">Privacy Status:</span>
                <span className="font-bold flex items-center gap-1.5">
                  {submittedReceipt.isAnonymous ? (
                    <span className="text-emerald-700 flex items-center gap-1">
                      <Lock className="w-3.5 h-3.5" /> Anonymous
                    </span>
                  ) : (
                    <span className="text-indigo-700 flex items-center gap-1">
                      <UserCheck className="w-3.5 h-3.5" /> Verified Profile ({currentUser?.name || "Student"})
                    </span>
                  )}
                </span>
              </div>
            </div>

            <div className="pt-2">
              <button
                type="button"
                onClick={onClose}
                className="px-8 py-3 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs sm:text-sm rounded-xl shadow-xs transition-all cursor-pointer"
              >
                Done & Return to Campus Surveys
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* Modal Header */}
        <div className="flex items-start justify-between gap-4 pb-4 border-b border-slate-100">
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-2.5 py-0.5 rounded-md text-[11px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                {survey.cat}
              </span>
              {isReadOnly && (
                <span className="px-2.5 py-0.5 rounded-md text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" />
                  <span>Submitted Response (Read-Only)</span>
                </span>
              )}
            </div>
            <h2 className="font-serif text-xl sm:text-2xl font-extrabold text-slate-900 leading-snug">
              {survey.title}
            </h2>
            <p className="text-xs text-slate-500">{survey.desc}</p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* How do you want to answer? */}
        {previewOnly && (
          <div className="p-3.5 bg-amber-50 rounded-2xl border border-amber-200 flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0 text-amber-700" />
            <div>
              <div className="text-xs font-bold text-amber-950">Preview only</div>
              <div className="text-[11px] text-amber-900/80 leading-snug mt-0.5">
                This is how respondents will see your survey. You can click the answers to try it, but nothing is saved
                or submitted.
              </div>
            </div>
          </div>
        )}

        {!isReadOnly && !previewOnly && requiresName && (
          <div className="p-3.5 bg-indigo-50/70 rounded-2xl border border-indigo-200 flex items-start gap-2.5">
            <UserCheck className="w-4 h-4 mt-0.5 shrink-0 text-indigo-700" />
            <div>
              <div className="text-xs font-bold text-indigo-950">This survey needs your name</div>
              <div className="text-[11px] text-indigo-900/80 leading-snug mt-0.5">
                Your name and email ({currentUser?.name || "your account"}) are saved with your answers, so the survey
                owner and the administrator can see who responded.
              </div>
            </div>
          </div>
        )}

        {!isReadOnly && !previewOnly && !requiresName && (
          <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                How do you want to answer?
              </span>
              <span className="text-[10px] text-slate-400 font-medium">{survey.questions.length} questions</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => setIsAnonymous(true)}
                className={`p-3 rounded-xl border text-left flex items-start gap-2.5 cursor-pointer transition-all ${
                  isAnonymous
                    ? "bg-blue-50/90 border-blue-400 text-blue-950 shadow-xs ring-1 ring-blue-300"
                    : "bg-white border-slate-200 text-slate-600 hover:border-slate-300"
                }`}
              >
                <Lock className={`w-4 h-4 mt-0.5 shrink-0 ${isAnonymous ? "text-blue-700" : "text-slate-400"}`} />
                <div>
                  <div className="text-xs font-bold">Answer anonymously</div>
                  <div className="text-[11px] text-slate-500 leading-tight mt-0.5">
                    Your name and email are not saved with your answers. Your department, program and year level may
                    still be included for statistics.
                  </div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setIsAnonymous(false)}
                className={`p-3 rounded-xl border text-left flex items-start gap-2.5 cursor-pointer transition-all ${
                  !isAnonymous
                    ? "bg-indigo-50/90 border-indigo-400 text-indigo-950 shadow-xs ring-1 ring-indigo-300"
                    : "bg-white border-slate-200 text-slate-600 hover:border-slate-300"
                }`}
              >
                <UserCheck className={`w-4 h-4 mt-0.5 shrink-0 ${!isAnonymous ? "text-indigo-700" : "text-slate-400"}`} />
                <div>
                  <div className="text-xs font-bold">Answer with my name</div>
                  <div className="text-[11px] text-slate-500 leading-tight mt-0.5">
                    Your name and email are saved with your answers, so the survey owner and the administrator can see who
                    responded.
                  </div>
                </div>
              </button>
            </div>
          </div>
        )}

        {validationError && (
          <div className="p-3.5 bg-rose-50 rounded-2xl border border-rose-200 text-xs font-bold text-rose-700 flex items-center gap-2">
            <HelpCircle className="w-4 h-4 text-rose-600" />
            <span>{validationError}</span>
          </div>
        )}

        {/* Questions Form */}
        <form onSubmit={handleFormSubmit} className="space-y-6">
          {survey.questions.map((q, idx) => {
            const currentAnswer = answersState[idx];
            const blockIndex = q.blockId !== undefined ? blockIndexById.get(q.blockId) : undefined;
            const block = blockIndex !== undefined ? blocks[blockIndex] : undefined;
            const startsNewBlock = Boolean(block) && (idx === 0 || survey.questions[idx - 1].blockId !== q.blockId);
            return (
              <React.Fragment key={idx}>
              {block && startsNewBlock && (
                <div className={`${idx === 0 ? "" : "pt-4"} space-y-1`}>
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 text-[10px] font-extrabold uppercase tracking-wider">
                      Section {(blockIndex ?? 0) + 1} of {blocks.length}
                    </span>
                  </div>
                  <h2 className="font-serif text-base sm:text-lg font-bold text-slate-900 border-b border-indigo-100 pb-1.5">
                    {block.title || "Untitled section"}
                  </h2>
                  {block.description && <p className="text-xs text-slate-500 leading-relaxed">{block.description}</p>}
                </div>
              )}
              <div className="p-5 rounded-2xl bg-slate-50/80 border border-slate-200 space-y-3 transition-all">
                <div className="flex items-start gap-2.5">
                  <span className="w-6 h-6 rounded-lg bg-blue-600 text-white text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                    {idx + 1}
                  </span>
                  <div className="flex-1">
                    <h3 className="font-bold text-sm text-slate-900 leading-snug">{q.text}</h3>
                  </div>
                </div>

                {/* Rating Scale Question */}
                {q.type === "rating" && (
                  <div className="space-y-2 pt-2">
                    <div className="flex flex-wrap gap-2">
                      {Array.from({ length: (q.max || 5) - (q.min || 1) + 1 }, (_, i) => {
                        const val = (q.min || 1) + i;
                        const label = q.labels && q.labels[i] ? q.labels[i] : undefined;
                        const isSelected =
                          answersState[`${idx}_raw`] === val ||
                          (typeof currentAnswer === "string" && currentAnswer.startsWith(`${val} stars`));

                        return (
                          <button
                            key={val}
                            type="button"
                            disabled={isReadOnly}
                            onClick={() => handleRatingSelect(idx, val, label)}
                            className={`flex flex-col items-center justify-center p-2.5 rounded-xl border transition-all cursor-pointer min-w-[56px] flex-1 ${
                              isSelected
                                ? "bg-blue-600 text-white border-blue-600 shadow-sm"
                                : "bg-white text-slate-700 border-slate-200 hover:border-blue-300 hover:bg-blue-50/30"
                            } ${isReadOnly ? "cursor-default" : ""}`}
                          >
                            <span className="text-sm font-extrabold">{val}</span>
                            {label && (
                              <span
                                className={`text-[9px] font-medium mt-0.5 text-center leading-tight ${
                                  isSelected ? "text-blue-100" : "text-slate-500"
                                }`}
                              >
                                {label}
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Multiple Choice Question */}
                {q.type === "multiple" && (
                  <div className="space-y-2 pt-1">
                    {q.options?.map((opt, oIdx) => {
                      const isSelected = currentAnswer === opt;
                      return (
                        <label
                          key={oIdx}
                          className={`flex items-center gap-3 p-3 rounded-xl border transition-all cursor-pointer ${
                            isSelected
                              ? "bg-blue-50/80 border-blue-500 text-blue-900 font-bold"
                              : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
                          } ${isReadOnly ? "cursor-default" : ""}`}
                        >
                          <input
                            type="radio"
                            name={`q_${idx}`}
                            disabled={isReadOnly}
                            checked={isSelected}
                            onChange={() => handleMultipleSelect(idx, opt)}
                            className="text-blue-600 focus:ring-blue-500"
                          />
                          <span className="text-xs sm:text-sm font-medium">{opt}</span>
                        </label>
                      );
                    })}
                  </div>
                )}

                {/* Checkboxes Question */}
                {q.type === "checkbox" && (
                  <div className="space-y-2 pt-1">
                    {q.options?.map((opt, oIdx) => {
                      const checkedList: string[] = Array.isArray(currentAnswer)
                        ? currentAnswer
                        : typeof currentAnswer === "string"
                        ? currentAnswer.split(", ").filter(Boolean)
                        : [];
                      const isChecked = checkedList.includes(opt);

                      return (
                        <label
                          key={oIdx}
                          className={`flex items-center gap-3 p-3 rounded-xl border transition-all cursor-pointer ${
                            isChecked
                              ? "bg-blue-50/80 border-blue-500 text-blue-900 font-bold"
                              : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
                          } ${isReadOnly ? "cursor-default" : ""}`}
                        >
                          <input
                            type="checkbox"
                            disabled={isReadOnly}
                            checked={isChecked}
                            onChange={() => handleCheckboxToggle(idx, opt)}
                            className="rounded text-blue-600 focus:ring-blue-500"
                          />
                          <span className="text-xs sm:text-sm font-medium">{opt}</span>
                        </label>
                      );
                    })}
                  </div>
                )}

                {/* Paragraph Open Response Question */}
                {q.type === "paragraph" && (
                  <div className="space-y-1.5 pt-1">
                    <textarea
                      rows={3}
                      disabled={isReadOnly}
                      value={currentAnswer || ""}
                      onChange={(e) => handleParagraphChange(idx, e.target.value)}
                      placeholder="Type your candid feedback in Tagalog, Taglish, or English..."
                      className="w-full p-3.5 bg-white border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-800 placeholder:text-slate-400 focus:outline-hidden focus:border-blue-500 disabled:bg-slate-100 disabled:text-slate-600 font-sans leading-relaxed"
                    />
                    <span className="text-[10px] text-slate-400 block text-right">
                      {(currentAnswer || "").length} characters · Filipino & Taglish supported
                    </span>
                  </div>
                )}
              </div>
              </React.Fragment>
            );
          })}

          {/* Form Actions */}
          <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-colors cursor-pointer"
            >
              {previewOnly ? "Close Preview" : isReadOnly ? "Close View" : "Cancel"}
            </button>

            {!isReadOnly && !previewOnly && (
              <button
                type="submit"
                disabled={submitting}
                className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-md shadow-blue-500/20 transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
              >
                <Send className="w-4 h-4" />
                <span>{submitting ? "Submitting..." : "Submit Survey Responses"}</span>
              </button>
            )}
          </div>
        </form>
        </>
        )}

        {/* CONFIRMATION MODAL OVERLAY */}
        {showConfirmModal && (
          <div className="fixed inset-0 z-60 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4 animate-in fade-in zoom-in-95">
              <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <div className="text-center space-y-1">
                <h3 className="font-serif text-lg font-bold text-slate-900">
                  Confirm Survey Submission
                </h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  You are about to submit your response for{" "}
                  <span className="font-semibold text-slate-800">"{survey.title}"</span>. You can answer each survey
                  only once, and this cannot be changed afterwards.
                </p>
              </div>

              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-700 space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-slate-500">Submission Mode:</span>
                  <span className="font-bold flex items-center gap-1.5 text-slate-900">
                    {isAnonymous ? (
                      <span className="text-emerald-700 flex items-center gap-1">
                        <Lock className="w-3.5 h-3.5" /> Anonymous
                      </span>
                    ) : (
                      <span className="text-indigo-700 flex items-center gap-1">
                        <UserCheck className="w-3.5 h-3.5" /> Verified Profile ({currentUser?.name || "Student"})
                      </span>
                    )}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500">Total Questions:</span>
                  <span className="font-bold text-slate-900">{survey.questions.length} Questions</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500">NLP Engine:</span>
                  <span className="font-bold text-blue-700">Tagalog/Taglish Sentiment Analysis</span>
                </div>
              </div>

              <div className="pt-2 flex items-center gap-3">
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => setShowConfirmModal(false)}
                  className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-colors cursor-pointer"
                >
                  Review Answers
                </button>
                <button
                  type="button"
                  disabled={submitting}
                  onClick={handleConfirmedSubmit}
                  className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-xs transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {submitting ? (
                    <span>Submitting...</span>
                  ) : (
                    <>
                      <span>Yes, Submit Feedback</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
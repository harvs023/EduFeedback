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
} from "lucide-react";

interface TakeSurveyModalProps {
  survey: Survey;
  currentUser: UserProfile | null;
  existingAnswers?: Answer[];
  onClose: () => void;
  onSubmit: (answers: Answer[]) => Promise<void>;
}

export const TakeSurveyModal: React.FC<TakeSurveyModalProps> = ({
  survey,
  currentUser,
  existingAnswers,
  onClose,
  onSubmit,
}) => {
  const isReadOnly = Boolean(existingAnswers && existingAnswers.length > 0);

  // Form State: question index -> answer string / selected rating / array
  const [answersState, setAnswersState] = useState<Record<number, any>>(() => {
    if (existingAnswers && existingAnswers.length > 0) {
      const initial: Record<number, any> = {};
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

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isReadOnly) return;
    setValidationError(null);

    // Validate that required questions are answered
    for (let i = 0; i < survey.questions.length; i++) {
      const q = survey.questions[i];
      const ans = answersState[i];
      if (q.type === "rating" && !ans) {
        setValidationError(`Please provide a rating for Question #${i + 1}.`);
        return;
      }
      if (q.type === "multiple" && !ans) {
        setValidationError(`Please select an option for Question #${i + 1}.`);
        return;
      }
      if (q.type === "paragraph" && (!ans || !ans.trim())) {
        setValidationError(`Please provide your feedback response for Question #${i + 1}.`);
        return;
      }
    }

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

      await onSubmit(answers);

      // Trigger celebratory confetti
      confetti({
        particleCount: 80,
        spread: 60,
        origin: { y: 0.6 },
      });
    } catch (err: any) {
      setValidationError(err?.message || "Failed to submit survey");
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

        {/* Anonymous Guarantee Callout */}
        <div className="p-3.5 bg-blue-50/70 rounded-2xl border border-blue-200/60 flex items-center justify-between text-xs text-blue-900">
          <div className="flex items-center gap-2">
            <Lock className="w-4 h-4 text-blue-700 shrink-0" />
            <span className="font-semibold">
              100% Anonymous Submission · Submissions in Tagalog, Taglish & English are welcome!
            </span>
          </div>
          <span className="text-[11px] text-blue-700 font-bold hidden sm:block">
            {survey.questions.length} Questions
          </span>
        </div>

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
            return (
              <div
                key={idx}
                className="p-5 rounded-2xl bg-slate-50/80 border border-slate-200 space-y-3 transition-all"
              >
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
            );
          })}

          {/* Form Actions */}
          <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-colors cursor-pointer"
            >
              {isReadOnly ? "Close View" : "Cancel"}
            </button>

            {!isReadOnly && (
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
      </div>
    </div>
  );
};

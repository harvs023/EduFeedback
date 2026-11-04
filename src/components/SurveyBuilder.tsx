import React, { useState, useEffect } from "react";
import { Survey, Question, UserProfile, TargetAudience, Topic, SurveyTopicBlock } from "../types";
import { DEPARTMENTS_DATA } from "../data/initialData";
import { SurveyCriteriaModal } from "./SurveyCriteriaModal";
import {
  PlusCircle,
  Pencil,
  ArrowLeft,
  Trash2,
  Calendar,
  Layers,
  Sparkles,
  Users,
  Star,
  CheckSquare,
  ListFilter,
  AlignLeft,
  Flame,
  ArrowRight,
  Clock,
  Tag,
} from "lucide-react";

interface SurveyBuilderProps {
  currentUser: UserProfile | null;
  categories: string[];
  topics?: Topic[];
  initialSurvey?: Survey | null;
  onSaveSurvey: (surveyData: Partial<Survey>, status: "draft" | "pending" | "published" | "scheduled") => void;
  onCancel?: () => void;
}

export const SurveyBuilder: React.FC<SurveyBuilderProps> = ({
  currentUser,
  categories,
  topics = [],
  initialSurvey,
  onSaveSurvey,
  onCancel,
}) => {
  const isEditing = Boolean(initialSurvey);

  const [title, setTitle] = useState<string>(initialSurvey?.title || "");
  const [cat, setCat] = useState<string>(initialSurvey?.cat || categories[0] || "Course");
  const [desc, setDesc] = useState<string>(initialSurvey?.desc || "");
  const [purpose, setPurpose] = useState<string>(initialSurvey?.purpose || "");
  const [criteriaAcceptedAt, setCriteriaAcceptedAt] = useState<number | null>(initialSurvey?.criteriaAcceptedAt ?? null);
  const [submitErrors, setSubmitErrors] = useState<string[]>([]);
  const [academicYear, setAcademicYear] = useState<string>(initialSurvey?.academicYear || "2025-2026");
  const [topicBlocks, setTopicBlocks] = useState<SurveyTopicBlock[]>(initialSurvey?.topicBlocks || []);

  // Scheduling
  const [scheduleType, setScheduleType] = useState<"immediate" | "scheduled">(
    initialSurvey?.status === "scheduled" || initialSurvey?.openDate ? "scheduled" : "immediate"
  );
  const [openDate, setOpenDate] = useState<string>(initialSurvey?.openDate || "");
  const [closeDate, setCloseDate] = useState<string>(initialSurvey?.closeDate || "");

  // Target audience
  const [targetType, setTargetType] = useState<TargetAudience["type"]>(initialSurvey?.targetAudience?.type || "all");
  const [selectedRoles, setSelectedRoles] = useState<string[]>(
    initialSurvey?.targetAudience?.filters?.roles || ["students", "faculty", "officers"]
  );

  // Mandatory / Required Survey (Admin Only Feature)
  const isSuperadmin = currentUser?.role === "superadmin" || currentUser?.pos === "Superadmin";
  const isRestricted = !isSuperadmin && currentUser?.canCreateSurveys === false;
  const [isRequired, setIsRequired] = useState<boolean>(initialSurvey?.isRequired || false);
  const [requiredAudience, setRequiredAudience] = useState<"all" | "students" | "faculty" | "officers">(
    initialSurvey?.requiredAudience || "students"
  );
  const [allowAnonymous, setAllowAnonymous] = useState<boolean>(
    initialSurvey?.allowAnonymous !== undefined ? initialSurvey.allowAnonymous : true
  );

  // Questions builder list
  const [questions, setQuestions] = useState<Question[]>(
    initialSurvey?.questions && initialSurvey.questions.length > 0
      ? initialSurvey.questions
      : [
          {
            id: "q1",
            type: "rating",
            text: "How would you rate the overall effectiveness and delivery of the course/subject?",
            min: 1,
            max: 5,
            labels: ["Poor", "Fair", "Satisfactory", "Very Good", "Outstanding"],
          },
          {
            id: "q2",
            type: "paragraph",
            text: "What specific suggestions or comments (in Tagalog or English) do you have for improvement?",
          },
        ]
  );

  useEffect(() => {
    if (initialSurvey) {
      setTitle(initialSurvey.title || "");
      setCat(initialSurvey.cat || categories[0] || "Course");
      setDesc(initialSurvey.desc || "");
      setPurpose(initialSurvey.purpose || "");
      setCriteriaAcceptedAt(initialSurvey.criteriaAcceptedAt ?? null);
      setAcademicYear(initialSurvey.academicYear || "2025-2026");
      setScheduleType(initialSurvey.status === "scheduled" || initialSurvey.openDate ? "scheduled" : "immediate");
      setOpenDate(initialSurvey.openDate || "");
      setCloseDate(initialSurvey.closeDate || "");
      setTargetType(initialSurvey.targetAudience?.type || "all");
      setSelectedRoles(initialSurvey.targetAudience?.filters?.roles || ["students", "faculty", "officers"]);
      if (initialSurvey.questions && initialSurvey.questions.length > 0) {
        setQuestions(initialSurvey.questions);
      }
      if (initialSurvey.topicBlocks) {
        setTopicBlocks(initialSurvey.topicBlocks);
      }
    }
  }, [initialSurvey, categories]);

  const generateUniqueQuestionId = () =>
    `q_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

  const addRatingQuestion = () => {
    setQuestions((prev) => [
      ...prev,
      {
        id: generateUniqueQuestionId(),
        type: "rating",
        text: "",
        min: 1,
        max: 5,
        labels: ["1 (Poor)", "2", "3 (Average)", "4", "5 (Excellent)"],
      },
    ]);
  };

  const addMultipleChoiceQuestion = () => {
    setQuestions((prev) => [
      ...prev,
      {
        id: generateUniqueQuestionId(),
        type: "multiple",
        text: "",
        options: ["Option 1", "Option 2", "Option 3"],
      },
    ]);
  };

  const addCheckboxQuestion = () => {
    setQuestions((prev) => [
      ...prev,
      {
        id: generateUniqueQuestionId(),
        type: "checkbox",
        text: "",
        options: ["Choice A", "Choice B", "Choice C"],
      },
    ]);
  };

  const addParagraphQuestion = () => {
    setQuestions((prev) => [
      ...prev,
      {
        id: generateUniqueQuestionId(),
        type: "paragraph",
        text: "",
      },
    ]);
  };

  const removeQuestion = (index: number) => {
    setQuestions((prev) => prev.filter((_, idx) => idx !== index));
  };

  const updateQuestionText = (index: number, text: string) => {
    setQuestions((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], text };
      return copy;
    });
  };

  const updateOptionText = (qIndex: number, optIndex: number, val: string) => {
    setQuestions((prev) => {
      const copy = [...prev];
      const opts = [...(copy[qIndex].options || [])];
      opts[optIndex] = val;
      copy[qIndex] = { ...copy[qIndex], options: opts };
      return copy;
    });
  };

  const addOptionToQuestion = (qIndex: number) => {
    setQuestions((prev) => {
      const copy = [...prev];
      const opts = [...(copy[qIndex].options || []), `New Option ${(copy[qIndex].options?.length || 0) + 1}`];
      copy[qIndex] = { ...copy[qIndex], options: opts };
      return copy;
    });
  };

  const removeOptionFromQuestion = (qIndex: number, optIndex: number) => {
    setQuestions((prev) => {
      const copy = [...prev];
      const opts = (copy[qIndex].options || []).filter((_, i) => i !== optIndex);
      copy[qIndex] = { ...copy[qIndex], options: opts };
      return copy;
    });
  };

  const changeQuestionType = (qIndex: number, newType: Question["type"]) => {
    setQuestions((prev) => {
      const copy = [...prev];
      const current = copy[qIndex];
      const updated: Question = { ...current, type: newType };
      if ((newType === "multiple" || newType === "checkbox") && (!updated.options || updated.options.length === 0)) {
        updated.options = ["Option 1", "Option 2", "Option 3"];
      }
      if (newType === "rating") {
        updated.min = 1;
        updated.max = 5;
        updated.labels = ["1 (Poor)", "2 (Fair)", "3 (Average)", "4 (Good)", "5 (Excellent)"];
      }
      copy[qIndex] = updated;
      return copy;
    });
  };

  const MIN_QUESTIONS = 3;

  const handleSubmit = (actionStatus: "draft" | "pending" | "published" | "scheduled") => {
    // Only the administrator can publish directly; everyone else goes through approval.
    const finalStatus: "draft" | "pending" | "published" | "scheduled" =
      !isSuperadmin && (actionStatus === "published" || actionStatus === "scheduled")
        ? "pending"
        : actionStatus;

    const errors: string[] = [];
    if (!title.trim()) errors.push("Enter a survey title.");

    if (finalStatus !== "draft") {
      if (title.trim() && title.trim().length < 5) errors.push("The title must be at least 5 characters.");
      if (purpose.trim().length < 20) errors.push("Describe the purpose of the survey (at least 20 characters).");
      if (targetType === "custom" && selectedRoles.length === 0) {
        errors.push("Select at least one target role for the custom audience.");
      }

      if (scheduleType === "scheduled" && !openDate) errors.push("Set the opening date.");
      if (!closeDate) {
        errors.push("Set a closing date.");
      } else {
        const close = new Date(closeDate);
        if (isNaN(close.getTime()) || close.getTime() <= Date.now()) {
          errors.push("The closing date and time must be in the future.");
        }
        if (scheduleType === "scheduled" && openDate) {
          const open = new Date(openDate);
          if (!isNaN(open.getTime()) && close.getTime() < open.getTime()) {
            errors.push("The closing date must be after the opening date.");
          }
        }
      }

      if (questions.length < MIN_QUESTIONS) errors.push(`Add at least ${MIN_QUESTIONS} questions.`);
      questions.forEach((q, i) => {
        if (q.text.trim().length < 5) {
          errors.push(`Question ${i + 1}: enter the question text (at least 5 characters).`);
        }
        if (
          (q.type === "multiple" || q.type === "checkbox") &&
          (q.options || []).filter((o) => o.trim().length > 0).length < 2
        ) {
          errors.push(`Question ${i + 1}: provide at least 2 answer options.`);
        }
      });
    }

    setSubmitErrors(errors);
    if (errors.length > 0) {
      setTimeout(() => {
        document.getElementById("builder-errors")?.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 0);
      return;
    }

    const surveyPayload: Partial<Survey> = {
      ...(initialSurvey ? { id: initialSurvey.id } : {}),
      title: title.trim(),
      cat,
      desc: desc.trim() || "No description provided.",
      purpose: purpose.trim(),
      criteriaAcceptedAt: criteriaAcceptedAt ?? undefined,
      isTrending: initialSurvey?.isTrending ?? false,
      academicYear,
      questions: questions
        .filter((q) => q.text.trim().length > 0)
        .map((q) => ({
          ...q,
          id: q.id ? String(q.id) : generateUniqueQuestionId(),
        })),
      questionCount: questions.length,
      responses: initialSurvey?.responses ?? 0,
      created: initialSurvey?.created || new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
      openDate: scheduleType === "scheduled" ? openDate : (initialSurvey?.openDate || new Date().toISOString()),
      closeDate: closeDate || null,
      closes: closeDate ? new Date(closeDate).toLocaleDateString() : (initialSurvey?.closes || "Open"),
      owner: (initialSurvey?.owner || currentUser?.email || "faculty@school.edu.ph").trim().toLowerCase(),
      ownerName: initialSurvey?.ownerName || currentUser?.name || "Campus Instructor",
      targetAudience: {
        type: targetType,
        filters: targetType === "custom" ? { roles: selectedRoles } : undefined,
      },
      isRequired: isSuperadmin ? isRequired : (initialSurvey?.isRequired || false),
      requiredAudience: isSuperadmin ? requiredAudience : (initialSurvey?.requiredAudience || "students"),
      allowAnonymous,
      tags: [cat, academicYear],
      topicBlocks: topicBlocks.length > 0 ? topicBlocks : undefined,
    };

    onSaveSurvey(surveyPayload, finalStatus);
  };

  if (isRestricted) {
    return (
      <div className="max-w-lg mx-auto mt-12 bg-white rounded-3xl p-10 text-center border border-slate-200 shadow-xs space-y-4">
        <h3 className="font-serif text-lg font-bold text-slate-900">Survey creation is switched off for your account</h3>
        <p className="text-xs text-slate-600 leading-relaxed">
          {currentUser?.restrictionReason
            ? `Reason: ${currentUser.restrictionReason}`
            : "The administrator has switched off survey creation for your account."}
        </p>
        <p className="text-xs text-slate-500">Please contact the administrator if you think this is a mistake.</p>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl cursor-pointer"
          >
            Go back
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-12">
      {!isSuperadmin && !criteriaAcceptedAt && (
        <SurveyCriteriaModal
          onAccept={(ts) => setCriteriaAcceptedAt(ts)}
          onCancel={() => {
            if (onCancel) onCancel();
          }}
        />
      )}
      {/* Header */}
      <div className="bg-white p-6 sm:p-8 rounded-3xl border border-slate-200 shadow-xs space-y-2">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 text-blue-700 text-xs font-bold uppercase tracking-wider border border-blue-200">
            {isEditing ? <Pencil className="w-3.5 h-3.5" /> : <PlusCircle className="w-3.5 h-3.5" />}
            <span>{isEditing ? "Edit Survey Instrument" : "Interactive Survey Builder"}</span>
          </div>
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="px-3.5 py-1.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to Surveys</span>
            </button>
          )}
        </div>
        <h1 className="font-serif text-2xl sm:text-3xl font-extrabold text-slate-900">
          {isEditing ? `Edit: ${initialSurvey?.title}` : "Create New Survey"}
        </h1>
        <p className="text-xs sm:text-sm text-slate-500">
          {isEditing
            ? "Update your survey configuration, adjust questions and rating scales, or modify the target audience."
            : "Design your survey, then submit it for approval. Once it is approved and published it cannot be edited, only archived."}
        </p>
      </div>

      {initialSurvey?.status === "rejected" && (
        <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-xs text-rose-800 space-y-1">
          <p className="font-bold">This survey was rejected by the administrator.</p>
          <p>{initialSurvey.rejectionReason ? `Reason: ${initialSurvey.rejectionReason}` : "No reason was given."}</p>
          <p className="text-rose-700">Edit it and submit it again for approval.</p>
        </div>
      )}

      {/* Main Form Fields */}
      <div className="bg-white p-6 sm:p-8 rounded-3xl border border-slate-200 shadow-xs space-y-6">
        <h2 className="font-serif text-base font-bold text-slate-900 border-b border-slate-100 pb-3">
          1. Basic Information & Section Theming
        </h2>

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Survey Title *
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Midterm Course Evaluation – CS101 & IT102"
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-900 placeholder:text-slate-400 focus:outline-hidden focus:border-blue-500 focus:bg-white"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Category
              </label>
              <select
                value={cat}
                onChange={(e) => setCat(e.target.value)}
                className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-semibold text-slate-800"
              >
                {categories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Academic Year
              </label>
              <select
                value={academicYear}
                onChange={(e) => setAcademicYear(e.target.value)}
                className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-semibold text-slate-800"
              >
                <option value="2025-2026">AY 2025–2026 (Current)</option>
                <option value="2024-2025">AY 2024–2025</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Survey Description & Instructions
            </label>
            <textarea
              rows={3}
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              placeholder="Provide a clear description of what this survey aims to measure..."
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-800 placeholder:text-slate-400 focus:outline-hidden focus:border-blue-500 focus:bg-white"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Purpose of this survey <span className="normal-case font-medium text-slate-400">(required, reviewed by the admin)</span>
            </label>
            <textarea
              rows={2}
              maxLength={300}
              value={purpose}
              onChange={(e) => setPurpose(e.target.value)}
              placeholder="What will this survey help you improve or decide? (e.g. Find out if the new lab computers meet students' needs)"
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-800 placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-blue-200 focus:border-blue-400 resize-none"
            />
            <p className="text-[11px] text-slate-400 mt-1">{purpose.trim().length}/300 characters (at least 20)</p>
          </div>
        </div>

        {/* SECTION 2: Scheduling & Target Audience */}
        <h2 className="font-serif text-base font-bold text-slate-900 border-b border-slate-100 pb-3 pt-4">
          2. Target Audience & Scheduling
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Target Audience
            </label>
            <select
              value={targetType}
              onChange={(e) => setTargetType(e.target.value as any)}
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-semibold text-slate-800"
            >
              <option value="all">🌐 All Campus Stakeholders</option>
              <option value="students">🎓 Students & Student Officers Only</option>
              <option value="faculty">👨‍🏫 Faculty Members Only</option>
              <option value="officers">👔 Student Officers Only</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Publishing Schedule
            </label>
            <select
              value={scheduleType}
              onChange={(e) => setScheduleType(e.target.value as any)}
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-semibold text-slate-800"
            >
              <option value="immediate">🚀 Start immediately (once approved)</option>
              <option value="scheduled">📅 Schedule for Future Date</option>
            </select>
          </div>
        </div>

        {/* Who can see who answered */}
        <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
          <div>
            <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
              Can respondents answer anonymously?
            </span>
            <p className="text-[11px] text-slate-500 mt-0.5">Choose one. Respondents are told which applies before they submit.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <label
              className={`p-3 rounded-xl border cursor-pointer flex items-start gap-2.5 transition-all ${
                allowAnonymous
                  ? "bg-blue-50/90 border-blue-400 ring-1 ring-blue-300"
                  : "bg-white border-slate-200 hover:border-slate-300"
              }`}
            >
              <input
                type="radio"
                name="responseIdentity"
                checked={allowAnonymous}
                onChange={() => setAllowAnonymous(true)}
                className="mt-0.5 w-4 h-4 accent-blue-600 cursor-pointer"
              />
              <div>
                <div className="text-xs font-bold text-slate-800">Yes, respondents choose</div>
                <div className="text-[11px] text-slate-500 leading-snug mt-0.5">
                  Each person decides to answer anonymously or with their name. Anonymous answers never show a name or
                  email. Best for evaluating teachers and services.
                </div>
              </div>
            </label>
            <label
              className={`p-3 rounded-xl border cursor-pointer flex items-start gap-2.5 transition-all ${
                !allowAnonymous
                  ? "bg-indigo-50/90 border-indigo-400 ring-1 ring-indigo-300"
                  : "bg-white border-slate-200 hover:border-slate-300"
              }`}
            >
              <input
                type="radio"
                name="responseIdentity"
                checked={!allowAnonymous}
                onChange={() => setAllowAnonymous(false)}
                className="mt-0.5 w-4 h-4 accent-indigo-600 cursor-pointer"
              />
              <div>
                <div className="text-xs font-bold text-slate-800">No, names are required</div>
                <div className="text-[11px] text-slate-500 leading-snug mt-0.5">
                  Every response is saved with the respondent's name and email, and you and the administrator can see who
                  answered. Use this only when you really need to know, for example for clearance signing.
                </div>
              </div>
            </label>
          </div>
        </div>

        {/* Admin-Only: Priority & Mandatory Institutional Survey Configuration */}
        {isSuperadmin && (
          <div className="p-4 bg-amber-50/70 rounded-2xl border border-amber-200 space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded text-[10px] font-extrabold uppercase bg-amber-600 text-white tracking-wider">
                  Admin Oversight
                </span>
                <span className="text-xs font-bold text-amber-950">
                  Priority / Mandatory Institutional Survey
                </span>
              </div>
              <label className="inline-flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isRequired}
                  onChange={(e) => setIsRequired(e.target.checked)}
                  className="w-4 h-4 rounded text-amber-600 focus:ring-amber-500 border-amber-300 cursor-pointer"
                />
                <span className="text-xs font-bold text-amber-900">
                  Designate as Mandatory Priority Survey
                </span>
              </label>
            </div>

            {isRequired && (
              <div className="pt-2 border-t border-amber-200/80 space-y-2">
                <label className="block text-xs font-bold text-amber-900">
                  Specify Who is Required to Complete This:
                </label>
                <select
                  value={requiredAudience}
                  onChange={(e) => setRequiredAudience(e.target.value as any)}
                  className="w-full sm:w-80 px-3 py-1.5 bg-white border border-amber-300 rounded-xl text-xs font-bold text-amber-950 focus:outline-hidden"
                >
                  <option value="all">Mandatory for All Campus Stakeholders</option>
                  <option value="students">Mandatory for Students Only (Semester Clearance Requirement)</option>
                  <option value="faculty">Mandatory for Faculty Members Only</option>
                  <option value="officers">Mandatory for Student Officers Only</option>
                </select>
                <p className="text-[11px] text-amber-800 leading-relaxed">
                  ⚡ When marked as Mandatory, this survey will be prominently pinned at the top of the homepage for eligible users until they submit their response.
                </p>
              </div>
            )}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 bg-blue-50/50 rounded-2xl border border-blue-200/60">
          {scheduleType === "scheduled" ? (
            <div>
              <label className="block text-xs font-bold text-blue-900 mb-1">Opening date and time (required)</label>
              <input
                type="datetime-local"
                value={openDate}
                onChange={(e) => setOpenDate(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs"
              />
              <p className="text-[11px] text-blue-900/70 mt-1">The survey becomes available at this time, once approved.</p>
            </div>
          ) : (
            <div>
              <label className="block text-xs font-bold text-blue-900 mb-1">Opens</label>
              <div className="w-full px-3 py-2 bg-white/70 border border-slate-200 rounded-xl text-xs text-slate-600">
                As soon as the administrator approves it
              </div>
            </div>
          )}
          <div>
            <label className="block text-xs font-bold text-blue-900 mb-1">Closing date and time (required)</label>
            <input
              type="datetime-local"
              value={closeDate}
              onChange={(e) => setCloseDate(e.target.value)}
              className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs"
            />
            <p className="text-[11px] text-blue-900/70 mt-1">After this time the survey stops accepting responses and is archived.</p>
          </div>
        </div>

        {/* SECTION 3: Questions Builder */}
        <div className="pt-4 border-t border-slate-100 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-serif text-base font-bold text-slate-900">
                3. Survey Questions ({questions.length})
              </h2>
              <p className="text-xs text-slate-500">
                Define question prompts and customize scales below. Add new questions using the toolbar at the bottom.
              </p>
            </div>
            {questions.length > 0 && (
              <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                {questions.length} {questions.length === 1 ? "Question" : "Questions"}
              </span>
            )}
          </div>

          {/* Empty state when no questions yet */}
          {questions.length === 0 && (
            <div className="p-8 bg-slate-50 border border-dashed border-slate-300 rounded-2xl text-center space-y-2">
              <p className="text-sm font-semibold text-slate-700">No questions added yet</p>
              <p className="text-xs text-slate-500">Choose a question type from the toolbar below to start building your survey.</p>
            </div>
          )}

          {/* Questions Stack */}
          <div className="space-y-4">
            {questions.map((q, qIdx) => (
              <div key={qIdx} className="p-5 bg-slate-50/80 rounded-2xl border border-slate-200 space-y-3">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-md bg-blue-600 text-white text-xs font-bold flex items-center justify-center shrink-0">
                      {qIdx + 1}
                    </span>
                    {/* Inline Quick-Switch Pill Buttons for Question Types */}
                    <div className="flex items-center gap-1 bg-white p-0.5 rounded-lg border border-slate-200 shadow-2xs">
                      {[
                        { type: "rating", label: "Rating", icon: "⭐" },
                        { type: "multiple", label: "Multiple", icon: "🔘" },
                        { type: "checkbox", label: "Checkbox", icon: "☑️" },
                        { type: "paragraph", label: "Paragraph", icon: "📝" },
                      ].map((t) => (
                        <button
                          key={t.type}
                          type="button"
                          onClick={() => changeQuestionType(qIdx, t.type as any)}
                          className={`px-2 py-0.5 rounded-md text-[11px] font-bold transition-all cursor-pointer flex items-center gap-1 ${
                            q.type === t.type
                              ? "bg-blue-600 text-white shadow-xs"
                              : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                          }`}
                          title={`Switch to ${t.label}`}
                        >
                          <span>{t.icon}</span>
                          <span className="hidden sm:inline">{t.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeQuestion(qIdx)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 cursor-pointer transition-colors"
                    title="Delete question"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                <input
                  type="text"
                  value={q.text}
                  onChange={(e) => updateQuestionText(qIdx, e.target.value)}
                  placeholder="Enter the question text here..."
                  className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-xs sm:text-sm font-semibold text-slate-900 placeholder:text-slate-400 focus:outline-hidden focus:border-blue-500"
                />

                {/* Rating Scale configuration preview */}
                {q.type === "rating" && (
                  <div className="p-3 bg-white rounded-xl border border-slate-200 text-xs text-slate-600 space-y-1">
                    <span className="font-bold text-slate-700">Rating Scale Config:</span>
                    <div className="flex items-center gap-2 flex-wrap text-[11px] text-slate-500">
                      <span>Min: {q.min || 1}</span>
                      <span>•</span>
                      <span>Max: {q.max || 5}</span>
                      <span>•</span>
                      <span>Labels: {q.labels?.join(", ") || "1 (Poor) to 5 (Excellent)"}</span>
                    </div>
                  </div>
                )}

                {/* Multiple choice and Checkbox Options */}
                {(q.type === "multiple" || q.type === "checkbox") && (
                  <div className="space-y-2 pt-1">
                    {q.options?.map((opt, oIdx) => (
                      <div key={oIdx} className="flex items-center gap-2">
                        <input
                          type="text"
                          value={opt}
                          onChange={(e) => updateOptionText(qIdx, oIdx, e.target.value)}
                          className="flex-1 px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs"
                        />
                        <button
                          type="button"
                          onClick={() => removeOptionFromQuestion(qIdx, oIdx)}
                          className="p-1 text-slate-400 hover:text-rose-600"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={() => addOptionToQuestion(qIdx)}
                      className="text-xs font-bold text-blue-600 hover:text-blue-700 cursor-pointer"
                    >
                      + Add Option
                    </button>
                  </div>
                )}

                {q.type === "paragraph" && (
                  <p className="text-[11px] text-slate-400 italic">
                    Respondents get an open text box. Their comments are analyzed for sentiment (Tagalog, English and Taglish).
                  </p>
                )}
              </div>
            ))}
          </div>

          {/* Add Question at the Bottom Toolbar */}
          <div className="p-4 sm:p-5 bg-gradient-to-r from-slate-50 via-blue-50/20 to-indigo-50/20 rounded-2xl border-2 border-dashed border-slate-300 hover:border-blue-400 transition-all space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-lg bg-blue-600 text-white flex items-center justify-center font-bold text-xs shadow-xs">
                  +
                </div>
                <div>
                  <h3 className="text-xs font-bold text-slate-900">Add Next Question</h3>
                  <p className="text-[11px] text-slate-500">Append a new question without scrolling back to the top</p>
                </div>
              </div>
              <span className="text-[11px] font-semibold text-slate-400">
                Item #{questions.length + 1}
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-1">
              <button
                type="button"
                onClick={addRatingQuestion}
                className="px-3 py-2.5 bg-white hover:bg-blue-50 hover:border-blue-300 text-blue-700 text-xs font-bold rounded-xl border border-slate-200 transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-xs active:scale-98"
              >
                <Star className="w-4 h-4 text-amber-500 fill-amber-400 shrink-0" />
                <span>+ Rating Scale</span>
              </button>

              <button
                type="button"
                onClick={addMultipleChoiceQuestion}
                className="px-3 py-2.5 bg-white hover:bg-indigo-50 hover:border-indigo-300 text-indigo-700 text-xs font-bold rounded-xl border border-slate-200 transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-xs active:scale-98"
              >
                <ListFilter className="w-4 h-4 text-indigo-600 shrink-0" />
                <span>+ Multi-Choice</span>
              </button>

              <button
                type="button"
                onClick={addCheckboxQuestion}
                className="px-3 py-2.5 bg-white hover:bg-emerald-50 hover:border-emerald-300 text-emerald-700 text-xs font-bold rounded-xl border border-slate-200 transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-xs active:scale-98"
              >
                <CheckSquare className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>+ Checkbox</span>
              </button>

              <button
                type="button"
                onClick={addParagraphQuestion}
                className="px-3 py-2.5 bg-white hover:bg-slate-100 hover:border-slate-300 text-slate-700 text-xs font-bold rounded-xl border border-slate-200 transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-xs active:scale-98"
              >
                <AlignLeft className="w-4 h-4 text-slate-600 shrink-0" />
                <span>+ Paragraph</span>
              </button>
            </div>
          </div>
        </div>

        {submitErrors.length > 0 && (
          <div id="builder-errors" className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-xs text-rose-800 space-y-1.5">
            <p className="font-bold">Please fix the following before continuing:</p>
            <ul className="list-disc pl-5 space-y-0.5">
              {submitErrors.map((e, i) => (
                <li key={i}>{e}</li>
              ))}
            </ul>
          </div>
        )}
        {!isSuperadmin && (
          <p className="text-[11px] text-slate-500">
            Your survey will be reviewed by the administrator before students can see it. You can save it as a draft and
            come back later.
          </p>
        )}

        {/* Action Controls */}
        <div className="pt-6 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
          {onCancel ? (
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl cursor-pointer"
            >
              Cancel
            </button>
          ) : (
            <div />
          )}

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => handleSubmit("draft")}
              className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl cursor-pointer"
            >
              💾 Save as Draft
            </button>
            <button
              type="button"
              onClick={() => handleSubmit(isSuperadmin ? (scheduleType === "scheduled" ? "scheduled" : "published") : "pending")}
              className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-md shadow-blue-500/20 cursor-pointer flex items-center gap-2"
            >
              <span>
                {!isSuperadmin
                  ? initialSurvey?.status === "rejected"
                    ? "📨 Resubmit for Approval"
                    : "📨 Submit for Approval"
                  : isEditing
                  ? "Save Changes"
                  : scheduleType === "scheduled"
                  ? "📅 Schedule Survey"
                  : "🚀 Publish Survey Now"}
              </span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
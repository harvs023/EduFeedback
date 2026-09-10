import React, { useState } from "react";
import { Survey, Question, UserProfile, TargetAudience } from "../types";
import { DEPARTMENTS_DATA } from "../data/initialData";
import {
  PlusCircle,
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
} from "lucide-react";

interface SurveyBuilderProps {
  currentUser: UserProfile | null;
  categories: string[];
  onSaveSurvey: (surveyData: Partial<Survey>, status: "draft" | "published" | "scheduled") => void;
}

export const SurveyBuilder: React.FC<SurveyBuilderProps> = ({
  currentUser,
  categories,
  onSaveSurvey,
}) => {
  const [title, setTitle] = useState<string>("");
  const [cat, setCat] = useState<string>(categories[0] || "Course");
  const [desc, setDesc] = useState<string>("");
  const [themeSection, setThemeSection] = useState<Survey["themeSection"]>("academics");
  const [academicYear, setAcademicYear] = useState<string>("2025-2026");

  // Scheduling
  const [scheduleType, setScheduleType] = useState<"immediate" | "scheduled">("immediate");
  const [openDate, setOpenDate] = useState<string>("");
  const [closeDate, setCloseDate] = useState<string>("");

  // Target audience
  const [targetType, setTargetType] = useState<TargetAudience["type"]>("all");
  const [selectedRoles, setSelectedRoles] = useState<string[]>(["students", "faculty", "officers"]);

  // Questions builder list
  const [questions, setQuestions] = useState<Question[]>([
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
  ]);

  const addRatingQuestion = () => {
    setQuestions((prev) => [
      ...prev,
      {
        id: `q_${Date.now()}`,
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
        id: `q_${Date.now()}`,
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
        id: `q_${Date.now()}`,
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
        id: `q_${Date.now()}`,
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

  const handleSubmit = (actionStatus: "draft" | "published" | "scheduled") => {
    if (!title.trim()) {
      alert("Please enter a survey title.");
      return;
    }
    if (questions.length === 0) {
      alert("Please add at least one survey question.");
      return;
    }

    const surveyPayload: Partial<Survey> = {
      title: title.trim(),
      cat,
      desc: desc.trim() || "No description provided.",
      themeSection,
      isTrending: false, // Determined automatically based on respondent velocity
      academicYear,
      questions: questions.filter((q) => q.text.trim().length > 0),
      questionCount: questions.length,
      responses: 0,
      created: new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
      openDate: scheduleType === "scheduled" ? openDate : new Date().toISOString(),
      closeDate: closeDate || null,
      closes: closeDate ? new Date(closeDate).toLocaleDateString() : "Open",
      owner: currentUser?.email || "anonymous@school.edu",
      ownerName: currentUser?.name || "Anonymous Member",
      targetAudience: {
        type: targetType,
        filters: targetType === "custom" ? { roles: selectedRoles } : undefined,
      },
      tags: [cat, themeSection || "General", academicYear],
    };

    onSaveSurvey(surveyPayload, actionStatus);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-12">
      {/* Header */}
      <div className="bg-white p-6 sm:p-8 rounded-3xl border border-slate-200 shadow-xs space-y-2">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 text-blue-700 text-xs font-bold uppercase tracking-wider border border-blue-200">
          <PlusCircle className="w-3.5 h-3.5" />
          <span>Interactive Survey Builder</span>
        </div>
        <h1 className="font-serif text-2xl sm:text-3xl font-extrabold text-slate-900">
          Create New Themed Survey
        </h1>
        <p className="text-xs sm:text-sm text-slate-500">
          Design structured feedback surveys, customize rating scales, select target audiences, and assign theme sections.
        </p>
      </div>

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
                Thematic Domain
              </label>
              <select
                value={themeSection}
                onChange={(e) => setThemeSection(e.target.value as any)}
                className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-semibold text-slate-800 focus:outline-hidden focus:border-blue-500 focus:bg-white"
              >
                <option value="academics">📚 Academic & Course Evaluation</option>
                <option value="facilities">🏫 Campus Facilities & Technology</option>
                <option value="student-life">💡 Student Services & Welfare</option>
                <option value="governance">🏛️ Institutional Governance & Policy</option>
              </select>
              <p className="text-[11px] text-slate-400 mt-1">
                Note: "Trending" (high respondent influx) and "Top Rated" (4.5+ rating) are dynamic performance badges awarded automatically by participant activity.
              </p>
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
              <option value="immediate">🚀 Publish Immediately</option>
              <option value="scheduled">📅 Schedule for Future Date</option>
            </select>
          </div>
        </div>

        {scheduleType === "scheduled" && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 bg-blue-50/50 rounded-2xl border border-blue-200/60">
            <div>
              <label className="block text-xs font-bold text-blue-900 mb-1">Open Date (Starts at)</label>
              <input
                type="datetime-local"
                value={openDate}
                onChange={(e) => setOpenDate(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-blue-900 mb-1">Close Date (Ends at)</label>
              <input
                type="datetime-local"
                value={closeDate}
                onChange={(e) => setCloseDate(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs"
              />
            </div>
          </div>
        )}

        {/* SECTION 3: Questions Builder */}
        <div className="pt-4 border-t border-slate-100 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-serif text-base font-bold text-slate-900">
              3. Survey Questions ({questions.length})
            </h2>

            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={addRatingQuestion}
                className="px-2.5 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-bold rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
              >
                <Star className="w-3.5 h-3.5" />
                <span>+ Rating</span>
              </button>
              <button
                type="button"
                onClick={addMultipleChoiceQuestion}
                className="px-2.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
              >
                <ListFilter className="w-3.5 h-3.5" />
                <span>+ Multi-Choice</span>
              </button>
              <button
                type="button"
                onClick={addCheckboxQuestion}
                className="px-2.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-bold rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
              >
                <CheckSquare className="w-3.5 h-3.5" />
                <span>+ Checkbox</span>
              </button>
              <button
                type="button"
                onClick={addParagraphQuestion}
                className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
              >
                <AlignLeft className="w-3.5 h-3.5" />
                <span>+ Tagalog/Text</span>
              </button>
            </div>
          </div>

          {/* Questions Stack */}
          <div className="space-y-4">
            {questions.map((q, qIdx) => (
              <div key={qIdx} className="p-5 bg-slate-50/80 rounded-2xl border border-slate-200 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-md bg-blue-600 text-white text-xs font-bold flex items-center justify-center">
                      {qIdx + 1}
                    </span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-extrabold uppercase tracking-wider bg-white border border-slate-200 text-slate-600">
                      {q.type}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeQuestion(qIdx)}
                    className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50 cursor-pointer"
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
                    Respondents will be provided with an open multiline textarea with Tagalog & Taglish NLP detection.
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Action Controls */}
        <div className="pt-6 border-t border-slate-100 flex flex-wrap items-center justify-end gap-3">
          <button
            type="button"
            onClick={() => handleSubmit("draft")}
            className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl cursor-pointer"
          >
            💾 Save as Draft
          </button>
          <button
            type="button"
            onClick={() => handleSubmit(scheduleType === "scheduled" ? "scheduled" : "published")}
            className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-md shadow-blue-500/20 cursor-pointer flex items-center gap-2"
          >
            <span>{scheduleType === "scheduled" ? "📅 Schedule Survey" : "🚀 Publish Survey Now"}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

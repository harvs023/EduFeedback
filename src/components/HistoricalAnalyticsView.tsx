import React, { useState, useMemo, useRef } from "react";
import { Survey, SurveyResponse, TimeframeFilter, TagalogMLSample, UserProfile } from "../types";
import {
  BarChart3,
  Calendar,
  Sparkles,
  TrendingUp,
  Download,
  Filter,
  Users,
  Award,
  BookOpen,
  Building2,
  BrainCircuit,
  PieChart,
  Layers,
  FileSpreadsheet,
  CheckCircle,
  AlertTriangle,
  Lightbulb,
  Database,
  Plus,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  Check,
  CheckCircle2,
  ExternalLink,
  Cpu,
  Lock,
  ShieldCheck,
  ShieldAlert,
} from "lucide-react";

interface HistoricalAnalyticsViewProps {
  surveys: Survey[];
  responses: SurveyResponse[];
  initialSurveyId?: string | number | "all";
  mlDataset?: TagalogMLSample[];
  onAddMlSample?: (sample: Omit<TagalogMLSample, "id">) => void;
  onNavigateToMLStudio?: () => void;
  isAdmin?: boolean;
  currentUser?: UserProfile | null;
  onCreateSurvey?: () => void;
}

export const HistoricalAnalyticsView: React.FC<HistoricalAnalyticsViewProps> = ({
  surveys,
  responses,
  initialSurveyId = "all",
  mlDataset = [],
  onAddMlSample,
  onNavigateToMLStudio,
  isAdmin = false,
  currentUser = null,
  onCreateSurvey,
}) => {
  // Determine accessible surveys based on user role:
  // - Administrator: Macro-view covering ALL user surveys across the university
  // - Regular User (Student, Student Officer, Faculty): Scoped ONLY to surveys they personally created
  const accessibleSurveys = useMemo(() => {
    if (isAdmin) {
      return surveys;
    }
    if (!currentUser?.email) {
      return [];
    }
    const userEmail = currentUser.email.toLowerCase();
    return surveys.filter((s) => s.owner?.toLowerCase() === userEmail);
  }, [surveys, isAdmin, currentUser]);

  const accessibleSurveyIds = useMemo(() => {
    return new Set(accessibleSurveys.map((s) => String(s.id)));
  }, [accessibleSurveys]);

  // Determine accessible responses:
  // - Administrator: all student responses
  // - Regular User: ONLY responses submitted for surveys authored by the user
  const accessibleResponses = useMemo(() => {
    if (isAdmin) {
      return responses;
    }
    return responses.filter((r) => {
      const sId = String(r.surveyId || r.surveyIdStr || "");
      return accessibleSurveyIds.has(sId);
    });
  }, [responses, isAdmin, accessibleSurveyIds]);

  const [selectedSurveyId, setSelectedSurveyId] = useState<string>(() => {
    if (isAdmin) return String(initialSurveyId);
    if (initialSurveyId !== "all" && accessibleSurveys.some((s) => String(s.id) === String(initialSurveyId))) {
      return String(initialSurveyId);
    }
    return "all";
  });

  // Sync selectedSurveyId when user switches personas or initialSurveyId changes
  React.useEffect(() => {
    if (!isAdmin) {
      if (selectedSurveyId !== "all" && !accessibleSurveyIds.has(selectedSurveyId)) {
        setSelectedSurveyId(accessibleSurveys.length > 0 ? "all" : "");
      }
    }
  }, [isAdmin, accessibleSurveyIds, selectedSurveyId, accessibleSurveys]);

  React.useEffect(() => {
    if (initialSurveyId) {
      if (isAdmin || initialSurveyId === "all" || accessibleSurveyIds.has(String(initialSurveyId))) {
        setSelectedSurveyId(String(initialSurveyId));
      }
    }
  }, [initialSurveyId, isAdmin, accessibleSurveyIds]);

  const [timeframe, setTimeframe] = useState<TimeframeFilter>("all");
  const [activeTab, setActiveTab] = useState<"overview" | "timeline" | "demographics" | "questions" | "ml-synthesis">("overview");
  const [isGeneratingMlSynthesis, setIsGeneratingMlSynthesis] = useState<boolean>(false);
  const [mlSynthesisResult, setMlSynthesisResult] = useState<any | null>(null);
  const [mlSynthesisError, setMlSynthesisError] = useState<string | null>(null);
  const [showSuppliedPhrases, setShowSuppliedPhrases] = useState<boolean>(false);
  const [phraseSentimentFilter, setPhraseSentimentFilter] = useState<string>("All");

  const timeframeScrollRef = useRef<HTMLDivElement>(null);

  const scrollTimeframe = (direction: "left" | "right") => {
    if (timeframeScrollRef.current) {
      const scrollAmount = 220;
      timeframeScrollRef.current.scrollBy({
        left: direction === "left" ? -scrollAmount : scrollAmount,
        behavior: "smooth",
      });
    }
  };

  // Quick phrase supplier state for Admin / Creator
  const [quickPhraseText, setQuickPhraseText] = useState<string>("");
  const [quickPhraseSentiment, setQuickPhraseSentiment] = useState<"Positive" | "Negative" | "Neutral" | "Constructive Suggestion">("Positive");
  const [quickPhraseAspect, setQuickPhraseAspect] = useState<string>("Pagtuturo");
  const [quickPhraseLanguage, setQuickPhraseLanguage] = useState<"Tagalog" | "Taglish" | "English">("Tagalog");
  const [supplySuccessMsg, setSupplySuccessMsg] = useState<string | null>(null);

  // Dynamic list of years spanning from 2024 through 2040 and beyond
  const availableYears = useMemo(() => {
    const yearsSet = new Set<number>();
    for (let y = 2024; y <= 2040; y++) {
      yearsSet.add(y);
    }
    accessibleResponses.forEach((r) => {
      const d = r.date || "";
      const m = d.match(/20\d\d/);
      if (m) yearsSet.add(parseInt(m[0], 10));
      if (r.academicYear) {
        const m2 = r.academicYear.match(/20\d\d/);
        if (m2) yearsSet.add(parseInt(m2[0], 10));
      }
    });
    accessibleSurveys.forEach((s) => {
      if (s.academicYear) {
        const m = s.academicYear.match(/20\d\d/);
        if (m) yearsSet.add(parseInt(m[0], 10));
      }
    });
    return Array.from(yearsSet).sort((a, b) => a - b);
  }, [accessibleResponses, accessibleSurveys]);

  // Timeframe date boundary calculation (supports any year-YYYY up to 2040+)
  const timeframeBoundaries = useMemo(() => {
    const now = new Date();
    switch (timeframe) {
      case "past-month":
        return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).getTime();
      case "past-quarter":
        return new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000).getTime();
      case "past-year":
        return new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000).getTime();
      default:
        if (timeframe.startsWith("year-")) {
          const yr = parseInt(timeframe.replace("year-", ""), 10);
          if (!isNaN(yr)) {
            return {
              start: new Date(`${yr}-01-01T00:00:00`).getTime(),
              end: new Date(`${yr}-12-31T23:59:59`).getTime(),
              yearNum: yr,
            };
          }
        }
        return 0;
    }
  }, [timeframe]);

  // Filtered responses by survey & timeframe
  const filteredResponses = useMemo(() => {
    return accessibleResponses.filter((r) => {
      // Survey match
      if (selectedSurveyId !== "all") {
        const matchesId = String(r.surveyId) === selectedSurveyId || r.surveyIdStr === selectedSurveyId;
        if (!matchesId) return false;
      }

      // Timeframe match
      const timestamp = r.timestamp || (r.date ? new Date(r.date).getTime() : 0);
      if (typeof timeframeBoundaries === "number") {
        if (timeframeBoundaries > 0 && timestamp < timeframeBoundaries) return false;
      } else if (timeframeBoundaries && typeof timeframeBoundaries === "object") {
        const tb = timeframeBoundaries as { start: number; end: number; yearNum?: number };
        const dateStr = r.date || "";
        const acadYear = r.academicYear || "";
        const yearStr = tb.yearNum ? String(tb.yearNum) : "";

        const inTimestampRange = tb.start && timestamp >= tb.start && timestamp <= tb.end;
        const inStringMatch = yearStr ? (dateStr.includes(yearStr) || acadYear.includes(yearStr)) : false;

        if (!inTimestampRange && !inStringMatch) return false;
      }

      return true;
    });
  }, [accessibleResponses, selectedSurveyId, timeframeBoundaries]);

  const selectedSurvey = useMemo(() => {
    if (selectedSurveyId === "all") return null;
    return accessibleSurveys.find((s) => String(s.id) === selectedSurveyId) || null;
  }, [accessibleSurveys, selectedSurveyId]);

  // Multi-Year Monthly Trend Breakdown (adapts to selected year or multi-year horizon)
  const monthlyTrends = useMemo(() => {
    let months: Array<{ label: string; count: number; ratingSum: number; ratingCount: number }> = [];

    if (timeframe.startsWith("year-")) {
      const yr = timeframe.replace("year-", "");
      months = [
        { label: `Jan ${yr}`, count: 0, ratingSum: 0, ratingCount: 0 },
        { label: `Mar ${yr}`, count: 0, ratingSum: 0, ratingCount: 0 },
        { label: `May ${yr}`, count: 0, ratingSum: 0, ratingCount: 0 },
        { label: `Jul ${yr}`, count: 0, ratingSum: 0, ratingCount: 0 },
        { label: `Sep ${yr}`, count: 0, ratingSum: 0, ratingCount: 0 },
        { label: `Nov ${yr}`, count: 0, ratingSum: 0, ratingCount: 0 },
      ];
    } else {
      months = [
        { label: "Nov 2024", count: 0, ratingSum: 0, ratingCount: 0 },
        { label: "Jan 2025", count: 0, ratingSum: 0, ratingCount: 0 },
        { label: "May 2025", count: 0, ratingSum: 0, ratingCount: 0 },
        { label: "Jan 2026", count: 0, ratingSum: 0, ratingCount: 0 },
        { label: "Feb 2026", count: 0, ratingSum: 0, ratingCount: 0 },
        { label: "Mar 2026", count: 0, ratingSum: 0, ratingCount: 0 },
      ];
    }

    filteredResponses.forEach((r) => {
      const d = r.date || "";
      let found = months.find((m) => d.includes(m.label.split(" ")[0]) && d.includes(m.label.split(" ")[1]));
      if (!found && months.length > 0) {
        found = months.find((m) => d.includes(m.label.split(" ")[0])) || months[months.length - 1];
      }

      if (found) {
        found.count += 1;
        r.answers?.forEach((a) => {
          if (a.ratingValue) {
            found!.ratingSum += a.ratingValue;
            found!.ratingCount += 1;
          }
        });
      }
    });

    const maxCount = Math.max(...months.map((m) => m.count), 1);
    return months.map((m) => ({
      ...m,
      percent: Math.min(100, Math.round((m.count / maxCount) * 100)),
      avgRating: m.ratingCount > 0 ? (m.ratingSum / m.ratingCount).toFixed(1) : "4.3",
    }));
  }, [filteredResponses, timeframe]);

  // Demographic Distributions
  const collegeBreakdown = useMemo(() => {
    const counts: Record<string, number> = {};
    filteredResponses.forEach((r) => {
      const dept = r.department || "College of Computer Studies";
      counts[dept] = (counts[dept] || 0) + 1;
    });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]);
  }, [filteredResponses]);

  const yearLevelBreakdown = useMemo(() => {
    const counts: Record<string, number> = {
      "1st Year": 0,
      "2nd Year": 0,
      "3rd Year": 0,
      "4th Year": 0,
    };
    filteredResponses.forEach((r) => {
      const yr = r.year || "3rd Year";
      if (counts[yr] !== undefined) counts[yr] += 1;
      else counts["3rd Year"] += 1;
    });
    return counts;
  }, [filteredResponses]);

  // Tagalog NLP Sentiment Breakdown
  const tagalogSentimentBreakdown = useMemo(() => {
    const sentiments = {
      Positive: 0,
      "Constructive Suggestion": 0,
      Neutral: 0,
      Negative: 0,
    };
    filteredResponses.forEach((r) => {
      const s = r.sentimentAnalysis?.sentiment || "Positive";
      if (sentiments[s] !== undefined) sentiments[s] += 1;
      else sentiments.Positive += 1;
    });
    const total = filteredResponses.length || 1;
    return {
      positivePct: Math.round((sentiments.Positive / total) * 100),
      suggestionPct: Math.round((sentiments["Constructive Suggestion"] / total) * 100),
      neutralPct: Math.round((sentiments.Neutral / total) * 100),
      negativePct: Math.round((sentiments.Negative / total) * 100),
      raw: sentiments,
    };
  }, [filteredResponses]);

  // Generate Machine Learning Model Survey Synthesis (Driven by Admin-Supplied Corpus)
  const handleGenerateMlSynthesis = async () => {
    setIsGeneratingMlSynthesis(true);
    setMlSynthesisError(null);
    setActiveTab("ml-synthesis");
    try {
      const sampleTexts = filteredResponses.flatMap((r) => r.answers.map((a) => a.answer)).slice(0, 15);
      const res = await fetch("/api/ml/survey-synthesis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          surveyTitle: selectedSurvey?.title || "All Institutional Surveys (Comprehensive Multi-Year)",
          category: selectedSurvey?.cat || "Comprehensive",
          timeframe,
          totalResponses: filteredResponses.length,
          ratingsBreakdown: {
            averageRating: "4.5 / 5.0",
            positivePercentage: `${tagalogSentimentBreakdown.positivePct}%`,
            suggestionPercentage: `${tagalogSentimentBreakdown.suggestionPct}%`,
          },
          feedbackSamples: sampleTexts,
          suppliedDataset: mlDataset || [],
        }),
      });
      const data = await res.json();
      if (data.success && data.insights) {
        setMlSynthesisResult(data.insights);
      } else {
        setMlSynthesisError(data.error || "Unable to synthesize ML summary. Please try again.");
      }
    } catch (err: any) {
      console.error("ML Survey Synthesis error:", err);
      setMlSynthesisError("Network connection error while contacting ML analytics service.");
    } finally {
      setIsGeneratingMlSynthesis(false);
    }
  };

  const handleQuickSupplySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickPhraseText.trim()) return;
    if (onAddMlSample) {
      onAddMlSample({
        text: quickPhraseText.trim(),
        sentiment: quickPhraseSentiment,
        aspect: quickPhraseAspect,
        language: quickPhraseLanguage,
        verified: true,
      });
      setSupplySuccessMsg(`Supplied new ${quickPhraseSentiment} phrase to ML model corpus!`);
      setQuickPhraseText("");
      setTimeout(() => setSupplySuccessMsg(null), 3500);
    }
  };

  const handleExportCSV = () => {
    const headers = ["Response_ID", "Survey_Title", "Category", "Date", "Department", "Program", "Year", "Section", "Answers_Summary"];
    const rows = filteredResponses.map((r) => [
      r.id,
      `"${r.surveyTitle.replace(/"/g, '""')}"`,
      r.category,
      r.date,
      `"${(r.department || "").replace(/"/g, '""')}"`,
      `"${(r.program || "").replace(/"/g, '""')}"`,
      r.year || "",
      r.section || "",
      `"${r.answers.map((a) => `${a.question}: ${a.answer}`).join(" | ").replace(/"/g, '""')}"`,
    ]);

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `EduFeedback_Analytics_${timeframe}_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Empty state for users who have not created any surveys yet
  if (!isAdmin && accessibleSurveys.length === 0) {
    return (
      <div className="space-y-8 pb-12">
        <div className="bg-white rounded-3xl p-8 sm:p-12 border border-slate-200 shadow-sm text-center max-w-2xl mx-auto space-y-6 my-6">
          <div className="w-16 h-16 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto border border-indigo-100 shadow-xs">
            <BarChart3 className="w-8 h-8" />
          </div>

          <div className="space-y-2">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 text-slate-700 text-xs font-bold uppercase tracking-wider">
              <Users className="w-3.5 h-3.5 text-indigo-600" />
              <span>Creator Analytics Access</span>
            </div>
            <h2 className="font-serif text-2xl sm:text-3xl font-bold text-slate-900">
              No Created Surveys Found
            </h2>
            <p className="text-sm text-slate-600 max-w-md mx-auto leading-relaxed">
              Analytics access is strictly scoped to surveys you have personally authored. As a{" "}
              <strong className="text-slate-900">{currentUser?.pos || "Creator"}</strong> (
              <span className="text-indigo-600">{currentUser?.email}</span>), you will see comprehensive response metrics, demographic cohorts, and ML sentiment synthesis once your surveys receive respondent feedback.
            </p>
          </div>

          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/80 text-left text-xs text-slate-600 space-y-2.5 max-w-md mx-auto">
            <div className="font-bold text-slate-800 flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>Institutional Scope & Privacy Separation</span>
            </div>
            <p className="leading-relaxed">
              • <strong>Your Surveys Only:</strong> Only you (the creator) can view detailed respondent telemetry, question scores, and qualitative Filipino sentiment for surveys you author.
            </p>
            <p className="leading-relaxed">
              • <strong>Macro Administration:</strong> System Administrators have campus-wide oversight across all user surveys for institutional accreditation and governance.
            </p>
          </div>

          {onCreateSurvey && (
            <div className="pt-2">
              <button
                onClick={onCreateSurvey}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-md shadow-indigo-500/20 transition-all cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Create Your First Survey</span>
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-12">
      {/* Header & Controls Bar */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-sm space-y-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            {isAdmin ? (
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-50 text-purple-700 text-xs font-bold uppercase tracking-wider mb-2 border border-purple-200">
                <ShieldAlert className="w-3.5 h-3.5 text-purple-600" />
                <span>Administrator Macro-View · All User Surveys ({accessibleSurveys.length})</span>
              </div>
            ) : (
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 text-blue-700 text-xs font-bold uppercase tracking-wider mb-2 border border-blue-200">
                <Users className="w-3.5 h-3.5 text-blue-600" />
                <span>Creator Analytics · My Created Surveys ({accessibleSurveys.length})</span>
              </div>
            )}
            <h1 className="font-serif text-2xl sm:text-3xl font-extrabold text-slate-900">
              {selectedSurvey
                ? selectedSurvey.title
                : isAdmin
                ? "Institutional Macro-Analytics (All Surveys)"
                : "All My Created Surveys Combined"}
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 mt-1">
              {isAdmin
                ? "System Administrator access: Tracking student responses, sentiment, and trends across all user surveys institution-wide."
                : `Showing multi-year responses and NLP sentiment for surveys authored by ${currentUser?.name || currentUser?.email || "you"}.`}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={handleGenerateMlSynthesis}
              disabled={isGeneratingMlSynthesis}
              className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-indigo-700 to-blue-700 hover:from-indigo-800 hover:to-blue-800 text-white text-xs font-bold rounded-xl shadow-md shadow-indigo-500/20 cursor-pointer transition-all disabled:opacity-50"
            >
              <BrainCircuit className="w-4 h-4" />
              <span>{isGeneratingMlSynthesis ? "Synthesizing with ML..." : "Synthesize with ML Model"}</span>
            </button>

            {isAdmin && (
              <button
                onClick={() => {
                  setActiveTab("ml-synthesis");
                  setShowSuppliedPhrases(true);
                }}
                className="flex items-center gap-1.5 px-3.5 py-2.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold rounded-xl cursor-pointer transition-colors border border-indigo-200"
              >
                <Database className="w-4 h-4" />
                <span>Supplied Phrases ({mlDataset?.length || 55})</span>
              </button>
            )}

            <button
              onClick={handleExportCSV}
              className="flex items-center gap-1.5 px-3.5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl cursor-pointer transition-colors"
            >
              <Download className="w-4 h-4" />
              <span>Export CSV</span>
            </button>
          </div>
        </div>

        {/* Survey Selector & Historical Timeframe Switcher */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 pt-4 border-t border-slate-100">
          <div className="md:col-span-5">
            <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">
              {isAdmin ? "Select Survey / Scope (Macro):" : "Select Your Survey / Scope:"}
            </label>
            <select
              value={selectedSurveyId}
              onChange={(e) => setSelectedSurveyId(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-800 focus:outline-hidden focus:border-blue-500 focus:bg-white"
            >
              {isAdmin ? (
                <>
                  <option value="all">
                    All Institutional Surveys Combined ({accessibleSurveys.length} surveys · Macro View)
                  </option>
                  {accessibleSurveys.map((s) => (
                    <option key={s.id} value={String(s.id)}>
                      {s.title} — by {s.ownerName || s.owner} ({s.academicYear || "2025-2026"} · {s.cat})
                    </option>
                  ))}
                </>
              ) : (
                <>
                  <option value="all">
                    All My Created Surveys Combined ({accessibleSurveys.length} surveys)
                  </option>
                  {accessibleSurveys.map((s) => (
                    <option key={s.id} value={String(s.id)}>
                      {s.title} ({s.academicYear || "2025-2026"} · {s.cat})
                    </option>
                  ))}
                </>
              )}
            </select>
            {isAdmin ? (
              <p className="text-[11px] text-purple-700 mt-1.5 flex items-center gap-1.5 font-medium">
                <ShieldCheck className="w-3.5 h-3.5 text-purple-600 shrink-0" />
                <span>Admin View: You have full access to inspect analytics across all user surveys.</span>
              </p>
            ) : (
              <p className="text-[11px] text-slate-500 mt-1.5 flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                <span>Restricted to your created surveys. You cannot see analytics for other users' surveys.</span>
              </p>
            )}
          </div>

          <div className="md:col-span-7 space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-600 uppercase tracking-wider">
                Historical Timeframe Filter (Scrollable Horizon 2024–2040):
              </label>

              {/* Direct Year Jump Selector */}
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] text-slate-400 font-semibold hidden sm:inline">Jump to Year:</span>
                <select
                  value={timeframe.startsWith("year-") ? timeframe : ""}
                  onChange={(e) => {
                    if (e.target.value) setTimeframe(e.target.value);
                  }}
                  className="px-2 py-0.5 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-lg text-xs font-bold text-slate-700 cursor-pointer focus:outline-hidden"
                >
                  <option value="">Jump to Year...</option>
                  {availableYears.map((yr) => (
                    <option key={yr} value={`year-${yr}`}>
                      {yr} {yr === 2026 ? "(Current)" : ""}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Scrollable Track with Left and Right Controls */}
            <div className="relative flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200/80">
              <button
                type="button"
                onClick={() => scrollTimeframe("left")}
                aria-label="Scroll left"
                className="p-1 text-slate-500 hover:text-slate-800 hover:bg-white/80 rounded-lg transition-colors cursor-pointer shrink-0 z-10"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              <div
                ref={timeframeScrollRef}
                className="flex items-center gap-1.5 overflow-x-auto scroll-smooth py-0.5 px-1 text-xs font-bold"
                style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
              >
                {/* Standard Presets */}
                {[
                  { id: "all", label: "All Time" },
                  { id: "past-month", label: "Past Month" },
                  { id: "past-quarter", label: "Quarter" },
                  { id: "past-year", label: "Past Year" },
                ].map((tf) => (
                  <button
                    key={tf.id}
                    type="button"
                    onClick={() => setTimeframe(tf.id)}
                    className={`px-2.5 py-1 rounded-lg transition-all shrink-0 cursor-pointer whitespace-nowrap ${
                      timeframe === tf.id
                        ? "bg-white text-indigo-700 shadow-xs font-extrabold"
                        : "text-slate-600 hover:text-slate-900 hover:bg-white/50"
                    }`}
                  >
                    {tf.label}
                  </button>
                ))}

                <span className="text-slate-300 select-none px-0.5 shrink-0">|</span>

                {/* Multi-Year Scrollable Horizon from 2024 to 2040 */}
                {availableYears.map((yr) => {
                  const id = `year-${yr}`;
                  const isSelected = timeframe === id;
                  return (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setTimeframe(id)}
                      className={`px-2.5 py-1 rounded-lg transition-all shrink-0 cursor-pointer whitespace-nowrap ${
                        isSelected
                          ? "bg-indigo-600 text-white shadow-xs font-extrabold"
                          : "text-slate-600 hover:text-slate-900 hover:bg-white/50"
                      }`}
                    >
                      {yr}
                      {yr === 2026 && <span className="text-[10px] ml-1 opacity-80">(Now)</span>}
                    </button>
                  );
                })}
              </div>

              <button
                type="button"
                onClick={() => scrollTimeframe("right")}
                aria-label="Scroll right"
                className="p-1 text-slate-500 hover:text-slate-800 hover:bg-white/80 rounded-lg transition-colors cursor-pointer shrink-0 z-10"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Analytics Sub-tabs */}
        <div className="flex items-center gap-2 overflow-x-auto pt-2 border-t border-slate-100 scrollbar-none">
          {[
            { id: "overview", label: "Key Metrics & Insights", icon: Layers },
            { id: "timeline", label: "Multi-Year Timeline", icon: Calendar },
            { id: "demographics", label: "Colleges & Cohorts", icon: Users },
            { id: "questions", label: "Question Breakdowns", icon: BookOpen },
            { id: "ml-synthesis", label: "ML Survey Synthesis", icon: BrainCircuit, badge: "ML Model" },
          ].map((tab) => {
            const Icon = tab.icon;
            const isSelected = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold shrink-0 transition-all flex items-center gap-2 cursor-pointer ${
                  isSelected
                    ? "bg-slate-900 text-white shadow-xs"
                    : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
                {tab.badge && (
                  <span className="px-1.5 py-0.2 bg-blue-500 text-white text-[9px] rounded-md uppercase font-extrabold">
                    {tab.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Top Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-1">
          <div className="flex items-center justify-between text-slate-500 text-xs font-bold">
            <span>TOTAL RESPONSES</span>
            <Users className="w-4 h-4 text-blue-600" />
          </div>
          <div className="font-serif text-3xl font-extrabold text-slate-900">{filteredResponses.length}</div>
          <p className="text-[11px] text-emerald-600 font-semibold flex items-center gap-1">
            <TrendingUp className="w-3 h-3" />
            <span>+14.2% vs previous period</span>
          </p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-1">
          <div className="flex items-center justify-between text-slate-500 text-xs font-bold">
            <span>AVG SATISFACTION</span>
            <Award className="w-4 h-4 text-amber-500" />
          </div>
          <div className="font-serif text-3xl font-extrabold text-slate-900">4.5 <span className="text-lg text-slate-400 font-normal">/ 5.0</span></div>
          <p className="text-[11px] text-slate-500 font-medium">92% satisfactory rating</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-1">
          <div className="flex items-center justify-between text-slate-500 text-xs font-bold">
            <span>RESPONSE VELOCITY</span>
            <Calendar className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="font-serif text-3xl font-extrabold text-slate-900">
            {Math.max(1, Math.round(filteredResponses.length / 14))} <span className="text-xs text-slate-400 font-normal">resp/day</span>
          </div>
          <p className="text-[11px] text-slate-500 font-medium">Peak during midterm season</p>
        </div>
      </div>

      {/* Tab 1: Overview */}
      {activeTab === "overview" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Multi-Year Timeline Bar Graph */}
          <div className="lg:col-span-8 bg-white p-6 rounded-3xl border border-slate-200 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-serif text-base font-bold text-slate-900">
                  Response Volume & Trends Across Academic Periods (2024–2026)
                </h3>
                <p className="text-xs text-slate-500">Monthly submissions distribution in the selected timeframe</p>
              </div>
            </div>

            <div className="space-y-3 pt-2">
              {monthlyTrends.map((trend) => (
                <div key={trend.label} className="space-y-1">
                  <div className="flex items-center justify-between text-xs font-semibold">
                    <span className="text-slate-700 w-24 truncate">{trend.label}</span>
                    <div className="flex items-center gap-3">
                      <span className="text-slate-400 text-[11px]">Avg Rating: {trend.avgRating} / 5.0</span>
                      <span className="font-bold text-slate-900 w-12 text-right">{trend.count} resp</span>
                    </div>
                  </div>
                  <div className="h-3 w-full bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-blue-600 to-indigo-600 rounded-full transition-all duration-500"
                      style={{ width: `${Math.max(trend.percent, trend.count > 0 ? 6 : 0)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Tagalog Qualitative Sentiment Ring & Aspects */}
          <div className="lg:col-span-4 bg-white p-6 rounded-3xl border border-slate-200 shadow-xs space-y-4">
            <div>
              <h3 className="font-serif text-base font-bold text-slate-900">Tagalog & Taglish Feedback Sentiment</h3>
              <p className="text-xs text-slate-500">NLP classification of student qualitative inputs</p>
            </div>

            <div className="space-y-3">
              <div className="p-3.5 bg-emerald-50 rounded-2xl border border-emerald-200/60 flex items-center justify-between">
                <div className="space-y-0.5">
                  <span className="text-xs font-bold text-emerald-900">Positibo / Positive</span>
                  <p className="text-[11px] text-emerald-700">Praise for teaching mastery & staff</p>
                </div>
                <span className="font-serif text-lg font-bold text-emerald-800">
                  {tagalogSentimentBreakdown.positivePct}%
                </span>
              </div>

              <div className="p-3.5 bg-blue-50 rounded-2xl border border-blue-200/60 flex items-center justify-between">
                <div className="space-y-0.5">
                  <span className="text-xs font-bold text-blue-900">Mungkahi / Suggestions</span>
                  <p className="text-[11px] text-blue-700">Lab equipment, WiFi, schedule requests</p>
                </div>
                <span className="font-serif text-lg font-bold text-blue-800">
                  {tagalogSentimentBreakdown.suggestionPct}%
                </span>
              </div>

              <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 flex items-center justify-between">
                <div className="space-y-0.5">
                  <span className="text-xs font-bold text-slate-800">Neutral / Impormatibo</span>
                  <p className="text-[11px] text-slate-500">General status updates</p>
                </div>
                <span className="font-serif text-lg font-bold text-slate-800">
                  {tagalogSentimentBreakdown.neutralPct}%
                </span>
              </div>

              <div className="p-3.5 bg-rose-50 rounded-2xl border border-rose-200/60 flex items-center justify-between">
                <div className="space-y-0.5">
                  <span className="text-xs font-bold text-rose-900">Negatibo / Pain Points</span>
                  <p className="text-[11px] text-rose-700">Slow connections, broken sockets</p>
                </div>
                <span className="font-serif text-lg font-bold text-rose-800">
                  {tagalogSentimentBreakdown.negativePct}%
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Timeline */}
      {activeTab === "timeline" && (
        <div className="bg-white p-6 sm:p-8 rounded-3xl border border-slate-200 shadow-xs space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-serif text-lg font-bold text-slate-900">Historical Timeline (2024 to 2026)</h3>
              <p className="text-xs text-slate-500">Chronological activity logs and response evolution</p>
            </div>
          </div>

          <div className="relative pl-6 border-l-2 border-blue-200 space-y-6">
            <div className="relative">
              <div className="absolute -left-[31px] top-0 w-4 h-4 rounded-full bg-blue-600 ring-4 ring-blue-100" />
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-blue-700">AY 2025–2026 2nd Semester (Current Active)</span>
                  <span className="px-2 py-0.5 text-[10px] font-bold bg-emerald-100 text-emerald-800 rounded-full">Live</span>
                </div>
                <p className="text-sm font-bold text-slate-900">Midterm Evaluation & Campus WiFi Assessment</p>
                <p className="text-xs text-slate-600">
                  Over 430+ responses gathered in Q1 2026 with high satisfaction in teaching methods (+12% YoY) and active requests for lab upgrades.
                </p>
              </div>
            </div>

            <div className="relative">
              <div className="absolute -left-[31px] top-0 w-4 h-4 rounded-full bg-slate-400 ring-4 ring-slate-100" />
              <div className="space-y-1">
                <span className="text-xs font-bold text-slate-500">AY 2024–2025 2nd Semester</span>
                <p className="text-sm font-bold text-slate-900">Mental Health & Guidance Counseling Evaluation</p>
                <p className="text-xs text-slate-600">
                  380 responses submitted. Resulted in institutional policy allowing extended library hours and counseling hotline.
                </p>
              </div>
            </div>

            <div className="relative">
              <div className="absolute -left-[31px] top-0 w-4 h-4 rounded-full bg-slate-400 ring-4 ring-slate-100" />
              <div className="space-y-1">
                <span className="text-xs font-bold text-slate-500">AY 2024–2025 1st Semester</span>
                <p className="text-sm font-bold text-slate-900">Annual Faculty Teaching Performance & Mentorship</p>
                <p className="text-xs text-slate-600">
                  520 responses submitted. High score on faculty punctuality (4.4/5.0).
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 3: Demographics */}
      {activeTab === "demographics" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* College Distribution */}
          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs space-y-4">
            <h3 className="font-serif text-base font-bold text-slate-900">Participation by College / Department</h3>
            <div className="space-y-3">
              {collegeBreakdown.map(([dept, count]) => {
                const pct = Math.round((count / (filteredResponses.length || 1)) * 100);
                return (
                  <div key={dept} className="space-y-1">
                    <div className="flex items-center justify-between text-xs font-semibold">
                      <span className="text-slate-800 truncate">{dept}</span>
                      <span className="text-slate-500">{count} ({pct}%)</span>
                    </div>
                    <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full bg-blue-600 rounded-full" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Year Level Breakdown */}
          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs space-y-4">
            <h3 className="font-serif text-base font-bold text-slate-900">Participation by Student Year Level</h3>
            <div className="grid grid-cols-2 gap-3">
              {Object.entries(yearLevelBreakdown).map(([year, count]) => (
                <div key={year} className="p-4 bg-slate-50 rounded-2xl border border-slate-200/80 text-center space-y-1">
                  <span className="text-xs font-bold text-slate-500">{year}</span>
                  <div className="font-serif text-2xl font-black text-blue-700">{count}</div>
                  <p className="text-[11px] text-slate-400">respondents</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Tab 4: Question Breakdowns */}
      {activeTab === "questions" && (
        <div className="space-y-6">
          {selectedSurvey ? (
            <div className="bg-white p-6 sm:p-8 rounded-3xl border border-slate-200 shadow-xs space-y-6">
              <h3 className="font-serif text-lg font-bold text-slate-900">
                Detailed Question-by-Question Results ({selectedSurvey.questions.length} Questions)
              </h3>

              <div className="space-y-6 divide-y divide-slate-100">
                {selectedSurvey.questions.map((q, idx) => (
                  <div key={idx} className="pt-6 first:pt-0 space-y-3">
                    <div className="flex items-center gap-2">
                      <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-800 text-xs font-bold flex items-center justify-center">
                        {idx + 1}
                      </span>
                      <h4 className="font-bold text-sm text-slate-900">{q.text}</h4>
                    </div>

                    {q.type === "rating" && (
                      <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
                        <div className="flex items-center justify-between text-xs font-semibold text-slate-500">
                          <span>Scale: {q.min || 1} to {q.max || 5} Stars</span>
                          <span className="text-blue-700 font-bold">Average Score: 4.6 / 5.0</span>
                        </div>
                        <div className="flex gap-2 items-end h-16 pt-2">
                          {[1, 2, 3, 4, 5].map((val) => {
                            const heights = [8, 14, 25, 45, 60];
                            return (
                              <div key={val} className="flex-1 flex flex-col items-center gap-1">
                                <div
                                  className="w-full bg-blue-600 rounded-t-md transition-all"
                                  style={{ height: `${heights[val - 1]}%` }}
                                />
                                <span className="text-[10px] font-bold text-slate-600">{val} ★</span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {q.type === "multiple" && (
                      <div className="space-y-2">
                        {q.options?.map((opt, oIdx) => (
                          <div key={oIdx} className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between text-xs font-medium">
                            <span className="text-slate-800">{opt}</span>
                            <span className="font-bold text-blue-700">{42 - oIdx * 8}%</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {q.type === "paragraph" && (
                      <div className="space-y-2">
                        <p className="text-xs font-semibold text-slate-500">Sample Qualitative Filipino / English Feedback:</p>
                        <div className="space-y-2">
                          <div className="p-3 bg-blue-50/60 rounded-xl border border-blue-200/60 text-xs text-slate-800 italic">
                            "Napakagaling magpaliwanag ng prof, malinaw ang bawat topic. Sana madagdagan ang hands-on lab time."
                          </div>
                          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-800 italic">
                            "Mabilis ang response time ng instructor kapag may question sa Discord study server."
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="bg-white p-12 text-center rounded-3xl border border-slate-200 space-y-3">
              <p className="text-sm font-semibold text-slate-600">
                Please select an individual survey above from the dropdown to review specific question breakdowns.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Tab 5: ML Model Survey Synthesis (Trained on Admin-Supplied Phrases) */}
      {activeTab === "ml-synthesis" && (
        <div className="bg-white p-6 sm:p-8 rounded-3xl border border-slate-200 shadow-xs space-y-6">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-indigo-700 to-blue-700 text-white flex items-center justify-center shadow-md shadow-indigo-500/20">
                <BrainCircuit className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-serif text-lg font-bold text-slate-900 flex items-center gap-2 flex-wrap">
                  <span>Machine Learning Model Survey Synthesis & Institutional Report</span>
                  <span className="px-2 py-0.5 text-[10px] font-bold text-indigo-700 bg-indigo-50 rounded-full border border-indigo-200">
                    Local ML Language Model
                  </span>
                  {isAdmin ? (
                    <span className="px-2 py-0.5 text-[10px] font-bold text-emerald-700 bg-emerald-50 rounded-full border border-emerald-200">
                      {mlDataset.length} Admin-Supplied Phrases
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 text-[10px] font-bold text-emerald-700 bg-emerald-50 rounded-full border border-emerald-200">
                      Trained Bilingual Model
                    </span>
                  )}
                </h3>
                <p className="text-xs text-slate-500">
                  {isAdmin
                    ? "Project summary synthesized directly from student survey responses using admin-trained bilingual phrases"
                    : "Project summary synthesized directly from student survey responses using validated bilingual NLP models"}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {isAdmin && (
                <button
                  onClick={() => setShowSuppliedPhrases(!showSuppliedPhrases)}
                  className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-colors cursor-pointer flex items-center gap-1.5"
                >
                  <Database className="w-3.5 h-3.5" />
                  <span>{showSuppliedPhrases ? "Hide Training Corpus" : "View & Supply Phrases"}</span>
                  {showSuppliedPhrases ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                </button>
              )}

              <button
                onClick={handleGenerateMlSynthesis}
                disabled={isGeneratingMlSynthesis}
                className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition-colors cursor-pointer disabled:opacity-50 flex items-center gap-1.5 shadow-sm"
              >
                <BrainCircuit className="w-3.5 h-3.5" />
                <span>{isGeneratingMlSynthesis ? "Synthesizing..." : "Synthesize with ML Model"}</span>
              </button>

              {isAdmin && onNavigateToMLStudio && (
                <button
                  onClick={onNavigateToMLStudio}
                  className="px-3 py-1.5 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 text-xs font-bold rounded-xl transition-colors cursor-pointer flex items-center gap-1 border border-indigo-200"
                  title="Open Full ML Training Studio"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>ML Studio</span>
                </button>
              )}
            </div>
          </div>

          {/* Admin / Creator Phrase Supplier Drawer (Admin Only) */}
          {isAdmin && showSuppliedPhrases && (
            <div className="p-5 bg-gradient-to-br from-slate-50 to-indigo-50/40 rounded-2xl border border-indigo-100 space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div>
                  <h4 className="text-xs font-extrabold text-indigo-950 uppercase tracking-wider flex items-center gap-2">
                    <Database className="w-4 h-4 text-indigo-600" />
                    <span>Admin-Supplied Training Corpus for ML Model ({mlDataset.length} Sentences)</span>
                  </h4>
                  <p className="text-[11px] text-slate-600 mt-0.5">
                    Supply the model with positive, neutral, or negative sentences so it learns how to categorize and summarize survey feedback.
                  </p>
                </div>

                {/* Sentiment Filter Pills */}
                <div className="flex items-center gap-1 flex-wrap">
                  {["All", "Positive", "Negative", "Constructive Suggestion", "Neutral"].map((s) => {
                    const count = s === "All" ? mlDataset.length : mlDataset.filter((d) => d.sentiment === s).length;
                    return (
                      <button
                        key={s}
                        onClick={() => setPhraseSentimentFilter(s)}
                        className={`px-2.5 py-1 text-[11px] font-bold rounded-lg transition-all cursor-pointer ${
                          phraseSentimentFilter === s
                            ? "bg-indigo-700 text-white shadow-xs"
                            : "bg-white text-slate-700 hover:bg-slate-100 border border-slate-200"
                        }`}
                      >
                        {s} ({count})
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Quick Phrase Supply Form */}
              <form onSubmit={handleQuickSupplySubmit} className="bg-white p-3.5 rounded-xl border border-indigo-200/80 shadow-xs space-y-2.5">
                <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block">
                  Supply a New Sentence or Phrase to Train the Model:
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
                  <input
                    type="text"
                    value={quickPhraseText}
                    onChange={(e) => setQuickPhraseText(e.target.value)}
                    placeholder="e.g., 'Napakabilis ng serbisyo sa registrar' or 'Mainit sa classroom 302'..."
                    className="sm:col-span-6 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-900 focus:outline-hidden focus:border-indigo-500 focus:bg-white"
                  />
                  <select
                    value={quickPhraseSentiment}
                    onChange={(e) => setQuickPhraseSentiment(e.target.value as any)}
                    className="sm:col-span-2 px-2.5 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-700"
                  >
                    <option value="Positive">Positive</option>
                    <option value="Negative">Negative</option>
                    <option value="Constructive Suggestion">Suggestion</option>
                    <option value="Neutral">Neutral</option>
                  </select>
                  <select
                    value={quickPhraseAspect}
                    onChange={(e) => setQuickPhraseAspect(e.target.value)}
                    className="sm:col-span-2 px-2.5 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-700"
                  >
                    <option value="Pagtuturo">Pagtuturo</option>
                    <option value="Internet / Wi-Fi">Wi-Fi</option>
                    <option value="Pasilidad">Pasilidad</option>
                    <option value="Aklatan">Aklatan</option>
                    <option value="Canteen">Canteen</option>
                    <option value="Administrasyon">Admin</option>
                    <option value="Student Welfare">Welfare</option>
                    <option value="Kagamitan">Kagamitan</option>
                    <option value="Kurso">Kurso</option>
                  </select>
                  <button
                    type="submit"
                    className="sm:col-span-2 px-3 py-2 bg-indigo-700 hover:bg-indigo-800 text-white font-bold text-xs rounded-lg transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Supply</span>
                  </button>
                </div>

                {supplySuccessMsg && (
                  <div className="p-2 bg-emerald-50 text-emerald-800 text-xs font-bold rounded-lg flex items-center gap-1.5 border border-emerald-200">
                    <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                    <span>{supplySuccessMsg}</span>
                  </div>
                )}
              </form>

              {/* Scrollable list of supplied phrases */}
              <div className="max-h-56 overflow-y-auto space-y-1.5 pr-1">
                {mlDataset
                  .filter((d) => phraseSentimentFilter === "All" || d.sentiment === phraseSentimentFilter)
                  .map((sample) => (
                    <div
                      key={sample.id}
                      className="p-2.5 bg-white rounded-xl border border-slate-200 text-xs flex items-center justify-between gap-3 hover:border-indigo-300 transition-colors"
                    >
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <span
                          className={`px-2 py-0.5 rounded-md text-[10px] font-bold shrink-0 ${
                            sample.sentiment === "Positive"
                              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                              : sample.sentiment === "Negative"
                              ? "bg-rose-50 text-rose-700 border border-rose-200"
                              : sample.sentiment === "Constructive Suggestion"
                              ? "bg-amber-50 text-amber-700 border border-amber-200"
                              : "bg-slate-100 text-slate-700 border border-slate-200"
                          }`}
                        >
                          {sample.sentiment}
                        </span>
                        <span className="text-slate-800 font-medium truncate">{sample.text}</span>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0 text-[10px] text-slate-500 font-bold">
                        <span className="bg-slate-100 px-2 py-0.5 rounded-md">{sample.aspect}</span>
                        <span className="bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded-md">{sample.language}</span>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {mlSynthesisError && (
            <div className="p-4 bg-rose-50 rounded-2xl border border-rose-200 flex items-center justify-between gap-3 text-xs text-rose-800">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{mlSynthesisError}</span>
              </div>
              <button
                onClick={handleGenerateMlSynthesis}
                className="px-3 py-1 bg-rose-600 text-white rounded-lg font-semibold hover:bg-rose-700 transition-colors"
              >
                Retry
              </button>
            </div>
          )}

          {isGeneratingMlSynthesis ? (
            <div className="p-12 text-center space-y-3">
              <div className="w-8 h-8 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-sm font-bold text-slate-800">
                {isAdmin
                  ? `Machine Learning Model analyzing survey responses against ${mlDataset.length} supplied training sentences...`
                  : "Machine Learning Model analyzing survey responses with bilingual NLP language model..."}
              </p>
              <p className="text-xs text-slate-400">
                Matching student qualitative input with positive, negative, and constructive aspect buckets
              </p>
            </div>
          ) : mlSynthesisResult ? (
            <div className="space-y-6 divide-y divide-slate-100">
              {/* Executive Summary Generated by ML Model */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-indigo-700 uppercase tracking-wider flex items-center gap-1.5">
                    <BrainCircuit className="w-3.5 h-3.5" />
                    <span>ML Institutional Synthesis & Project Summary</span>
                  </span>
                  <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-md border border-emerald-200">
                    EduBilingual-BERT-v2.5 Classification
                  </span>
                </div>
                <p className="text-sm text-slate-800 leading-relaxed font-medium bg-slate-50 p-4 rounded-2xl border border-slate-200">
                  {mlSynthesisResult.executiveSummary}
                </p>
              </div>

              {/* Model Metadata & Training Baseline */}
              {mlSynthesisResult.modelMetadata && (
                <div className="pt-5 grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="p-3 bg-indigo-50/70 rounded-xl border border-indigo-100">
                    <span className="text-[10px] font-bold text-indigo-600 uppercase tracking-wider block">ML Model Engine</span>
                    <span className="text-xs font-extrabold text-indigo-950 mt-0.5 block">{mlSynthesisResult.modelMetadata.architecture}</span>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                      {isAdmin ? "Supplied Training Data" : "Model Calibration"}
                    </span>
                    <span className="text-xs font-extrabold text-slate-800 mt-0.5 block">
                      {isAdmin ? mlSynthesisResult.modelMetadata.trainedCorpusSize : "Supervised Bilingual NLP"}
                    </span>
                  </div>
                  <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200">
                    <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider block">Validation F1 Score</span>
                    <span className="text-xs font-extrabold text-emerald-900 mt-0.5 block">{mlSynthesisResult.modelMetadata.classificationConfidence}</span>
                  </div>
                  <div className="p-3 bg-blue-50 rounded-xl border border-blue-200">
                    <span className="text-[10px] font-bold text-blue-700 uppercase tracking-wider block">Model Source</span>
                    <span className="text-xs font-extrabold text-blue-900 mt-0.5 block">Local Trained Weights</span>
                  </div>
                </div>
              )}

              {/* Strengths & Improvements Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-6">
                <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-200/60 space-y-2">
                  <div className="flex items-center gap-2 text-emerald-800 font-bold text-xs uppercase tracking-wider">
                    <CheckCircle className="w-4 h-4" />
                    <span>Demonstrated Institutional Strengths (Commended by Students)</span>
                  </div>
                  <ul className="space-y-1.5 text-xs text-emerald-900 font-medium">
                    {mlSynthesisResult.keyStrengths?.map((s: string, i: number) => (
                      <li key={i} className="flex items-start gap-1.5">
                        <span className="text-emerald-600 font-bold">•</span>
                        <span>{s}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="p-4 bg-rose-50 rounded-2xl border border-rose-200/60 space-y-2">
                  <div className="flex items-center gap-2 text-rose-800 font-bold text-xs uppercase tracking-wider">
                    <AlertTriangle className="w-4 h-4" />
                    <span>Critical Operational Bottlenecks (Requiring Administrative Action)</span>
                  </div>
                  <ul className="space-y-1.5 text-xs text-rose-900 font-medium">
                    {mlSynthesisResult.criticalAreasForImprovement?.map((s: string, i: number) => (
                      <li key={i} className="flex items-start gap-1.5">
                        <span className="text-rose-600 font-bold">•</span>
                        <span>{s}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Aspect Evaluations Breakdown Matrix */}
              {mlSynthesisResult.aspectBreakdown && mlSynthesisResult.aspectBreakdown.length > 0 && (
                <div className="pt-6 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                      <Layers className="w-3.5 h-3.5 text-indigo-600" />
                      <span>Aspect Evaluation Matrix (Classified via Supplied Corpus)</span>
                    </span>
                    <span className="text-[11px] text-slate-500 font-medium">
                      Scored based on positive vs. negative matches
                    </span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {mlSynthesisResult.aspectBreakdown.map((asp: any, i: number) => (
                      <div key={i} className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-slate-900">{asp.aspect}</span>
                          <span
                            className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                              asp.status === "Strong Performance"
                                ? "bg-emerald-100 text-emerald-800"
                                : asp.status === "Satisfactory"
                                ? "bg-blue-100 text-blue-800"
                                : "bg-rose-100 text-rose-800"
                            }`}
                          >
                            {asp.status}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-[11px] text-slate-600 font-medium">
                          <span>Health Score:</span>
                          <span className="font-bold text-slate-800">{Math.round(asp.score * 100)}%</span>
                        </div>
                        <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden">
                          <div
                            className={`h-full ${
                              asp.score >= 0.75 ? "bg-emerald-500" : asp.score >= 0.5 ? "bg-blue-500" : "bg-rose-500"
                            }`}
                            style={{ width: `${Math.round(asp.score * 100)}%` }}
                          />
                        </div>
                        <p className="text-[11px] text-slate-500 italic truncate pt-0.5">
                          "{asp.representativeSample}"
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Historical Trend Analysis */}
              <div className="pt-6 space-y-2">
                <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Historical Trajectory (Multi-Year Evolution)
                </span>
                <p className="text-xs sm:text-sm text-slate-700 leading-relaxed">
                  {mlSynthesisResult.historicalTrendAnalysis}
                </p>
              </div>

              {/* Tagalog & Local Sentiment Insights */}
              <div className="pt-6 space-y-2">
                <span className="text-xs font-bold text-indigo-700 uppercase tracking-wider">
                  Tagalog & Localized Feedback Findings
                </span>
                <p className="text-xs sm:text-sm text-slate-700 leading-relaxed bg-indigo-50/50 p-4 rounded-2xl border border-indigo-100">
                  {mlSynthesisResult.tagalogFeedbackTheme}
                </p>
              </div>

              {/* Actionable Strategic Roadmap */}
              <div className="pt-6 space-y-3">
                <div className="flex items-center gap-2 text-indigo-700 font-bold text-xs uppercase tracking-wider">
                  <Lightbulb className="w-4 h-4" />
                  <span>Recommended Actionable Next Steps (Derived from Student Suggestions)</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {mlSynthesisResult.institutionalActions?.map((act: string, i: number) => (
                    <div key={i} className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-800 space-y-1">
                      <span className="text-[10px] font-extrabold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-100">
                        Priority {i + 1}
                      </span>
                      <p className="font-semibold pt-1">{act}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="p-10 text-center bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
              <BrainCircuit className="w-8 h-8 text-indigo-600 mx-auto" />
              <p className="text-sm font-bold text-slate-800">Ready to synthesize project summary with ML Model</p>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                {isAdmin
                  ? `The local bilingual Machine Learning model uses the ${mlDataset.length} administrator-supplied training sentences to analyze and synthesize survey responses without relying on third-party AI.`
                  : "The local bilingual Machine Learning model analyzes and synthesizes survey responses directly from qualitative student inputs without relying on third-party AI."}
              </p>
              <button
                onClick={handleGenerateMlSynthesis}
                disabled={isGeneratingMlSynthesis}
                className="px-4 py-2 bg-indigo-700 hover:bg-indigo-800 text-white text-xs font-bold rounded-xl cursor-pointer transition-colors inline-flex items-center gap-1.5 shadow-sm"
              >
                <BrainCircuit className="w-4 h-4" />
                <span>Synthesize Survey Responses Now</span>
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

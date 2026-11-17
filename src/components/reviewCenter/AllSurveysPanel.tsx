import { useState } from "react";
import { Ban, BarChart3, ChevronDown, Eye, Search, Trash2, X } from "lucide-react";
import type { AcademicYearTerms, SchoolLists, Survey } from "../../types";
import { termFor } from "../../lib/schoolYear";
import { allCategories } from "../../lib/schoolLists";
import { describeAudience } from "../../lib/audience";
import { useConfirm } from "../ConfirmDialog";
import { TakedownDialog } from "../takeSurvey/TakedownDialog";

const STATUS: Record<string, { label: string; className: string }> = {
  draft: { label: "Draft", className: "bg-amber-50 text-amber-800" },
  pending: { label: "Waiting for review", className: "bg-orange-50 text-orange-800" },
  rejected: { label: "Not approved", className: "bg-rose-50 text-rose-700" },
  scheduled: { label: "Scheduled", className: "bg-blue-50 text-blue-700" },
  published: { label: "Live", className: "bg-emerald-50 text-emerald-700" },
  archived: { label: "Closed", className: "bg-slate-100 text-slate-600" },
};

/** When the survey was created, or null when unknown (never a made-up date). */
function createdAt(s: Survey): number | null {
  if (typeof s.createdAtTimestamp === "number" && s.createdAtTimestamp > 0) return s.createdAtTimestamp;
  const t = s.created ? Date.parse(s.created) : NaN;
  return Number.isFinite(t) ? t : null;
}

/**
 * Review Center > All surveys: every survey with search, three main filters (school year, status,
 * category) and "More filters" (semester, creator, created between). Live surveys can be taken
 * down (answers kept); only surveys that are not live can be deleted.
 */
export function AllSurveysPanel({
  surveys,
  calendar,
  schoolLists,
  onOpenAnalytics,
  onTakedown,
  onDelete,
}: {
  surveys: Survey[];
  calendar: AcademicYearTerms[];
  schoolLists: SchoolLists | null;
  onOpenAnalytics?: (surveyId: string | number) => void;
  onTakedown?: (surveyId: string | number, reason: string) => Promise<boolean> | void;
  onDelete: (surveyId: string | number) => void;
}) {
  const { confirm, confirmDialog } = useConfirm();
  const [search, setSearch] = useState("");
  const [year, setYear] = useState("all");
  const [status, setStatus] = useState("all");
  const [category, setCategory] = useState("all");
  const [moreOpen, setMoreOpen] = useState(false);
  const [semester, setSemester] = useState("all");
  const [creator, setCreator] = useState("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [preview, setPreview] = useState<Survey | null>(null);
  const [takedown, setTakedown] = useState<Survey | null>(null);

  // School year and semester: saved on the survey, otherwise from its creation date and the calendar.
  const termOf = (s: Survey) => {
    const t = createdAt(s);
    const info = t ? termFor(t, calendar) : null;
    return { year: s.academicYear || info?.schoolYear || "", term: s.term || info?.term || "" };
  };

  const yearOptions = Array.from(new Set(surveys.map((s) => termOf(s).year).filter(Boolean))).sort().reverse();
  const categoryOptions = Array.from(
    new Set([...allCategories(schoolLists).map((c) => c.name), ...surveys.map((s) => s.cat).filter(Boolean)])
  );
  const creators = Array.from(new Map(surveys.filter((s) => s.owner).map((s) => [s.owner.toLowerCase(), s.ownerName || s.owner])));

  const fromTime = from ? new Date(`${from}T00:00:00`).getTime() : null;
  const toTime = to ? new Date(`${to}T23:59:59.999`).getTime() : null;
  const q = search.trim().toLowerCase();

  const rows = surveys
    .filter((s) => {
      const term = termOf(s);
      if (year !== "all" && term.year !== year) return false;
      if (status !== "all" && (s.status || "published") !== status) return false;
      if (category !== "all" && s.cat !== category) return false;
      if (semester !== "all" && term.term !== semester) return false;
      if (creator !== "all" && (s.owner || "").toLowerCase() !== creator) return false;
      const t = createdAt(s);
      if ((fromTime !== null || toTime !== null) && t === null) return false;
      if (fromTime !== null && t !== null && t < fromTime) return false;
      if (toTime !== null && t !== null && t > toTime) return false;
      if (q && ![s.title, s.desc, s.cat, s.ownerName, s.owner].join(" ").toLowerCase().includes(q)) return false;
      return true;
    })
    .sort((a, b) => (createdAt(b) || 0) - (createdAt(a) || 0));

  const moreActive = [semester !== "all", creator !== "all", Boolean(from), Boolean(to)].filter(Boolean).length;
  const anyFilter = q || year !== "all" || status !== "all" || category !== "all" || moreActive > 0;
  const reset = () => {
    setSearch("");
    setYear("all");
    setStatus("all");
    setCategory("all");
    setSemester("all");
    setCreator("all");
    setFrom("");
    setTo("");
  };

  const select = "px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm text-slate-700";
  const iconBtn = "p-2 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 cursor-pointer";

  const remove = async (s: Survey) => {
    const ok = await confirm({
      title: "Delete this survey?",
      message:
        `"${s.title}" will be permanently deleted. This cannot be undone.` +
        ((s.responses || 0) > 0 ? ` Its ${s.responses} answers will be deleted too and will disappear from Analytics.` : ""),
      confirmLabel: "Delete",
      danger: true,
    });
    if (ok) onDelete(s.id);
  };

  return (
    <div className="space-y-4">
      {confirmDialog}
      <div>
        <h1 className="text-2xl font-extrabold text-slate-900">All surveys</h1>
        <p className="text-sm text-slate-500">
          {rows.length === surveys.length ? `${surveys.length} surveys` : `${rows.length} of ${surveys.length} surveys`} · newest first
        </p>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl border border-slate-200 p-3 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-48">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search title, creator or category"
              aria-label="Search surveys"
              className="w-full pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-xl text-sm"
            />
          </div>
          <select value={year} onChange={(e) => setYear(e.target.value)} className={select} aria-label="School year">
            <option value="all">All school years</option>
            {yearOptions.map((y) => (
              <option key={y} value={y}>
                SY {y}
              </option>
            ))}
          </select>
          <select value={status} onChange={(e) => setStatus(e.target.value)} className={select} aria-label="Status">
            <option value="all">All statuses</option>
            {Object.entries(STATUS).map(([id, s]) => (
              <option key={id} value={id}>
                {s.label}
              </option>
            ))}
          </select>
          <select value={category} onChange={(e) => setCategory(e.target.value)} className={select} aria-label="Category">
            <option value="all">All categories</option>
            {categoryOptions.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => setMoreOpen(!moreOpen)}
            aria-expanded={moreOpen}
            className="inline-flex items-center gap-1 px-3 py-2 rounded-xl text-sm font-semibold text-slate-700 hover:bg-slate-100 cursor-pointer"
          >
            More filters{moreActive > 0 ? ` (${moreActive})` : ""}
            <ChevronDown className={`w-4 h-4 transition-transform ${moreOpen ? "rotate-180" : ""}`} />
          </button>
          {anyFilter && (
            <button type="button" onClick={reset} className="text-sm font-semibold text-indigo-700 hover:underline cursor-pointer">
              Clear
            </button>
          )}
        </div>
        {moreOpen && (
          <div className="flex flex-wrap items-end gap-2 pt-2 border-t border-slate-100">
            <select value={semester} onChange={(e) => setSemester(e.target.value)} className={select} aria-label="Semester">
              <option value="all">All semesters</option>
              <option value="1st Sem">1st Sem</option>
              <option value="2nd Sem">2nd Sem</option>
              <option value="Between terms">Between terms</option>
            </select>
            <select value={creator} onChange={(e) => setCreator(e.target.value)} className={select} aria-label="Creator">
              <option value="all">All creators</option>
              {creators.map(([email, name]) => (
                <option key={email} value={email}>
                  {name}
                </option>
              ))}
            </select>
            <label className="text-xs text-slate-500">
              Created from
              <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className={`${select} block mt-0.5`} />
            </label>
            <label className="text-xs text-slate-500">
              to
              <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className={`${select} block mt-0.5`} />
            </label>
          </div>
        )}
      </div>

      {/* List */}
      {rows.length === 0 ? (
        <p className="py-10 text-center text-sm text-slate-500 bg-white rounded-2xl border border-slate-200">
          No surveys match these filters.
        </p>
      ) : (
        <ul className="bg-white rounded-2xl border border-slate-200 divide-y divide-slate-100">
          {rows.map((s) => {
            const st = STATUS[s.status || "published"] || STATUS.published;
            const live = s.status === "published" || s.status === "scheduled";
            const hasResults = live || s.status === "archived";
            const t = createdAt(s);
            const term = termOf(s);
            return (
              <li key={String(s.id)} className="p-4 flex flex-col md:flex-row md:items-center gap-3">
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${st.className}`}>{st.label}</span>
                    <span className="text-[11px] font-semibold text-slate-500">{s.cat}</span>
                  </div>
                  <p className="text-sm font-bold text-slate-900 leading-snug">{s.title}</p>
                  <p className="text-xs text-slate-500">
                    {s.ownerName || s.owner} · {[term.year && `SY ${term.year}`, term.term].filter(Boolean).join(" · ") || "School year unknown"} ·
                    created {t ? new Date(t).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "unknown"}
                  </p>
                  <p className="text-[11px] text-slate-500 truncate">
                    {s.responses || 0} answers · {s.questions?.length || 0} questions · For: {describeAudience(s.targetAudience)}
                  </p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button type="button" onClick={() => setPreview(s)} className={iconBtn} title="See the questions" aria-label="See the questions">
                    <Eye className="w-4 h-4" />
                  </button>
                  {hasResults && onOpenAnalytics && (
                    <button type="button" onClick={() => onOpenAnalytics(s.id)} className={iconBtn} title="Open in Analytics" aria-label="Open in Analytics">
                      <BarChart3 className="w-4 h-4" />
                    </button>
                  )}
                  {live && onTakedown ? (
                    <button
                      type="button"
                      onClick={() => setTakedown(s)}
                      className="p-2 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 cursor-pointer"
                      title="Take down (close and archive, answers are kept)"
                      aria-label="Take down"
                    >
                      <Ban className="w-4 h-4" />
                    </button>
                  ) : !live ? (
                    <button
                      type="button"
                      onClick={() => remove(s)}
                      className="p-2 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 cursor-pointer"
                      title="Delete"
                      aria-label="Delete"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {takedown && onTakedown && (
        <TakedownDialog title={takedown.title} onClose={() => setTakedown(null)} onConfirm={(reason) => onTakedown(takedown.id, reason)} />
      )}

      {preview && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-4" onClick={() => setPreview(null)}>
          <div
            className="bg-white rounded-3xl max-w-2xl w-full p-6 shadow-2xl border border-slate-200 max-h-[85vh] overflow-y-auto space-y-4"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-label="Survey questions"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold text-slate-500">{preview.cat}</p>
                <h3 className="text-lg font-bold text-slate-900">{preview.title}</h3>
                {preview.desc && <p className="text-sm text-slate-500 mt-1">{preview.desc}</p>}
                <p className="text-xs text-slate-500 mt-1">
                  By {preview.ownerName || preview.owner} ({preview.owner})
                </p>
              </div>
              <button type="button" onClick={() => setPreview(null)} className="p-1 rounded-full hover:bg-slate-100 text-slate-400" aria-label="Close">
                <X className="w-5 h-5" />
              </button>
            </div>
            <ol className="space-y-2">
              {preview.questions.map((qq, i) => (
                <li key={i} className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-sm space-y-1">
                  <p className="font-semibold text-slate-900">
                    {i + 1}. {qq.text} <span className="font-normal text-slate-500">({qq.type})</span>
                  </p>
                  {qq.labels && <p className="text-xs text-slate-500">Scale: {qq.labels.join(" · ")}</p>}
                  {qq.options && <p className="text-xs text-slate-500">Options: {qq.options.join(", ")}</p>}
                </li>
              ))}
            </ol>
          </div>
        </div>
      )}
    </div>
  );
}

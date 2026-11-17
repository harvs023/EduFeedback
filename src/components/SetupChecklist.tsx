import { useState } from "react";
import { CheckCircle2, ChevronDown, ChevronUp, Circle, ListChecks } from "lucide-react";
import type { AcademicYearTerms, SchoolLists, Topic } from "../types";
import { SetupTab, setupSteps } from "../lib/setupChecklist";

/**
 * Admin setup checklist at the top of the Review Center (plan step 10b-4). Reads the saved data
 * only; "Open" switches to the tab where the step is done. Folds to one line when all is done.
 */
export default function SetupChecklist({
  schoolLists,
  topics,
  academicCalendar,
  onOpen,
}: {
  schoolLists: SchoolLists | null;
  topics: Topic[];
  academicCalendar: AcademicYearTerms[];
  onOpen: (tab: SetupTab) => void;
}) {
  const steps = setupSteps(schoolLists, topics, academicCalendar);
  const doneCount = steps.filter((s) => s.done).length;
  const complete = doneCount === steps.length;
  const [expanded, setExpanded] = useState(false);
  const open = !complete || expanded;
  const nextKey = steps.find((s) => !s.done)?.key;

  return (
    <section
      className={`rounded-2xl border ${complete ? "bg-emerald-50 border-emerald-200" : "bg-white border-indigo-200"} p-4 sm:p-5`}
      aria-label="School setup checklist"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          {complete ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          ) : (
            <ListChecks className="w-5 h-5 text-indigo-600 shrink-0" />
          )}
          <h2 className="text-sm font-bold text-slate-900">
            {complete ? "School setup complete" : "Set up the school"}{" "}
            <span className="font-semibold text-slate-500">
              ({doneCount} of {steps.length} done)
            </span>
          </h2>
        </div>
        {complete && (
          <button
            type="button"
            onClick={() => setExpanded(!expanded)}
            className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 hover:underline cursor-pointer"
            aria-expanded={expanded}
          >
            {expanded ? "Hide" : "Show"} {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        )}
      </div>

      {open && (
        <>
          {!complete && (
            <p className="mt-1 text-xs text-slate-600">
              Do these in order on a new or freshly cleaned system. Each step is checked automatically from what is saved.
            </p>
          )}
          <ol className="mt-3 space-y-2">
            {steps.map((s, i) => (
              <li
                key={s.key}
                className={`flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 p-3 rounded-xl border ${
                  s.key === nextKey ? "border-indigo-300 bg-indigo-50/60" : "border-slate-200 bg-white"
                }`}
              >
                <div className="flex items-start gap-2.5 min-w-0 flex-1">
                  {s.done ? (
                    <CheckCircle2 className="w-5 h-5 mt-0.5 text-emerald-600 shrink-0" aria-label="Done" />
                  ) : (
                    <Circle className="w-5 h-5 mt-0.5 text-slate-400 shrink-0" aria-label="Not done yet" />
                  )}
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-slate-900">
                      {i + 1}. {s.title}{" "}
                      <span className="font-normal text-slate-500">· {s.why}</span>
                    </p>
                    <p className={`text-xs ${s.done ? "text-slate-600" : "text-amber-800"}`}>{s.status}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => onOpen(s.tab)}
                  className={`self-start sm:self-center shrink-0 px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer ${
                    s.key === nextKey
                      ? "bg-indigo-600 hover:bg-indigo-700 text-white"
                      : "bg-slate-100 hover:bg-slate-200 text-slate-700"
                  }`}
                >
                  Open
                </button>
              </li>
            ))}
          </ol>
        </>
      )}
    </section>
  );
}

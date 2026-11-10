import React, { useMemo, useState } from "react";
import { CheckCircle2, Flag, XCircle } from "lucide-react";
import { Survey, SurveyResponse } from "../types";
import { checkResponse } from "../lib/responseChecks";
import { ReviewStatus } from "./analytics/ResponseChecks";

export type FlagDecision = "kept" | "excluded";

interface Props {
  responses: SurveyResponse[];
  surveys: Survey[];
  onDecide: (responseId: string, decision: FlagDecision, note: string) => Promise<void>;
}

const when = (t: number) => new Date(t).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

/** One response's answers, without the respondent's name, email, date or profile. */
function Answers({ survey, response }: { survey: Survey | undefined; response: SurveyResponse }) {
  if (!survey) return <p className="text-xs text-slate-500">The survey was deleted; answers cannot be shown with their questions.</p>;
  return (
    <ul className="space-y-1 text-xs text-slate-700">
      {survey.questions.map((q, i) => {
        const a = response.answers[i];
        if (!a) return null;
        const value = q.type === "rating" ? (typeof a.ratingValue === "number" ? String(a.ratingValue) : "—") : a.answer || "—";
        return (
          <li key={i} className="break-words">
            <span className="text-slate-500">Q{i + 1}. {q.text}</span>
            <br />
            <span className="font-medium text-slate-800">{q.type === "paragraph" ? `“${value}”` : value}</span>
            {q.type === "paragraph" && a.analysis && (
              <span className="text-slate-500">
                {" "}({a.analysis.analyzable && a.analysis.polarity ? a.analysis.polarity : "not analyzable"}
                {a.analysis.method === "fallback" ? ", fallback" : ""})
              </span>
            )}
          </li>
        );
      })}
    </ul>
  );
}

function DecisionForm({ onDecide }: { onDecide: (d: FlagDecision, note: string) => Promise<void> }) {
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState<FlagDecision | null>(null);
  const [error, setError] = useState<string | null>(null);
  const decide = async (d: FlagDecision) => {
    if (d === "excluded" && !note.trim()) {
      setError("Write a short reason before excluding, so the decision is on record.");
      return;
    }
    setBusy(d);
    setError(null);
    try {
      await onDecide(d, note.trim());
    } catch (err: any) {
      setError(err?.message || "Could not save the decision. Please try again.");
      setBusy(null);
    }
  };
  return (
    <div className="space-y-2">
      <textarea
        value={note}
        maxLength={300}
        rows={2}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Reason for your decision (required to exclude). The survey owner will see it."
        className="w-full p-2.5 rounded-xl border border-slate-200 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-200"
      />
      {error && <p className="text-xs text-rose-700">{error}</p>}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy !== null}
          onClick={() => decide("kept")}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white border border-blue-200 text-xs font-semibold text-blue-800 hover:bg-blue-50 disabled:opacity-50 cursor-pointer"
        >
          <CheckCircle2 className="w-4 h-4" />
          {busy === "kept" ? "Saving..." : "Keep (count it)"}
        </button>
        <button
          type="button"
          disabled={busy !== null}
          onClick={() => decide("excluded")}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white border border-red-200 text-xs font-semibold text-red-800 hover:bg-red-50 disabled:opacity-50 cursor-pointer"
        >
          <XCircle className="w-4 h-4" />
          {busy === "excluded" ? "Saving..." : "Exclude (do not count)"}
        </button>
      </div>
    </div>
  );
}

/** Review Center tab (admin): flagged responses waiting for a decision, and decided ones. */
export const FlaggedResponsesPanel: React.FC<Props> = ({ responses, surveys, onDecide }) => {
  const [view, setView] = useState<"waiting" | "decided">("waiting");
  const [changing, setChanging] = useState<string | null>(null);
  const surveyOf = (r: SurveyResponse) => surveys.find((s) => String(s.id) === String(r.surveyId));

  const waiting = useMemo(
    () => responses.filter((r) => r.review?.status === "flagged").sort((a, b) => (a.review!.flaggedAt || 0) - (b.review!.flaggedAt || 0)),
    [responses]
  );
  const decided = useMemo(
    () =>
      responses
        .filter((r) => r.review && r.review.status !== "flagged")
        .sort((a, b) => (b.review!.decidedAt || 0) - (a.review!.decidedAt || 0)),
    [responses]
  );
  const list = view === "waiting" ? waiting : decided;

  return (
    <div className="bg-white p-6 sm:p-8 rounded-3xl border border-slate-200 shadow-xs space-y-5">
      <div className="border-b border-slate-100 pb-4 space-y-1">
        <h2 className="font-serif text-xl font-bold text-slate-900 flex items-center gap-2">
          <Flag className="w-5 h-5 text-amber-600" />
          Flagged Responses
        </h2>
        <p className="text-xs text-slate-500">
          Survey owners flag responses that look wrong. Flagged responses still count until you decide. Excluded ones stay
          saved but are never counted in Analytics. The respondent's name is never shown here, so the decision is about
          the answers only.
        </p>
      </div>

      <div className="flex gap-1.5">
        {(
          [
            { id: "waiting", label: `Waiting (${waiting.length})` },
            { id: "decided", label: `Decided (${decided.length})` },
          ] as const
        ).map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setView(t.id)}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold border cursor-pointer ${
              view === t.id ? "bg-indigo-600 text-white border-indigo-600" : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {list.length === 0 ? (
        <p className="py-8 text-center text-sm text-slate-500">
          {view === "waiting" ? "No flagged responses are waiting." : "No decisions yet."}
        </p>
      ) : (
        <ul className="space-y-3">
          {list.map((r) => {
            const review = r.review!;
            const survey = surveyOf(r);
            const warnings = survey ? checkResponse(survey, r) : [];
            return (
              <li key={r.id} className="p-4 rounded-2xl border border-slate-200 space-y-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-slate-900 truncate">{survey?.title || r.surveyTitle || "Unknown survey"}</p>
                    <p className="text-[11px] text-slate-500">
                      Flagged by {review.flaggedBy} on {when(review.flaggedAt)}
                    </p>
                  </div>
                  <ReviewStatus review={review} />
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {review.reasons.map((reason) => (
                    <span key={reason} className="px-2 py-0.5 rounded-full bg-amber-50 border border-amber-200 text-[11px] font-semibold text-amber-900">
                      {reason}
                    </span>
                  ))}
                </div>
                {review.note && <p className="text-xs text-slate-700">Owner's note: {review.note}</p>}
                {warnings.length > 0 && (
                  <p className="text-[11px] text-slate-500">System warnings: {warnings.join(", ")}</p>
                )}
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                  <Answers survey={survey} response={r} />
                </div>

                {review.status !== "flagged" && (
                  <p className="text-xs text-slate-600">
                    Decided by {review.decidedBy} on {review.decidedAt ? when(review.decidedAt) : "—"}
                    {review.decisionNote ? `: ${review.decisionNote}` : ""}
                  </p>
                )}

                {review.status === "flagged" || changing === r.id ? (
                  <DecisionForm
                    onDecide={async (d, note) => {
                      await onDecide(r.id, d, note);
                      setChanging(null);
                    }}
                  />
                ) : (
                  <button
                    type="button"
                    onClick={() => setChanging(r.id)}
                    className="text-xs font-semibold text-indigo-700 hover:underline cursor-pointer"
                  >
                    Change decision
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};

export default FlaggedResponsesPanel;

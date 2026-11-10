import React, { useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, Flag, Hourglass, XCircle } from "lucide-react";
import { ResponseReview, Survey, SurveyResponse } from "../../types";
import { responsesToCheck } from "../../lib/responseChecks";

interface Props {
  survey: Survey;
  /** Responses in the chosen period (excluded ones already removed by the page). */
  responses: SurveyResponse[];
  /** Excluded responses of this survey, shown here so the owner sees the admin's decision. */
  excluded: SurveyResponse[];
  onFlag?: (response: SurveyResponse, suggested: string[]) => void;
}

const SHOW = 10;

export function ReviewStatus({ review }: { review: ResponseReview }) {
  if (review.status === "flagged") {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-800">
        <Hourglass className="w-3.5 h-3.5" /> Flagged, waiting for the admin
      </span>
    );
  }
  if (review.status === "kept") {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-800">
        <CheckCircle2 className="w-3.5 h-3.5" /> Admin kept it (counted)
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-red-800">
      <XCircle className="w-3.5 h-3.5" /> Admin excluded it (not counted)
    </span>
  );
}

/** One response's answers without any name, date or profile detail. */
function ResponseBody({ survey, response }: { survey: Survey; response: SurveyResponse }) {
  const ratings = survey.questions
    .map((q, i) => (q.type === "rating" && typeof response.answers[i]?.ratingValue === "number" ? `Q${i + 1}: ${response.answers[i].ratingValue}` : null))
    .filter(Boolean);
  const comments = survey.questions
    .map((q, i) => (q.type === "paragraph" ? { i, a: response.answers[i] } : null))
    .filter((x): x is { i: number; a: SurveyResponse["answers"][number] } => !!x && !!x.a && !!(x.a.answer || "").trim() && x.a.answer !== "No response");
  return (
    <div className="space-y-1 text-xs text-slate-700">
      {ratings.length > 0 && <p>Ratings: {ratings.join(" · ")}</p>}
      {comments.map(({ i, a }) => (
        <p key={i} className="break-words">
          <span className="text-slate-500">Q{i + 1}:</span> “{a.answer}”
          {a.analysis && (
            <span className="text-slate-500">
              {" "}({a.analysis.analyzable && a.analysis.polarity ? a.analysis.polarity : "not analyzable"})
            </span>
          )}
        </p>
      ))}
    </div>
  );
}

/**
 * Responses with automatic warnings (still counted) and responses already flagged or decided.
 * The owner can flag one for the admin; only the admin can exclude.
 */
export const ResponseChecks: React.FC<Props> = ({ survey, responses, excluded, onFlag }) => {
  const items = useMemo(() => {
    const list = responsesToCheck(survey, [...responses, ...excluded]);
    // Waiting ones first, then plain warnings, then decided ones.
    const rank = (r: SurveyResponse) => (r.review?.status === "flagged" ? 0 : !r.review ? 1 : 2);
    return list.sort((a, b) => rank(a.response) - rank(b.response));
  }, [survey, responses, excluded]);
  const [showAll, setShowAll] = useState(false);

  const warned = items.filter((x) => !x.response.review).length;
  const waiting = items.filter((x) => x.response.review?.status === "flagged").length;

  return (
    <div className="p-5 rounded-2xl bg-white border border-slate-200 space-y-3">
      <div className="flex items-center gap-2">
        <AlertTriangle className="w-4 h-4 text-amber-600" />
        <h3 className="text-sm font-bold text-slate-800">Responses to check</h3>
      </div>
      {items.length === 0 ? (
        <p className="text-sm text-slate-500">No response looks odd in this period.</p>
      ) : (
        <>
          <p className="text-xs text-slate-600">
            {warned} with a warning{waiting > 0 ? `, ${waiting} flagged and waiting for the admin` : ""}. Warnings are only
            hints: these responses are still counted. Flag one if it should not count; the admin decides.
          </p>
          <ul className="divide-y divide-slate-100 border border-slate-100 rounded-xl">
            {(showAll ? items : items.slice(0, SHOW)).map(({ response, warnings }, k) => (
              <li key={response.id} className="px-3 py-2.5 space-y-1.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-[11px] font-bold text-slate-500">Response {k + 1}</span>
                    {(response.review?.reasons.length ? response.review.reasons : warnings).map((w) => (
                      <span key={w} className="px-2 py-0.5 rounded-full bg-amber-50 border border-amber-200 text-[11px] font-semibold text-amber-900">
                        {w}
                      </span>
                    ))}
                  </div>
                  {response.review ? (
                    <ReviewStatus review={response.review} />
                  ) : (
                    onFlag && (
                      <button
                        type="button"
                        onClick={() => onFlag(response, warnings)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-amber-200 bg-white text-[11px] font-semibold text-amber-800 hover:bg-amber-50 cursor-pointer"
                      >
                        <Flag className="w-3.5 h-3.5" />
                        Flag for admin
                      </button>
                    )
                  )}
                </div>
                <ResponseBody survey={survey} response={response} />
                {response.review?.decisionNote && (
                  <p className="text-[11px] text-slate-500">Admin's note: {response.review.decisionNote}</p>
                )}
              </li>
            ))}
          </ul>
          {items.length > SHOW && (
            <button type="button" onClick={() => setShowAll((v) => !v)} className="text-xs font-semibold text-indigo-700 hover:underline cursor-pointer">
              {showAll ? "Show fewer" : `Show all ${items.length}`}
            </button>
          )}
        </>
      )}
    </div>
  );
};

export default ResponseChecks;

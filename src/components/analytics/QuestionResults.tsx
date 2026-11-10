import React, { useState } from "react";
import { ChevronDown, ChevronRight, Flag } from "lucide-react";
import { QuestionResult, interpretRating } from "../../lib/analytics";
import { CountBar, SENTIMENT_COLORS, SentimentBar, SentimentFootnote } from "./AnalyticsParts";
import { CommentAnalysis } from "../../types";

const COMMENTS_PER_PAGE = 20;

function CommentLabel({ analysis }: { analysis: CommentAnalysis | null }) {
  if (!analysis) {
    return <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">Not analyzed</span>;
  }
  if (!analysis.analyzable || !analysis.polarity) {
    return <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">Not analyzable</span>;
  }
  const key = analysis.polarity.toLowerCase() as keyof typeof SENTIMENT_COLORS;
  return (
    <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-slate-50 border border-slate-200 text-slate-700">
      <span className="w-2 h-2 rounded-sm" style={{ backgroundColor: SENTIMENT_COLORS[key] }} />
      {analysis.polarity}
      {analysis.method === "fallback" && <span className="normal-case font-semibold text-amber-700">· fallback</span>}
    </span>
  );
}

interface FlagProps {
  /** Whether the response holding a comment is already flagged or decided. */
  isFlagged?: (responseId: string) => boolean;
  /** Flag the response a comment belongs to (survey owner or admin). */
  onFlagComment?: (responseId: string) => void;
}

function CommentList({ result, isFlagged, onFlagComment }: { result: Extract<QuestionResult, { type: "paragraph" }> } & FlagProps) {
  const [shown, setShown] = useState(COMMENTS_PER_PAGE);
  if (result.comments.length === 0) return <p className="text-sm text-slate-500">No comments in this period.</p>;
  return (
    <div className="space-y-3">
      <SentimentBar counts={result.sentiment} compact />
      <SentimentFootnote counts={result.sentiment} />
      <ul className="divide-y divide-slate-100 border border-slate-100 rounded-xl">
        {result.comments.slice(0, shown).map((c, i) => (
          <li key={i} className="px-3 py-2.5 flex flex-col sm:flex-row sm:items-start gap-2 sm:justify-between">
            <p className="text-sm text-slate-800 whitespace-pre-wrap break-words min-w-0">{c.text}</p>
            <div className="shrink-0 flex items-center gap-2">
              <CommentLabel analysis={c.analysis} />
              {onFlagComment &&
                (isFlagged?.(c.responseId) ? (
                  <span className="text-[10px] font-bold uppercase text-amber-700">flagged</span>
                ) : (
                  <button
                    type="button"
                    onClick={() => onFlagComment(c.responseId)}
                    title="Flag this response for admin review"
                    aria-label="Flag this response for admin review"
                    className="p-1 rounded-md text-slate-400 hover:text-amber-700 hover:bg-amber-50 cursor-pointer"
                  >
                    <Flag className="w-3.5 h-3.5" />
                  </button>
                ))}
            </div>
          </li>
        ))}
      </ul>
      {shown < result.comments.length && (
        <button
          type="button"
          onClick={() => setShown((s) => s + COMMENTS_PER_PAGE)}
          className="text-xs font-semibold text-indigo-700 hover:underline cursor-pointer"
        >
          Show more ({result.comments.length - shown} left)
        </button>
      )}
    </div>
  );
}

function summaryLine(result: QuestionResult): string {
  if (result.type === "rating") {
    return result.average === null
      ? "No ratings"
      : `Average ${result.average.toFixed(2)} (${interpretRating(result.average)}) · ${result.answered} answered`;
  }
  if (result.type === "choice") return `${result.answered} answered`;
  return `${result.comments.length} comment${result.comments.length === 1 ? "" : "s"}`;
}

const TYPE_NAMES = { rating: "Rating", choice: "Choice", paragraph: "Comment" };

export function QuestionResults({
  results,
  sectionTitle,
  isFlagged,
  onFlagComment,
}: { results: QuestionResult[]; sectionTitle: (r: QuestionResult) => string | null } & FlagProps) {
  const [open, setOpen] = useState<Set<number>>(new Set());
  const toggle = (i: number) =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });

  return (
    <ul className="space-y-2">
      {results.map((r) => {
        const isOpen = open.has(r.index);
        const section = sectionTitle(r);
        return (
          <li key={r.index} className="border border-slate-200 rounded-2xl bg-white">
            <button
              type="button"
              onClick={() => toggle(r.index)}
              className="w-full flex items-start gap-3 px-4 py-3 text-left cursor-pointer"
            >
              {isOpen ? <ChevronDown className="w-4 h-4 mt-0.5 text-slate-500 shrink-0" /> : <ChevronRight className="w-4 h-4 mt-0.5 text-slate-500 shrink-0" />}
              <span className="min-w-0 flex-1">
                <span className="block text-[11px] font-bold uppercase tracking-wide text-slate-500">
                  Q{r.index + 1} · {r.type === "choice" && r.multi ? "Checkboxes" : TYPE_NAMES[r.type]}
                  {section ? ` · ${section}` : ""}
                </span>
                <span className="block text-sm font-semibold text-slate-900">{r.question.text}</span>
                <span className="block text-xs text-slate-500">{summaryLine(r)}</span>
              </span>
            </button>
            {isOpen && (
              <div className="px-4 pb-4 pl-11 space-y-2">
                {r.type === "rating" &&
                  r.counts
                    .slice()
                    .reverse()
                    .map((c) => (
                      <CountBar
                        key={c.value}
                        label={`${c.value}${r.question.labels?.[c.value - (r.question.min ?? 1)] ? ` · ${r.question.labels[c.value - (r.question.min ?? 1)]}` : ""}`}
                        count={c.count}
                        total={r.answered}
                      />
                    ))}
                {r.type === "choice" && (
                  <>
                    {r.counts.map((c) => (
                      <CountBar key={c.option} label={c.option} count={c.count} total={r.answered} />
                    ))}
                    {r.multi && <p className="text-xs text-slate-500">People could pick more than one, so these can add up to more than 100%.</p>}
                  </>
                )}
                {r.type === "paragraph" && <CommentList result={r} isFlagged={isFlagged} onFlagComment={onFlagComment} />}
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

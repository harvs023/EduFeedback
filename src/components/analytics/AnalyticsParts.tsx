import React from "react";
import { AlertTriangle, Info } from "lucide-react";
import { MIN_RESPONSES, SampleLevel, SentimentCounts, interpretRating, percent } from "../../lib/analytics";

/** Sentiment colors: a diverging pair (blue / red) with a gray middle, checked for color blindness. */
export const SENTIMENT_COLORS = { positive: "#2563eb", neutral: "#cbd5e1", negative: "#dc2626" };

export const fmtPct = (value: number) => `${Math.round(value)}%`;

export function SampleNotice({ level, n }: { level: SampleLevel; n: number }) {
  if (level === "normal") return null;
  if (level === "insufficient") {
    return (
      <div className="flex items-start gap-2 px-4 py-3 rounded-2xl bg-slate-100 border border-slate-200 text-sm text-slate-700">
        <Info className="w-4 h-4 mt-0.5 shrink-0 text-slate-500" />
        <span>
          <strong>Not enough responses to analyze yet ({n} of {MIN_RESPONSES}).</strong> Results appear once at least{" "}
          {MIN_RESPONSES} people have answered in this period, so no one's answers can be singled out.
        </span>
      </div>
    );
  }
  return (
    <div className="flex items-start gap-2 px-4 py-3 rounded-2xl bg-amber-50 border border-amber-200 text-sm text-amber-900">
      <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0 text-amber-600" />
      <span>
        <strong>Small sample (n = {n}), read with caution.</strong> With fewer than 30 responses, a few answers can
        change these numbers a lot.
      </span>
    </div>
  );
}

/** "3.9 / 5 · Very Good" */
export function RatingValue({ average }: { average: number | null }) {
  if (average === null) return <span className="text-slate-400">No ratings</span>;
  return (
    <span>
      {average.toFixed(2)} <span className="text-slate-400 font-medium">/ 5</span>
      <span className="block text-xs font-semibold text-slate-500">{interpretRating(average)}</span>
    </span>
  );
}

export function StatCard({
  label,
  children,
  hint,
}: {
  label: string;
  children: React.ReactNode;
  hint?: React.ReactNode;
}) {
  return (
    <div className="p-4 rounded-2xl bg-white border border-slate-200 min-w-0">
      <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">{label}</p>
      <div className="mt-1 text-2xl font-extrabold text-slate-900 leading-tight">{children}</div>
      {hint && <div className="mt-1 text-xs text-slate-500">{hint}</div>}
    </div>
  );
}

/** Change between two values, e.g. "▲ 0.30 vs other period". */
export function Change({ now, before, digits = 2, suffix = "" }: { now: number | null; before: number | null; digits?: number; suffix?: string }) {
  if (now === null || before === null) return null;
  const diff = now - before;
  const shown = Math.abs(diff).toFixed(digits);
  if (Number(shown) === 0) return <span className="text-slate-500">No change vs other period</span>;
  return (
    <span className={diff > 0 ? "text-blue-700" : "text-red-700"}>
      {diff > 0 ? "▲" : "▼"} {shown}
      {suffix} vs other period
    </span>
  );
}

/** Below this share a percentage does not fit inside its bar segment. */
const INSIDE_LABEL_MIN = 12;
/** Neutral is drawn across both halves, so it has twice the room of one segment. */
const NEUTRAL_LABEL_MIN = 8;

/** Scale shown above a list of diverging sentiment bars. */
export function DivergingAxis() {
  return (
    <div className="grid grid-cols-3 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
      <span>More negative</span>
      <span className="text-center">0</span>
      <span className="text-right">More positive</span>
    </div>
  );
}

/**
 * Diverging bar: negative grows left from the middle line, positive grows right,
 * neutral is split evenly across the middle. Each side of the line is 0-100% of
 * the analyzed comments, so bars in a list can be compared with each other.
 */
/** Color key in bar order: Negative, Neutral, Positive. */
export function SentimentLegend() {
  return (
    <span className="flex flex-wrap gap-3 text-xs text-slate-600">
      {(["negative", "neutral", "positive"] as const).map((k) => (
        <span key={k} className="inline-flex items-center gap-1">
          <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: SENTIMENT_COLORS[k] }} />
          {k[0].toUpperCase() + k.slice(1)}
        </span>
      ))}
    </span>
  );
}

/** Row label for a list of diverging bars: name, then "n = 12 comments · neutral 17%". */
export function SentimentRowLabel({ name, counts }: { name: string; counts: SentimentCounts }) {
  return (
    <span className="min-w-0">
      <span className="block text-sm font-semibold text-slate-800 truncate" title={name}>
        {name}
      </span>
      <span className="block text-[11px] text-slate-500">
        n = {counts.analyzed} comment{counts.analyzed === 1 ? "" : "s"} · neutral{" "}
        {fmtPct(percent(counts.neutral, counts.analyzed))}
      </span>
    </span>
  );
}

export function SentimentBar({
  counts,
  compact = false,
  legend = true,
}: {
  counts: SentimentCounts;
  compact?: boolean;
  /** false in lists that use SentimentRowLabel and a SentimentLegend in the header. */
  legend?: boolean;
}) {
  if (counts.analyzed === 0) {
    return <p className="text-sm text-slate-500">No analyzed comments in this period.</p>;
  }
  const parts = [
    { key: "negative" as const, label: "Negative", value: counts.negative },
    { key: "neutral" as const, label: "Neutral", value: counts.neutral },
    { key: "positive" as const, label: "Positive", value: counts.positive },
  ];
  const pct = {
    positive: percent(counts.positive, counts.analyzed),
    neutral: percent(counts.neutral, counts.analyzed),
    negative: percent(counts.negative, counts.analyzed),
  };
  const tip = (p: (typeof parts)[number]) =>
    `${p.label}: ${p.value} of ${counts.analyzed} comments (${fmtPct(pct[p.key])})`;
  // A segment's width in the whole bar = its share / 2 (each side is half the bar).
  const segment = (key: "positive" | "neutral" | "negative", share: number, rounded: string, showLabel: boolean) =>
    share > 0 ? (
      <div
        className={`h-full flex items-center justify-center text-[11px] font-bold text-white ${rounded}`}
        style={{ width: `${share / 2}%`, backgroundColor: SENTIMENT_COLORS[key] }}
        title={tip(parts.find((p) => p.key === key)!)}
      >
        {showLabel && pct[key] >= INSIDE_LABEL_MIN ? fmtPct(pct[key]) : null}
      </div>
    ) : null;
  // Too small to hold its number: write it just outside the bar end instead.
  const outside = (key: "negative" | "positive") =>
    pct[key] < INSIDE_LABEL_MIN ? (
      <span className={`self-center text-[11px] font-bold text-slate-600 ${key === "negative" ? "pr-1" : "pl-1"}`}>
        {fmtPct(pct[key])}
      </span>
    ) : null;
  return (
    <div className="space-y-2">
      <div className={`relative flex w-full ${compact ? "h-5" : "h-6"}`}>
        <div className="flex w-1/2 justify-end gap-0.5 pr-px">
          {outside("negative")}
          {segment("negative", pct.negative, "rounded-l-md", true)}
          {segment("neutral", pct.neutral, "", false)}
        </div>
        <div className="flex w-1/2 gap-0.5 pl-px">
          {segment("neutral", pct.neutral, "", false)}
          {segment("positive", pct.positive, "rounded-r-md", true)}
          {outside("positive")}
        </div>
        <div className="absolute -inset-y-0.75 left-1/2 w-px bg-slate-400" aria-hidden="true" />
        {/* Neutral spans the middle line; its number sits on the line (dark text, gray is light). */}
        {pct.neutral >= NEUTRAL_LABEL_MIN && (
          <span
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 px-1 rounded text-[11px] font-bold text-slate-800"
            style={{ backgroundColor: SENTIMENT_COLORS.neutral }}
          >
            {fmtPct(pct.neutral)}
          </span>
        )}
      </div>
      {legend && (
        <div className={`flex flex-wrap justify-center gap-x-4 gap-y-1 ${compact ? "text-xs" : "text-sm"} text-slate-700`}>
          {parts.map((p) => (
            <span key={p.key} className="inline-flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: SENTIMENT_COLORS[p.key] }} />
              {p.label} <strong>{fmtPct(pct[p.key])}</strong>
              {!compact && <span className="text-slate-400">({p.value})</span>}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

/** "12 comments analyzed, 2 by the fallback word list. 1 not analyzable, 3 waiting for analysis." */
export function SentimentFootnote({ counts }: { counts: SentimentCounts }) {
  const bits = [`${counts.analyzed} comment${counts.analyzed === 1 ? "" : "s"} analyzed`];
  if (counts.fallback > 0) bits[0] += `, ${counts.fallback} labeled by the fallback word list`;
  if (counts.notAnalyzable > 0) bits.push(`${counts.notAnalyzable} not analyzable (empty, joke or nonsense)`);
  if (counts.pending > 0) bits.push(`${counts.pending} not analyzed yet (the admin can re-run them)`);
  return <p className="text-xs text-slate-500">{bits.join(". ")}.</p>;
}

/** A single-hue horizontal bar for counts (rating values, options). */
export function CountBar({ label, count, total, title }: { label: React.ReactNode; count: number; total: number; title?: string }) {
  const p = percent(count, total);
  return (
    <div className="grid grid-cols-[minmax(0,9rem)_1fr_4.5rem] sm:grid-cols-[minmax(0,14rem)_1fr_5rem] items-center gap-3 text-sm">
      <span className="truncate text-slate-700" title={typeof label === "string" ? label : undefined}>
        {label}
      </span>
      <div className="h-2.5 rounded-full bg-slate-100 overflow-hidden" title={title}>
        {count > 0 && <div className="h-full rounded-full bg-indigo-500" style={{ width: `${p}%` }} />}
      </div>
      <span className="text-right text-slate-600 tabular-nums">
        {fmtPct(p)} <span className="text-slate-400">({count})</span>
      </span>
    </div>
  );
}

import React from "react";
import { BarChart3, BrainCircuit, CheckCircle2, ChevronRight, type LucideIcon } from "lucide-react";

export interface WaitingTile<T extends string> {
  id: T;
  label: string;
  /** e.g. "surveys to approve" */
  noun: string;
  count: number;
  icon: LucideIcon;
}

/**
 * Review Center Home: what is waiting for the admin (click to open), the live switches and a few
 * key numbers, the setup checklist, and shortcuts.
 */
export function ReviewCenterHome<T extends string>({
  waiting,
  onOpen,
  status,
  numbers,
  setup,
  onNavigateToAnalytics,
  onNavigateToSentiment,
}: {
  waiting: WaitingTile<T>[];
  onOpen: (id: T) => void;
  /** Active users card and survey creation switch. */
  status: React.ReactNode;
  numbers: { label: string; value: number | string; id?: T }[];
  setup: React.ReactNode;
  onNavigateToAnalytics?: () => void;
  onNavigateToSentiment?: () => void;
}) {
  const total = waiting.reduce((s, w) => s + w.count, 0);
  const shortcut =
    "inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white border border-slate-200 text-sm font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer";

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900">Home</h1>
          <p className="text-sm text-slate-500">
            {total === 0 ? "Nothing is waiting for you right now." : `${total} item${total === 1 ? "" : "s"} waiting for you.`}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {onNavigateToAnalytics && (
            <button type="button" onClick={onNavigateToAnalytics} className={shortcut}>
              <BarChart3 className="w-4 h-4 text-indigo-600" /> Analytics
            </button>
          )}
          {onNavigateToSentiment && (
            <button type="button" onClick={onNavigateToSentiment} className={shortcut}>
              <BrainCircuit className="w-4 h-4 text-emerald-600" /> Sentiment Analysis
            </button>
          )}
        </div>
      </div>

      <section aria-label="Waiting for you" className="space-y-2">
        <h2 className="text-xs font-bold uppercase tracking-wide text-slate-500">Waiting for you</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
          {waiting.map((w) => {
            const Icon = w.icon;
            const has = w.count > 0;
            return (
              <button
                key={w.id}
                type="button"
                onClick={() => onOpen(w.id)}
                className={`flex items-center gap-3 p-4 rounded-2xl border text-left cursor-pointer transition-colors ${
                  has ? "bg-white border-indigo-200 hover:border-indigo-400" : "bg-slate-50 border-slate-200 hover:bg-white"
                }`}
              >
                <span className={`p-2 rounded-xl ${has ? "bg-indigo-50 text-indigo-600" : "bg-white text-slate-400"}`}>
                  {has ? <Icon className="w-5 h-5" /> : <CheckCircle2 className="w-5 h-5 text-emerald-500" />}
                </span>
                <span className="flex-1 min-w-0">
                  <span className={`block text-2xl font-extrabold leading-none ${has ? "text-slate-900" : "text-slate-400"}`}>
                    {w.count}
                  </span>
                  <span className="block text-sm text-slate-600 mt-1">{w.noun}</span>
                </span>
                <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
              </button>
            );
          })}
        </div>
      </section>

      <section aria-label="Status" className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
        {status}
        {numbers.map((n) => {
          const body = (
            <>
              <span className="block text-[11px] font-bold uppercase tracking-wide text-slate-500">{n.label}</span>
              <span className="block text-2xl font-extrabold text-slate-900 mt-1">{n.value}</span>
            </>
          );
          return n.id ? (
            <button
              key={n.label}
              type="button"
              onClick={() => onOpen(n.id as T)}
              className="p-4 rounded-2xl bg-white border border-slate-200 text-left hover:border-slate-300 cursor-pointer"
            >
              {body}
            </button>
          ) : (
            <div key={n.label} className="p-4 rounded-2xl bg-white border border-slate-200">
              {body}
            </div>
          );
        })}
      </section>

      {setup}
    </div>
  );
}

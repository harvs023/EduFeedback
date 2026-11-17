import React from "react";
import type { LucideIcon } from "lucide-react";

export interface ReviewCenterItem<T extends string> {
  id: T;
  label: string;
  icon: LucideIcon;
  /** Things waiting for the admin (shown as a highlighted badge when > 0). */
  waiting?: number;
}

export interface ReviewCenterGroup<T extends string> {
  title: string;
  items: ReviewCenterItem<T>[];
}

/**
 * Review Center frame: a grouped side menu (a dropdown on small screens) and the chosen page.
 * The pages themselves are unchanged; this only replaces the old row of 12 tabs.
 */
export function ReviewCenterLayout<T extends string>({
  groups,
  active,
  onSelect,
  children,
}: {
  groups: ReviewCenterGroup<T>[];
  active: T;
  onSelect: (id: T) => void;
  children: React.ReactNode;
}) {
  const all = groups.flatMap((g) => g.items);
  const current = all.find((i) => i.id === active);

  return (
    <div className="flex flex-col lg:flex-row gap-5 lg:gap-6 items-start">
      {/* Small screens: one dropdown */}
      <div className="w-full lg:hidden">
        <label className="block text-[11px] font-bold uppercase tracking-wide text-slate-500 mb-1">Review Center</label>
        <select
          value={active}
          onChange={(e) => onSelect(e.target.value as T)}
          className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-white text-sm font-semibold text-slate-800"
        >
          {groups.map((g) => (
            <optgroup key={g.title} label={g.title}>
              {g.items.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.label}
                  {i.waiting ? ` (${i.waiting} waiting)` : ""}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </div>

      {/* Large screens: side menu */}
      <nav
        aria-label="Review Center"
        className="hidden lg:block w-60 shrink-0 sticky top-4 bg-white rounded-2xl border border-slate-200 p-3 space-y-4"
      >
        <p className="px-2 pt-1 text-sm font-extrabold text-slate-900">Review Center</p>
        {groups.map((g) => (
          <div key={g.title} className="space-y-0.5">
            {g.title && (
              <p className="px-2 pb-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">{g.title}</p>
            )}
            {g.items.map((i) => {
              const Icon = i.icon;
              const on = i.id === active;
              return (
                <button
                  key={i.id}
                  type="button"
                  onClick={() => onSelect(i.id)}
                  aria-current={on ? "page" : undefined}
                  className={`w-full flex items-center gap-2.5 px-2 py-2 rounded-lg text-sm text-left cursor-pointer transition-colors ${
                    on ? "bg-indigo-50 text-indigo-800 font-bold" : "text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  <Icon className={`w-4 h-4 shrink-0 ${on ? "text-indigo-600" : "text-slate-400"}`} />
                  <span className="flex-1 truncate">{i.label}</span>
                  {!!i.waiting && (
                    <span className="min-w-5 px-1.5 py-0.5 rounded-full bg-rose-500 text-white text-[10px] font-bold text-center">
                      {i.waiting}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        ))}
      </nav>

      <main className="flex-1 min-w-0 w-full space-y-5" aria-label={current?.label}>
        {children}
      </main>
    </div>
  );
}

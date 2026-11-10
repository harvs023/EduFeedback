import React, { useState } from "react";
import { RefreshCw } from "lucide-react";
import { UserProfile } from "../types";

/** "Active now" = had the app open within this time (the heartbeat writes every 5 minutes). */
export const ACTIVE_WINDOW_MS = 10 * 60 * 1000;

export function activeCounts(users: UserProfile[], now: number = Date.now()) {
  const midnight = new Date(now);
  midnight.setHours(0, 0, 0, 0);
  const seen = users.map((u) => u.lastSeenAt || 0);
  return {
    now: seen.filter((t) => t > 0 && now - t <= ACTIVE_WINDOW_MS).length,
    today: seen.filter((t) => t >= midnight.getTime()).length,
  };
}

/** Review Center card (admin): how many people had EduFeedback open recently. */
export const ActiveUsersCard: React.FC<{ users: UserProfile[]; onRefresh?: () => Promise<void> }> = ({ users, onRefresh }) => {
  const [busy, setBusy] = useState(false);
  const [checkedAt, setCheckedAt] = useState(Date.now());
  const counts = activeCounts(users, checkedAt);

  const refresh = async () => {
    if (!onRefresh) return;
    setBusy(true);
    try {
      await onRefresh();
      setCheckedAt(Date.now());
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="bg-slate-800/80 p-4 rounded-2xl border border-slate-700/80">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Active users</span>
        {onRefresh && (
          <button
            type="button"
            onClick={refresh}
            disabled={busy}
            title="Check again"
            aria-label="Check active users again"
            className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-slate-700 cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${busy ? "animate-spin" : ""}`} />
          </button>
        )}
      </div>
      <div className="font-serif text-2xl font-black text-emerald-400 flex items-center gap-2">
        <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" aria-hidden="true" />
        {counts.now} <span className="text-sm font-sans font-semibold text-emerald-300">now</span>
      </div>
      <span className="text-[11px] text-slate-400">
        {counts.today} today · checked {new Date(checkedAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
      </span>
    </div>
  );
};

export default ActiveUsersCard;

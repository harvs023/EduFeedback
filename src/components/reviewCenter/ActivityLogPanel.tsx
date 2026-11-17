import { useMemo, useState } from "react";
import { Download, Search } from "lucide-react";
import type { ActivityLog } from "../../types";
import { formatDateTime, timeAgo } from "../../lib/timeAgo";

/** How many entries the app loads (newest first); see FirestoreLogService. */
const LOADED_LIMIT = 200;

type Kind = "accounts" | "surveys" | "responses" | "topics" | "news" | "school" | "system" | "other";

const KINDS: { id: Kind; label: string; className: string }[] = [
  { id: "accounts", label: "Accounts", className: "bg-sky-50 text-sky-700" },
  { id: "surveys", label: "Surveys", className: "bg-indigo-50 text-indigo-700" },
  { id: "responses", label: "Answers & comments", className: "bg-emerald-50 text-emerald-700" },
  { id: "topics", label: "Topics", className: "bg-violet-50 text-violet-700" },
  { id: "news", label: "News", className: "bg-amber-50 text-amber-800" },
  { id: "school", label: "School setup", className: "bg-teal-50 text-teal-700" },
  { id: "system", label: "Backup & settings", className: "bg-rose-50 text-rose-700" },
  { id: "other", label: "Other", className: "bg-slate-100 text-slate-600" },
];

/** Groups an action name into a type, by the words it contains. */
function kindOf(action: string): Kind {
  const a = action.toLowerCase();
  if (/response|sentiment|comment/.test(a)) return "responses";
  if (/topic/.test(a)) return "topics";
  if (/news/.test(a)) return "news";
  if (/backup|restore|database|creation|setting/.test(a)) return "system";
  if (/school setup|calendar/.test(a)) return "school";
  if (/user|account|sign|profile|password|position|school year/.test(a)) return "accounts";
  if (/survey|report/.test(a)) return "surveys";
  return "other";
}

const whenText = (l: ActivityLog) => (l.timestamp ? formatDateTime(l.timestamp) : l.time);

function csvCell(v: string): string {
  return `"${v.replace(/"/g, '""')}"`;
}

/** Review Center > Activity log: the latest entries with search and a filter by type of action. */
export function ActivityLogPanel({ logs }: { logs: ActivityLog[] }) {
  const [search, setSearch] = useState("");
  const [kind, setKind] = useState<Kind | "all">("all");

  const counts = useMemo(() => {
    const c = new Map<Kind, number>();
    logs.forEach((l) => c.set(kindOf(l.action), (c.get(kindOf(l.action)) || 0) + 1));
    return c;
  }, [logs]);

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return logs.filter((l) => {
      if (kind !== "all" && kindOf(l.action) !== kind) return false;
      if (!q) return true;
      return [l.user, l.pos, l.action, l.details].some((v) => (v || "").toLowerCase().includes(q));
    });
  }, [logs, search, kind]);

  const filtered = search.trim() !== "" || kind !== "all";

  const handleExport = () => {
    const headers = ["Date and time", "Who", "Position", "Type", "Action", "Details"];
    const lines = rows.map((l) =>
      [whenText(l), l.user, l.pos, KINDS.find((k) => k.id === kindOf(l.action))!.label, l.action, l.details || ""]
        .map((v) => csvCell(String(v ?? "")))
        .join(","),
    );
    const blob = new Blob(["﻿" + [headers.join(","), ...lines].join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `EduFeedback_activity_log_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const select = "px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm text-slate-700";

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900">Activity log</h1>
          <p className="text-sm text-slate-500">
            {filtered ? `${rows.length} of ${logs.length} entries` : `${logs.length} entries`} · newest first
            {logs.length >= LOADED_LIMIT ? ` · only the latest ${LOADED_LIMIT} are shown` : ""}
          </p>
        </div>
        <button
          onClick={handleExport}
          disabled={rows.length === 0}
          className="px-3.5 py-2.5 bg-white hover:bg-slate-50 text-slate-700 font-semibold text-sm rounded-xl flex items-center gap-2 cursor-pointer border border-slate-200 disabled:opacity-40 self-start sm:self-auto"
          title="Download the entries shown below (CSV)"
        >
          <Download className="w-4 h-4 text-slate-500" />
          <span>Export list</span>
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 p-3 flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-48">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search who, action or details"
            aria-label="Search the activity log"
            className="w-full pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-xl text-sm"
          />
        </div>
        <select value={kind} onChange={(e) => setKind(e.target.value as Kind | "all")} className={select} aria-label="Type of action">
          <option value="all">All types</option>
          {KINDS.filter((k) => counts.get(k.id)).map((k) => (
            <option key={k.id} value={k.id}>
              {k.label} ({counts.get(k.id)})
            </option>
          ))}
        </select>
        {filtered && (
          <button
            onClick={() => {
              setSearch("");
              setKind("all");
            }}
            className="text-sm text-indigo-700 hover:underline font-semibold cursor-pointer px-2"
          >
            Clear
          </button>
        )}
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        {rows.length === 0 ? (
          <p className="p-8 text-center text-sm text-slate-500">
            {logs.length === 0 ? "Nothing has been logged yet." : "No entries match your search."}
          </p>
        ) : (
          <div className="overflow-x-auto max-h-[70vh] overflow-y-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead className="bg-slate-50 text-slate-600 text-xs font-semibold sticky top-0">
                <tr>
                  <th className="px-4 py-3">When</th>
                  <th className="px-4 py-3">Who</th>
                  <th className="px-4 py-3">What happened</th>
                  <th className="px-4 py-3">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {rows.map((log, idx) => {
                  const k = KINDS.find((x) => x.id === kindOf(log.action))!;
                  return (
                    <tr key={log.id || idx} className="hover:bg-slate-50 align-top">
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="block text-slate-800">{log.timestamp ? timeAgo(log.timestamp) : log.time}</span>
                        {log.timestamp && <span className="block text-xs text-slate-400">{formatDateTime(log.timestamp)}</span>}
                      </td>
                      <td className="px-4 py-3">
                        <span className="block font-semibold text-slate-900">{log.user}</span>
                        <span className="block text-xs text-slate-500">{log.pos}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-semibold mb-1 ${k.className}`}>{k.label}</span>
                        <span className="block font-semibold text-slate-800">{log.action}</span>
                      </td>
                      <td className="px-4 py-3 text-slate-600 min-w-64">{log.details}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

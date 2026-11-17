import { useState } from "react";
import { Pin, ThumbsUp, Trash2 } from "lucide-react";
import type { NewsAnnouncement } from "../../types";
import { timeAgo } from "../../lib/timeAgo";

const CATEGORY_STYLE: Record<NewsAnnouncement["category"], { label: string; className: string }> = {
  "Survey Results Action": { label: "Action on feedback", className: "bg-emerald-50 text-emerald-700" },
  "Campus Announcement": { label: "Announcement", className: "bg-blue-50 text-blue-700" },
  "System Update": { label: "System update", className: "bg-indigo-50 text-indigo-700" },
  "Policy Change": { label: "Policy", className: "bg-amber-50 text-amber-800" },
};

const AVATAR_COLORS = ["bg-indigo-600", "bg-emerald-600", "bg-sky-600", "bg-amber-600", "bg-rose-600", "bg-violet-600"];

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] || "?") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase();
}

export function avatarColor(name: string): string {
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}

/** When the post appeared in the feed (approval time, else when it was sent), or null. */
export function postTime(n: NewsAnnouncement): number | null {
  return n.reviewedAt || n.submittedAt || (n.date && Number.isFinite(Date.parse(n.date)) ? Date.parse(n.date) : null);
}

/** One post in the feed, styled like a social post: author, time, category, text, Helpful. */
export function NewsPost({
  post,
  liked,
  onLike,
  onDelete,
}: {
  post: NewsAnnouncement;
  liked: boolean;
  onLike: () => void;
  /** Admin only. */
  onDelete?: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const cat = CATEGORY_STYLE[post.category] || { label: post.category, className: "bg-slate-100 text-slate-700" };
  const time = postTime(post);
  const body = post.content || post.summary;
  const long = body.length > 280;

  return (
    <article
      className={`bg-white rounded-2xl border p-4 sm:p-5 space-y-3 ${post.isPinned ? "border-indigo-200 ring-1 ring-indigo-100" : "border-slate-200"}`}
    >
      <header className="flex items-start gap-3">
        <span
          className={`w-10 h-10 rounded-full ${avatarColor(post.author)} text-white text-sm font-bold flex items-center justify-center shrink-0`}
          aria-hidden="true"
        >
          {initials(post.author)}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-slate-900 truncate">{post.author}</p>
          <p className="text-xs text-slate-500">{time ? timeAgo(time) : post.date}</p>
        </div>
        {post.isPinned && (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-full">
            <Pin className="w-3 h-3 rotate-45" /> Pinned
          </span>
        )}
      </header>

      <div className="space-y-1.5">
        <div className="flex flex-wrap gap-1.5">
          <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${cat.className}`}>{cat.label}</span>
          {post.badgeText && post.badgeText !== cat.label && (
            <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-700">{post.badgeText}</span>
          )}
        </div>
        <h3 className="text-base font-bold text-slate-900 leading-snug">{post.title}</h3>
        <p className={`text-sm text-slate-700 leading-relaxed whitespace-pre-line ${!expanded && long ? "line-clamp-4" : ""}`}>
          {body}
        </p>
        {long && (
          <button type="button" onClick={() => setExpanded(!expanded)} className="text-xs font-bold text-slate-500 hover:text-slate-800 cursor-pointer">
            {expanded ? "See less" : "See more"}
          </button>
        )}
      </div>

      <footer className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={onLike}
          aria-pressed={liked}
          title={liked ? "You marked this helpful. Click to undo." : "Mark as helpful"}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold cursor-pointer transition-colors ${
            liked ? "text-indigo-700 bg-indigo-50" : "text-slate-600 hover:bg-slate-50"
          }`}
        >
          <ThumbsUp className={`w-4 h-4 ${liked ? "fill-indigo-600 text-indigo-600" : ""}`} />
          Helpful{post.likesCount > 0 ? ` · ${post.likesCount}` : ""}
        </button>
        {onDelete && (
          <button
            type="button"
            onClick={onDelete}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-slate-500 hover:text-rose-700 hover:bg-rose-50 cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" /> Delete
          </button>
        )}
      </footer>
    </article>
  );
}

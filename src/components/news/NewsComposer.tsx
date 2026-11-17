import React, { useState } from "react";
import { X } from "lucide-react";
import type { NewsAnnouncement } from "../../types";

/** "Write a post" window. Admin posts publish at once; everyone else's go to the admin first. */
export function NewsComposer({
  authorName,
  isAdmin,
  atPendingLimit,
  maxPending,
  onClose,
  onSubmit,
}: {
  authorName: string;
  isAdmin: boolean;
  atPendingLimit: boolean;
  maxPending: number;
  onClose: () => void;
  /** Resolves to true when the post was saved. */
  onSubmit: (news: Omit<NewsAnnouncement, "id" | "likesCount">) => Promise<boolean>;
}) {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [category, setCategory] = useState<NewsAnnouncement["category"]>("Survey Results Action");
  const [badgeText, setBadgeText] = useState("");
  const [isPinned, setIsPinned] = useState(false);
  const [saving, setSaving] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !content.trim() || atPendingLimit) return;
    setSaving(true);
    try {
      const firstSentence = content.trim().split(/(?<=[.!?])\s/)[0].slice(0, 200);
      const saved = await onSubmit({
        title: title.trim(),
        summary: firstSentence || title.trim(),
        content: content.trim(),
        category,
        author: authorName,
        date: new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
        isPinned: isAdmin && isPinned,
        badgeText: badgeText.trim(),
      });
      // Keep what was typed if saving failed, so nothing is lost.
      if (saved) onClose();
    } finally {
      setSaving(false);
    }
  };

  const field = "w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-hidden focus:border-indigo-400 focus:bg-white";

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white rounded-3xl max-w-xl w-full p-6 shadow-2xl border border-slate-200 space-y-4"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Write a post"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-lg font-bold text-slate-900">Write a post</h3>
            <p className="text-xs text-slate-500">
              {isAdmin ? "Your post is published right away." : "The administrator reviews your post before others can see it."}
            </p>
          </div>
          <button type="button" onClick={onClose} className="p-1 rounded-full hover:bg-slate-100 text-slate-400" aria-label="Close">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={submit} className="space-y-3">
          <input
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Title, e.g. Library hours extended after your feedback"
            className={field}
          />
          <textarea
            required
            rows={5}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="What would you like to share?"
            className={field}
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="block">
              <span className="block text-xs font-bold text-slate-700 mb-1">Type of post</span>
              <select value={category} onChange={(e) => setCategory(e.target.value as NewsAnnouncement["category"])} className={field}>
                <option value="Survey Results Action">Action on feedback</option>
                <option value="Campus Announcement">Announcement</option>
                <option value="System Update">System update</option>
                <option value="Policy Change">Policy</option>
              </select>
            </label>
            <label className="block">
              <span className="block text-xs font-bold text-slate-700 mb-1">Tag (optional)</span>
              <input value={badgeText} onChange={(e) => setBadgeText(e.target.value)} placeholder="e.g. New lab" className={field} />
            </label>
          </div>
          {isAdmin && (
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" checked={isPinned} onChange={(e) => setIsPinned(e.target.checked)} className="rounded" />
              Pin to the top of the feed
            </label>
          )}
          {atPendingLimit && (
            <p className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-xs font-semibold text-amber-900">
              You already have {maxPending} posts waiting for review. Wait for a decision or delete one under "Your posts".
            </p>
          )}
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={onClose} className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-bold rounded-xl cursor-pointer">
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || atPendingLimit}
              className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold rounded-xl cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? "Posting..." : isAdmin ? "Post" : "Send for approval"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

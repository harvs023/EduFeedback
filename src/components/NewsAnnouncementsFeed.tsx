import React, { useState } from "react";
import { useConfirm } from "./ConfirmDialog";
import { NewsAnnouncement, UserProfile } from "../types";
import {
  Newspaper,
  Sparkles,
  Pin,
  Heart,
  PlusCircle,
  Calendar,
  User,
  Tag,
  CheckCircle2,
  Share2,
  X,
  ChevronDown,
  Clock,
  Trash2,
} from "lucide-react";

/** Most posts one person may have waiting for review (admin has no limit). */
export const MAX_PENDING_NEWS = 3;

interface NewsAnnouncementsFeedProps {
  newsList: NewsAnnouncement[];
  currentUser: UserProfile | null;
  /** Resolves to true when the post was saved. */
  onAddNews: (news: Omit<NewsAnnouncement, "id" | "likesCount">) => Promise<boolean>;
  onLikeNews: (id: string) => void;
  onDeleteNews?: (id: string) => Promise<void> | void;
  limit?: number;
}

export const NewsAnnouncementsFeed: React.FC<NewsAnnouncementsFeedProps> = ({
  newsList,
  currentUser,
  onAddNews,
  onLikeNews,
  onDeleteNews,
  limit,
}) => {
  const { confirm, confirmDialog } = useConfirm();
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [activeArticle, setActiveArticle] = useState<NewsAnnouncement | null>(null);
  const [showCreateModal, setShowCreateModal] = useState<boolean>(false);
  const [isExpanded, setIsExpanded] = useState<boolean>(false);

  // New post form state
  const [title, setTitle] = useState<string>("");
  const [summary, setSummary] = useState<string>("");
  const [content, setContent] = useState<string>("");
  const [category, setCategory] = useState<NewsAnnouncement["category"]>("Survey Results Action");
  const [badgeText, setBadgeText] = useState<string>("Action Taken");
  const [isPinned, setIsPinned] = useState<boolean>(false);

  const isSuperadmin = currentUser?.role === "superadmin" || currentUser?.pos === "Superadmin";
  const canPost = isSuperadmin || (Boolean(currentUser) && currentUser?.canPostNews !== false);
  const myEmail = (currentUser?.email || "").trim().toLowerCase();
  const myPosts = newsList.filter((n) => n.authorEmail === myEmail);
  const myPendingCount = myPosts.filter((n) => n.status === "pending").length;
  const atPendingLimit = !isSuperadmin && myPendingCount >= MAX_PENDING_NEWS;

  // The public feed shows published posts only (older posts without a status count as published).
  const filteredNews = newsList.filter((item) => {
    if (item.status && item.status !== "published") return false;
    if (selectedCategory !== "all" && item.category !== selectedCategory) return false;
    return true;
  });

  const displayedNews = limit && !isExpanded ? filteredNews.slice(0, limit) : filteredNews;

  const handleSubmitNewPost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !content.trim() || atPendingLimit) return;

    setIsSaving(true);
    try {
      const saved = await onAddNews({
        title: title.trim(),
        summary: summary.trim() || title.trim(),
        content: content.trim(),
        category,
        author: currentUser?.name || "Campus Administration",
        date: new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
        isPinned: isSuperadmin && isPinned,
        badgeText: badgeText.trim() || "Announcement",
      });
      // Keep what was typed if saving failed, so nothing is lost.
      if (saved) {
        setTitle("");
        setSummary("");
        setContent("");
        setIsPinned(false);
        setShowCreateModal(false);
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeletePost = async (post: NewsAnnouncement) => {
    if (!onDeleteNews) return;
    const ok = await confirm({
      title: "Delete this post?",
      message: `"${post.title}" will be permanently deleted. This cannot be undone.`,
      confirmLabel: "Delete",
      danger: true,
    });
    if (ok) {
      await onDeleteNews(post.id);
      setActiveArticle(null);
    }
  };

  const getCategoryBadgeColor = (cat: NewsAnnouncement["category"]) => {
    switch (cat) {
      case "Survey Results Action":
        return "bg-emerald-50 text-emerald-700 border-emerald-200";
      case "Campus Announcement":
        return "bg-blue-50 text-blue-700 border-blue-200";
      case "System Update":
        return "bg-indigo-50 text-indigo-700 border-indigo-200";
      case "Policy Change":
        return "bg-amber-50 text-amber-700 border-amber-200";
      default:
        return "bg-slate-100 text-slate-700";
    }
  };

  return (
    <div className="space-y-8 pb-12">
      {confirmDialog}
      {/* Top Banner */}
      <div className="bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 text-white rounded-3xl p-6 sm:p-10 shadow-xl border border-slate-800 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/20 text-blue-300 text-xs font-bold uppercase tracking-wider border border-blue-400/30">
              <Newspaper className="w-3.5 h-3.5" />
              <span>Campus Feedback In Action · News & Transparency Feed</span>
            </div>
            <h1 className="font-serif text-2xl sm:text-4xl font-extrabold tracking-tight">
              Institutional Action Reports & Campus News
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 max-w-2xl leading-relaxed">
              Track real university improvements, facility upgrades, and policy adjustments implemented as a direct result
              of student and faculty feedback.
            </p>
          </div>

          {canPost && (
            <button
              onClick={() => setShowCreateModal(true)}
              className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-md shadow-blue-500/20 transition-all flex items-center gap-2 shrink-0 cursor-pointer"
            >
              <PlusCircle className="w-4 h-4" />
              <span>{isSuperadmin ? "Post Announcement" : "Post News"}</span>
            </button>
          )}
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-2 overflow-x-auto pt-4 border-t border-white/10 scrollbar-none">
          {[
            { id: "all", label: "All News & Updates" },
            { id: "Survey Results Action", label: "⚡ Actions on Feedback" },
            { id: "Campus Announcement", label: "📢 Campus Announcements" },
            { id: "System Update", label: "🤖 AI & Platform Updates" },
            { id: "Policy Change", label: "🏛️ Academic Policies" },
          ].map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold shrink-0 transition-all cursor-pointer ${
                selectedCategory === cat.id
                  ? "bg-white text-slate-900 shadow-md font-extrabold"
                  : "bg-white/10 text-white hover:bg-white/20"
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* My Posts: status of the person's own posts */}
      {!isSuperadmin && myPosts.length > 0 && (
        <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200 shadow-xs space-y-3">
          <h2 className="font-serif text-base font-bold text-slate-900">My Posts ({myPosts.length})</h2>
          <div className="space-y-2.5">
            {myPosts.map((post) => (
              <div key={post.id} className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1.5">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <span className="text-xs font-bold text-slate-900">{post.title}</span>
                  <div className="flex items-center gap-2">
                    {post.status === "pending" && (
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-orange-50 text-orange-700 border border-orange-200 inline-flex items-center gap-1">
                        <Clock className="w-3 h-3" /> Waiting for review
                      </span>
                    )}
                    {post.status === "rejected" && (
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200 inline-flex items-center gap-1">
                        <X className="w-3 h-3" /> Rejected
                      </span>
                    )}
                    {post.status === "published" && (
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 inline-flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" /> Published
                      </span>
                    )}
                    {(post.status === "pending" || post.status === "rejected") && onDeleteNews && (
                      <button
                        type="button"
                        onClick={() => handleDeletePost(post)}
                        className="p-1 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 cursor-pointer"
                        title="Delete this post"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
                {post.status === "rejected" && (
                  <p className="text-[11px] text-rose-700">
                    Reason: {post.rejectionReason || "No reason was given."} To change it, delete this post and post
                    again.
                  </p>
                )}
                {post.status === "published" && (
                  <p className="text-[11px] text-slate-500">Only the administrator can remove a published post.</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* News Feed Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {displayedNews.map((item) => (
          <div
            key={item.id}
            className={`bg-white rounded-3xl p-6 border transition-all duration-200 flex flex-col justify-between space-y-4 ${
              item.isPinned
                ? "border-blue-300 shadow-md shadow-blue-500/5 bg-gradient-to-b from-blue-50/20 to-white"
                : "border-slate-200 shadow-xs hover:shadow-md hover:border-slate-300"
            }`}
          >
            <div className="space-y-3">
              {/* Header Badges */}
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span
                    className={`px-2.5 py-0.5 rounded-md text-[11px] font-bold border ${getCategoryBadgeColor(
                      item.category
                    )}`}
                  >
                    {item.badgeText || item.category}
                  </span>
                  {item.isPinned && (
                    <span className="inline-flex items-center gap-1 text-[11px] font-extrabold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-md border border-blue-200">
                      <Pin className="w-3 h-3 rotate-45" />
                      <span>Pinned</span>
                    </span>
                  )}
                </div>
                <span className="text-[11px] font-medium text-slate-400">{item.date}</span>
              </div>

              {/* Title */}
              <h3
                onClick={() => setActiveArticle(item)}
                className="font-serif text-lg font-bold text-slate-900 hover:text-blue-700 transition-colors cursor-pointer line-clamp-2"
              >
                {item.title}
              </h3>

              {/* Summary */}
              <p className="text-xs text-slate-600 line-clamp-3 leading-relaxed">{item.summary}</p>
            </div>

            {/* Footer */}
            <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-xs text-slate-500">
                <User className="w-3.5 h-3.5 text-slate-400" />
                <span className="truncate max-w-[160px]">{item.author}</span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => onLikeNews(item.id)}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold text-rose-600 bg-rose-50 hover:bg-rose-100 transition-colors cursor-pointer"
                >
                  <Heart className="w-3.5 h-3.5 fill-rose-500" />
                  <span>{item.likesCount}</span>
                </button>
                <button
                  onClick={() => setActiveArticle(item)}
                  className="px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-lg transition-colors cursor-pointer"
                >
                  Read Memo →
                </button>
              </div>
            </div>
          </div>
        ))}

        {displayedNews.length === 0 && (
          <div className="col-span-full py-12 text-center bg-white rounded-3xl border border-slate-200">
            <Newspaper className="w-10 h-10 text-slate-300 mx-auto mb-2" />
            <p className="text-slate-600 font-bold text-sm">No announcements to display</p>
            <p className="text-slate-400 text-xs mt-1">Check back soon for new institutional updates.</p>
          </div>
        )}
      </div>

      {/* Expand / View All button when limit is active */}
      {limit && filteredNews.length > limit && (
        <div className="flex justify-center pt-2">
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="px-5 py-2.5 bg-white hover:bg-slate-50 border border-slate-200 hover:border-slate-300 text-slate-700 text-xs font-bold rounded-xl shadow-xs transition-all cursor-pointer flex items-center gap-2"
          >
            <span>{isExpanded ? "Show fewer announcements" : `View all announcements (${filteredNews.length})`}</span>
            <ChevronDown className={`w-3.5 h-3.5 transition-transform ${isExpanded ? "rotate-180" : ""}`} />
          </button>
        </div>
      )}

      {/* Article Detail Modal */}
      {activeArticle && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setActiveArticle(null)}
        >
          <div
            className="bg-white rounded-3xl max-w-2xl w-full p-6 sm:p-8 shadow-2xl border border-slate-200 space-y-6 max-h-[85vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1.5">
                <span
                  className={`px-2.5 py-0.5 rounded-md text-[11px] font-bold border ${getCategoryBadgeColor(
                    activeArticle.category
                  )}`}
                >
                  {activeArticle.badgeText || activeArticle.category}
                </span>
                <h2 className="font-serif text-xl sm:text-2xl font-extrabold text-slate-900 leading-snug">
                  {activeArticle.title}
                </h2>
                <div className="flex items-center gap-3 text-xs text-slate-400">
                  <span>Author: {activeArticle.author}</span>
                  <span>•</span>
                  <span>Date: {activeArticle.date}</span>
                </div>
              </div>
              <button
                onClick={() => setActiveArticle(null)}
                className="p-1.5 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 text-xs sm:text-sm text-slate-700 font-medium leading-relaxed italic">
              "{activeArticle.summary}"
            </div>

            <div className="text-xs sm:text-sm text-slate-800 leading-relaxed whitespace-pre-line font-sans">
              {activeArticle.content}
            </div>

            <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
              <button
                onClick={() => onLikeNews(activeArticle.id)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-50 text-rose-600 rounded-xl text-xs font-bold hover:bg-rose-100"
              >
                <Heart className="w-4 h-4 fill-rose-500" />
                <span>{activeArticle.likesCount} Helpful Reactions</span>
              </button>

              <div className="flex items-center gap-2">
                {isSuperadmin && onDeleteNews && (
                  <button
                    type="button"
                    onClick={() => handleDeletePost(activeArticle)}
                    className="px-3 py-2 bg-white border border-rose-200 hover:bg-rose-50 text-rose-700 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Delete</span>
                  </button>
                )}
                <button
                  onClick={() => setActiveArticle(null)}
                  className="px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold cursor-pointer"
                >
                  Close Memo
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Create Announcement Modal */}
      {showCreateModal && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setShowCreateModal(false)}
        >
          <div
            className="bg-white rounded-3xl max-w-xl w-full p-6 sm:p-8 shadow-2xl border border-slate-200 space-y-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-serif text-lg font-bold text-slate-900">
                  {isSuperadmin ? "Post Institutional Announcement" : "Post News"}
                </h3>
                <p className="text-xs text-slate-500">
                  {isSuperadmin
                    ? "Publishes right away."
                    : "The administrator reviews your post before anyone else can see it."}
                </p>
              </div>
              <button
                onClick={() => setShowCreateModal(false)}
                className="p-1 rounded-full hover:bg-slate-100 text-slate-400"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitNewPost} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Headline / Title *</label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Action on Q1 Survey: Library Hours Extended"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm focus:outline-hidden focus:border-blue-500 focus:bg-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Category</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value as any)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold"
                  >
                    <option value="Survey Results Action">⚡ Action on Survey</option>
                    <option value="Campus Announcement">📢 Campus Announcement</option>
                    <option value="System Update">🤖 System Update</option>
                    <option value="Policy Change">🏛️ Policy Change</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Badge Tag</label>
                  <input
                    type="text"
                    value={badgeText}
                    onChange={(e) => setBadgeText(e.target.value)}
                    placeholder="e.g. Action Taken, New Lab"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Summary (1-2 sentences)</label>
                <textarea
                  rows={2}
                  value={summary}
                  onChange={(e) => setSummary(e.target.value)}
                  placeholder="Brief summary of actions taken..."
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Full Content / Memo Text *</label>
                <textarea
                  rows={4}
                  required
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="Detailed announcement details..."
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                />
              </div>

              {isSuperadmin && (
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="pin-post"
                    checked={isPinned}
                    onChange={(e) => setIsPinned(e.target.checked)}
                    className="rounded text-blue-600"
                  />
                  <label htmlFor="pin-post" className="text-xs font-medium text-slate-700">
                    Pin this announcement to top of feed
                  </label>
                </div>
              )}

              {atPendingLimit && (
                <p className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-[11px] font-semibold text-amber-900">
                  You already have {MAX_PENDING_NEWS} posts waiting for review. Wait for a decision or delete one in My
                  Posts.
                </p>
              )}

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving || atPendingLimit}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-xs cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSaving ? "Saving..." : isSuperadmin ? "Publish Announcement" : "Submit for Approval"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

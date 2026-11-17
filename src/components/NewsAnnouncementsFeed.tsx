import { useState } from "react";
import { useConfirm } from "./ConfirmDialog";
import { NewsAnnouncement, Survey, UserProfile } from "../types";
import { ChevronDown, Megaphone, Newspaper } from "lucide-react";
import { NewsPost, avatarColor, initials, postTime } from "./news/NewsPost";
import { NewsComposer } from "./news/NewsComposer";
import { NewsSideColumn } from "./news/NewsSideColumn";
import type { TrendingSurvey } from "../lib/trending";

/** Most posts one person may have waiting for review (admin has no limit). */
export const MAX_PENDING_NEWS = 3;

interface NewsAnnouncementsFeedProps {
  newsList: NewsAnnouncement[];
  currentUser: UserProfile | null;
  /** Resolves to true when the post was saved. */
  onAddNews: (news: Omit<NewsAnnouncement, "id" | "likesCount">) => Promise<boolean>;
  onLikeNews: (id: string) => void;
  /** Posts the signed-in person has liked (filled icon; clicking again un-likes). */
  likedNewsIds?: string[];
  onDeleteNews?: (id: string) => Promise<void> | void;
  /** Posts shown before "Show more posts". */
  limit?: number;
  /** Side column: trending surveys, which of them this person answered, and how to open one. */
  trending?: TrendingSurvey[];
  answeredSurveyIds?: Set<string>;
  onOpenSurvey?: (survey: Survey) => void;
}

/**
 * News & announcements as a social-style feed (pinned first, then newest), with a side column for
 * trending surveys and the person's own posts that are not public yet.
 */
export const NewsAnnouncementsFeed: React.FC<NewsAnnouncementsFeedProps> = ({
  newsList,
  currentUser,
  onAddNews,
  onLikeNews,
  likedNewsIds = [],
  onDeleteNews,
  limit,
  trending = [],
  answeredSurveyIds = new Set<string>(),
  onOpenSurvey,
}) => {
  const { confirm, confirmDialog } = useConfirm();
  const [showComposer, setShowComposer] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const isSuperadmin = currentUser?.role === "superadmin" || currentUser?.pos === "Superadmin";
  const canPost = isSuperadmin || (Boolean(currentUser) && currentUser?.canPostNews !== false);
  const myEmail = (currentUser?.email || "").trim().toLowerCase();
  const myPosts = isSuperadmin ? [] : newsList.filter((n) => n.authorEmail === myEmail);
  const atPendingLimit = !isSuperadmin && myPosts.filter((n) => n.status === "pending").length >= MAX_PENDING_NEWS;

  // The feed shows published posts only (older posts without a status count as published).
  const feed = newsList
    .filter((n) => !n.status || n.status === "published")
    .sort((a, b) => Number(!!b.isPinned) - Number(!!a.isPinned) || (postTime(b) || 0) - (postTime(a) || 0));
  const shown = limit && !expanded ? feed.slice(0, limit) : feed;

  const deletePost = async (post: NewsAnnouncement) => {
    if (!onDeleteNews) return;
    const ok = await confirm({
      title: "Delete this post?",
      message: `"${post.title}" will be permanently deleted. This cannot be undone.`,
      confirmLabel: "Delete",
      danger: true,
    });
    if (ok) await onDeleteNews(post.id);
  };

  const myName = currentUser?.name || "You";

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_20rem] gap-5 items-start">
      {confirmDialog}

      <div className="space-y-4 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <h2 className="flex items-center gap-2 text-lg font-extrabold text-slate-900">
            <Megaphone className="w-5 h-5 text-indigo-600" /> News &amp; announcements
          </h2>
        </div>

        {canPost && (
          <div className="bg-white rounded-2xl border border-slate-200 p-3 flex items-center gap-3">
            <span
              className={`w-10 h-10 rounded-full ${avatarColor(myName)} text-white text-sm font-bold flex items-center justify-center shrink-0`}
              aria-hidden="true"
            >
              {initials(myName)}
            </span>
            <button
              type="button"
              onClick={() => setShowComposer(true)}
              className="flex-1 text-left px-4 py-2.5 rounded-full bg-slate-100 hover:bg-slate-200 text-sm text-slate-500 cursor-pointer"
            >
              Share an update or an action taken on feedback...
            </button>
          </div>
        )}

        {shown.length === 0 ? (
          <div className="py-12 text-center bg-white rounded-2xl border border-slate-200">
            <Newspaper className="w-10 h-10 text-slate-300 mx-auto mb-2" />
            <p className="text-slate-700 font-bold text-sm">No posts yet</p>
            <p className="text-slate-500 text-xs mt-1">News and actions taken on feedback will appear here.</p>
          </div>
        ) : (
          shown.map((post) => (
            <NewsPost
              key={post.id}
              post={post}
              liked={likedNewsIds.includes(post.id)}
              onLike={() => onLikeNews(post.id)}
              onDelete={isSuperadmin && onDeleteNews ? () => deletePost(post) : undefined}
            />
          ))
        )}

        {limit && feed.length > limit && (
          <div className="flex justify-center">
            <button
              type="button"
              onClick={() => setExpanded(!expanded)}
              className="px-5 py-2.5 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-sm font-bold rounded-xl cursor-pointer inline-flex items-center gap-2"
            >
              {expanded ? "Show fewer posts" : `Show more posts (${feed.length - limit})`}
              <ChevronDown className={`w-4 h-4 transition-transform ${expanded ? "rotate-180" : ""}`} />
            </button>
          </div>
        )}
      </div>

      <div className="lg:sticky lg:top-4">
        <NewsSideColumn
          trending={trending}
          answeredIds={answeredSurveyIds}
          onOpenSurvey={onOpenSurvey}
          myPosts={myPosts}
          onDeletePost={onDeleteNews ? deletePost : undefined}
        />
      </div>

      {showComposer && (
        <NewsComposer
          authorName={currentUser?.name || "Campus Administration"}
          isAdmin={isSuperadmin}
          atPendingLimit={atPendingLimit}
          maxPending={MAX_PENDING_NEWS}
          onClose={() => setShowComposer(false)}
          onSubmit={onAddNews}
        />
      )}
    </div>
  );
};

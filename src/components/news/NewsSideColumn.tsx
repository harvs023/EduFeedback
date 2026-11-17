import { CheckCircle2, Clock, Flame, Trash2, X } from "lucide-react";
import type { NewsAnnouncement, Survey } from "../../types";
import { TRENDING_MIN_RESPONSES, type TrendingSurvey } from "../../lib/trending";

/**
 * Right-hand column next to the feed: Trending surveys (always visible, not a tab) and the
 * person's own posts that are not public yet (waiting or rejected).
 */
export function NewsSideColumn({
  trending,
  answeredIds,
  onOpenSurvey,
  myPosts,
  onDeletePost,
}: {
  trending: TrendingSurvey[];
  answeredIds: Set<string>;
  onOpenSurvey?: (survey: Survey) => void;
  /** The person's own posts (all statuses); empty for the admin. */
  myPosts: NewsAnnouncement[];
  onDeletePost?: (post: NewsAnnouncement) => void;
}) {
  const waiting = myPosts.filter((p) => p.status === "pending");
  const rejected = myPosts.filter((p) => p.status === "rejected");
  const published = myPosts.filter((p) => !p.status || p.status === "published").length;

  return (
    <aside className="space-y-4" aria-label="Trending and your posts">
      <section className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3">
        <h2 className="flex items-center gap-1.5 text-sm font-bold text-slate-900">
          <Flame className="w-4 h-4 text-orange-500" /> Trending surveys
        </h2>
        {trending.length === 0 ? (
          <p className="text-xs text-slate-500">
            Nothing trending yet. An open survey needs at least {TRENDING_MIN_RESPONSES} responses to show here.
          </p>
        ) : (
          <ol className="space-y-2">
            {trending.map((t, i) => {
              const done = answeredIds.has(String(t.survey.id));
              return (
                <li key={String(t.survey.id)} className="flex items-start gap-3">
                  <span className="w-6 h-6 rounded-full bg-orange-50 text-orange-700 text-xs font-bold flex items-center justify-center shrink-0">
                    {i + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-slate-900 leading-snug">{t.survey.title}</p>
                    <p className="text-[11px] text-slate-500">
                      {t.perDay} answers a day · {t.survey.responses} in total
                    </p>
                  </div>
                  {done ? (
                    <span className="text-[11px] font-semibold text-emerald-700 inline-flex items-center gap-1 shrink-0">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Done
                    </span>
                  ) : (
                    onOpenSurvey && (
                      <button
                        type="button"
                        onClick={() => onOpenSurvey(t.survey)}
                        className="text-xs font-bold text-indigo-700 hover:underline cursor-pointer shrink-0"
                      >
                        Answer
                      </button>
                    )
                  )}
                </li>
              );
            })}
          </ol>
        )}
      </section>

      {myPosts.length > 0 && (
        <section className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3">
          <h2 className="text-sm font-bold text-slate-900">Your posts</h2>
          {waiting.length === 0 && rejected.length === 0 && (
            <p className="text-xs text-slate-500">
              {published} published post{published === 1 ? "" : "s"}. Nothing waiting.
            </p>
          )}
          {[...waiting, ...rejected].map((post) => (
            <div key={post.id} className="space-y-1">
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-semibold text-slate-900 leading-snug">{post.title}</p>
                {onDeletePost && (
                  <button
                    type="button"
                    onClick={() => onDeletePost(post)}
                    className="p-1 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 cursor-pointer shrink-0"
                    title="Delete this post"
                    aria-label={`Delete "${post.title}"`}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
              {post.status === "pending" ? (
                <p className="inline-flex items-center gap-1 text-[11px] font-semibold text-orange-700">
                  <Clock className="w-3 h-3" /> Waiting for the administrator
                </p>
              ) : (
                <p className="text-[11px] text-rose-700">
                  <span className="inline-flex items-center gap-1 font-semibold">
                    <X className="w-3 h-3" /> Not approved:
                  </span>{" "}
                  {post.rejectionReason || "No reason was given."} Delete it and post again to change it.
                </p>
              )}
            </div>
          ))}
          {(waiting.length > 0 || rejected.length > 0) && published > 0 && (
            <p className="text-[11px] text-slate-500">
              {published} published post{published === 1 ? "" : "s"} (only the administrator can remove those).
            </p>
          )}
        </section>
      )}
    </aside>
  );
}

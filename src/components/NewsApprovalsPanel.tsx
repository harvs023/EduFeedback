import React, { useState } from "react";
import { NewsAnnouncement } from "../types";
import { CheckCircle, Newspaper, User, XCircle } from "lucide-react";

const MIN_REASON_LENGTH = 10;

interface NewsApprovalsPanelProps {
  newsList: NewsAnnouncement[];
  onReview: (id: string, decision: "approve" | "reject", reason?: string) => Promise<void> | void;
}

/** Review Center tab: the administrator approves or rejects news posts. */
export const NewsApprovalsPanel: React.FC<NewsApprovalsPanelProps> = ({ newsList, onReview }) => {
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [reason, setReason] = useState<string>("");
  const [busyId, setBusyId] = useState<string | null>(null);

  const pending = newsList
    .filter((n) => n.status === "pending")
    .sort((a, b) => (a.submittedAt || 0) - (b.submittedAt || 0));

  const review = async (id: string, decision: "approve" | "reject", why?: string) => {
    setBusyId(id);
    try {
      await onReview(id, decision, why);
      setRejectingId(null);
      setReason("");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="bg-white p-6 sm:p-8 rounded-3xl border border-slate-200 shadow-xs space-y-6">
      <div className="border-b border-slate-100 pb-4">
        <h2 className="font-serif text-xl font-bold text-slate-900">News Approvals ({pending.length})</h2>
        <p className="text-xs text-slate-500 mt-1">
          Posts appear on the Dashboard and the News page only after you approve them. Oldest posts are shown first.
        </p>
      </div>

      {pending.length === 0 && (
        <div className="py-12 text-center">
          <Newspaper className="w-10 h-10 text-slate-300 mx-auto mb-2" />
          <p className="text-sm font-bold text-slate-600">No posts are waiting for review</p>
        </div>
      )}

      <div className="space-y-4">
        {pending.map((post) => {
          const isBusy = busyId === post.id;
          const isRejecting = rejectingId === post.id;
          const reasonLength = reason.trim().length;
          return (
            <div key={post.id} className="p-5 rounded-2xl border border-slate-200 bg-slate-50/60 space-y-3">
              <div className="flex items-center gap-2 flex-wrap text-[11px]">
                <span className="px-2 py-0.5 rounded-md font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                  {post.category}
                </span>
                {post.badgeText && <span className="text-slate-500">Tag: {post.badgeText}</span>}
                <span className="text-slate-400">{post.date}</span>
              </div>
              <h3 className="font-serif text-base font-bold text-slate-900">{post.title}</h3>
              <div className="flex items-center gap-1.5 text-xs text-slate-500">
                <User className="w-3.5 h-3.5 text-slate-400" />
                <span>
                  {post.author} ({post.authorEmail})
                </span>
              </div>
              {post.summary && post.summary !== post.title && (
                <p className="text-xs font-medium text-slate-700 italic">"{post.summary}"</p>
              )}
              <p className="text-xs text-slate-800 leading-relaxed whitespace-pre-line">{post.content}</p>

              {isRejecting ? (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl space-y-2">
                  <label className="block text-xs font-bold text-rose-900">
                    Why is this rejected? The author will see this.
                  </label>
                  <textarea
                    rows={2}
                    maxLength={300}
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="e.g. Please remove the personal details from the second paragraph."
                    className="w-full text-xs p-2 rounded-lg border border-rose-200 bg-white focus:outline-hidden focus:border-rose-400"
                  />
                  <p className="text-[11px] text-rose-800/70">
                    {reasonLength}/{MIN_REASON_LENGTH} characters minimum
                  </p>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={isBusy || reasonLength < MIN_REASON_LENGTH}
                      onClick={() => review(post.id, "reject", reason)}
                      className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isBusy ? "Saving..." : "Confirm Reject"}
                    </button>
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => {
                        setRejectingId(null);
                        setReason("");
                      }}
                      className="px-3 py-1.5 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-semibold cursor-pointer"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2 pt-1">
                  <button
                    type="button"
                    disabled={isBusy}
                    onClick={() => review(post.id, "approve")}
                    className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    <CheckCircle className="w-3.5 h-3.5" />
                    <span>{isBusy ? "Saving..." : "Approve"}</span>
                  </button>
                  <button
                    type="button"
                    disabled={isBusy}
                    onClick={() => {
                      setRejectingId(post.id);
                      setReason("");
                    }}
                    className="px-3.5 py-2 bg-white border border-rose-200 hover:bg-rose-50 text-rose-700 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    <XCircle className="w-3.5 h-3.5" />
                    <span>Reject</span>
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

import React, { useState } from "react";
import { Lightbulb, Pencil, X } from "lucide-react";
import type { SurveyTopicBlock, Topic, TopicRequest } from "../types";
import { OTHER_TOPIC_ID } from "../lib/topicBlocks";

interface TopicRequestBoxProps {
  block: SurveyTopicBlock;
  topics: Topic[];
  requesterEmail: string;
  onChange: (request: TopicRequest | undefined) => void;
}

const MIN_REASON = 10;

/**
 * Under a block set to "Other": lets the creator suggest a new topic for the admin. It is saved with
 * the survey. After the admin decides, the decision is shown here instead.
 */
export const TopicRequestBox: React.FC<TopicRequestBoxProps> = ({ block, topics, requesterEmail, onChange }) => {
  const request = block.topicRequest;
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(request?.name || "");
  const [reason, setReason] = useState(request?.reason || "");
  const [error, setError] = useState<string | null>(null);

  if (request && request.status !== "pending") {
    const topicName = topics.find((t) => t.id === request.resultTopicId)?.name;
    const text =
      request.status === "approved"
        ? `Your suggested topic was approved as "${topicName || request.name}", and this block now uses it.`
        : request.status === "mapped"
        ? `The administrator put this block under the existing topic "${topicName || "?"}" instead of "${request.name}".`
        : `The administrator kept this block under "Other" instead of adding "${request.name}".`;
    return (
      <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-[11px] text-emerald-900">
        <span className="font-bold">Topic suggestion decided.</span> {text}
        {request.decisionNote && <span className="block mt-0.5">Note: {request.decisionNote}</span>}
      </div>
    );
  }

  if (block.topicId !== OTHER_TOPIC_ID) return null;

  const save = () => {
    const n = name.trim();
    if (n.length < 2 || n.length > 60) {
      setError("The topic name must be 2 to 60 characters.");
      return;
    }
    if (topics.some((t) => t.name.trim().toLowerCase() === n.toLowerCase())) {
      setError(`A topic named "${n}" already exists. Choose it in the Topic list instead.`);
      return;
    }
    if (reason.trim().length < MIN_REASON) {
      setError(`Please explain why in at least ${MIN_REASON} characters.`);
      return;
    }
    onChange({
      name: n,
      reason: reason.trim(),
      requestedBy: requesterEmail.trim().toLowerCase(),
      requestedAt: Date.now(),
      status: "pending",
    });
    setError(null);
    setEditing(false);
  };

  if (request && !editing) {
    return (
      <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-[11px] text-amber-900 flex flex-wrap items-start justify-between gap-2">
        <div>
          <span className="font-bold">Suggested topic: "{request.name}"</span> (waiting for the administrator).
          <span className="block text-amber-800/80">Reason: {request.reason}</span>
          <span className="block text-amber-800/80">It is sent when you save or submit the survey.</span>
        </div>
        <div className="flex gap-1">
          <button
            type="button"
            onClick={() => {
              setName(request.name);
              setReason(request.reason);
              setEditing(true);
            }}
            className="p-1.5 rounded-lg hover:bg-amber-100 cursor-pointer"
            title="Edit suggestion"
          >
            <Pencil className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => onChange(undefined)}
            className="p-1.5 rounded-lg hover:bg-amber-100 cursor-pointer"
            title="Remove suggestion"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    );
  }

  if (!editing) {
    return (
      <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-[11px] text-slate-600 flex flex-wrap items-center justify-between gap-2">
        <span>None of the topics fit? You can suggest a new one to the administrator.</span>
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="px-3 py-1.5 bg-white border border-slate-200 hover:bg-indigo-50 hover:border-indigo-200 text-indigo-700 font-bold rounded-lg flex items-center gap-1 cursor-pointer"
        >
          <Lightbulb className="w-3.5 h-3.5" /> Suggest a new topic
        </button>
      </div>
    );
  }

  return (
    <div className="p-3 rounded-xl bg-indigo-50/60 border border-indigo-200 space-y-2 text-xs">
      <div className="font-bold text-indigo-900">Suggest a new topic</div>
      <input
        type="text"
        value={name}
        maxLength={60}
        onChange={(e) => setName(e.target.value)}
        placeholder="Topic name, e.g. Sports Facilities"
        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl font-semibold"
      />
      <textarea
        value={reason}
        maxLength={300}
        rows={2}
        onChange={(e) => setReason(e.target.value)}
        placeholder="Why is it needed? e.g. Our questions are about the gym and courts; no topic covers that."
        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl"
      />
      {error && <div className="text-rose-700 font-semibold">{error}</div>}
      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={() => {
            setEditing(false);
            setError(null);
          }}
          className="px-3 py-1.5 bg-white border border-slate-200 text-slate-700 font-bold rounded-lg cursor-pointer"
        >
          Cancel
        </button>
        <button type="button" onClick={save} className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg cursor-pointer">
          Add suggestion
        </button>
      </div>
    </div>
  );
};

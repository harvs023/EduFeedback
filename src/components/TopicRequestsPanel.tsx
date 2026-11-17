import React, { useMemo, useState } from "react";
import { Lightbulb, Loader2 } from "lucide-react";
import type { Survey, SurveyTopicBlock, Topic } from "../types";
import { OTHER_TOPIC_ID, sortTopics } from "../lib/topicBlocks";
import { formatDateTime } from "../lib/timeAgo";

export type TopicDecision = { kind: "approve"; name: string } | { kind: "map"; topicId: string } | { kind: "keep" };

interface TopicRequestsPanelProps {
  surveys: Survey[];
  topics: Topic[];
  onDecide: (surveyId: string, blockId: string, decision: TopicDecision, note: string) => Promise<void>;
}

interface RequestRow {
  survey: Survey;
  block: SurveyTopicBlock;
  questions: string[];
}

const STATUS_TEXT: Record<string, string> = {
  approved: "Approved as a new topic",
  mapped: "Put under an existing topic",
  kept_other: "Kept under Other",
};

export const TopicRequestsPanel: React.FC<TopicRequestsPanelProps> = ({ surveys, topics, onDecide }) => {
  const [open, setOpen] = useState<string | null>(null);
  const [kind, setKind] = useState<TopicDecision["kind"]>("approve");
  const [name, setName] = useState("");
  const [mapTo, setMapTo] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [showDecided, setShowDecided] = useState(false);

  const rows = useMemo<RequestRow[]>(
    () =>
      surveys.flatMap((s) =>
        (s.topicBlocks || [])
          .filter((b) => b.topicRequest)
          .map((b) => ({
            survey: s,
            block: b,
            questions: (s.questions || []).filter((q) => q.blockId === b.id).map((q) => q.text),
          }))
      ),
    [surveys]
  );
  const pending = rows.filter((r) => r.block.topicRequest!.status === "pending").sort((a, b) => a.block.topicRequest!.requestedAt - b.block.topicRequest!.requestedAt);
  const decided = rows
    .filter((r) => r.block.topicRequest!.status !== "pending")
    .sort((a, b) => (b.block.topicRequest!.decidedAt || 0) - (a.block.topicRequest!.decidedAt || 0))
    .slice(0, 20);
  const mapOptions = sortTopics(topics.filter((t) => t.status === "active" && t.id !== OTHER_TOPIC_ID));

  const start = (r: RequestRow) => {
    setOpen(`${r.survey.id}::${r.block.id}`);
    setKind("approve");
    setName(r.block.topicRequest!.name);
    setMapTo("");
    setNote("");
  };

  const submit = async (r: RequestRow) => {
    const decision: TopicDecision =
      kind === "approve" ? { kind, name } : kind === "map" ? { kind, topicId: mapTo } : { kind: "keep" };
    if (decision.kind === "approve" && name.trim().length < 2) return;
    if (decision.kind === "map" && !mapTo) return;
    setBusy(true);
    try {
      await onDecide(String(r.survey.id), r.block.id, decision, note);
      setOpen(null);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-serif text-lg font-bold text-slate-900 flex items-center gap-2">
          <Lightbulb className="w-5 h-5 text-amber-500" /> Topic requests ({pending.length})
        </h3>
        {decided.length > 0 && (
          <button type="button" onClick={() => setShowDecided((v) => !v)} className="text-xs font-bold text-indigo-700 hover:underline cursor-pointer">
            {showDecided ? "Hide decided" : `Show decided (${decided.length})`}
          </button>
        )}
      </div>
      {pending.length === 0 && (
        <p className="text-xs text-slate-500">No suggestions waiting. Creators can suggest a topic when they put a block under "Other".</p>
      )}

      {pending.map((r) => {
        const req = r.block.topicRequest!;
        const key = `${r.survey.id}::${r.block.id}`;
        return (
          <div key={key} className="p-4 rounded-2xl border border-amber-200 bg-amber-50/40 space-y-2 text-xs">
            <div className="flex flex-wrap justify-between gap-2">
              <div>
                <div className="font-bold text-slate-900 text-sm">Suggested: "{req.name}"</div>
                <div className="text-slate-600">Reason: {req.reason}</div>
              </div>
              <div className="text-[11px] text-slate-500 text-right">
                {req.requestedBy}
                <br />
                {formatDateTime(req.requestedAt)}
              </div>
            </div>
            <div className="p-2.5 rounded-xl bg-white border border-slate-100">
              <div className="font-semibold text-slate-800">
                {r.survey.title} <span className="text-slate-400 font-normal">({r.survey.status})</span> · block "{r.block.title}"
              </div>
              <ul className="list-disc pl-5 text-slate-600 mt-1">
                {r.questions.slice(0, 5).map((q, i) => (
                  <li key={i}>{q || "(empty question)"}</li>
                ))}
                {r.questions.length > 5 && <li className="list-none text-slate-400">and {r.questions.length - 5} more</li>}
              </ul>
            </div>

            {open !== key ? (
              <button type="button" onClick={() => start(r)} className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg cursor-pointer">
                Decide
              </button>
            ) : (
              <div className="p-3 rounded-xl bg-white border border-slate-200 space-y-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="radio" checked={kind === "approve"} onChange={() => setKind("approve")} />
                  Approve as a new topic named
                  <input
                    value={name}
                    maxLength={60}
                    onChange={(e) => setName(e.target.value)}
                    disabled={kind !== "approve"}
                    className="flex-1 min-w-[140px] px-2 py-1 border border-slate-200 rounded-lg disabled:opacity-50"
                  />
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="radio" checked={kind === "map"} onChange={() => setKind("map")} />
                  Put under an existing topic
                  <select
                    value={mapTo}
                    onChange={(e) => setMapTo(e.target.value)}
                    disabled={kind !== "map"}
                    className="flex-1 min-w-[140px] px-2 py-1 border border-slate-200 rounded-lg disabled:opacity-50"
                  >
                    <option value="">Choose…</option>
                    {mapOptions.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="radio" checked={kind === "keep"} onChange={() => setKind("keep")} />
                  Keep it under "Other"
                </label>
                <input
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  maxLength={300}
                  placeholder="Note for the creator (optional)"
                  className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg"
                />
                <div className="flex justify-end gap-2">
                  <button type="button" onClick={() => setOpen(null)} className="px-3 py-1.5 bg-slate-100 text-slate-700 font-bold rounded-lg cursor-pointer">
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => submit(r)}
                    disabled={busy || (kind === "approve" && name.trim().length < 2) || (kind === "map" && !mapTo)}
                    className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg flex items-center gap-1 cursor-pointer disabled:opacity-50"
                  >
                    {busy && <Loader2 className="w-3.5 h-3.5 animate-spin" />} Save decision
                  </button>
                </div>
              </div>
            )}
          </div>
        );
      })}

      {showDecided && (
        <ul className="space-y-1.5">
          {decided.map((r) => {
            const req = r.block.topicRequest!;
            return (
              <li key={`${r.survey.id}::${r.block.id}`} className="p-2.5 rounded-xl bg-slate-50 border border-slate-100 text-xs text-slate-700">
                "{req.name}" in {r.survey.title}: <strong>{STATUS_TEXT[req.status]}</strong>
                {req.resultTopicId && ` (${topics.find((t) => t.id === req.resultTopicId)?.name || "?"})`}
                {req.decidedAt && <span className="text-slate-400"> · {formatDateTime(req.decidedAt)}</span>}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};

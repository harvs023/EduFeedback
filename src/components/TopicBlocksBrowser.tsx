import React, { useMemo, useState } from "react";
import { ArrowRightLeft, Loader2, Merge, Search, X } from "lucide-react";
import type { Survey, Topic, TopicBlockMove } from "../types";
import { OTHER_TOPIC_ID, sortTopics } from "../lib/topicBlocks";
import { blockKey, blocksUnderTopic, matchesKeywords } from "../lib/topicMoves";
import { useConfirm } from "./ConfirmDialog";

interface TopicBlocksBrowserProps {
  topic: Topic;
  topics: Topic[];
  surveys: Survey[];
  onMove: (moves: TopicBlockMove[], kind: "move" | "merge", retireTopicId?: string) => Promise<void>;
  onClose: () => void;
}

/**
 * Admin tool for one topic: see every question block under it, find blocks by keyword, and move the
 * selected ones to another topic, or merge the whole topic into another. Only the topic changes;
 * question wording and block titles stay exactly as they are.
 */
export const TopicBlocksBrowser: React.FC<TopicBlocksBrowserProps> = ({ topic, topics, surveys, onMove, onClose }) => {
  const { confirm, confirmDialog } = useConfirm();
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [moveTo, setMoveTo] = useState("");
  const [mergeTo, setMergeTo] = useState("");
  const [busy, setBusy] = useState(false);

  const rows = useMemo(() => blocksUnderTopic(surveys, topic.id), [surveys, topic.id]);
  const shown = useMemo(() => rows.filter((r) => matchesKeywords(r, query)), [rows, query]);
  const targets = sortTopics(topics.filter((t) => t.status === "active" && t.id !== topic.id));
  const surveyCount = new Set(rows.map((r) => r.surveyId)).size;

  const selectedRows = rows.filter((r) => selected.has(blockKey(r.surveyId, r.block.id)));
  const selectedSurveys = new Set(selectedRows.map((r) => r.surveyId)).size;
  const nameOf = (id: string) => topics.find((t) => t.id === id)?.name || "";

  const toggle = (key: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const doMove = async () => {
    if (!moveTo || selectedRows.length === 0) return;
    const ok = await confirm({
      title: "Move these blocks?",
      message: `This will move ${selectedRows.length} block(s) from ${selectedSurveys} survey(s) from "${topic.name}" to "${nameOf(moveTo)}". Questions and block titles do not change. Each creator gets one notification. You can undo the last move.`,
      confirmLabel: "Move",
    });
    if (!ok) return;
    setBusy(true);
    try {
      await onMove(
        selectedRows.map((r) => ({ surveyId: r.surveyId, blockId: r.block.id, from: topic.id, to: moveTo })),
        "move"
      );
      setSelected(new Set());
    } finally {
      setBusy(false);
    }
  };

  const doMerge = async () => {
    if (!mergeTo) return;
    const ok = await confirm({
      title: `Merge "${topic.name}" into "${nameOf(mergeTo)}"?`,
      message: `All ${rows.length} block(s) from ${surveyCount} survey(s) move to "${nameOf(mergeTo)}", and "${topic.name}" is retired. Questions and block titles do not change. You can undo the last merge.`,
      confirmLabel: "Merge",
      danger: true,
    });
    if (!ok) return;
    setBusy(true);
    try {
      await onMove(
        rows.map((r) => ({ surveyId: r.surveyId, blockId: r.block.id, from: topic.id, to: mergeTo })),
        "merge",
        topic.id
      );
      onClose();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="p-4 sm:p-5 rounded-2xl border border-indigo-200 bg-indigo-50/30 space-y-4">
      {confirmDialog}
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="font-serif text-lg font-bold text-slate-900">Topic: {topic.name}</h3>
          <p className="text-xs text-slate-500">
            {rows.length} question block(s) in {surveyCount} survey(s). Moving changes only the topic.
          </p>
        </div>
        <button type="button" onClick={onClose} className="p-1.5 rounded-lg hover:bg-white text-slate-500 cursor-pointer" aria-label="Close">
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Search */}
      <div className="space-y-1">
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search words, separated by commas, e.g. court, korte, basketball"
            className="w-full pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-xl text-xs"
          />
        </div>
        <p className="text-[11px] text-slate-500">
          Finds the words you type in survey titles, block titles and questions (Tagalog or English; it does not translate,
          so add words in both languages). {shown.length} of {rows.length} block(s) match.
        </p>
        <div className="flex gap-2 text-[11px] font-bold">
          <button
            type="button"
            onClick={() => setSelected(new Set([...selected, ...shown.map((r) => blockKey(r.surveyId, r.block.id))]))}
            className="text-indigo-700 hover:underline cursor-pointer"
          >
            Select all matches ({shown.length})
          </button>
          <button type="button" onClick={() => setSelected(new Set())} className="text-slate-500 hover:underline cursor-pointer">
            Clear selection
          </button>
        </div>
      </div>

      {/* Blocks */}
      <div className="max-h-96 overflow-y-auto space-y-1.5 pr-1">
        {shown.length === 0 && <p className="text-xs text-slate-500 p-3">No blocks match.</p>}
        {shown.map((r) => {
          const key = blockKey(r.surveyId, r.block.id);
          return (
            <label key={key} className="flex items-start gap-2.5 p-2.5 rounded-xl bg-white border border-slate-200 text-xs cursor-pointer hover:border-indigo-300">
              <input type="checkbox" checked={selected.has(key)} onChange={() => toggle(key)} className="mt-0.5 w-4 h-4 accent-indigo-600" />
              <span className="min-w-0">
                <span className="block font-semibold text-slate-900">
                  {r.surveyTitle} <span className="font-normal text-slate-400">({r.surveyStatus})</span> · "{r.block.title}"
                </span>
                <span className="block text-slate-600 line-clamp-2">{r.questions.join(" · ") || "(no questions)"}</span>
              </span>
            </label>
          );
        })}
      </div>

      {/* Move */}
      <div className="p-3 rounded-xl bg-white border border-slate-200 space-y-2 text-xs">
        <div className="font-bold text-slate-800 flex items-center gap-1.5">
          <ArrowRightLeft className="w-4 h-4" /> Move selected blocks
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select value={moveTo} onChange={(e) => setMoveTo(e.target.value)} className="px-2.5 py-1.5 border border-slate-200 rounded-lg">
            <option value="">to topic…</option>
            {targets.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={doMove}
            disabled={busy || !moveTo || selectedRows.length === 0}
            className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg flex items-center gap-1 cursor-pointer disabled:opacity-50"
          >
            {busy && <Loader2 className="w-3.5 h-3.5 animate-spin" />} Move
          </button>
          <span className="text-slate-600">
            {selectedRows.length > 0 && moveTo
              ? `This will move ${selectedRows.length} block(s) from ${selectedSurveys} survey(s) to "${nameOf(moveTo)}".`
              : `${selectedRows.length} selected.`}
          </span>
        </div>
      </div>

      {/* Merge */}
      {topic.id !== OTHER_TOPIC_ID && (
        <div className="p-3 rounded-xl bg-white border border-rose-200 space-y-2 text-xs">
          <div className="font-bold text-slate-800 flex items-center gap-1.5">
            <Merge className="w-4 h-4" /> Merge this whole topic into another
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select value={mergeTo} onChange={(e) => setMergeTo(e.target.value)} className="px-2.5 py-1.5 border border-slate-200 rounded-lg">
              <option value="">into topic…</option>
              {targets.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={doMerge}
              disabled={busy || !mergeTo}
              className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-lg cursor-pointer disabled:opacity-50"
            >
              Merge
            </button>
            <span className="text-slate-600">All {rows.length} block(s) move, then "{topic.name}" is retired.</span>
          </div>
        </div>
      )}
    </div>
  );
};

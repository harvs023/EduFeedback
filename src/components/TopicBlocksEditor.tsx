import React, { useState } from "react";
import { Question, QuestionType, SurveyTopicBlock, Topic } from "../types";
import {
  MAX_BLOCKS,
  MAX_QUESTIONS,
  createBlock,
  createQuestion,
  orderQuestionsByBlock,
} from "../lib/topicBlocks";
import { Trash2, Star, CheckSquare, ListFilter, AlignLeft, ChevronUp, ChevronDown, Plus, Layers } from "lucide-react";

interface TopicBlocksEditorProps {
  questions: Question[];
  blocks: SurveyTopicBlock[];
  topics: Topic[];
  onChange: (questions: Question[], blocks: SurveyTopicBlock[]) => void;
}

const TYPE_SWITCHES: Array<{ type: QuestionType; label: string; icon: string }> = [
  { type: "rating", label: "Rating", icon: "⭐" },
  { type: "multiple", label: "Multiple", icon: "🔘" },
  { type: "checkbox", label: "Checkbox", icon: "☑️" },
  { type: "paragraph", label: "Paragraph", icon: "📝" },
];

const ADD_BUTTONS: Array<{ type: QuestionType; label: string; icon: React.ReactNode; className: string }> = [
  {
    type: "rating",
    label: "+ Rating",
    icon: <Star className="w-4 h-4 text-amber-500 fill-amber-400 shrink-0" />,
    className: "hover:bg-blue-50 hover:border-blue-300 text-blue-700",
  },
  {
    type: "multiple",
    label: "+ Multiple Choice",
    icon: <ListFilter className="w-4 h-4 text-indigo-600 shrink-0" />,
    className: "hover:bg-indigo-50 hover:border-indigo-300 text-indigo-700",
  },
  {
    type: "checkbox",
    label: "+ Checkbox",
    icon: <CheckSquare className="w-4 h-4 text-emerald-600 shrink-0" />,
    className: "hover:bg-emerald-50 hover:border-emerald-300 text-emerald-700",
  },
  {
    type: "paragraph",
    label: "+ Paragraph",
    icon: <AlignLeft className="w-4 h-4 text-slate-600 shrink-0" />,
    className: "hover:bg-slate-100 hover:border-slate-300 text-slate-700",
  },
];

export const TopicBlocksEditor: React.FC<TopicBlocksEditorProps> = ({ questions, blocks, topics, onChange }) => {
  const [confirmRemoveId, setConfirmRemoveId] = useState<string | null>(null);

  const atBlockLimit = blocks.length >= MAX_BLOCKS;
  const atQuestionLimit = questions.length >= MAX_QUESTIONS;

  const commit = (nextQuestions: Question[], nextBlocks: SurveyTopicBlock[]) => {
    onChange(orderQuestionsByBlock(nextQuestions, nextBlocks), nextBlocks);
  };

  // ---- Blocks ----
  const addBlock = () => {
    if (atBlockLimit) return;
    commit(questions, [...blocks, createBlock(topics, false)]);
  };

  const updateBlock = (blockId: string, patch: Partial<SurveyTopicBlock>) => {
    commit(
      questions,
      blocks.map((b) => (b.id === blockId ? { ...b, ...patch } : b))
    );
  };

  const changeBlockTopic = (block: SurveyTopicBlock, topicId: string) => {
    const oldName = topics.find((t) => t.id === block.topicId)?.name || "";
    const newName = topics.find((t) => t.id === topicId)?.name || "";
    // Follow the topic name unless the user already typed their own title.
    const keepTitle = block.title.trim() !== "" && block.title.trim() !== oldName;
    updateBlock(block.id, { topicId, title: keepTitle ? block.title : newName });
  };

  const moveBlock = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= blocks.length) return;
    const next = [...blocks];
    [next[index], next[target]] = [next[target], next[index]];
    commit(questions, next);
  };

  const removeBlock = (blockId: string) => {
    if (blocks.length <= 1) return;
    const hasQuestions = questions.some((q) => q.blockId === blockId);
    if (hasQuestions && confirmRemoveId !== blockId) {
      setConfirmRemoveId(blockId);
      return;
    }
    setConfirmRemoveId(null);
    commit(
      questions.filter((q) => q.blockId !== blockId),
      blocks.filter((b) => b.id !== blockId)
    );
  };

  // ---- Questions ----
  const addQuestion = (blockId: string, type: QuestionType) => {
    if (atQuestionLimit) return;
    commit([...questions, createQuestion(type, blockId)], blocks);
  };

  const updateQuestion = (id: Question["id"], patch: Partial<Question>) => {
    commit(
      questions.map((q) => (q.id === id ? { ...q, ...patch } : q)),
      blocks
    );
  };

  const removeQuestion = (id: Question["id"]) => {
    commit(
      questions.filter((q) => q.id !== id),
      blocks
    );
  };

  const moveQuestion = (id: Question["id"], direction: -1 | 1) => {
    const index = questions.findIndex((q) => q.id === id);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= questions.length) return;
    if (questions[target].blockId !== questions[index].blockId) return;
    const next = [...questions];
    [next[index], next[target]] = [next[target], next[index]];
    commit(next, blocks);
  };

  const changeQuestionType = (q: Question, newType: QuestionType) => {
    const patch: Partial<Question> = { type: newType };
    if ((newType === "multiple" || newType === "checkbox") && (!q.options || q.options.length === 0)) {
      patch.options = ["Option 1", "Option 2", "Option 3"];
    }
    if (newType === "rating") {
      patch.min = 1;
      patch.max = 5;
      patch.labels = ["1 (Poor)", "2 (Fair)", "3 (Average)", "4 (Good)", "5 (Excellent)"];
    }
    updateQuestion(q.id, patch);
  };

  const setOptions = (q: Question, options: string[]) => updateQuestion(q.id, { options });

  // Topics that can be picked: all active ones, plus a retired one if a block already uses it.
  const topicOptionsFor = (block: SurveyTopicBlock) =>
    topics.filter((t) => t.status === "active" || t.id === block.topicId);

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2 flex-wrap text-[11px] font-semibold">
        <span
          className={`px-2.5 py-1 rounded-full border ${
            atBlockLimit ? "bg-amber-50 text-amber-800 border-amber-200" : "bg-indigo-50 text-indigo-700 border-indigo-200"
          }`}
        >
          Topic blocks: {blocks.length}/{MAX_BLOCKS}
        </span>
        <span
          className={`px-2.5 py-1 rounded-full border ${
            atQuestionLimit ? "bg-amber-50 text-amber-800 border-amber-200" : "bg-blue-50 text-blue-700 border-blue-200"
          }`}
        >
          Questions: {questions.length}/{MAX_QUESTIONS}
        </span>
      </div>

      {topics.length === 0 && (
        <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900">
          No topics are available yet. The administrator adds topics in the Topics manager. You can still save a draft.
        </div>
      )}

      {blocks.map((block, bIdx) => {
        const blockQuestions = questions.filter((q) => q.blockId === block.id);
        const usedByOthers = new Set(blocks.filter((b) => b.id !== block.id).map((b) => b.topicId));
        const isConfirming = confirmRemoveId === block.id;

        return (
          <div key={block.id} className="rounded-2xl border border-indigo-200 bg-indigo-50/30 overflow-hidden">
            {/* Block header */}
            <div className="px-4 sm:px-5 py-3 bg-indigo-50/80 border-b border-indigo-100 flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-indigo-600" />
                <span className="text-xs font-extrabold uppercase tracking-wider text-indigo-900">
                  Topic block {bIdx + 1}
                </span>
                <span className="text-[11px] text-indigo-700/70">
                  ({blockQuestions.length} {blockQuestions.length === 1 ? "question" : "questions"})
                </span>
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => moveBlock(bIdx, -1)}
                  disabled={bIdx === 0}
                  className="p-1.5 rounded-lg text-indigo-700 hover:bg-white disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                  title="Move block up"
                >
                  <ChevronUp className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => moveBlock(bIdx, 1)}
                  disabled={bIdx === blocks.length - 1}
                  className="p-1.5 rounded-lg text-indigo-700 hover:bg-white disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                  title="Move block down"
                >
                  <ChevronDown className="w-4 h-4" />
                </button>
                {blocks.length > 1 &&
                  (isConfirming ? (
                    <div className="flex items-center gap-1 ml-1">
                      <button
                        type="button"
                        onClick={() => removeBlock(block.id)}
                        className="px-2 py-1 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-[11px] font-bold cursor-pointer"
                      >
                        Remove block and its {blockQuestions.length} questions
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmRemoveId(null)}
                        className="px-2 py-1 rounded-lg bg-white border border-slate-200 text-slate-600 text-[11px] font-bold cursor-pointer"
                      >
                        Keep
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => removeBlock(block.id)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 cursor-pointer"
                      title="Remove block"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  ))}
              </div>
            </div>

            <div className="p-4 sm:p-5 space-y-4">
              {/* Topic, title, description */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">Topic *</label>
                  <select
                    value={block.topicId}
                    onChange={(e) => changeBlockTopic(block, e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs sm:text-sm font-semibold text-slate-800"
                  >
                    <option value="">Choose a topic…</option>
                    {topicOptionsFor(block).map((t) => (
                      <option key={t.id} value={t.id} disabled={usedByOthers.has(t.id)}>
                        {t.name}
                        {t.status === "retired" ? " (retired)" : ""}
                        {usedByOthers.has(t.id) ? " (used in another block)" : ""}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Block title * <span className="normal-case font-medium text-slate-400">(shown to respondents)</span>
                  </label>
                  <input
                    type="text"
                    maxLength={80}
                    value={block.title}
                    onChange={(e) => updateBlock(block.id, { title: e.target.value })}
                    placeholder="e.g. Teaching Quality"
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs sm:text-sm font-semibold text-slate-900 placeholder:text-slate-400 focus:outline-hidden focus:border-indigo-400"
                  />
                </div>
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Short description <span className="normal-case font-medium text-slate-400">(optional)</span>
                </label>
                <input
                  type="text"
                  maxLength={200}
                  value={block.description || ""}
                  onChange={(e) => updateBlock(block.id, { description: e.target.value })}
                  placeholder="e.g. These questions are about how the subject is taught."
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 placeholder:text-slate-400 focus:outline-hidden focus:border-indigo-400"
                />
              </div>

              {/* Questions in this block */}
              {blockQuestions.length === 0 && (
                <div className="p-5 bg-white border border-dashed border-slate-300 rounded-xl text-center text-xs text-slate-500">
                  No questions in this block yet. Use the buttons below to add one.
                </div>
              )}

              <div className="space-y-3">
                {blockQuestions.map((q, i) => {
                  const number = questions.indexOf(q) + 1;
                  return (
                    <div key={String(q.id)} className="p-4 bg-white rounded-xl border border-slate-200 space-y-3">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <div className="flex items-center gap-2">
                          <span className="w-6 h-6 rounded-md bg-blue-600 text-white text-xs font-bold flex items-center justify-center shrink-0">
                            {number}
                          </span>
                          <div className="flex items-center gap-1 bg-slate-50 p-0.5 rounded-lg border border-slate-200">
                            {TYPE_SWITCHES.map((t) => (
                              <button
                                key={t.type}
                                type="button"
                                onClick={() => changeQuestionType(q, t.type)}
                                className={`px-2 py-0.5 rounded-md text-[11px] font-bold transition-all cursor-pointer flex items-center gap-1 ${
                                  q.type === t.type
                                    ? "bg-blue-600 text-white shadow-xs"
                                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                                }`}
                                title={`Switch to ${t.label}`}
                              >
                                <span>{t.icon}</span>
                                <span className="hidden sm:inline">{t.label}</span>
                              </button>
                            ))}
                          </div>
                        </div>
                        <div className="flex items-center gap-0.5">
                          <button
                            type="button"
                            onClick={() => moveQuestion(q.id, -1)}
                            disabled={i === 0}
                            className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                            title="Move question up"
                          >
                            <ChevronUp className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => moveQuestion(q.id, 1)}
                            disabled={i === blockQuestions.length - 1}
                            className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                            title="Move question down"
                          >
                            <ChevronDown className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => removeQuestion(q.id)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 cursor-pointer transition-colors"
                            title="Delete question"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      <input
                        type="text"
                        value={q.text}
                        onChange={(e) => updateQuestion(q.id, { text: e.target.value })}
                        placeholder="Enter the question text here..."
                        className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-semibold text-slate-900 placeholder:text-slate-400 focus:outline-hidden focus:border-blue-500 focus:bg-white"
                      />

                      {q.type === "rating" && (
                        <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-600 space-y-1">
                          <span className="font-bold text-slate-700">Rating scale:</span>
                          <div className="flex items-center gap-2 flex-wrap text-[11px] text-slate-500">
                            <span>Min: {q.min || 1}</span>
                            <span>•</span>
                            <span>Max: {q.max || 5}</span>
                            <span>•</span>
                            <span>Labels: {q.labels?.join(", ") || "1 (Poor) to 5 (Excellent)"}</span>
                          </div>
                        </div>
                      )}

                      {(q.type === "multiple" || q.type === "checkbox") && (
                        <div className="space-y-2 pt-1">
                          {(q.options || []).map((opt, oIdx) => (
                            <div key={oIdx} className="flex items-center gap-2">
                              <input
                                type="text"
                                value={opt}
                                onChange={(e) =>
                                  setOptions(
                                    q,
                                    (q.options || []).map((o, k) => (k === oIdx ? e.target.value : o))
                                  )
                                }
                                className="flex-1 px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs"
                              />
                              <button
                                type="button"
                                onClick={() => setOptions(q, (q.options || []).filter((_, k) => k !== oIdx))}
                                className="p-1 text-slate-400 hover:text-rose-600 cursor-pointer"
                                title="Remove option"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ))}
                          <button
                            type="button"
                            onClick={() =>
                              setOptions(q, [...(q.options || []), `New Option ${(q.options?.length || 0) + 1}`])
                            }
                            className="text-xs font-bold text-blue-600 hover:text-blue-700 cursor-pointer"
                          >
                            + Add Option
                          </button>
                        </div>
                      )}

                      {q.type === "paragraph" && (
                        <p className="text-[11px] text-slate-400 italic">
                          Respondents get an open text box. Their comments are analyzed for sentiment (Tagalog, English
                          and Taglish).
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Add question to this block */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {ADD_BUTTONS.map((b) => (
                  <button
                    key={b.type}
                    type="button"
                    onClick={() => addQuestion(block.id, b.type)}
                    disabled={atQuestionLimit}
                    className={`px-3 py-2 bg-white text-xs font-bold rounded-xl border border-slate-200 transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-xs disabled:opacity-40 disabled:cursor-not-allowed ${b.className}`}
                  >
                    {b.icon}
                    <span>{b.label}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        );
      })}

      {atQuestionLimit && (
        <p className="text-[11px] font-semibold text-amber-800">
          You reached the limit of {MAX_QUESTIONS} questions. Remove a question to add another.
        </p>
      )}

      <button
        type="button"
        onClick={addBlock}
        disabled={atBlockLimit}
        className="w-full p-4 rounded-2xl border-2 border-dashed border-indigo-300 hover:border-indigo-500 hover:bg-indigo-50/50 text-indigo-700 text-xs font-bold flex items-center justify-center gap-2 cursor-pointer transition-all disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent"
      >
        <Plus className="w-4 h-4" />
        <span>
          {atBlockLimit ? `Limit reached: ${MAX_BLOCKS} topic blocks` : "Add another topic block"}
        </span>
      </button>
    </div>
  );
};

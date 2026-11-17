import type { Survey, SurveyTopicBlock, TopicBlockMove } from "../types";

/** One question block, with what the admin needs to recognise it. */
export interface BlockRow {
  surveyId: string;
  surveyTitle: string;
  surveyStatus: string;
  owner: string;
  block: SurveyTopicBlock;
  questions: string[];
}

export function blockKey(surveyId: string, blockId: string): string {
  return `${surveyId}::${blockId}`;
}

/** Every block under a topic, across all surveys. */
export function blocksUnderTopic(surveys: Survey[], topicId: string): BlockRow[] {
  const rows: BlockRow[] = [];
  for (const s of surveys) {
    for (const b of s.topicBlocks || []) {
      if (b.topicId !== topicId) continue;
      rows.push({
        surveyId: String(s.id),
        surveyTitle: s.title,
        surveyStatus: s.status,
        owner: (s.owner || "").trim().toLowerCase(),
        block: b,
        questions: (s.questions || []).filter((q) => q.blockId === b.id).map((q) => q.text),
      });
    }
  }
  return rows;
}

/** Lowercase, without accents, so "Pasilidád" matches "pasilidad". */
export function normalizeText(text: string): string {
  return text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

/**
 * Keyword search: words separated by commas, any of them may match (Tagalog and English words
 * can be mixed, e.g. "court, korte, basketball"). Searches survey title, block title and questions.
 * It finds the words typed; it does not translate.
 */
export function matchesKeywords(row: BlockRow, query: string): boolean {
  const words = query
    .split(",")
    .map((w) => normalizeText(w.trim()))
    .filter(Boolean);
  if (words.length === 0) return true;
  const hay = normalizeText([row.surveyTitle, row.block.title, row.block.description || "", ...row.questions].join(" \n "));
  return words.some((w) => hay.includes(w));
}

/** The new topic blocks of each changed survey after applying the moves. Only `topicId` changes. */
export function applyMoves(surveys: Survey[], moves: TopicBlockMove[], reverse = false): Map<string, SurveyTopicBlock[]> {
  const out = new Map<string, SurveyTopicBlock[]>();
  for (const m of moves) {
    const survey = surveys.find((s) => String(s.id) === m.surveyId);
    if (!survey) continue;
    const blocks = out.get(m.surveyId) || (survey.topicBlocks || []).map((b) => ({ ...b }));
    const from = reverse ? m.to : m.from;
    const to = reverse ? m.from : m.to;
    const target = blocks.find((b) => b.id === m.blockId);
    // Only move a block that is still where we expect it (it may have been changed since).
    if (target && target.topicId === from) target.topicId = to;
    out.set(m.surveyId, blocks);
  }
  return out;
}

/** How many of the moves can still be applied (the block is still under the expected topic). */
export function applicableCount(surveys: Survey[], moves: TopicBlockMove[], reverse = false): number {
  return moves.filter((m) => {
    const b = surveys.find((s) => String(s.id) === m.surveyId)?.topicBlocks?.find((x) => x.id === m.blockId);
    return b?.topicId === (reverse ? m.to : m.from);
  }).length;
}

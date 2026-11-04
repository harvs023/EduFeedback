import { Question, QuestionType, SurveyTopicBlock, Topic } from "../types";

export const MAX_BLOCKS = 8;
export const MAX_QUESTIONS = 30;

export const makeId = (prefix: string) =>
  `${prefix}_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

/** A new, empty block. The first block of a survey defaults to the "General" topic. */
export function createBlock(topics: Topic[], useDefaultTopic: boolean): SurveyTopicBlock {
  const active = topics.filter((t) => t.status === "active");
  const topic = useDefaultTopic ? active.find((t) => t.id === "topic_general") || active[0] : undefined;
  return { id: makeId("b"), topicId: topic?.id || "", title: topic?.name || "" };
}

export function createQuestion(type: QuestionType, blockId: string): Question {
  const base = { id: makeId("q"), text: "", blockId };
  switch (type) {
    case "rating":
      return { ...base, type, min: 1, max: 5, labels: ["1 (Poor)", "2", "3 (Average)", "4", "5 (Excellent)"] };
    case "multiple":
      return { ...base, type, options: ["Option 1", "Option 2", "Option 3"] };
    case "checkbox":
      return { ...base, type, options: ["Choice A", "Choice B", "Choice C"] };
    default:
      return { ...base, type: "paragraph" };
  }
}

/** Keeps questions in block order, so question numbers match what is shown on screen. */
export function orderQuestionsByBlock(questions: Question[], blocks: SurveyTopicBlock[]): Question[] {
  return blocks.flatMap((b) => questions.filter((q) => q.blockId === b.id));
}

/**
 * Makes sure every question has a unique id and belongs to an existing block.
 * Older surveys without blocks get one "General" block holding all their questions.
 */
export function prepareBlocks(
  questions: Question[],
  blocks: SurveyTopicBlock[] | undefined,
  topics: Topic[]
): { questions: Question[]; blocks: SurveyTopicBlock[] } {
  const outBlocks = blocks && blocks.length > 0 ? blocks.map((b) => ({ ...b })) : [createBlock(topics, true)];
  const blockIds = new Set(outBlocks.map((b) => b.id));
  const seenIds = new Set<string>();

  const outQuestions = questions.map((q) => {
    let id = q.id !== undefined && q.id !== "" ? String(q.id) : makeId("q");
    if (seenIds.has(id)) id = makeId("q");
    seenIds.add(id);
    const blockId = q.blockId && blockIds.has(q.blockId) ? q.blockId : outBlocks[0].id;
    return { ...q, id, blockId };
  });

  return { questions: orderQuestionsByBlock(outQuestions, outBlocks), blocks: outBlocks };
}

/** Checks run before a survey is submitted for approval (not for drafts). */
export function validateBlocks(questions: Question[], blocks: SurveyTopicBlock[], topics: Topic[]): string[] {
  const errors: string[] = [];
  if (blocks.length === 0) errors.push("Add at least one topic block.");
  if (blocks.length > MAX_BLOCKS) errors.push(`A survey can have at most ${MAX_BLOCKS} topic blocks.`);
  if (questions.length > MAX_QUESTIONS) errors.push(`A survey can have at most ${MAX_QUESTIONS} questions.`);

  const usedTopics = new Set<string>();
  blocks.forEach((b, i) => {
    const label = `Topic block ${i + 1}`;
    const topic = topics.find((t) => t.id === b.topicId);
    if (!b.topicId) {
      errors.push(`${label}: choose a topic.`);
    } else if (topic && topic.status === "retired") {
      errors.push(`${label}: the topic "${topic.name}" was retired by the administrator. Choose another topic.`);
    } else if (usedTopics.has(b.topicId)) {
      errors.push(`${label}: uses the same topic as an earlier block. Each block needs a different topic.`);
    }
    usedTopics.add(b.topicId);
    if (b.title.trim().length < 3) errors.push(`${label}: enter a title (at least 3 characters).`);
    if (!questions.some((q) => q.blockId === b.id && q.text.trim().length > 0)) {
      errors.push(`${label} has no questions. Add a question or remove the block.`);
    }
  });
  return errors;
}

/** Trims text and leaves out an empty description (Firestore rejects undefined). */
export function cleanBlocks(blocks: SurveyTopicBlock[]): SurveyTopicBlock[] {
  return blocks.map((b) => {
    const description = (b.description || "").trim();
    return {
      id: b.id,
      topicId: b.topicId,
      title: b.title.trim(),
      ...(description ? { description } : {}),
    };
  });
}

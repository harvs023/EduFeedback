import fs from "fs";
import path from "path";
import type { GoogleGenAI } from "@google/genai";
import { askGemini, modelVersionFor, sentimentModel } from "./sentiment";

/**
 * Optional "AI-suggested wording" for the rule-based recommendations (plan step 7d). Gemini only
 * rewords findings the rules already computed; any suggestion containing a number that is not in
 * its finding is hidden. Nothing is saved.
 */
export const RECOMMENDATION_PROMPT_VERSION = "v1";
export const MAX_FINDINGS = 15;
const MAX_COMMENTS_PER_FINDING = 3;
const MAX_COMMENT_CHARS = 300;
const MAX_FIELD_CHARS = 600;

export interface FindingInput {
  id: string;
  label: string;
  topic: string;
  sentence: string;
  evidence: string;
  comments: string[];
}

export interface WordingItem {
  id: string;
  suggestion: string | null;
  /** Why no suggestion is shown, in plain words. */
  problem?: string;
}

let cachedTemplate: string | null = null;
export function loadRecommendationTemplate(): string {
  if (cachedTemplate) return cachedTemplate;
  const file = path.resolve(process.cwd(), "docs", `recommendation-prompt-${RECOMMENDATION_PROMPT_VERSION}.md`);
  const match = fs.readFileSync(file, "utf8").match(/```\r?\n([\s\S]*?)\r?\n```/);
  const block = match?.[1];
  if (!block || !["{{SURVEY_TITLE}}", "{{PERIOD}}", "{{FINDINGS}}"].every((k) => block.includes(k))) {
    throw new Error(`The prompt block in ${file} is missing or lacks {{SURVEY_TITLE}}, {{PERIOD}} or {{FINDINGS}}.`);
  }
  cachedTemplate = block.replace(/\r\n/g, "\n");
  return cachedTemplate;
}

const oneLine = (t: unknown, max: number) => String(t ?? "").replace(/\s+/g, " ").trim().slice(0, max);

/** Cleans what the browser sent: plain text, short, at most 3 comments per finding. */
export function cleanFindings(raw: unknown): FindingInput[] | null {
  if (!Array.isArray(raw) || raw.length === 0 || raw.length > MAX_FINDINGS) return null;
  return raw.map((f: any, i) => ({
    id: `F${i + 1}`,
    label: oneLine(f?.label, 40),
    topic: oneLine(f?.topic, 120),
    sentence: oneLine(f?.sentence, MAX_FIELD_CHARS),
    evidence: oneLine(f?.evidence, MAX_FIELD_CHARS),
    comments: (Array.isArray(f?.comments) ? f.comments : [])
      .slice(0, MAX_COMMENTS_PER_FINDING)
      .map((c: unknown) => oneLine(c, MAX_COMMENT_CHARS))
      .filter(Boolean),
  }));
}

function findingsText(findings: FindingInput[]): string {
  return findings
    .map((f) => {
      const lines = [`[${f.id}] ${f.label} | Topic: ${f.topic}`, `Finding: ${f.sentence}`];
      if (f.evidence) lines.push(`Evidence: ${f.evidence}`);
      if (f.comments.length) lines.push("Example comments:", ...f.comments.map((c) => `- ${c}`));
      return lines.join("\n");
    })
    .join("\n\n");
}

const numbersIn = (text: string) => (text.match(/\d+(?:\.\d+)?/g) || []).map(Number);

/** True when every number in the suggestion already appears in the allowed text. */
export function keepsNumbers(suggestion: string, allowedText: string): boolean {
  const allowed = new Set(numbersIn(allowedText));
  return numbersIn(suggestion).every((n) => allowed.has(n));
}

export async function suggestWording(
  ai: GoogleGenAI | null,
  surveyTitle: string,
  period: string,
  findings: FindingInput[]
): Promise<{ items: WordingItem[]; model: string; modelVersion: string | null; promptVersion: string } | null> {
  if (!ai) return null;
  const title = oneLine(surveyTitle, 200) || "Survey";
  const when = oneLine(period, 100) || "All time";
  const prompt = loadRecommendationTemplate()
    .replace("{{SURVEY_TITLE}}", () => title)
    .replace("{{PERIOD}}", () => when)
    .replace("{{FINDINGS}}", () => findingsText(findings));

  const answer = await askGemini(ai, prompt);
  if (!answer) return null;
  const returned: any[] = Array.isArray(answer.json?.items) ? answer.json.items : [];
  const items = findings.map((f): WordingItem => {
    const hit = returned.find((r) => r?.id === f.id);
    const text = typeof hit?.suggestion === "string" ? oneLine(hit.suggestion, 600) : "";
    if (!text) return { id: f.id, suggestion: null, problem: "No suggestion was returned for this finding." };
    if (!keepsNumbers(text, `${f.sentence} ${f.evidence} ${title} ${when}`)) {
      return { id: f.id, suggestion: null, problem: "Hidden: the AI wording contained a number that is not in the finding." };
    }
    return { id: f.id, suggestion: text };
  });
  const model = sentimentModel();
  return {
    items,
    model,
    modelVersion: (await modelVersionFor(ai, model)) || answer.modelVersion,
    promptVersion: RECOMMENDATION_PROMPT_VERSION,
  };
}

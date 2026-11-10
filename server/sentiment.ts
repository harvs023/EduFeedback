import fs from "fs";
import path from "path";
import type { GoogleGenAI } from "@google/genai";
import type { CommentAnalysis, CommentEmotion, CommentLanguage, Polarity } from "../src/types";
import { MAX_COMMENT_LENGTH, signResult } from "./signing";

/**
 * Sentiment analysis = zero-shot classification with ONE pinned Gemini model (not a trained model).
 * The prompt is read word for word from docs/sentiment-prompt-<version>.md, so the file in the
 * repository is exactly what Gemini receives. Do not edit it after the final evaluation run;
 * bump PROMPT_VERSION instead.
 */
export const PROMPT_VERSION = "v1";
// Chosen 2026-11-08: available on this key and answered in about 10 s. gemini-3.8-flash was
// overloaded (503) and took minutes; gemini-2.5-flash is closed to new users (404).
export const DEFAULT_SENTIMENT_MODEL = "gemini-3.1-flash-lite";
/** Read when used (not at import time), so GEMINI_SENTIMENT_MODEL in .env is seen. Not a VITE_ setting. */
export function sentimentModel(): string {
  return (process.env.GEMINI_SENTIMENT_MODEL || DEFAULT_SENTIMENT_MODEL).trim();
}

let cachedTemplate: string | null = null;

/** The fenced prompt block inside the docs file. Throws if the file is missing or malformed. */
export function loadPromptTemplate(): string {
  if (cachedTemplate) return cachedTemplate;
  const file = path.resolve(process.cwd(), "docs", `sentiment-prompt-${PROMPT_VERSION}.md`);
  const markdown = fs.readFileSync(file, "utf8");
  const match = markdown.match(/```\r?\n([\s\S]*?)\r?\n```/);
  if (!match || !match[1].includes("${text}") || !match[1].includes("${surveyContext}")) {
    throw new Error(`The prompt block in ${file} is missing or does not contain \${text} and \${surveyContext}.`);
  }
  cachedTemplate = match[1].replace(/\r\n/g, "\n");
  return cachedTemplate;
}

function buildPrompt(text: string, surveyContext: string): string {
  // A comment must not be able to close the data markers early.
  const safeText = text.replace(/<<<COMMENT|COMMENT>>>/g, "");
  const safeContext = surveyContext.replace(/<<<COMMENT|COMMENT>>>/g, "").replace(/\s+/g, " ").slice(0, 300);
  // Functions as replacements, so "$&" or "$1" typed in a comment is kept literally.
  return loadPromptTemplate()
    .replace("${surveyContext}", () => safeContext || "General campus feedback")
    .replace("${text}", () => safeText);
}

const POLARITIES: Polarity[] = ["Positive", "Neutral", "Negative"];
const LANGUAGES: CommentLanguage[] = ["Tagalog", "Taglish", "English", "Other"];
const EMOTIONS: CommentEmotion[] = ["Satisfied", "Frustrated", "Confused", "Hopeful", "Neutral"];

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

/** Keeps the score inside the band the prompt requires for the polarity. */
function scoreForPolarity(polarity: Polarity, score: number): number {
  const s = Number.isFinite(score) ? score : 0;
  if (polarity === "Positive") return clamp(s, 0.25, 1);
  if (polarity === "Negative") return clamp(s, -1, -0.25);
  return clamp(s, -0.25, 0.25);
}

/** Checks Gemini's JSON against the prompt's schema. Returns null if it cannot be trusted. */
function normalizeGeminiResult(
  raw: any
): Omit<CommentAnalysis, "method" | "model" | "modelVersion" | "promptVersion" | "analyzedAt"> | null {
  if (!raw || typeof raw !== "object" || typeof raw.analyzable !== "boolean") return null;
  const keywords = Array.isArray(raw.keywords)
    ? raw.keywords.filter((k: unknown) => typeof k === "string").slice(0, 4).map((k: string) => k.slice(0, 80))
    : [];
  const common = {
    language: LANGUAGES.includes(raw.language) ? (raw.language as CommentLanguage) : "Other",
    emotion: EMOTIONS.includes(raw.emotion) ? (raw.emotion as CommentEmotion) : "Neutral",
    keywords,
    englishTranslation: typeof raw.englishTranslation === "string" ? raw.englishTranslation.slice(0, 600) : "",
    reason: typeof raw.reason === "string" ? raw.reason.slice(0, 200) : "",
  };
  const confidence = typeof raw.confidence === "number" ? Number(clamp(raw.confidence, 0, 1).toFixed(2)) : null;

  if (!raw.analyzable) {
    return {
      ...common,
      analyzable: false,
      polarity: null,
      sentiment: null,
      isSuggestion: false,
      score: null,
      confidence,
      sarcasmDetected: false,
    };
  }
  if (!POLARITIES.includes(raw.polarity)) return null;
  const polarity = raw.polarity as Polarity;
  const isSuggestion = raw.isSuggestion === true;
  return {
    ...common,
    analyzable: true,
    polarity,
    // "sentiment" equals polarity, except "Constructive Suggestion" for suggestions (prompt's last rule).
    sentiment: raw.sentiment === "Constructive Suggestion" && isSuggestion ? "Constructive Suggestion" : polarity,
    isSuggestion,
    score: Number(scoreForPolarity(polarity, Number(raw.score)).toFixed(2)),
    confidence,
    sarcasmDetected: raw.sarcasmDetected === true,
  };
}

// ---------------------------------------------------------------------------------------------
// Fallback: a simple word list, used only when Gemini cannot answer. Its results are labeled
// method "fallback" everywhere and carry no confidence number (the word list cannot measure one).
// ---------------------------------------------------------------------------------------------
const EMPTY_ANSWERS = new Set(["", "-", "--", ".", "n/a", "na", "none", "wala", "wala po", "no comment", "no comments", "nothing"]);
const POSITIVE_WORDS = ["maganda", "mahusay", "mabait", "magaling", "sulit", "maayos", "salamat", "thank", "good", "great", "excellent", "helpful", "malinaw", "clear", "masaya", "the best"];
const NEGATIVE_WORDS = ["mabagal", "pangit", "sira", "masikip", "kulang", "mahirap", "mainit", "mabaho", "bulok", "madumi", "bad", "terrible", "poor", "slow", "late", "unfair", "hindi maganda", "walang kwenta"];
const SUGGESTION_WORDS = ["sana", "dapat", "paki", "suggest", "should", "i hope", "improve", "dagdagan", "ayusin", "palitan"];

function fallbackAnalysis(
  text: string
): Omit<CommentAnalysis, "method" | "model" | "modelVersion" | "promptVersion" | "analyzedAt"> {
  const lower = text.toLowerCase().trim();
  const base = { language: "Other" as CommentLanguage, emotion: "Neutral" as CommentEmotion, keywords: [], englishTranslation: "", confidence: null, sarcasmDetected: false };
  if (EMPTY_ANSWERS.has(lower) || !/[a-z]{2,}/i.test(lower)) {
    return { ...base, analyzable: false, polarity: null, sentiment: null, isSuggestion: false, score: null, reason: "Word-list fallback: no comment content." };
  }
  const pos = POSITIVE_WORDS.filter((w) => lower.includes(w)).length;
  const neg = NEGATIVE_WORDS.filter((w) => lower.includes(w)).length;
  const isSuggestion = SUGGESTION_WORDS.some((w) => lower.includes(w));
  const polarity: Polarity = neg > pos || (isSuggestion && pos === 0) ? "Negative" : pos > neg ? "Positive" : "Neutral";
  const score = polarity === "Positive" ? 0.5 : polarity === "Negative" ? -0.5 : 0;
  return {
    ...base,
    analyzable: true,
    polarity,
    sentiment: isSuggestion ? "Constructive Suggestion" : polarity,
    isSuggestion,
    score,
    reason: "Word-list fallback (Gemini was unavailable); lower accuracy than Gemini.",
  };
}

// The dated version Google reports for the pinned model, e.g. "3.1-flash-lite-05-2026".
// Asked once per model name and remembered; the per-answer report only repeats the plain name.
const versionCache = new Map<string, string | null>();
export async function modelVersionFor(ai: GoogleGenAI, model: string): Promise<string | null> {
  if (versionCache.has(model)) return versionCache.get(model) ?? null;
  try {
    const info = await ai.models.get({ model });
    versionCache.set(model, info.version || null);
  } catch (err) {
    console.warn(`[Sentiment] Could not look up the version of ${model}:`, err);
    return null; // not cached, so it is tried again next time
  }
  return versionCache.get(model) ?? null;
}

/**
 * Gemini's JSON plus the model version reported with the answer. Temperature 0, retries on
 * temporary errors. Also used for the recommendation wording (server/recommendationWording.ts).
 */
export async function askGemini(ai: GoogleGenAI, prompt: string): Promise<{ json: any; modelVersion: string | null } | null> {
  // Daily limit used up: do not call Gemini at all until the pause is over.
  if (Date.now() < quotaPausedUntil) return null;
  for (let attempt = 0; attempt < RETRY_WAITS_MS.length + 1; attempt++) {
    try {
      const response = await ai.models.generateContent({
        model: sentimentModel(),
        contents: prompt,
        config: { responseMimeType: "application/json", temperature: 0 },
      });
      const cleaned = (response.text || "").replace(/```json/gi, "").replace(/```/g, "").trim();
      const json = JSON.parse(cleaned);
      if (quotaHitAt) {
        console.log("[Sentiment] Gemini answers again; the daily limit has reset.");
        quotaHitAt = 0;
      }
      return { json, modelVersion: response.modelVersion || null };
    } catch (err: any) {
      const msg = String(err?.message || err);
      if (isDailyLimit(err, msg)) {
        // Keep the first time it was hit while the limit stays used up across pauses.
        if (!quotaHitAt) {
          quotaHitAt = Date.now();
          console.warn(`[Sentiment] Gemini's daily limit is used up. Pausing for ${QUOTA_PAUSE_MS / 60000} minutes; new comments stay pending.`);
        }
        quotaPausedUntil = Date.now() + QUOTA_PAUSE_MS;
        return null;
      }
      console.warn(`[Sentiment] ${sentimentModel()} attempt ${attempt + 1} failed: ${msg.slice(0, 160)}`);
      if (!isTemporary(err, msg) || attempt === RETRY_WAITS_MS.length) return null;
      await new Promise((r) => setTimeout(r, RETRY_WAITS_MS[attempt]));
    }
  }
  return null;
}

/** Waits between tries for one comment (3 tries in all). */
const RETRY_WAITS_MS = [2000, 5000];

/**
 * Gemini's free daily limit. When it is used up, retrying is pointless, so the server stops
 * calling Gemini for QUOTA_PAUSE_MS, leaves new comments "pending" (no fallback labels) and
 * tries again after the pause (see the sweep in server.ts).
 */
export const QUOTA_PAUSE_MS = 30 * 60 * 1000;
let quotaPausedUntil = 0;
let quotaHitAt = 0;

export function geminiQuotaStatus(): { paused: boolean; since: number | null; retryAt: number | null } {
  const paused = Date.now() < quotaPausedUntil;
  return { paused, since: paused ? quotaHitAt : null, retryAt: paused ? quotaPausedUntil : null };
}

/** "Too many requests" that names a per-day quota (not the per-minute one, which passes quickly). */
function isDailyLimit(err: any, msg: string): boolean {
  const status = Number(err?.status ?? err?.code);
  const tooMany = status === 429 || /RESOURCE_EXHAUSTED|429/.test(msg);
  return tooMany && /per ?day|PerDay|daily/i.test(msg);
}

/**
 * Errors worth trying again: Gemini busy (503), too many requests (429), server errors (5xx),
 * network problems, timeouts, or a reply that was not valid JSON. A wrong key (400/401/403) or
 * unknown model (404) is not retried.
 */
function isTemporary(err: any, msg: string): boolean {
  const status = Number(err?.status ?? err?.code);
  if (status === 429 || status >= 500) return true;
  if (err instanceof SyntaxError) return true;
  return /\b(429|500|502|503|504)\b|UNAVAILABLE|RESOURCE_EXHAUSTED|INTERNAL|DEADLINE|timeout|timed out|fetch failed|ECONNRESET|ETIMEDOUT|socket/i.test(msg);
}

/** Analyzes and signs one comment. Never throws: if Gemini fails, returns a labeled fallback result. */
export async function analyzeComment(
  ai: GoogleGenAI | null,
  text: string,
  surveyContext: string
): Promise<CommentAnalysis> {
  const result = await analyzeUnsigned(ai, text.trim(), surveyContext);
  const signature = signResult(text, result);
  return signature ? { ...result, signature } : result;
}

async function analyzeUnsigned(
  ai: GoogleGenAI | null,
  text: string,
  surveyContext: string
): Promise<CommentAnalysis> {
  const stamp = { promptVersion: PROMPT_VERSION, analyzedAt: Date.now() };
  const clipped = text.slice(0, MAX_COMMENT_LENGTH);

  if (ai) {
    let prompt: string | null = null;
    try {
      prompt = buildPrompt(clipped, surveyContext);
    } catch (err) {
      console.error("[Sentiment] Prompt file problem:", err);
    }
    if (prompt) {
      const answer = await askGemini(ai, prompt);
      const normalized = answer ? normalizeGeminiResult(answer.json) : null;
      if (normalized && answer) {
        const dated = await modelVersionFor(ai, sentimentModel());
        return {
          ...normalized,
          method: "gemini",
          model: sentimentModel(),
          modelVersion: dated || answer.modelVersion,
          ...stamp,
        };
      }
    }
  }
  return { ...fallbackAnalysis(clipped), method: "fallback", model: null, modelVersion: null, ...stamp };
}

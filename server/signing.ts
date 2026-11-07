import crypto from "crypto";
import type { CommentAnalysis } from "../src/types";

/**
 * Signed sentiment results.
 *
 * The respondent's browser saves the response, so it could change a label before saving. To make
 * that detectable, the server signs every result with a secret only the server knows
 * (RESULT_SIGNING_SECRET, never a VITE_ setting). The signature covers the comment text and the
 * whole result (polarity, sentiment, score, method, model, model version, prompt version, ...).
 * Verification also happens only on the server. A result whose signature is missing or does not
 * match is treated as "needs a re-run" and is not counted anywhere.
 */
export const SIGNATURE_VERSION = "s1";
export const MAX_COMMENT_LENGTH = 2000;
const MIN_SECRET_LENGTH = 32;

/** Read when used (not at import time), so the value from .env is seen. */
function signingSecret(): string | null {
  const secret = (process.env.RESULT_SIGNING_SECRET || "").trim();
  return secret.length >= MIN_SECRET_LENGTH ? secret : null;
}

export function signingReady(): boolean {
  return signingSecret() !== null;
}

/** The comment exactly as it was analyzed. */
export function normalizeCommentText(text: string): string {
  return text.trim().slice(0, MAX_COMMENT_LENGTH);
}

/** Same JSON for the same data, whatever order Firestore returns the fields in. */
function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonicalJson(v)}`).join(",")}}`;
}

function computeSignature(secret: string, text: string, analysis: CommentAnalysis): string {
  const { signature: _ignored, ...result } = analysis;
  const payload = canonicalJson({ v: SIGNATURE_VERSION, text: normalizeCommentText(text), result });
  return `${SIGNATURE_VERSION}.${crypto.createHmac("sha256", secret).update(payload).digest("hex")}`;
}

/** Returns the signature, or undefined when no secret is set (the result then needs a re-run). */
export function signResult(text: string, analysis: CommentAnalysis): string | undefined {
  const secret = signingSecret();
  return secret ? computeSignature(secret, text, analysis) : undefined;
}

export function verifyResult(text: string, analysis: CommentAnalysis): boolean {
  const secret = signingSecret();
  if (!secret || typeof analysis?.signature !== "string") return false;
  const expected = Buffer.from(computeSignature(secret, text, analysis));
  const given = Buffer.from(analysis.signature);
  return expected.length === given.length && crypto.timingSafeEqual(expected, given);
}

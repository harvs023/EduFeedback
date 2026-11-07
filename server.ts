import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";
import appletConfig from "./firebase-applet-config.json";
import { analyzeComment, loadPromptTemplate, PROMPT_VERSION, sentimentModel } from "./server/sentiment";
import { signingReady, verifyResult } from "./server/signing";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json({ limit: "10mb" }));

// In-memory rate limiting map: userId -> { count: number, resetTime: number }
const userRateLimits = new Map<string, { count: number; resetTime: number }>();

// Authentication and rate limiting middleware for all /api/* endpoints
app.use("/api/*", async (req, res, next) => {
  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";

  if (!token) {
    return res.status(401).json({ error: "Missing or invalid authorization token" });
  }

  const apiKey =
    process.env.VITE_FIREBASE_API_KEY ||
    process.env.FIREBASE_API_KEY ||
    appletConfig?.apiKey ||
    "";

  try {
    const verifyRes = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken: token }),
      }
    );

    if (!verifyRes.ok) {
      return res.status(401).json({ error: "Invalid authentication token" });
    }

    const data = (await verifyRes.json()) as any;
    if (!data.users || data.users.length === 0) {
      return res.status(401).json({ error: "User not found for token" });
    }

    const user = data.users[0];
    const userId = user.localId || user.email || token;

    // Rate limiting: 30 requests per minute per user
    const now = Date.now();
    const rateData = userRateLimits.get(userId);

    if (!rateData || now > rateData.resetTime) {
      userRateLimits.set(userId, { count: 1, resetTime: now + 60000 });
    } else {
      if (rateData.count >= 30) {
        return res.status(429).json({ error: "Rate limit exceeded. Maximum 30 requests per minute." });
      }
      rateData.count++;
    }

    (req as any).user = user;
    next();
  } catch {
    return res.status(401).json({ error: "Authentication verification failed" });
  }
});

// Dynamic helper to get Gemini API Key (re-reads .env if modified)
function getGeminiApiKey(): string {
  dotenv.config();
  const rawKey =
    process.env.GEMINI_API_KEY ||
    process.env.VITE_GEMINI_API_KEY ||
    process.env.GOOGLE_API_KEY ||
    "";
  return rawKey.trim().replace(/^["']|["']$/g, "").replace(/;$/, "");
}

// Lazy initialize Gemini AI client with dynamic key reload
let aiClient: GoogleGenAI | null = null;
let activeApiKey: string = "";

function getGeminiAI(): GoogleGenAI | null {
  const currentKey = getGeminiApiKey();
  if (!currentKey) {
    return null;
  }
  if (!aiClient || activeApiKey !== currentKey) {
    activeApiKey = currentKey;
    aiClient = new GoogleGenAI({
      apiKey: currentKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  }
  return aiClient;
}

// Health check: shows whether Gemini is set up, never any part of the key.
app.get("/api/health", (req, res) => {
  let promptReady = true;
  try {
    loadPromptTemplate();
  } catch {
    promptReady = false;
  }
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    geminiConfigured: Boolean(getGeminiApiKey()),
    sentimentModel: sentimentModel(),
    promptVersion: PROMPT_VERSION,
    promptReady,
    signingReady: signingReady(),
  });
});

// Sentiment analysis of survey comments: zero-shot classification with one pinned Gemini model.
// Body: { comments: [{ text, context }] }. Only comment text and survey/question context are sent
// to Gemini, never the respondent's name, email or profile.
const MAX_COMMENTS_PER_REQUEST = 30;
app.post("/api/sentiment/analyze", async (req, res) => {
  const comments = Array.isArray(req.body?.comments) ? req.body.comments : null;
  if (!comments || comments.length === 0 || comments.length > MAX_COMMENTS_PER_REQUEST) {
    return res.status(400).json({ error: `Send between 1 and ${MAX_COMMENTS_PER_REQUEST} comments.` });
  }
  const ai = getGeminiAI();
  // Up to 3 comments at a time: fast enough for a survey with several comment boxes,
  // gentle enough not to burst the Gemini usage limit. Results keep the original order.
  const results = new Array(comments.length);
  let next = 0;
  const worker = async () => {
    while (next < comments.length) {
      const i = next++;
      const text = typeof comments[i]?.text === "string" ? comments[i].text : "";
      const context = typeof comments[i]?.context === "string" ? comments[i].context : "";
      results[i] = await analyzeComment(ai, text, context);
    }
  };
  await Promise.all(Array.from({ length: Math.min(3, comments.length) }, worker));
  res.json({ success: true, results });
});

// Checks result signatures. Done only here, because only the server knows the secret.
// Body: { items: [{ text, analysis }] }. Returns { valid: boolean[] } in the same order.
const MAX_VERIFY_ITEMS = 1000;
app.post("/api/sentiment/verify", (req, res) => {
  const items = Array.isArray(req.body?.items) ? req.body.items : null;
  if (!items || items.length > MAX_VERIFY_ITEMS) {
    return res.status(400).json({ error: `Send up to ${MAX_VERIFY_ITEMS} results.` });
  }
  const valid = items.map((item: any) =>
    typeof item?.text === "string" && item?.analysis && typeof item.analysis === "object"
      ? verifyResult(item.text, item.analysis)
      : false
  );
  res.json({ success: true, signingReady: signingReady(), valid });
});

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  try {
    loadPromptTemplate();
  } catch (err) {
    console.error("[Sentiment] Could not load the prompt file. Comments will use the labeled fallback until it is fixed:", err);
  }
  if (!signingReady()) {
    console.error(
      "[Sentiment] RESULT_SIGNING_SECRET is missing or shorter than 32 characters. New results will be unsigned and shown as needing a re-run."
    );
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`EduFeedback server running at http://0.0.0.0:${PORT}`);
  });
}

startServer();

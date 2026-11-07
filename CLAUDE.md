# EduFeedback: project guide for Claude Code

A survey / evaluation web app for a Philippine college. It is a thesis project: the thesis states that the system uses **sentiment analysis** on survey comments. Originally generated in Google AI Studio (Gemini), now continued here.

## How to work with me (the owner)

- I am **non-technical**. Explain simply, say *why* a change is needed, and avoid jargon. Short sentences.
- **One feature at a time.** Finish it, run the checks, tell me how to test it, then stop and wait. Do not start the next feature on your own.
- Before big changes, tell me in 3-5 plain lines what you will change and which files. For anything hard to undo, ask first.
- After each feature, give me a short **"how to test it"** list (what to click, what I should see).
- Be honest. If something is not done, not tested, or only partly works, say so.
- I deploy and test myself. Never run `git push`, deploy, wipe/seed the database, or touch the live Firebase Console for me. Tell me what to do instead.

## Non-negotiable rules

1. **Never loosen `firestore.rules`.** A "Missing or insufficient permissions" error is fixed by fixing the *client query or code*, never by opening the rules (no `allow ... if true`). If a rule truly must change, explain why and ask me first. After any rule change, remind me to paste the same rules into Firebase Console > Firestore > Rules.
2. **Never set `VITE_ADMIN_PASSWORD`, and never give `GEMINI_API_KEY` or `RESULT_SIGNING_SECRET` a `VITE_` name.** Anything starting with `VITE_` is bundled into the public website. The admin password lives only in Firebase Auth.
3. **Never use `admin123`** anywhere (the README still mentions it, so remove it from the README).
4. Never send a respondent's identity fields (the name, email or other profile details attached to a response) to Gemini, and do not put names into CSV exports for anonymous responses. Comment text is sent to Gemini as the respondent typed it (automatic name hiding is unreliable); state this as a limitation in the paper, and the answer screen asks people not to write names in comments.
5. Firestore rejects `undefined` values. `ignoreUndefinedProperties: true` is set in `src/lib/firebase.ts`; keep it, and still avoid writing undefined fields.
6. Use the **(default)** Firestore database (`firestoreDatabaseId: ""` in `firebase-applet-config.json`). Do not switch to a named database.
7. Never commit `.env` (it is gitignored). Do not paste secrets into code.

## Stack and layout

React 19 + Vite + Tailwind 4, Express server (`server.ts`), Firebase Auth + Firestore, `@google/genai` for Gemini (server side only).

```
server.ts                      Express + Vite dev middleware. All /api/* needs a Firebase ID token (Bearer),
                               30 requests/min/user. Gemini calls with model fallback list (GEMINI_MODELS).
src/App.tsx                    Central state + handlers + view router (~1700 lines)
src/types.ts                   All shared types (Survey, Question, SurveyResponse, Topic, ...)
src/lib/firebase.ts            Firestore/Auth service functions
src/lib/databaseService.ts     DatabaseService facade used by App.tsx (getSurveys scoped per role)
src/lib/surveyReview.ts        getSurveyAvailability, countEligibleUsers, runPreChecks, getCreatorStats
src/data/initialData.ts        Departments/programs, categories, MASTER_ADMIN_EMAIL (still imported; keep)
src/components/                Screens (see below)
scripts/                       seed-firestore.ts, wipe-firestore.ts (dev only; do not run for me)
firestore.rules                Source of truth for security (strict, role-aware)
```

Views (`currentView` in App.tsx): `dashboard`, `take-survey`, `my-surveys`, `analytics`, `news`, `create`, `admin` (Review Center, superadmin), `tagalog-ml` (Sentiment Analysis screen `SentimentAnalysisView`, superadmin).

Key components: `SurveyBuilder`, `SurveyCriteriaModal`, `TakeSurveyModal`, `MySurveysScreen`, `SurveyApprovalsPanel`, `TopicsManager`, `ThemedSurveySections` (the Take-a-Survey list grouped by category; this is **not** the removed Thematic Domain), `HistoricalAnalyticsView`, `Dashboard`, `NewsAnnouncementsFeed`, `SuperadminDashboard`, `UserManagementView`, `DatabaseBackupView`, `SentimentAnalysisView`.

## Commands

```
npm install
npm run dev        # starts server.ts (Express + Vite) on http://localhost:3000
npm run lint       # tsc --noEmit  <- run after every change; must pass
npm run build
```

Copy `.env.example` to `.env` and fill `GEMINI_API_KEY` and the `VITE_FIREBASE_*` values (from `firebase-applet-config.json` / Firebase Console). Leave `VITE_ADMIN_PASSWORD` empty.

## Data model

- **User doc id** = lowercase email with every char outside `[a-z0-9_-]` replaced by `_` (e.g. `admin_edufeedback_edu`). Roles are read from the caller's own `/users/{emailKey}` profile by the security rules (`isActive()`, `isAdmin()` = role `superadmin`).
- Roles: `student`/`user`, `officer`, `faculty`, `superadmin`. Faculty and officers sign up as `pending_approval`; students are `active`. Admin can set `canCreateSurveys`, `canPostNews`, `restrictionReason` per user.
- Collections: `users`, `surveys`, `responses`, `topics`, `news`, `notifications`, `logs`, `ml_dataset`.
- **Survey lifecycle:** `draft` -> `pending` -> `rejected` | `scheduled` | `published` -> `archived`. Only the admin approves. Non-admins can only create `draft`/`pending`; owners edit only `draft`/`rejected`; owners may archive their own live survey; anyone active may bump `responses` by exactly 1 on a live survey.
- Survey fields added for this flow: `purpose` (>= 20 chars), `criteriaAcceptedAt`, `submittedAt`, `reviewedBy/At`, `rejectionReason`, `eligibleCount`, `previousSurveyId`, `seriesId`, `archived*`, `topicBlocks`, `allowAnonymous`, `openEnded` (true = no closing date, runs until archived). `previousSurveyId` / `seriesId` are no longer used (copies are independent surveys).
- **Topics** are admin-managed (`/topics`, `TopicsManager`). Questions are grouped into **topic blocks** (`Survey.topicBlocks`, `Question.blockId`), NOT tagged one by one. The old per-question "Thematic Domain" is removed.
- Anonymous responses use `userEmail = "anonymous@school.edu.ph"` and `isAnonymous: true`; the survey's `allowAnonymous` decides whether a respondent may choose anonymous or must give their name.

## Sentiment analysis (be honest about it)

- It is **LLM zero-shot classification with Gemini**. It is NOT a trained model. Never describe it as "trained" or "machine learning model we built" in UI text or docs.
- The prompt is in `docs/sentiment-prompt-v1.md` (11 decision rules + JSON output schema). The server sends its fenced block word for word, so the docs file must be deployed with the server. If that file is missing from `docs/`, ask me for it.
- Two outputs: `polarity` (3 labels: Positive / Neutral / Negative) is what gets **evaluated**; `sentiment` (4 values incl. "Constructive Suggestion") is for display.
- A rule-based word-list fallback is allowed only when Gemini is unavailable, and it must be **labeled as fallback** in the UI.
- Evaluation plan for the thesis: ~200-300 real, de-identified comments; two human labelers; Cohen's kappa between them; tuning/test split; pinned model version; stored labels; report accuracy, macro-F1 and a confusion matrix. The comparison run is a one-time run (it does call Gemini).
- Surveys with no paragraph question still get rating-based analytics and recommendations.
- Gibberish / joke / contradictory responses are **flagged and quarantined for review, not silently counted**. The survey owner cannot exclude responses alone (that would be biased); the admin is notified too.

## Current status (checked against the code in the uploaded zip)

**Done and working**
- Strict Firestore rules; Firestore-only (no localStorage); `ignoreUndefinedProperties`.
- Approval flow (draft/pending/rejected/published/archived), `SurveyApprovalsPanel`, `SurveyCriteriaModal`, purpose field, closing-date fix, two-option anonymity in builder and answer screen.
- `TopicsManager` (admin add / rename / retire / delete-if-unused).
- My Surveys: Pending / Rejected tabs, status pills, rejection-reason banner, edit locking.
- Thematic Domain removed from the builder. (`ThemedSurveySections` is a different, still-valid component.)
- API auth + rate limiting on the server; Gemini model fallback list.
- Topic blocks (2D-1, 2D-2): builder UI in `TopicBlocksEditor.tsx` + `src/lib/topicBlocks.ts` (`MAX_BLOCKS = 8`, `MAX_QUESTIONS = 30`, every question has `blockId`); block titles shown as sections in `TakeSurveyModal` and the Review Center.
- My Surveys card buttons depend on status (Edit / Analytics / Archive / Preview / Copy link / Copy as draft / Delete only where the rules allow). Owner **Archive** = close early (`DatabaseService.archiveSurvey` writes only the archive fields, as the rules require; auto-archive at closing date uses it too). **Preview** opens `TakeSurveyModal` with `previewOnly` (no submit).
- Registration: role is set from position in `DatabaseService.register` (Faculty -> `faculty`, Student Officer -> `officer`); `DatabaseService.isRegistering` stops the auth listener from signing out mid sign-up; a half-made account can be finished by registering again with the same email + password.
- Confirm prompts use the in-app `useConfirm()` / `ConfirmDialog` (`src/components/ConfirmDialog.tsx`). Do not use `window.confirm` / `alert` / `prompt`.

**Partly done, verify first**
- Flagging: there is an admin "flag survey" action; there is no response-level flag/quarantine yet.

**To do, in this order (one at a time)**
1. ~~2D-1~~ done. 2. ~~2D-2~~ done.
3. ~~2E~~ done: Withdraw (pending -> draft, status-only write); Archive = close early; "Copy as new draft" makes an independent survey titled "(Copy)" with no link and without old review/archive/flag fields ("Run again" was dropped by decision); closing date is optional ("Keeps running until I archive it", `openEnded`); max 3 pending surveys per user (client-side check in `SurveyBuilder`; the rules cannot count documents, say so honestly).
3b. ~~Type checking fix~~ done: `@types/react`, `@types/react-dom` added, `"strict": true` on, `npm run lint` now checks the screens. Unused code (about 127 unused imports/variables, shown by `tsc --noUnusedLocals --noUnusedParameters`) is left for the step 10 cleanup.
4. ~~Post News + News Approvals~~ done: anyone with `canPostNews` (on by default; admin switch in the user edit form) posts as `pending`; admin approves or rejects with a reason in the Review Center tab `NewsApprovalsPanel`; authors see status in My Posts on the Dashboard (the `news` view has no menu link; News lives on the Dashboard) and can delete pending/rejected posts; admin posts publish directly; max 3 pending per person (client-side check). Non-admins load news with two queries (published + own), because the rules no longer allow reading the whole collection. Older posts with no status are admin-only.
3c. ~~5. One response per person~~ done (moved ahead of News): `users/{key}/receipts/{surveyId}` holds only the survey id; response + receipt + count are saved in one batch; the response rule requires no earlier receipt and the new one (`existsAfter`). Anonymous answered surveys show "Completed" and cannot be reopened (decided: viewing them again would need a link to the person, which anonymity forbids). Anonymous answers no longer put the name in the activity log or store `section`. **Limits to state honestly:** Firestore keeps hidden creation times, so someone with full technical access could try to match a receipt to a response by time; responses from before this change have no receipt. **Clearing test responses must also clear each user's `receipts`, or people stay marked as answered.**
6. ~~Sentiment pipeline + Sentiment Analysis module~~ done: `server/sentiment.ts` reads the prompt word for word from `docs/sentiment-prompt-v1.md` (`PROMPT_VERSION`), one pinned model (`GEMINI_SENTIMENT_MODEL` in `.env`, default `gemini-3.1-flash-lite`, chosen after a speed test: `gemini-3.8-flash` was overloaded and took minutes, `gemini-2.5-flash` is closed to new users; never a `VITE_` setting), temperature 0, JSON checked against the schema. `/api/sentiment/analyze` is the only Gemini endpoint (all `/api/ml/*` and `/api/ai/*` removed). Every Paragraph answer gets `answers[i].analysis` (`CommentAnalysis`); responses get `commentStatus` (`no_comment` / `analyzed` / `not_analyzable` / `not_analyzed`) and, only when there are analyzable comments, a `sentimentAnalysis` summary (mean score -> polarity bands). Fallback word list is labeled `method: "fallback"` with `confidence: null`. `SentimentAnalysisView` replaced `TagalogMLTrainingStudio` (deleted); admin can re-run old / fallback / not-analyzed responses (`needsReanalysis`, never Gemini results), after a confirm; replaced results are kept in `answers[i].previousAnalyses` and `previousSentimentAnalyses`. Each Gemini result stores `modelVersion` as reported by the API (e.g. `3.1-flash-lite-05-2026`). **Signed results** (`server/signing.ts`): the server signs each result (HMAC over the comment text and the whole result) with `RESULT_SIGNING_SECRET` (server only, >= 32 chars, same value on every machine that uses this database); `/api/sentiment/verify` checks them server-side; the client uses `trustedResponses()` so failed/missing signatures are hidden from totals and Analytics, summaries are recalculated from confirmed results, and those responses show under "needs a re-run". Changing the secret invalidates every saved result until re-run. Analytics' fake "ML Survey Synthesis" tab and phrase-supply feature removed; no-comment responses are no longer counted as Positive. `/api/health` no longer shows part of the API key.
6a. **Small add-on:** a short line near comment boxes on the answer screen: "Please don't write names in your comment."
6c. **Sentiment evaluation tools** (thesis): human labels from two labelers (polarity + sarcastic yes/no, using prompt rules 1-11). **The labelers' export must include the same context Gemini saw (survey title, section, question text) next to each comment**, or the comparison is unfair. Report the exact `modelVersion` Gemini returned. Only Gemini results are evaluated (fallback excluded; report how many fallback results remained). Then Cohen's kappa, tuning/test split, then accuracy, macro-F1 and confusion matrix against the stored Gemini results. Plan and ask before building. Show the measured results (with sample size and date) on the Sentiment Analysis screen only; never show an accuracy number anywhere before it is measured (a hard-coded "94.2% accuracy" sidebar card was removed).
6b. **Academic calendar (admin):** admin enters, per school year, **2 semesters** (1st Sem, 2nd Sem; no Midyear) with start/end dates. Checks: end after start, no overlap, 2nd after 1st. A response's semester and school year are **derived from its submit timestamp** at analysis time (not stored), so correcting a date fixes all charts ("one source of truth"). Responses between terms show as "Between terms" (still in All time / month views). Replaces the temporary rule in `src/lib/schoolYear.ts` (school year starts in August; the builder dropdown is already removed and shows "SY ... (automatic)"), and fixes responses being stamped with the survey's year instead of the year they were answered. If no calendar is set, the semester view says to ask the admin. Needs a new rule (read: active users, write: admin only); show me the rule and ask first.
7. **Analytics rework** (decided design):
   - **Period picker** for one survey: All time / Per school year / Per semester / Per month / Custom from-to. Averages are never only all-time for long-running surveys. **From-to comparison** of two periods of the same survey (note: different respondents, since each person answers once).
   - **Sample-size rule** everywhere (each period, and each side of a comparison): **n < 5** -> "Not enough responses to analyze yet (x of 5)", no numbers; **5-29** -> show with a yellow "Small sample (n = x), read with caution" note; **n >= 30** -> normal. Always show n.
   - **Compare two surveys** (owner: any two of their own; admin: any two): sentiment as **percentages** Positive / Neutral / Negative, plus **average rating** and n for each; optional per-topic comparison for topics both surveys share. Percentages, not raw counts.
   - **Recommendations (decided: both layers).** Layer 1, rules: per topic block and period, compute average rating (n), % negative comments, common words in negative comments, and change vs the previous period. Fixed rules label each topic (starting thresholds, to be confirmed against the school's rating scale: Needs attention = average < 3.0 or >= 40% negative; Getting worse = drop >= 0.5; Strength = average >= 4.2 and >= 60% positive). Each label comes with a **fill-in-the-blank sentence template** and its evidence, so recommendations work with no AI at all. Layer 1 is the main engine, not a fallback; it always runs. If any evidence comes from fallback-labeled comments, say how many (e.g. "33 comments, 5 labeled by the fallback word list"). Sample-size rule applies. Layer 2, optional: on a button press Gemini rewrites the evidence into a short suggested action, labeled "AI-suggested wording", given only the computed evidence plus a few comments (never names), cannot change numbers, own versioned prompt file (e.g. `docs/recommendation-prompt-v1.md`), saved with the date.
   - Also: participation % (responses vs `eligibleCount`). Fix fake fallback values saved on responses in `handleSubmitSurveyResponse` (`College of Computer Studies`, `BS Computer Science`, `3rd Year`, `CS-3A` for anyone missing them, e.g. faculty) so they do not distort analytics.
8. **Response flags / quarantine** with notifications to the survey owner and admin.
9. **Small items:** "Active users" counter (logged-in users only; no Firebase Console change), admin switch to turn survey creation off, graceful behavior when the Gemini quota is used up (the server already rotates through `GEMINI_MODELS`; show a clear message if all fail), remove `ml_dataset`/ML-training leftovers that are no longer used. Guest login is out of scope for now.
10. **Cleanup, bug sweep and UI arrangement pass:** remove buttons/sections left over from old features (ask the owner for the list they noticed), fix leftover bugs, tidy and arrange screens consistently, README cleanup (see below). Known bug to fix here: one person can like a news post many times (likes are not tracked per person). Remove the unreachable `news` view from `App.tsx` (decided: news stays on the Dashboard, no News menu item). Backup restore/seed of responses: rules block admins creating other people's responses (named ones already, anonymous ones too since the receipts rule), so decide how restore should work. Older activity logs may contain names next to anonymous answers (fixed for new answers): clear them with the test data.
10b. **Remove dummy data; admin sets up the school's data** (before step 11):
   - Remove leftovers: `INITIAL_TAGALOG_ML_DATASET` samples, `INITIAL_LOGS`, the auto-seeded `INITIAL_TOPICS`, the sign-up defaults (`3rd Year`, `CS-3A`), and any fake fallback values. (`INITIAL_SURVEYS`, `INITIAL_RESPONSES` and `INITIAL_NEWS` are already empty.)
   - New admin screen for **departments, programs and sections**, replacing the hard-coded `DEPARTMENTS_DATA` and the free-text section box. Sections are listed **per program** (decided), e.g. BSCS: CS-1A, CS-1B, CS-2A. Also admin-managed: survey categories (`DEFAULT_SURVEY_CATEGORIES`). Topics are already admin-managed. Retire instead of delete when something is in use, like topics.
   - **Setup checklist for the admin** on a clean system: departments/programs/sections -> categories -> topics -> academic calendar.
   - **The sign-up screen runs before login**, so it needs a new read-only rule letting anyone read this list. It must hold no personal data, and admin-only write. The owner chose the list over free-text typing and agreed to this rule; still show the exact rule before adding it, and remind them to paste it into the Firebase Console. If the list is empty, sign-up says registration is not open yet.
11. **Final fresh start (only when the owner says the system is ready, before real data collection):** first update the wipe tool so it covers everything; it does not clear `receipts` or notifications today. Give the owner exact steps for test surveys, responses, `receipts`, logs, notifications and test accounts (Firebase Authentication and `users`). The owner runs it; never wipe for them. **Never delete the admin's `users` profile:** the rules do not let an account make itself admin, so the app cannot recreate it and the admin would be locked out (it would have to be recreated by hand in the Firebase Console). Then do one full test on the clean system.

## Cleanup reminders for me

- `README.md` still lists `admin123` (lines ~140 and ~161) and "Tagalog ML" wording. Remove the password and update the text when we reach cleanup.
- The admin account should use a strong password. If it was created with `admin123`, delete and recreate it.
- `src/data/initialData.ts` is still imported by many files (departments, programs, categories, `MASTER_ADMIN_EMAIL`). Do **not** delete it; only trim leftovers inside it.

## Conventions

- TypeScript strict; keep types in `src/types.ts`. Tailwind classes, lucide-react icons, existing look and feel (indigo / slate).
- Keep components under ~900 lines where practical; when you add a feature, prefer a new component or `src/lib` helper over growing `App.tsx`.
- Dates: store timestamps as numbers (`Date.now()`); show them formatted.
- Always lowercase emails before comparing or writing (`userEmail`, `owner`, `to`), because the rules compare lowercase.
- Don't leave debug `console.log` or commented-out code behind.
- After each task: run `npm run lint`, then summarize in plain words: what changed, which files, how I test it.

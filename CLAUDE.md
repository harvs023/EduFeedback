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
2. **Never set `VITE_ADMIN_PASSWORD`.** Anything starting with `VITE_` is bundled into the public website. The admin password lives only in Firebase Auth.
3. **Never use `admin123`** anywhere (the README still mentions it, so remove it from the README).
4. Do not put names or emails into anything sent to Gemini, and do not put names into CSV exports for anonymous responses.
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

Views (`currentView` in App.tsx): `dashboard`, `take-survey`, `my-surveys`, `analytics`, `news`, `create`, `admin` (Review Center, superadmin), `tagalog-ml` (Sentiment Analysis, superadmin).

Key components: `SurveyBuilder`, `SurveyCriteriaModal`, `TakeSurveyModal`, `MySurveysScreen`, `SurveyApprovalsPanel`, `TopicsManager`, `ThemedSurveySections` (the Take-a-Survey list grouped by category; this is **not** the removed Thematic Domain), `HistoricalAnalyticsView`, `Dashboard`, `NewsAnnouncementsFeed`, `SuperadminDashboard`, `UserManagementView`, `DatabaseBackupView`, `TagalogMLTrainingStudio`.

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
- The prompt is in `docs/sentiment-prompt-v1.md` (11 decision rules + JSON output schema). If that file is missing from `docs/`, ask me for it.
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
- Receipts: `TakeSurveyModal` shows a receipt after submit, but there is no enforced one-response-per-person.
- Flagging: there is an admin "flag survey" action; there is no response-level flag/quarantine yet.
- News: feed exists, but only the admin can write (`news` rules); no Post News form for others and no news approval yet.

**To do, in this order (one at a time)**
1. ~~2D-1~~ done. 2. ~~2D-2~~ done.
3. ~~2E~~ done: Withdraw (pending -> draft, status-only write); Archive = close early; "Copy as new draft" makes an independent survey titled "(Copy)" with no link and without old review/archive/flag fields ("Run again" was dropped by decision); closing date is optional ("Keeps running until I archive it", `openEnded`); max 3 pending surveys per user (client-side check in `SurveyBuilder`; the rules cannot count documents, say so honestly).
3b. **Type checking fix:** add the dev packages `@types/react` and `@types/react-dom` (and consider `"strict": true` in `tsconfig.json`). Today they are missing, so `npm run lint` barely checks the screens (JSX is untyped) and `tsconfig.json` is not strict. Expect many old errors from the AI Studio code; fix real bugs, list the rest. Until then, also run `npm run build` after changes.
4. **Post News + News Approvals** (anyone with `canPostNews`, admin approves, then shown in the dashboard). Needs a rules change; ask me first.
5. **One response per person + receipts + anonymity:** **one response per person per survey, ever** (decided). A receipts pattern so a person can't answer twice while anonymous answers stay unlinkable. Needs a rules change; ask me first.
6. **Sentiment pipeline + Sentiment Analysis module** (replace the old "Tagalog ML Training Studio" wording and the `/api/ml/*` training endpoints with the honest Gemini-classification flow above; remove "training" language).
6b. **Academic calendar (admin):** admin enters, per school year, **2 semesters** (1st Sem, 2nd Sem; no Midyear) with start/end dates. Checks: end after start, no overlap, 2nd after 1st. A response's semester and school year are **derived from its submit timestamp** at analysis time (not stored), so correcting a date fixes all charts ("one source of truth"). Responses between terms show as "Between terms" (still in All time / month views). Replaces the temporary rule in `src/lib/schoolYear.ts` (school year starts in August; the builder dropdown is already removed and shows "SY ... (automatic)"), and fixes responses being stamped with the survey's year instead of the year they were answered. If no calendar is set, the semester view says to ask the admin. Needs a new rule (read: active users, write: admin only); show me the rule and ask first.
7. **Analytics rework** (decided design):
   - **Period picker** for one survey: All time / Per school year / Per semester / Per month / Custom from-to. Averages are never only all-time for long-running surveys. **From-to comparison** of two periods of the same survey (note: different respondents, since each person answers once).
   - **Sample-size rule** everywhere (each period, and each side of a comparison): **n < 5** -> "Not enough responses to analyze yet (x of 5)", no numbers; **5-29** -> show with a yellow "Small sample (n = x), read with caution" note; **n >= 30** -> normal. Always show n.
   - **Compare two surveys** (owner: any two of their own; admin: any two): sentiment as **percentages** Positive / Neutral / Negative, plus **average rating** and n for each; optional per-topic comparison for topics both surveys share. Percentages, not raw counts.
   - Also: participation % (responses vs `eligibleCount`), data-backed recommendations.
8. **Response flags / quarantine** with notifications to the survey owner and admin.
9. **Small items:** "Active users" counter (logged-in users only; no Firebase Console change), admin switch to turn survey creation off, graceful behavior when the Gemini quota is used up (the server already rotates through `GEMINI_MODELS`; show a clear message if all fail), remove `ml_dataset`/ML-training leftovers that are no longer used. Guest login is out of scope for now.
10. **Cleanup, bug sweep and UI arrangement pass:** remove buttons/sections left over from old features (ask the owner for the list they noticed), fix leftover bugs, tidy and arrange screens consistently, README cleanup (see below).

## Cleanup reminders for me

- `README.md` still lists `admin123` (lines ~140 and ~161) and "Tagalog ML" wording. Remove the password and update the text when we reach cleanup.
- The admin account should use a strong password. If it was created with `admin123`, delete and recreate it.
- `src/data/initialData.ts` is still imported by many files (departments, programs, categories, `MASTER_ADMIN_EMAIL`). Do **not** delete it; only trim leftovers inside it.

## Conventions

- TypeScript (not yet strict, see step 3b); keep types in `src/types.ts`. Tailwind classes, lucide-react icons, existing look and feel (indigo / slate).
- Keep components under ~900 lines where practical; when you add a feature, prefer a new component or `src/lib` helper over growing `App.tsx`.
- Dates: store timestamps as numbers (`Date.now()`); show them formatted.
- Always lowercase emails before comparing or writing (`userEmail`, `owner`, `to`), because the rules compare lowercase.
- Don't leave debug `console.log` or commented-out code behind.
- After each task: run `npm run lint`, then summarize in plain words: what changed, which files, how I test it.

# EduFeedback: Academic Survey & Evaluation Platform

A survey and evaluation web app for a Philippine college, built with **React 19**, **TypeScript**, **Tailwind CSS 4**, an **Express** server, and **Google Firebase** (Authentication and Cloud Firestore). Survey comments are classified for sentiment by **Google Gemini** (zero-shot classification with a fixed, versioned prompt; this is not a model trained by the project).

---

## Table of Contents
1. [Features](#features)
2. [Firebase Setup](#firebase-setup)
3. [Environment Variables](#environment-variables)
4. [Admin Account](#admin-account)
5. [Firestore Collections](#firestore-collections)
6. [Local Development](#local-development)
7. [Hosting](#hosting)

---

## Features

- **Roles:** Superadmin, Faculty, Student Officer, Student. Faculty and officer accounts wait for admin approval.
- **Survey builder:** rating scales, multiple choice and open comment questions, grouped into topic blocks; audience, anonymity and closing date settings.
- **Approval flow:** draft, pending review, rejected, scheduled, published, archived. Only the admin approves.
- **One response per person**, with optional anonymous answers.
- **Comment sentiment (Gemini):** each comment gets Positive / Neutral / Negative plus a display label. The prompt is in `docs/sentiment-prompt-v1.md`. If Gemini is unavailable, a word-list fallback is used and clearly labeled as fallback. Results are signed by the server so changed labels are detected.
- **Analytics:** per-survey results by period (school year, semester, month, custom), sample-size warnings, rule-based recommendations per topic, survey comparison, CSV exports.
- **Evaluation tools:** sampling and labeling sheets, Cohen's kappa between labelers, accuracy / macro-F1 / confusion matrix against Gemini's labels.
- **Review Center (admin):** survey and news approvals, flagged responses, users, topics, academic calendar, activity logs, backups, survey creation switch.

---

## Firebase Setup

1. In the [Firebase Console](https://console.firebase.google.com/), create a project and register a **Web app**. Note its `firebaseConfig` values.
2. **Authentication** > Sign-in method: enable **Email/Password**.
3. **Firestore Database**: create the **(default)** database in production mode.
4. **Firestore Database** > Rules: paste the contents of `firestore.rules` and publish. Do this again every time `firestore.rules` changes.
5. **Project settings** > Service accounts: generate a private key for the server (see below). Keep the file outside this folder and never commit it.

---

## Environment Variables

Copy `.env.example` to `.env` and fill it in. The comments in `.env.example` explain each setting.

| Setting | Where it is used |
| :--- | :--- |
| `VITE_FIREBASE_*` | Firebase web config (public, bundled into the website) |
| `GEMINI_API_KEY` | Server only. Gemini sentiment analysis |
| `GEMINI_SENTIMENT_MODEL` | Server only, optional. The one fixed Gemini model |
| `RESULT_SIGNING_SECRET` | Server only. Signs sentiment results; same value on every machine using this database |
| `FIREBASE_SERVICE_ACCOUNT_FILE` or `FIREBASE_SERVICE_ACCOUNT_JSON` | Server only. Lets the server save sentiment results |
| `VITE_ADMIN_EMAIL`, `VITE_ADMIN_NAME` | The admin account's email and display name |

Anything starting with `VITE_` is visible in the public website. Never put a password, API key or secret in a `VITE_` setting, and never commit `.env`.

---

## Admin Account

There are no demo accounts or default passwords. The admin signs in with the email set in `VITE_ADMIN_EMAIL` and a **strong password stored only in Firebase Authentication**. The admin's profile in the `users` collection must have the role `superadmin`; the app cannot give itself admin rights.

---

## Firestore Collections

| Collection | Contents |
| :--- | :--- |
| `users/{emailKey}` | Profiles and roles (`emailKey` = lowercase email with other characters replaced by `_`) |
| `users/{emailKey}/receipts/{surveyId}` | Marks that a person answered a survey (holds only the survey id) |
| `surveys/{surveyId}` | Surveys, questions, topic blocks, review status |
| `responses/{responseId}` | Answers and signed sentiment results |
| `topics/{topicId}` | Admin-managed topics |
| `news/{newsId}` | Announcements (with approval) |
| `notifications/{id}` | In-app notifications |
| `logs/{logId}` | Activity log (admin only) |
| `academic_calendar/{schoolYear}` | Semester dates per school year |
| `settings/app` | App switches (survey creation on/off) |
| `evaluation_runs/{runId}` | Saved evaluation results (cannot be edited after saving) |

---

## Local Development

```bash
npm install
npm run dev      # http://localhost:3000
npm run lint     # type check; must pass
npm run build
npm start        # runs the production build
```

`scripts/seed-firestore.ts` and `scripts/wipe-firestore.ts` are development tools that change the database. Read them before running, and never run them against a database with real data.

---

## Hosting

The app runs as one Node server (it serves the website and the `/api` routes).

- Build command: `npm install --include=dev && npm run build`
- Start command: `npm start` (the server uses the `PORT` given by the host)
- Set the server-only environment variables on the host (`FIREBASE_SERVICE_ACCOUNT_JSON` without surrounding quotes).
- Add the host's domain in Firebase Authentication > Settings > Authorized domains.
- The `docs/` folder must be deployed with the server; it contains the prompt files.

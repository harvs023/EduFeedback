# EduFeedback — Academic Survey & Evaluation Platform

A modern, full-stack academic feedback, survey authoring, and analytics platform powered by **React 19**, **TypeScript**, **Tailwind CSS**, and **Google Firebase (Cloud Firestore & Authentication)** with local Tagalog/Filipino NLP sentiment intelligence.

---

## Table of Contents
1. [Overview & Features](#overview--features)
2. [Firebase Setup Guide](#firebase-setup-guide)
3. [Importing Demo Data into Firebase Firestore](#importing-demo-data-into-firebase-firestore)
4. [Demo Accounts & Credentials](#demo-accounts--credentials)
5. [Firestore Collections & Schema](#firestore-collections--schema)
6. [Local Development & Deployment](#local-development--deployment)

---

## Overview & Features

- **Authentication & Multi-Role Access**: Standalone institutional sign-in & registration portal with dedicated views for **Superadmin**, **Faculty**, **Student Officers**, and **Students**.
- **Cloud Firestore Persistence**: Real-time cloud storage with seamless offline/local fallback.
- **Survey Authoring & Themed Question Bank**: Likert scales, open-ended responses, multiple choice, and rating grids.
- **Filipino/Tagalog Sentiment NLP**: Native sentiment analysis and model training studio for bilingual campus evaluations.
- **Administrative Oversight & Backups**: Instant snapshots, JSON backup/restore, user management, and one-click cloud synchronization.

---

## Firebase Setup Guide

Follow these steps to connect EduFeedback to your own Firebase project:

### Step 1: Create a Project in Firebase Console
1. Navigate to the [Firebase Console](https://console.firebase.google.com/).
2. Click **Add Project** and give it a name (e.g., `edufeedback-prod`).
3. (Optional) Choose whether to enable Google Analytics, then click **Create Project**.

### Step 2: Register a Web Application
1. In your Firebase project overview, click the **Web icon (`</>`)** to add a web app.
2. Enter an App nickname (e.g., `EduFeedback Web`) and click **Register app**.
3. Firebase will display your `firebaseConfig` credentials object:
   ```javascript
   const firebaseConfig = {
     apiKey: "AIzaSy...",
     authDomain: "your-project-id.firebaseapp.com",
     projectId: "your-project-id",
     storageBucket: "your-project-id.firebasestorage.app",
     messagingSenderId: "123456789012",
     appId: "1:123456789012:web:abcdef123456"
   };
   ```

### Step 3: Enable Firebase Authentication
1. In the Firebase console sidebar, go to **Build** > **Authentication**.
2. Click **Get Started**.
3. Under the **Sign-in method** tab:
   - Enable **Email/Password** (Email/Password toggle: Enabled).
   - (Optional) Enable **Google** provider if you wish to allow Google sign-in.

### Step 4: Create Cloud Firestore Database
1. In the Firebase console sidebar, go to **Build** > **Firestore Database**.
2. Click **Create database**.
3. Select your preferred Cloud Firestore location (e.g., `asia-east1`, `us-central1`, etc.).
4. Choose **Start in production mode** (or test mode if prototyping).

### Step 5: Configure Environment Variables
Copy `.env.example` to `.env` and fill in your Firebase web configuration values:

```bash
cp .env.example .env
```

Edit `.env`:
```env
# Google Firebase Configuration
VITE_FIREBASE_API_KEY="AIzaSyYourActualApiKeyHere"
VITE_FIREBASE_AUTH_DOMAIN="your-project-id.firebaseapp.com"
VITE_FIREBASE_PROJECT_ID="your-project-id"
VITE_FIREBASE_STORAGE_BUCKET="your-project-id.firebasestorage.app"
VITE_FIREBASE_MESSAGING_SENDER_ID="123456789012"
VITE_FIREBASE_APP_ID="1:123456789012:web:abcdef123456"

# Server & AI Settings
APP_URL="http://localhost:3000"
GEMINI_API_KEY="YOUR_GEMINI_API_KEY"
```

### Step 6: Deploy Firestore Security Rules
Copy the security rules from `firestore.rules` to the **Firestore Database** > **Rules** tab in your Firebase Console, or deploy using the Firebase CLI:

```bash
# Using Firebase CLI
firebase deploy --only firestore:rules
```

---

## Importing Demo Data into Firebase Firestore

You can import all sample academic surveys, student responses, announcements, and Filipino ML sentiment data using either of the following methods:

### Method 1: Automated CLI Import Script (Recommended)
EduFeedback includes an automated seed script that reads `scripts/demo-data.json` and inserts all documents into your Cloud Firestore:

```bash
# Make sure your .env has your VITE_FIREBASE_* variables set
npm run seed:firestore
```

The script will output:
```text
===============================================================
🔥 EduFeedback — Firebase Firestore Demo Data Importer
===============================================================

Connecting to Firebase Project: your-project-id...
📥 Loading and validating datasets from scripts/demo-data.json...
  - Users: 4
  - Surveys: 5
  - Survey Responses: 14
  - Campus News: 4
  - Tagalog ML Dataset: 15
  - Activity Logs: 10

🚀 Writing documents to Cloud Firestore...
  ✅ Successfully seeded 4 users into 'users' collection
  ✅ Successfully seeded 5 surveys into 'surveys' collection
  ✅ Successfully seeded 14 responses into 'responses' collection
  ✅ Successfully seeded 4 announcements into 'news' collection
  ✅ Successfully seeded 15 ML samples into 'ml_dataset' collection
  ✅ Successfully seeded 10 audit logs into 'logs' collection

===============================================================
🎉 Firestore demo data import completed successfully!
===============================================================
```

### Method 2: One-Click In-App Cloud Sync
1. Open the application in your browser (`http://localhost:3000`).
2. Sign in as Administrator:
   - Email: `admin@edufeedback.edu`
   - Password: `admin123`
3. Click **Admin Oversight** in the left sidebar.
4. Select the **Database Management** tab.
5. In the **Firebase Cloud Architecture Ready** section, click **Sync Firestore Cloud**.
6. All surveys, student responses, categories, and Tagalog ML samples will be synchronized directly to your Firestore database.

### Method 3: Direct JSON File Inspection
The complete database seed payload is located at:
```text
scripts/demo-data.json
```
This clean JSON file can also be used with custom Node.js scripts, Firebase Admin SDK, or third-party database import tools.

---

## Demo Accounts & Credentials

The system comes pre-configured with four role profiles for testing:

| Role | Name | Email | Password | Permissions & Scope |
| :--- | :--- | :--- | :--- | :--- |
| **Superadmin (Root)** | System Administrator | `admin@edufeedback.edu` | `admin123` | Full Administrative Control, User Directory, Tagalog ML Supervision, System Snapshots |
| **Faculty** | Dr. Maria Reyes | `maria.reyes@school.edu` | `faculty123` | Mid-Term & Course Survey Authoring, Department Analytics, Response Monitoring |
| **Student Officer** | Clara Santos | `clara.santos@school.edu` | `officer123` | Student Org & Campus Welfare Surveys, Section Analytics, Batch Filtering |
| **Student** | Juan Dela Cruz | `juan.delacruz@school.edu` | `student123` | Take Active Surveys, Tagalog/English Feedback, View Campus Announcements |

> **Note**: On the standalone sign-in page, click **"Use Account"** next to any credential card to automatically populate the sign-in form.

---

## Firestore Collections & Schema

When connected to Firebase, EduFeedback organizes data into the following top-level Firestore collections:

| Collection Path | Description | Key Fields |
| :--- | :--- | :--- |
| `/users/{userEmailKey}` | User profiles and academic affiliations | `email`, `name`, `role`, `pos`, `department`, `program`, `studentId`, `status` |
| `/surveys/{surveyId}` | Academic surveys and question templates | `id`, `title`, `cat`, `status`, `sections`, `questions`, `createdBy`, `deadline` |
| `/responses/{responseId}` | Submitted student evaluations | `id`, `surveyId`, `userEmail`, `answers`, `sentiment`, `sentimentScore`, `timestamp` |
| `/news/{newsId}` | Campus announcements and updates | `id`, `title`, `content`, `author`, `date`, `category`, `likesCount` |
| `/ml_dataset/{sampleId}` | Tagalog & Filipino sentiment training data | `id`, `text`, `sentiment`, `category`, `confidence`, `language` |
| `/logs/{logId}` | Security and system audit trail | `id`, `action`, `user`, `details`, `timestamp`, `severity` |

---

## Local Development & Deployment

### Run the Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

### Run Type Checking & Linting
```bash
npm run lint
```

### Build for Production
```bash
npm run build
```

### Start Production Server
```bash
npm start
```

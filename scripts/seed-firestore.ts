import { readFileSync, existsSync } from "fs";
import { resolve } from "path";
import { config } from "dotenv";
import { initializeApp } from "firebase/app";
import { getFirestore, doc, setDoc, writeBatch } from "firebase/firestore";

// Load environment variables from .env file
config({ path: resolve(process.cwd(), ".env") });

// Check for firebase config in environment or config file
const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY || process.env.FIREBASE_API_KEY || "",
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN || process.env.FIREBASE_AUTH_DOMAIN || "",
  projectId: process.env.VITE_FIREBASE_PROJECT_ID || process.env.FIREBASE_PROJECT_ID || "",
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET || process.env.FIREBASE_STORAGE_BUCKET || "",
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID || process.env.FIREBASE_MESSAGING_SENDER_ID || "",
  appId: process.env.VITE_FIREBASE_APP_ID || process.env.FIREBASE_APP_ID || "",
};

async function main() {
  console.log("===============================================================");
  console.log("🔥 EduFeedback — Firebase Firestore Demo Data Importer");
  console.log("===============================================================\n");

  if (!firebaseConfig.apiKey || !firebaseConfig.projectId) {
    console.error("❌ Firebase configuration is missing or incomplete in your .env file!");
    console.error("Please ensure the following environment variables are set in .env:");
    console.error("  - VITE_FIREBASE_API_KEY");
    console.error("  - VITE_FIREBASE_AUTH_DOMAIN");
    console.error("  - VITE_FIREBASE_PROJECT_ID");
    console.error("  - VITE_FIREBASE_STORAGE_BUCKET");
    console.error("  - VITE_FIREBASE_MESSAGING_SENDER_ID");
    console.error("  - VITE_FIREBASE_APP_ID\n");
    console.error("Check the README.md for step-by-step instructions on setting up Firebase.");
    process.exit(1);
  }

  console.log(`Connecting to Firebase Project: \x1b[36m${firebaseConfig.projectId}\x1b[0m...`);

  // Load demo data
  const dataPath = resolve(process.cwd(), "scripts/demo-data.json");
  if (!existsSync(dataPath)) {
    console.error(`❌ Demo data file not found at: ${dataPath}`);
    process.exit(1);
  }

  const raw = readFileSync(dataPath, "utf-8");
  const data = JSON.parse(raw);

  const app = initializeApp(firebaseConfig);
  const db = getFirestore(app);

  console.log("📥 Loading and validating datasets from scripts/demo-data.json...");
  console.log(`  - Users: ${data.users?.length || 0}`);
  console.log(`  - Surveys: ${data.surveys?.length || 0}`);
  console.log(`  - Survey Responses: ${data.responses?.length || 0}`);
  console.log(`  - Campus News: ${data.news?.length || 0}`);
  console.log(`  - Tagalog ML Dataset: ${data.mlDataset?.length || 0}`);
  console.log(`  - Activity Logs: ${data.logs?.length || 0}\n`);

  console.log("🚀 Writing documents to Cloud Firestore...");

  // Import Users
  if (data.users && Array.isArray(data.users)) {
    for (const user of data.users) {
      const docId = user.email.toLowerCase().replace(/[^a-zA-Z0-9_-]/g, "_");
      await setDoc(doc(db, "users", docId), user, { merge: true });
    }
    console.log(`  ✅ Successfully seeded ${data.users.length} users into 'users' collection`);
  }

  // Import Surveys
  if (data.surveys && Array.isArray(data.surveys)) {
    for (const survey of data.surveys) {
      await setDoc(doc(db, "surveys", String(survey.id)), survey, { merge: true });
    }
    console.log(`  ✅ Successfully seeded ${data.surveys.length} surveys into 'surveys' collection`);
  }

  // Import Responses
  if (data.responses && Array.isArray(data.responses)) {
    for (const resp of data.responses) {
      await setDoc(doc(db, "responses", String(resp.id)), resp, { merge: true });
    }
    console.log(`  ✅ Successfully seeded ${data.responses.length} responses into 'responses' collection`);
  }

  // Import Campus News
  if (data.news && Array.isArray(data.news)) {
    for (const item of data.news) {
      await setDoc(doc(db, "news", String(item.id)), item, { merge: true });
    }
    console.log(`  ✅ Successfully seeded ${data.news.length} announcements into 'news' collection`);
  }

  // Import Tagalog ML Dataset
  if (data.mlDataset && Array.isArray(data.mlDataset)) {
    for (const item of data.mlDataset) {
      await setDoc(doc(db, "ml_dataset", String(item.id)), item, { merge: true });
    }
    console.log(`  ✅ Successfully seeded ${data.mlDataset.length} ML samples into 'ml_dataset' collection`);
  }

  // Import Logs
  if (data.logs && Array.isArray(data.logs)) {
    for (const log of data.logs) {
      await setDoc(doc(db, "logs", String(log.id)), log, { merge: true });
    }
    console.log(`  ✅ Successfully seeded ${data.logs.length} audit logs into 'logs' collection`);
  }

  console.log("\n===============================================================");
  console.log("🎉 Firestore demo data import completed successfully!");
  console.log("===============================================================");
  console.log("\nYou can now open your Firebase Console at:");
  console.log(`👉 https://console.firebase.google.com/project/${firebaseConfig.projectId}/firestore`);
  console.log("\nDemo users are ready to sign in:");
  console.log("  • Admin:           admin@edufeedback.edu   / admin123");
  console.log("  • Dr. Maria Reyes: maria.reyes@school.edu  / faculty123");
  console.log("  • Clara Santos:    clara.santos@school.edu / officer123");
  console.log("  • Juan Dela Cruz:  juan.delacruz@school.edu / student123\n");
}

main().catch((err) => {
  console.error("\n❌ Error importing demo data into Firestore:", err);
  process.exit(1);
});

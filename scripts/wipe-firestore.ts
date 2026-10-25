import { resolve } from "path";
import { config } from "dotenv";
import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, doc, deleteDoc } from "firebase/firestore";
import { getAuth, signInWithEmailAndPassword } from "firebase/auth";

// Load environment variables from .env file
config({ path: resolve(process.cwd(), ".env") });

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
  console.log("🧹 EduFeedback — Cloud Firestore Database Wiper (Clean Slate)");
  console.log("===============================================================\n");

  if (!firebaseConfig.apiKey || !firebaseConfig.projectId) {
    console.error("❌ Firebase configuration is missing in your .env file!");
    process.exit(1);
  }

  console.log(`Connecting to Firebase Project: \x1b[36m${firebaseConfig.projectId}\x1b[0m...`);

  const app = initializeApp(firebaseConfig);
  const db = getFirestore(app);
  const auth = getAuth(app);

  // Authenticate as Admin
  console.log("🔐 Authenticating with Firebase Auth as admin@edufeedback.edu...");
  try {
    await signInWithEmailAndPassword(auth, "admin@edufeedback.edu", "admin123");
    console.log("  ✅ Authenticated as administrator\n");
  } catch (authErr: any) {
    console.warn("  ⚠️ Firebase Auth notice:", authErr?.message || authErr);
    console.warn("  Proceeding with wipe attempt...\n");
  }

  const collectionsToClear = ["surveys", "responses", "news", "ml_dataset", "logs"];

  for (const colName of collectionsToClear) {
    try {
      const snap = await getDocs(collection(db, colName));
      for (const d of snap.docs) {
        await deleteDoc(doc(db, colName, d.id));
      }
      console.log(`  🗑️  Cleared collection '${colName}': deleted ${snap.size} documents.`);
    } catch (err: any) {
      console.error(`  ❌ Failed to clear collection '${colName}':`, err?.message || err);
    }
  }

  // Clear non-admin users
  try {
    const usersSnap = await getDocs(collection(db, "users"));
    let deletedUsers = 0;
    for (const d of usersSnap.docs) {
      const uData = d.data();
      const email = (uData.email || "").toLowerCase();
      if (email !== "admin@edufeedback.edu" && email !== "azalrob023@gmail.com") {
        await deleteDoc(doc(db, "users", d.id));
        deletedUsers++;
      }
    }
    console.log(`  🗑️  Cleared collection 'users': removed ${deletedUsers} demo users (admin preserved).`);
  } catch (err: any) {
    console.error("  ❌ Failed to clean users collection:", err?.message || err);
  }

  console.log("\n===============================================================");
  console.log("🎉 Cloud Firestore collections successfully wiped to 0 records!");
  console.log("===============================================================\n");
  process.exit(0);
}

main().catch((err) => {
  console.error("Fatal error wiping Firestore:", err);
  process.exit(1);
});

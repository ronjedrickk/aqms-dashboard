// src/lib/firebase-admin.ts
import {
  initializeApp,
  getApps,
  cert,
  applicationDefault,
} from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getMessaging } from "firebase-admin/messaging";
import serviceAccount from "../../service-account.json"; // 👈 Import JSON directly

if (!getApps().length) {
  if (process.env.NODE_ENV === "production") {
    // ✅ On Firebase Hosting / Cloud Run: use default service account
    initializeApp({
      credential: applicationDefault(),
    });
  } else {
    // ✅ Local dev: use JSON key
    initializeApp({
      credential: cert(serviceAccount as any),
    });
  }
}

export const adminDb = getFirestore();
export const adminMessaging = getMessaging();

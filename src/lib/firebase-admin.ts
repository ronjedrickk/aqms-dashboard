import * as admin from "firebase-admin";

let adminDB: admin.firestore.Firestore;
let adminMessaging: admin.messaging.Messaging;

if (!admin.apps.length) {
  try {
    console.log("Initializing Firebase Admin...");

    const projectId = process.env.FIREBASE_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    let privateKey = process.env.FIREBASE_PRIVATE_KEY;

    if (!projectId || !clientEmail || !privateKey) {
      throw new Error("Missing Firebase credentials in environment variables");
    }

    // Fix formatting for PEM
    privateKey = privateKey
      .replace(/\\n/g, "\n") // convert escaped newlines
      .replace(/"/g, ""); // remove accidental quotes

    admin.initializeApp({
      credential: admin.credential.cert({
        projectId,
        clientEmail,
        privateKey,
      }),
    });

    console.log("✅ Firebase Admin initialized");
  } catch (error) {
    console.error("❌ Firebase Admin initialization error:", error);
    throw error;
  }
}

adminDB = admin.firestore();
adminMessaging = admin.messaging();

export { admin, adminDB, adminMessaging };

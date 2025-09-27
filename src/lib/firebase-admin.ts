// src/lib/firebase-admin.ts
import * as admin from "firebase-admin";

// Initialize variables that will be exported
let adminDB: admin.firestore.Firestore;
let adminMessaging: admin.messaging.Messaging;

// Only initialize Firebase Admin SDK once
if (!admin.apps.length) {
  try {
    console.log("Initializing Firebase Admin...");

    // Check for required environment variables
    if (
      !process.env.FIREBASE_PROJECT_ID ||
      !process.env.FIREBASE_CLIENT_EMAIL ||
      !process.env.FIREBASE_PRIVATE_KEY
    ) {
      throw new Error("Missing Firebase credentials in environment variables");
    }

    // Get credentials from environment variables
    const projectId = process.env.FIREBASE_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    let privateKey = process.env.FIREBASE_PRIVATE_KEY;

    // Log for debugging
    console.log("Project ID:", projectId);
    console.log("Client Email:", clientEmail?.substring(0, 5) + "...");

    // IMPORTANT: Alternative approach for private key
    // Use service account JSON directly if available
    try {
      // Option 1: Try initializing with raw environment variables
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId,
          clientEmail,
          // Simple fix - directly use the key with basic newline replacement
          privateKey: privateKey?.replace(/\\n/g, "\n"),
        }),
      });
    } catch (e) {
      console.error("First initialization attempt failed:", e);

      // Option 2: Try with service account JSON if available
      try {
        // If you have a service account JSON file, use this instead
        const serviceAccount = require("../../service-account.json");
        admin.initializeApp({
          credential: admin.credential.cert(serviceAccount),
        });
        console.log("Initialized with service account file");
      } catch (jsonError) {
        console.error("Service account fallback failed:", jsonError);
        throw new Error("Failed to initialize Firebase with any method");
      }
    }

    console.log("Firebase Admin initialized successfully");
  } catch (error) {
    console.error("Firebase Admin initialization error:", error);
    throw error; // Re-throw to prevent silent failures
  }
}

// Initialize these only after Firebase has been initialized
adminDB = admin.firestore();
adminMessaging = admin.messaging();

export { admin, adminDB, adminMessaging };

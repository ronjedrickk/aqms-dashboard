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

    // IMPORTANT: Handle the private key with special care
    // This is the most reliable way to format the key properly
    const privateKeyString = process.env.FIREBASE_PRIVATE_KEY;
    let privateKey = privateKeyString;

    // Print debug info without exposing the full key
    console.log("Private key type:", typeof privateKey);
    console.log("Private key length:", privateKey?.length);

    // Special handling for different formats
    if (privateKey) {
      // Remove any wrapping quotes from environment variable parsing
      if (privateKey.startsWith('"') && privateKey.endsWith('"')) {
        privateKey = privateKey.slice(1, -1);
      }

      // Replace escaped newlines with actual newlines - crucial for PEM format
      privateKey = privateKey.replace(/\\n/g, "\n");

      // Verify the key has expected PEM format markers
      if (!privateKey.includes("-----BEGIN PRIVATE KEY-----")) {
        console.warn(
          "Warning: Private key doesn't contain expected PEM header"
        );
      }
    }

    // Initialize Firebase Admin
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId,
        clientEmail,
        privateKey,
      }),
    });

    console.log("Firebase Admin initialized successfully");
  } catch (error) {
    console.error("Firebase Admin initialization error:", error);
    // Print more details about the error
    if (error instanceof Error) {
      console.error("Error message:", error.message);
      console.error("Error stack:", error.stack);
    }
    throw error; // Re-throw to prevent silent failures
  }
}

// Initialize these only after Firebase has been initialized
adminDB = admin.firestore();
adminMessaging = admin.messaging();

export { admin, adminDB, adminMessaging };

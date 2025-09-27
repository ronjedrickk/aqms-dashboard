// src/lib/firebase-messaging.js
import { initializeApp } from "firebase/app";
import { getMessaging, getToken, onMessage } from "firebase/messaging";

const firebaseConfig = {
  apiKey: "AIzaSyD0A5sSpOnfUkRq0nBwGKgPnTydujt2D3c",
  projectId: "adu-aqms-28741",
  messagingSenderId: "59449331551",
  appId: "1:59449331551:web:4c1b01af4409e6016030ea",
};

// ✅ Initialize Firebase
const app = initializeApp(firebaseConfig);
export const messaging = getMessaging(app);

// ✅ Get FCM token with your VAPID key
export async function requestPermissionAndToken() {
  try {
    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      console.log("❌ Notification permission not granted");
      return null;
    }

    const token = await getToken(messaging, {
      vapidKey: process.env.NEXT_PUBLIC_VAPID_KEY, // put your PUBLIC VAPID KEY here
    });

    if (token) {
      console.log("✅ FCM Token:", token);
      return token;
    } else {
      console.warn("⚠️ No registration token available.");
      return null;
    }
  } catch (err) {
    console.error("❌ Error retrieving token:", err);
    return null;
  }
}

// ✅ Foreground message handler
onMessage(messaging, (payload) => {
  console.log("📩 Foreground message received:", payload);

  const { title, body } = payload.notification || {};
  if (title) {
    // Show a native notification even in foreground
    new Notification(title, {
      body,
      icon: "/icon.png",
      badge: "/badge.png",
    });
  }
});

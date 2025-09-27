"use client";

import { useState } from "react";
import { getMessaging, getToken } from "firebase/messaging";
import { app } from "@/lib/firebase"; // your firebase client init

export function useRegisterToken() {
  const [loading, setLoading] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const register = async () => {
    try {
      setLoading(true);
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setError("Notifications not granted");
        setLoading(false);
        return;
      }

      // Register service worker
      await navigator.serviceWorker.register("/firebase-messaging-sw.js");

      const messaging = getMessaging(app);
      const fcmToken = await getToken(messaging, {
        vapidKey: process.env.NEXT_PUBLIC_VAPID_KEY,
      });

      if (!fcmToken) throw new Error("No FCM token");

      setToken(fcmToken);

      // Call your Cloud Function (rewritten as /api/register-token)
      await fetch("/api/register-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: fcmToken }),
      });
    } catch (err: any) {
      setError(err.message || "Failed to register");
    } finally {
      setLoading(false);
    }
  };

  return { register, token, loading, error };
}

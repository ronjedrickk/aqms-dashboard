"use client";

import { useState, useEffect } from "react";
import { getMessaging, getToken } from "firebase/messaging";
import { app } from "@/lib/firebase";

// Add interface for error handling
interface NotificationError extends Error {
  code?: string;
  message: string;
}

export function useNotifications() {
  const [permission, setPermission] =
    useState<NotificationPermission>("default");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const requestPermission = async () => {
    try {
      setLoading(true);
      setError(null);

      const status = await Notification.requestPermission();
      setPermission(status);

      if (status === "granted") {
        const messaging = getMessaging(app);

        const token = await getToken(messaging, {
          vapidKey: process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY,
        });

        console.log("📱 Generated FCM token:", token);

        if (token) {
          const res = await fetch("/api/register-token", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ token, enabled: true }),
          });

          if (!res.ok) {
            throw new Error("Failed to register token");
          }

          console.log("✅ Token registered in Firestore");
          return true;
        } else {
          setError("Failed to generate token");
          return false;
        }
      }

      return false;
    } catch (error: unknown) {
      const err = error as NotificationError;
      console.error("Failed to request notification permission:", err);
      return false;
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setPermission(Notification.permission);
  }, []);

  return { permission, loading, error, requestPermission };
}

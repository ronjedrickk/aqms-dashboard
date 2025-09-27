import { getToken, onMessage } from "firebase/messaging";
import { getClientMessaging } from "@/lib/firebase";

export async function requestNotificationPermission() {
  try {
    const permission = await Notification.requestPermission();
    if (permission !== "granted") return null;

    const messaging = getClientMessaging();
    if (!messaging) return null;

    return getToken(messaging, {
      vapidKey: process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY!,
    });
  } catch (error) {
    console.error('Failed to get notification permission:', error);
    return null;
  }
}

export function listenForegroundMessages() {
  const messaging = getClientMessaging();
  if (!messaging) return;

  onMessage(messaging, (payload) => {
    console.log("Message received in foreground:", payload);
    // Optional: show browser notification
    if (payload.notification) {
      const { title, body } = payload.notification;
      new Notification(title || 'New Message', { body });
    }
  });
}

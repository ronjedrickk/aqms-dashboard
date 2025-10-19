import { adminMessaging, adminDB } from "./firebase-admin";

/**
 * Send a push notification to multiple FCM tokens.
 */
export async function sendNotificationToTokens(
  tokens: string[],
  title: string,
  body: string,
  data?: Record<string, string>
) {
  if (!tokens.length) return { successCount: 0, failureCount: 0 };

  const message = {
    tokens,
    notification: { title, body },
    data,
  };

  const resp = await adminMessaging.sendEachForMulticast(message);

  // Clean up invalid tokens
  const tokensToRemove: string[] = [];
  resp.responses.forEach((r, i) => {
    if (!r.success) {
      const err = r.error;
      if (
        err?.code === "messaging/invalid-argument" ||
        err?.code === "messaging/registration-token-not-registered"
      ) {
        tokensToRemove.push(tokens[i]);
      }
    }
  });

  if (tokensToRemove.length) {
    for (const token of tokensToRemove) {
      await adminDB.collection("push_token").doc(token).delete();
    }
  }

  return resp;
}

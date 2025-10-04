import { NextRequest, NextResponse } from "next/server";
import { adminDB, adminMessaging } from "@/lib/firebase-admin";

export async function POST(req: NextRequest) {
  try {
    const { title, body } = await req.json();

    if (!title || !body) {
      return NextResponse.json(
        { error: "Title and body are required" },
        { status: 400 }
      );
    }

    // FCM token is the document ID
    const snap = await adminDB.collection("push_token").get();
    const tokens = snap.docs.map((d) => d.id).filter(Boolean);

    console.log(`📱 Found ${tokens.length} tokens`);

    if (tokens.length === 0) {
      return NextResponse.json({ message: "No tokens found" });
    }

    // Send notification with curent
    const response = await adminMessaging.sendEachForMulticast({
      tokens,
      notification: { title, body },
    });

    console.log(
      `✅ Sent: ${response.successCount} succeeded, ${response.failureCount} failed`
    );

    return NextResponse.json({
      successCount: response.successCount,
      failureCount: response.failureCount,
    });
  } catch (err: any) {
    console.error("❌ Error sending notification:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

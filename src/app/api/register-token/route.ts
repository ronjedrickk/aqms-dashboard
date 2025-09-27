import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";

export async function POST(req: NextRequest) {
  try {
    const { token, enabled = true } = await req.json();

    if (!token || typeof token !== "string") {
      console.error("❌ Invalid token received:", token);
      return NextResponse.json(
        { error: "Valid token is required" },
        { status: 400 }
      );
    }

    // Debug log
    console.log(
      "📱 Received token:",
      token.slice(0, 20) + "...",
      "length:",
      token.length
    );

    const tokenRef = adminDb.collection("push_token").doc(token);

    if (enabled) {
      await tokenRef.set(
        {
          enabled: true,
          lastUpdated: new Date(),
          platform: "web",
          userAgent: req.headers.get("user-agent") || "unknown",
        },
        { merge: true }
      );
      console.log("✅ Token enabled:", token.slice(0, 20) + "...");
    } else {
      await tokenRef.update({
        enabled: false,
        lastUpdated: new Date(),
      });
      console.log("🔕 Token disabled:", token.slice(0, 20) + "...");
    }

    return NextResponse.json({ success: true, enabled });
  } catch (error: any) {
    console.error("❌ Token operation failed:", error);
    return NextResponse.json(
      { error: error.message || "Failed to process token" },
      { status: 500 }
    );
  }
}

import { NextResponse } from "next/server";
import { adminDB } from "@/lib/firebase-admin";

export async function GET() {
  try {
    // Check if Auto Notifications are enabled
    const settingsSnap = await adminDB.doc("autonotify/notifications").get();
    const settingsData = settingsSnap.data();

    if (!settingsData?.autoSend) {
      return NextResponse.json({ message: "Auto notifications disabled" });
    }

    // Locations list
    const locations = [
      { name: "Quadrangle", collection: "sensor_dataQuad" },
      { name: "Falcon Bridge", collection: "sensor_datafalconbridge" },
      { name: "SV Entrance / Parking Lot", collection: "sensor_data" },
    ];

    const results: {
      name: string;
      uv: number;
      temperature: number;
      heatIndex: number;
      aqi: number;
      alerts: string[];
      highestSeverity: string;
    }[] = [];

    // Fetch and analyze each location
    for (const loc of locations) {
      const snap = await adminDB
        .collection(loc.collection)
        .orderBy("created_at", "desc")
        .limit(1)
        .get();

      if (snap.empty) continue;

      const latest = snap.docs[0].data();
      const uv = Number(latest.uv_index || 0);
      const temperature = Number(latest.temperature || 0);
      const humidity = Number(latest.humidity || 0);
      const aqi = Number(latest.pm2_5 || 0);

      //  heat index calculation (in °C)
      function heatIndexCelsius(tempC: number, rh: number): number {
        if (!tempC || !rh) return tempC ?? 0;
        const T = (tempC * 9) / 5 + 32; // C → F
        const R = rh;
        const HI =
          -42.379 +
          2.04901523 * T +
          10.14333127 * R -
          0.22475541 * T * R -
          0.00683783 * T * T -
          0.05481717 * R * R +
          0.00122874 * T * T * R +
          0.00085282 * T * R * R -
          0.00000199 * T * T * R * R;

        return ((HI - 32) * 5) / 9;
      }

      const heatIndex = heatIndexCelsius(temperature, humidity);

      const thresholds = {
        AQI: await adminDB.collection("categories/AQI/thresholds").get(),
        UV: await adminDB.collection("categories/UV/thresholds").get(),
        Heat: await adminDB.collection("categories/Heat/thresholds").get(),
      };

      let aqiSev = "low",
        uvSev = "low",
        heatSev = "low";

      // Match current values to severity
      for (const [cat, tSnap] of Object.entries(thresholds)) {
        tSnap.forEach((docSnap) => {
          const { min, max, severity } = docSnap.data();
          const value = cat === "AQI" ? aqi : cat === "UV" ? uv : temperature;
          if (value >= min && value <= max) {
            if (cat === "AQI") aqiSev = severity.toLowerCase();
            if (cat === "UV") uvSev = severity.toLowerCase();
            if (cat === "Heat") heatSev = severity.toLowerCase();
          }
        });
      }

      // Determine highest severity per location
      const severityOrder = ["low", "moderate", "high", "extreme", "critical"];
      const sevLevels = [aqiSev, uvSev, heatSev];
      let highest = "low";
      sevLevels.forEach((s) => {
        if (severityOrder.indexOf(s) > severityOrder.indexOf(highest))
          highest = s;
      });

      // Include metrics with severity
      const alerts: string[] = [];

      const sevLabels: Record<string, string> = {
        moderate: "moderate",
        high: "high",
        extreme: "extreme",
        critical: "critical",
      };

      if (["moderate", "high", "extreme", "critical"].includes(uvSev))
        alerts.push(`UV is ${sevLabels[uvSev]}`);
      if (["moderate", "high", "extreme", "critical"].includes(heatSev))
        alerts.push(`Heat is ${sevLabels[heatSev]}`);
      if (["moderate", "high", "extreme", "critical"].includes(aqiSev))
        alerts.push(`AQI is ${sevLabels[aqiSev]}`);

      results.push({
        name: loc.name,
        uv,
        temperature,
        heatIndex,
        aqi,
        alerts,
        highestSeverity: highest,
      });
    }

    // Compare all readings - build final message
    let title = "";
    let body = "";

    // Find the location with the highest temperature
    if (results.length === 0) {
      title = "🌤 No Data Available";
      body = "No recent sensor readings found.";
    } else {
      const hottest = results.reduce((max, curr) =>
        curr.heatIndex > max.heatIndex ? curr : max
      );

      if (hottest.highestSeverity === "low" && hottest.alerts.length === 0) {
        title = "🌤 All Locations Stable";
        body = "Conditions normal.";
      } else {
        title = "⚠️ Environmental Readings Detected!";
        body = `${hottest.temperature.toFixed(1)}°C in ${
          hottest.name
        } — feels like ${hottest.heatIndex.toFixed(
          0
        )}°C — See other parameters - AQI - UV.`;
      }
    }

    // Send the notification
    await fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/api/send-notifications`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, body }),
    });

    console.log("✅ Auto notification sent:", { title, body });

    return NextResponse.json({ title, body, message: "Notification sent" });
  } catch (err: any) {
    console.error("❌ Auto-notify error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

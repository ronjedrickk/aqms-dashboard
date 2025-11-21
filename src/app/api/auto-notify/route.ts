import { NextResponse } from "next/server";
import { adminDB } from "@/lib/firebase-admin";

export async function GET() {
  try {
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
      aqi: number;
      uvSev: string;
      tempSev: string;
      aqiSev: string;
      alerts: string[];
      highestSeverity: string;
    }[] = [];

    // LOOP THROUGH LOCATIONS
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
      const aqi = Number(latest.pm2_5 || 0);

      // FETCH THRESHOLDS
      const thresholds = {
        AQI: await adminDB.collection("categories/AQI/thresholds").get(),
        UV: await adminDB.collection("categories/UV/thresholds").get(),
        Temperature: await adminDB
          .collection("categories/Temperature/thresholds")
          .get(),
      };

      let aqiSev = "low",
        uvSev = "low",
        tempSev = "low";

      // CHECK SEVERITY RANGES
      for (const [cat, tSnap] of Object.entries(thresholds)) {
        tSnap.forEach((docSnap) => {
          const { min, max, severity } = docSnap.data();
          const value = cat === "AQI" ? aqi : cat === "UV" ? uv : temperature;

          if (value >= min && value <= max) {
            if (cat === "AQI") aqiSev = severity.toLowerCase();
            if (cat === "UV") uvSev = severity.toLowerCase();
            if (cat === "Temperature") tempSev = severity.toLowerCase();
          }
        });
      }

      // Determine highest severity
      const severityOrder = ["low", "moderate", "high", "extreme", "critical"];
      const sevLevels = [aqiSev, uvSev, tempSev];
      let highest = "low";
      sevLevels.forEach((s) => {
        if (severityOrder.indexOf(s) > severityOrder.indexOf(highest)) {
          highest = s;
        }
      });

      // Build alerts ONLY for high/exceeding
      const alerts: string[] = [];

      if (uvSev === "high" || uvSev === "extreme" || uvSev === "critical")
        alerts.push(`High UV (${uv})`);

      if (tempSev === "high" || tempSev === "extreme" || tempSev === "critical")
        alerts.push(`High Temperature (${temperature.toFixed(1)}°C)`);

      if (aqiSev === "high" || aqiSev === "extreme" || aqiSev === "critical")
        alerts.push(`Poor Air Quality (${aqi} AQI)`);

      results.push({
        name: loc.name,
        uv,
        temperature,
        aqi,
        uvSev,
        tempSev,
        aqiSev,
        alerts,
        highestSeverity: highest,
      });
    }

    // FILTER LOCATIONS THAT EXCEEDED THRESHOLDS
    const exceeded = results.filter((r) => r.alerts.length > 0);

    // NONE EXCEEDED → DO NOT SEND
    if (exceeded.length === 0) {
      return NextResponse.json({
        message: "No high readings detected. No notification sent.",
      });
    }

    // Build notification with ALL locations that have high readings
    const locationCount = exceeded.length;
    const title =
      locationCount === 1
        ? `⚠️ High Environmental Reading - ${exceeded[0].name}`
        : `⚠️ High Readings at ${locationCount} Locations`;

    const locationMessages: string[] = [];

    // Build message for each location
    for (const loc of exceeded) {
      const readings: string[] = [];

      if (
        loc.uvSev === "high" ||
        loc.uvSev === "extreme" ||
        loc.uvSev === "critical"
      ) {
        readings.push(`UV: ${loc.uv} (${loc.uvSev})`);
      }

      if (
        loc.tempSev === "high" ||
        loc.tempSev === "extreme" ||
        loc.tempSev === "critical"
      ) {
        readings.push(`Temp: ${loc.temperature.toFixed(1)}°C (${loc.tempSev})`);
      }

      if (
        loc.aqiSev === "high" ||
        loc.aqiSev === "extreme" ||
        loc.aqiSev === "critical"
      ) {
        readings.push(`AQI: ${loc.aqi} (${loc.aqiSev})`);
      }

      if (readings.length > 0) {
        locationMessages.push(
          `${loc.name}: ${readings.join(", ")} \nSee dashboard for details.`
        );
      }
    }

    const body = locationMessages.join("\n");

    // SEND NOTIFICATION
    await fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/api/send-notifications`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, body }),
    });

    return NextResponse.json({
      title,
      body,
      message: "Notification sent",
      locationsAlerted: locationCount,
    });
  } catch (err: any) {
    console.error("❌ Auto-notify error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

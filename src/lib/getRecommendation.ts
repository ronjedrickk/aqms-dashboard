import { collection, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";

interface SensorReadings {
  heat: number;
  uv: number;
  aqi: number;
}

export async function getRecommendation(latest: SensorReadings) {
  const categories = ["heat", "uv", "aqi"];
  let baseMessages: string[] = [];
  let maxSeverity: "low" | "moderate" | "high" | "extreme" = "low";

  // Fetch thresholds for each category
  for (const cat of categories) {
    const snap = await getDocs(collection(db, "recommendations", cat));
    snap.forEach((doc) => {
      const { min, max, recommendation, severity } = doc.data();
      const value =
        cat === "heat" ? latest.heat : cat === "uv" ? latest.uv : latest.aqi;

      if (value >= min && value <= max) {
        baseMessages.push(`${cat.toUpperCase()}: ${recommendation}`);

        // escalate severity
        if (severity === "extreme") maxSeverity = "extreme";
        else if (severity === "high" && maxSeverity !== "extreme")
          maxSeverity = "high";
        else if (severity === "moderate" && maxSeverity === "low")
          maxSeverity = "moderate";
      }
    });
  }

  // Check combination overrides
  const comboSnap = await getDocs(
    collection(db, "recommendations/combinations")
  );
  comboSnap.forEach((doc) => {
    const { heat, uv, aqi, recommendation, severity } = doc.data();

    const heatMatch = baseMessages.some((m) => m.includes(heat));
    const uvMatch = baseMessages.some((m) => m.includes(uv));
    const aqiMatch = baseMessages.some((m) => m.includes(aqi));

    if (heatMatch && uvMatch && aqiMatch) {
      baseMessages = [recommendation];
      maxSeverity = severity;
    }
  });

  return { text: baseMessages.join(" | "), severity: maxSeverity };
}

"use client";

interface GoogleData {
  aqi: number;
  uv: number;
  heat: number;
  locationName?: string;
  source?: string;
  uvLocation?: string;
  uvSource?: string;
  heatLocation?: string;
  heatSource?: string;
}
// Add after existing interfaces
interface ThresholdData {
  min: number;
  max: number;
  recommendation: string;
  severity: string;
}

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FaClock } from "react-icons/fa";
import { SensorCard } from "@/components/SensorCard";
import { SimpleArea } from "@/components/charts/SimpleArea";
import { Combined } from "@/components/charts/Combined";
import CampusMap from "@/components/CampusMap";
import { useClock } from "@/hooks/useClock";
import { useSensorData, LocationKey } from "@/hooks/useSensorData";
import type { SeverityLevel } from "@/types/severity";
import Image from "next/image";

// Auth + Firestore
import { auth, db } from "@/lib/firebase";
import { onAuthStateChanged, signOut as fbSignOut } from "firebase/auth";
import { doc, getDoc, collection, getDocs } from "firebase/firestore";

const locationDetails: Record<
  LocationKey,
  { title: string; colorClass: string; fontSize: string }
> = {
  Quadrangle: {
    title: "Quadrangle",
    colorClass: "text-red-500",
    fontSize: "text-2xl",
  },
  "Falcon Bridge": {
    title: "Falcon Bridge",
    colorClass: "text-blue-500",
    fontSize: "text-2xl",
  },
  "SV Entrance / Parking Lot": {
    title: "SV Entrance / Parking Lot",
    colorClass: "text-green-500",
    fontSize: "text-1xl",
  },
};

// 🔹 Utility: map severity to Tailwind colors
const getSeverityColor = (severity: string) => {
  switch (severity.toLowerCase()) {
    case "low":
    case "good":
    case "caution":
      return "text-green-500";
    case "moderate":
    case "medium":
    case "extreme caution":
      return "text-[#FFD93D]";
    case "high":
    case "unhealthy for sensitive groups":
    case "danger":
      return "text-[#FF9A00]";
    case "extreme":
    case "unhealthy":
    case "extreme danger":
    case "critical":
      return "text-[#E62727]";
    default:
      return "text-gray-500";
  }
};

// Remove unused functions: getRecommendation, getSensorSeverity

// Rank severities
const severityRank: Record<string, number> = {
  low: 1,
  moderate: 2,
  high: 3,
  extreme: 4,
};

// Rank severities in order
const severityOrder = ["low", "moderate", "high", "extreme", "critical"];

// Decide which severity is highest among AQI, UV, Heat
function getHighestSeverity(severities: (string | undefined)[]): string {
  let highest = "low";

  severities.forEach((sev) => {
    if (!sev) return;
    const currentIndex = severityOrder.indexOf(sev.toLowerCase());
    const highestIndex = severityOrder.indexOf(highest);
    if (currentIndex > highestIndex) {
      highest = sev.toLowerCase();
    }
  });

  return highest;
}

// Map severity → background color
function getBgColorFromSeverity(severity: string): string {
  switch (severity.toLowerCase()) {
    case "low":
      return "bg-green-500"; // ✅ Low
    case "moderate":
      return "bg-[#FFD93D]"; // ✅ Moderate
    case "high":
      return "bg-[#FF9A00]"; // ✅ High
    case "extreme":
      return "bg-[#E62727]"; // ✅ Extreme
    case "critical":
      return "bg-black"; // ⚡ Example for critical (change as needed)
    default:
      return "bg-gray-400"; // fallback
  }
}

export default function AdminPage() {
  const now = useClock();
  const [activeLocation, setActiveLocation] = useState<LocationKey>(
    "SV Entrance / Parking Lot"
  );

  // Auth - remove unused states
  const router = useRouter();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        router.push("/login");
        return;
      }
      const snap = await getDoc(doc(db, "admin", user.uid));
      if (snap.exists()) {
        const userRole = snap.data().role;
        if (userRole !== "admin") router.push("/login");
      } else {
        router.push("/login");
      }
    });
    return () => unsubscribe();
  }, [router]);

  // ✅ unified hook: latest + rows
  const { latest, rows } = useSensorData(activeLocation, 8);

  // ✅ recommendation state
  const [recommendation, setRecommendation] = useState("Loading...");

  // ✅ per-sensor severities
  const [aqiSeverity, setAqiSeverity] = useState<SeverityLevel>("low");
  const [uvSeverity, setUvSeverity] = useState<SeverityLevel>("low");
  const [heatSeverity, setHeatSeverity] = useState<SeverityLevel>("low");

  // ✅ Google API data with proper typing
  const [googleData, setGoogleData] = useState<GoogleData | null>(null);

  useEffect(() => {
    async function fetchGoogle() {
      try {
        const res = await fetch("/api/google-readings");
        const data = await res.json();
        setGoogleData(data);
      } catch (err) {
        console.error("Google API fetch error:", err);
      }
    }
    fetchGoogle();
  }, []);

  // 🔥 Get overall recommendation + per-sensor severities
  useEffect(() => {
    if (!latest) return;

    (async () => {
      const categories = ["AQI", "Heat", "UV"];
      const messages: string[] = [];
      let maxSeverity = "low";

      for (const cat of categories) {
        const snap = await getDocs(
          collection(db, "categories", cat, "thresholds")
        );

        snap.forEach((docSnap) => {
          const data = docSnap.data() as ThresholdData;
          const value =
            cat === "AQI"
              ? latest.aqi
              : cat === "Heat"
              ? latest.heat
              : latest.uv;

          if (value >= data.min && value <= data.max) {
            messages.push(`${cat}: ${data.recommendation}`);

            // update per-sensor severity
            const sev = data.severity.toLowerCase() as SeverityLevel;
            if (cat === "AQI") setAqiSeverity(sev);
            if (cat === "Heat") setHeatSeverity(sev);
            if (cat === "UV") setUvSeverity(sev);

            // track max severity for overall
            if (severityRank[sev] > severityRank[maxSeverity]) {
              maxSeverity = sev;
            }
          }
        });
      }

      setRecommendation(messages.join(" | "));
    })();
  }, [latest]);

  return (
    <main className="bg-blue-300 text-[#0A0A0A] font-['Inter'] min-h-screen p-3">
      {/* Header */}
      <div className="p-5 ">
        <header className="mt-3.5 shadow-xl bg-white rounded-2xl">
          <div className="flex justify-around  p-2">
            {/* Logo and Title */}
            <div className="text-center mt-2">
              <Image
                src="/adu_logo.png"
                alt="ADU Logo"
                width={120}
                height={120}
              />
            </div>
            {/* Clock */}
            <div className="flex items-center gap-2">
              <FaClock className="text-2xl text-[#FFB703]" />
              <div className="bg-[#0067B1] rounded-lg shadow text-center px-4 py-2 border border-[#A7A9AC]">
                <p className="text-lg font-medium">Adamson University</p>
                <div className="text-2xl font-bold">
                  {now.toLocaleTimeString()}
                </div>
              </div>
            </div>

            {/* Navigation */}
            <div className="flex flex-row ">
              <div className="self-center">
                <nav className="mt-3 text-center space-x-8 text-2xl">
                  <Link
                    href="/admin/aqi"
                    className="hover:underline underline-offset-8"
                  >
                    Air Quality
                  </Link>
                  <Link
                    href="/admin/uv"
                    className="hover:underline underline-offset-8"
                  >
                    UV Intensity
                  </Link>
                  <Link
                    href="/admin/heat"
                    className="hover:underline underline-offset-8"
                  >
                    Heat Index
                  </Link>
                  <Link
                    href="/admin/notif"
                    className="hover:underline underline-offset-8"
                  >
                    Notifications
                  </Link>
                </nav>
              </div>
            </div>

            {/* Logout */}
            <div className="self-end">
              <button
                onClick={() =>
                  fbSignOut(auth).then(() => router.push("/login"))
                }
                className="text-red-500 self-center hover:text-red-700 text-2xl"
                aria-label="Logout"
              >
                Log out
              </button>
            </div>
          </div>
        </header>
      </div>

      {/* Recommendation */}
      <div className="flex justify-center items-center">
        <div className="m-5 bg-white rounded-2xl max-w-6xl">
          <section className="h-auto p-5 gap-2 shadow-2xl">
            <div className="flex flex-col sm:flex-col md:flex-row gap-4 self-center">
              <div
                className={`flex-1 ${getBgColorFromSeverity(
                  getHighestSeverity([aqiSeverity, uvSeverity, heatSeverity])
                )} text-black rounded-md shadow-md text-center p-2`}
              >
                <h1 className="text-3xl font-semibold p-3">
                  ⚠️ <strong>Recommendation:</strong> {recommendation}
                </h1>
              </div>
            </div>
          </section>
        </div>
      </div>
      {/* Current values + charts */}
      <section className="my-6">
        {latest && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-6">
            <SensorCard
              title="Air Quality"
              value={`${latest.aqi} AQI`}
              icon="🌫️"
              severity={aqiSeverity as SeverityLevel}
              apiValue={googleData ? `${googleData.aqi} AQI` : "Loading..."}
              location={googleData?.locationName || "Unknown location"} // 👈 dynamic location
              source={googleData?.source || "Loading..."}
            >
              <div></div>
              <SimpleArea
                data={rows}
                dataKey="aqi"
                stroke="#ef4444"
                fillId="aqi-fill"
              />
            </SensorCard>

            <SensorCard
              title="UV Intensity"
              value={`${latest.uv} UV`}
              icon="☀️"
              severity={uvSeverity as SeverityLevel}
              apiValue={googleData ? `${googleData.uv} UV` : "Loading..."}
              location={googleData?.uvLocation || "Unknown location"}
              source={googleData?.uvSource || "Loading..."}
            >
              <SimpleArea
                data={rows}
                dataKey="uv"
                stroke="#9112BC"
                fillId="uv-fill"
              />
            </SensorCard>

            <SensorCard
              title="Heat Index"
              value={latest.heat ? `${latest.heat.toFixed(1)} °C` : "—"}
              icon="🌡️"
              severity={heatSeverity as SeverityLevel}
              apiValue={googleData ? `${googleData.heat} °C` : "Loading..."}
              location={googleData?.heatLocation || "Unknown location"}
              source={googleData?.heatSource || "Loading..."}
            >
              <SimpleArea
                data={rows}
                dataKey="heat"
                stroke="#FCB53B"
                fillId="heat-fill"
              />
            </SensorCard>
          </div>
        )}
        {/* Map + Combined chart */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="flex flex-col justify-center items-center">
            <h3 className="text-lg font-semibold text-black mb-2">
              <p className="text-black mt-2 font-semibold text-lg">
                Location:{" "}
                <span
                  className={`underline underline-offset-8 ${locationDetails[activeLocation].colorClass} ${locationDetails[activeLocation].fontSize}`}
                >
                  {activeLocation || "None selected"}
                </span>
              </p>
            </h3>
            <CampusMap
              onMarkerClick={(location) =>
                setActiveLocation(location as LocationKey)
              }
            />
          </div>

          <div className="col-span-1 lg:col-span-2 p-2">
            <h3 className="text-xl font-semibold text-black mb-4">
              Combined Analysis <br />
              {latest && (
                <span className="ml-2 text-xl font-semibold text-gray-700">
                  Now:{" "}
                  <span
                    className={` font-bold ${getSeverityColor(aqiSeverity)}`}
                  >
                    {latest.aqi} AQI
                  </span>
                  <span
                    className={`ml-2 font-bold ${getSeverityColor(uvSeverity)}`}
                  >
                    {latest.uv} UV
                  </span>
                  <span
                    className={`ml-2 font-bold ${getSeverityColor(
                      heatSeverity
                    )}`}
                  >
                    {latest.heat.toFixed(1)}°C
                  </span>
                  <span className="ml-2 font-bold text-gray-600">
                    {now.toLocaleTimeString()}
                  </span>
                </span>
              )}
            </h3>
            <div className="h-[290px]">
              <Combined data={rows} />
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

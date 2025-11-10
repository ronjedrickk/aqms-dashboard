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
import { severityColors, Severity } from "@/lib/severitycolors";

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

// map severity to Tailwind colors
const getSeverityColor = (severity: string) => {
  switch (severity.toLowerCase()) {
    case "low":
    case "good":
      return "text-green-500";
    case "moderate":
    case "normal":
      return "text-[#FFD93D]";
    case "high":
    case "caution":
      return "text-[#FF9A00]";
    case "extreme":
    case "extreme danger":
    case "danger":
      return "text-[#FF3D00]";
    case "critical":
      return "text-purple-600";
    default:
      return "text-gray-500";
  }
};

const severityRank: Record<string, number> = {
  low: 1,
  moderate: 2,
  high: 3,
  extreme: 4,
};

// severities in order
const severityOrder = ["low", "moderate", "high", "extreme", "critical"];

// Decide which severity is highest
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

// background color
function getBgColorFromSeverity(severity: string): string {
  switch (severity.toLowerCase()) {
    case "low":
      return "bg-green-500";
    case "moderate":
      return "bg-[#FFD93D]";
    case "high":
      return "bg-[#FF9A00]";
    case "extreme":
      return "bg-red-500";
    case "critical":
      return "bg-[#E62727]";
    default:
      return "bg-gray-400";
  }
}
// Add this function near your other utility functions at the top of the file
function getSeverityLabel(severity: string): string {
  switch (severity.toLowerCase()) {
    case "low":
      return "Good";
    case "moderate":
      return "Moderate";
    case "high":
      return "Unhealthy";
    case "extreme":
      return "Extreme Danger";
    case "critical":
      return "Critical";
    default:
      return "Unknown";
  }
}

function normalizeSeverity(raw: string | number, type: string): string {
  // If raw is a number, handle numeric ranges directly
  if (typeof raw === "number") {
    if (type === "Heat") {
      if (raw <= 27) return "low";
      if (raw <= 32) return "moderate"; // Changed from "normal"
      if (raw <= 39) return "high"; // Changed from "caution"
      if (raw <= 51) return "extreme";
      return "critical";
    }
    if (type === "AQI") {
      if (raw <= 50) return "low";
      if (raw <= 100) return "moderate";
      if (raw <= 150) return "high";
      if (raw <= 200) return "extreme";
      return "critical";
    }
    if (type === "UV") {
      if (raw <= 2) return "low";
      if (raw <= 5) return "moderate";
      if (raw <= 7) return "high";
      if (raw <= 12) return "extreme";
      return "critical";
    }
  }

  // Handle string values (fallback to existing logic)
  const s = (raw || "").toString().toLowerCase();

  if (type === "Heat") {
    if (s.includes("low") || s.includes("0-27")) return "low";
    if (s.includes("normal") || s.includes("28-32")) return "moderate"; // Changed from "normal"
    if (s.includes("caution") || s.includes("33-39")) return "high"; // Changed from "caution"
    if (s.includes("extreme danger") || s.includes("40-100")) return "extreme";
    if (s.includes("critical")) return "critical";
    return "low"; // safe fallback
  }

  if (s === "low" || s.includes("good")) return "low";
  if (s.includes("moderate")) return "moderate";
  if (s.includes("high") || s.includes("unhealthy for sensitive"))
    return "high";
  if (s.includes("extreme") || s.includes("unhealthy")) return "extreme";
  if (s.includes("critical") || s.includes("hazard")) return "critical";

  return "low"; // safe fallback
}

// First add this helper function near the other utility functions
function getOtherLocations(activeLocation: LocationKey): LocationKey[] {
  const allLocations: LocationKey[] = [
    "Quadrangle",
    "Falcon Bridge",
    "SV Entrance / Parking Lot",
  ];
  return allLocations.filter((loc) => loc !== activeLocation);
}

export default function AdminPage() {
  const now = useClock();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const [activeLocation, setActiveLocation] = useState<LocationKey>(
    "SV Entrance / Parking Lot"
  );
  const [activeView, setActiveView] = useState("dashboard");

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

  // unified hook: latest + rows
  const { latest, rows } = useSensorData(activeLocation, 8);

  // recommendation state
  const [recommendation, setRecommendation] = useState("Loading...");

  // per-sensor severities
  const [aqiSeverity, setAqiSeverity] = useState<SeverityLevel>("low");
  const [uvSeverity, setUvSeverity] = useState<SeverityLevel>("low");
  const [heatSeverity, setHeatSeverity] = useState<SeverityLevel>("low");

  // Google API data with proper typing
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

  // Get overall recommendation + per-sensor severities
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
              ? latest.temperature || 0
              : latest.uv;

          if (value >= data.min && value <= data.max) {
            messages.push(`${cat}: ${data.recommendation}`);

            // update per-sensor severity
            const rawSeverity = data.severity;
            const sev = normalizeSeverity(rawSeverity, cat) as SeverityLevel;
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

  // First, add these hooks to fetch data for all locations
  const { latest: quadData } = useSensorData("Quadrangle", 8);
  const { latest: bridgeData } = useSensorData("Falcon Bridge", 8);
  const { latest: entranceData } = useSensorData(
    "SV Entrance / Parking Lot",
    8
  );

  // First, verify the UV data is being properly fetched
  useEffect(() => {
    if (latest) {
      console.log("UV Data:", {
        quad: quadData?.uv,
        bridge: bridgeData?.uv,
        entrance: entranceData?.uv,
      });
    }
  }, [latest, quadData, bridgeData, entranceData]);

  return (
    <div className="flex min-h-screen bg-[#0a1f44] text-white font-['Inter']">
      {/* Sidebar */}
      <aside className="w-60 bg-[#0b1a33] p-5 flex flex-col gap-4 sticky top-0 h-screen">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-[10px] bg-[#071327] grid place-items-center text-white font-extrabold">
            A
          </div>
          <h2 className="text-lg text-[#38bdf8] m-0">Adamson University</h2>
        </div>
        <nav className="flex flex-col">
          {/* Dashboard - active */}
          <Link
            href="/admin"
            className={`flex items-center gap-2.5 py-2.5 px-3 rounded-lg mb-1.5 transition-all
              ${
                activeView === "dashboard"
                  ? "bg-[#1d3557] text-[#38bdf8]"
                  : "text-[#e4e8f0] hover:bg-[#1d3557] hover:text-[#38bdf8]"
              }`}
            onClick={() => setActiveView("dashboard")}
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className="w-4 h-4 opacity-90 flex-shrink-0"
            >
              <rect x="3" y="3" width="7" height="7" rx="1.5"></rect>
              <rect x="14" y="3" width="7" height="7" rx="1.5"></rect>
              <rect x="3" y="14" width="7" height="7" rx="1.5"></rect>
              <rect x="14" y="14" width="7" height="7" rx="1.5"></rect>
            </svg>
            Dashboard
          </Link>
          {/* AQI  */}
          <Link
            href="/admin/aqi"
            className={`flex items-center gap-2.5 py-2.5 px-3 rounded-lg mb-1.5 transition-all
              ${
                activeView === "aqi"
                  ? "bg-[#1d3557] text-[#38bdf8]"
                  : "text-[#e4e8f0] hover:bg-[#1d3557] hover:text-[#38bdf8]"
              }`}
            onClick={() => setActiveView("aqi")}
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="#ffeb3b"
              strokeWidth="2"
              className="w-4 h-4 opacity-90 flex-shrink-0"
            >
              <path d="M3 15a4 4 0 014-4h1a5 5 0 119 0h1a4 4 0 110 8H7a4 4 0 01-4-4z" />
            </svg>
            Air Quality
          </Link>
          {/* UV */}
          <Link
            href="/admin/uv"
            className={`flex items-center gap-2.5 py-2.5 px-3 rounded-lg mb-1.5 transition-all
              ${
                activeView === "uv"
                  ? "bg-[#1d3557] text-[#38bdf8]"
                  : "text-[#e4e8f0] hover:bg-[#1d3557] hover:text-[#38bdf8]"
              }`}
            onClick={() => setActiveView("uv")}
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="#a78bfa"
              strokeWidth="2"
              className="w-4 h-4 opacity-90 flex-shrink-0"
            >
              <circle cx="12" cy="12" r="5" />
              <path d="M12 1v2m0 18v2m11-11h-2M3 12H1m16.95-6.95l-1.41 1.41M6.46 17.54l-1.41 1.41M17.54 17.54l1.41 1.41M6.46 6.46L5.05 5.05" />
            </svg>
            UV Intensity
          </Link>
          {/* Heat Index */}
          <Link
            href="/admin/heat"
            className={`flex items-center gap-2.5 py-2.5 px-3 rounded-lg mb-1.5 transition-all
              ${
                activeView === "heat"
                  ? "bg-[#1d3557] text-[#38bdf8]"
                  : "text-[#e4e8f0] hover:bg-[#1d3557] hover:text-[#38bdf8]"
              }`}
            onClick={() => setActiveView("heat")}
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="#ff9800"
              strokeWidth="2"
              className="w-4 h-4 opacity-90 flex-shrink-0"
            >
              <path d="M14 14.76V5a2 2 0 10-4 0v9.76a4 4 0 104 0z" />
            </svg>
            Heat Index
          </Link>
          {/* Notifications */}
          <Link
            href="/admin/notif"
            className={`flex items-center gap-2.5 py-2.5 px-3 rounded-lg mb-1.5 transition-all
              ${
                activeView === "notif"
                  ? "bg-[#1d3557] text-[#38bdf8]"
                  : "text-[#e4e8f0] hover:bg-[#1d3557] hover:text-[#38bdf8]"
              }`}
            onClick={() => setActiveView("notif")}
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="#9fb8d1"
              strokeWidth="2"
              className="w-4 h-4 opacity-90 flex-shrink-0"
            >
              <path d="M7 3h7l5 5v13a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z" />
              <path d="M14 3v6h6" />
            </svg>
            Notifications
          </Link>
        </nav>

        <div className="flex-1"></div>

        {/* Logout button */}
        <button
          onClick={() => fbSignOut(auth).then(() => router.push("/login"))}
          className="flex items-center gap-2.5 py-2.5 px-3 rounded-lg mb-1.5 text-red-500 hover:bg-[#1d3557] hover:text-red-400 transition-all"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className="w-4 h-4 opacity-90 flex-shrink-0"
          >
            <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
            <path d="M16 17l5-5-5-5" />
            <path d="M21 12H9" />
          </svg>
          Log out
        </button>

        <div className="text-xs text-[#6ea8d9]">© Adamson University 2025</div>
      </aside>

      {/* Main content */}
      <main className="flex-1">
        {/* Recommendation + Clock*/}
        <div className="flex justify-center items-center p-5">
          <div className="flex items-center gap-6 ">
            <div className="flex items-center gap-2 text-[#e4e8f0] bg-[#071327] rounded-xl px-4 py-2 shadow max-w-50">
              <FaClock className="text-[#38bdf8]" />
              <span className="text-2xl font-medium">
                {now ? now.toLocaleTimeString() : "--:--:--"}
              </span>
            </div>
            <div
              className={`${getBgColorFromSeverity(
                getHighestSeverity([aqiSeverity, uvSeverity, heatSeverity])
              )} text-black rounded-xl p-4 shadow-md grid grid-cols-[auto_1fr] gap-4 items-start max-w-5xl`}
            >
              <div className="flex items-center gap-2.5 font-extrabold text-base">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  className="w-5 h-5"
                >
                  <path d="M10.3 3.5L1.6 18.6A2 2 0 0 0 3.3 21h17.4a2 2 0 0 0 1.7-3L13.7 3.5a2 2 0 0 0-3.4 0z" />
                  <path d="M12 9v5M12 18h.01" />
                </svg>
                <span>Recommendation:</span>
              </div>
              <div className="text-base font-semibold leading-relaxed">
                {recommendation}
              </div>
            </div>
          </div>
        </div>

        {/* Current values + charts */}
        <section className="my-3">
          {latest && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-2 sm:mb-4">
              {/* AQI */}
              <SensorCard
                title="Air Quality"
                subtitle={locationDetails[activeLocation].title}
                value={latest ? `${latest.aqi} AQI` : "Loading..."}
                icon={
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="#ffeb3b"
                    strokeWidth="2"
                    className="h-9 w-9 sm:w-12 sm:h-15 opacity-90 flex-shrink-0"
                  >
                    <path d="M3 15a4 4 0 014-4h1a5 5 0 119 0h1a4 4 0 110 8H7a4 4 0 01-4-4z" />
                  </svg>
                }
                severity={aqiSeverity as Severity}
                apiValue={googleData ? `${googleData.aqi} AQI` : "Loading..."}
                location={googleData?.locationName || "Unknown location"}
                source={googleData?.source || "Loading..."}
              >
                {/* AQI Card Grid */}
                <div className="grid grid-cols-2 gap-4 mb-4">
                  {getOtherLocations(activeLocation).map((location) => {
                    const data =
                      location === "Quadrangle"
                        ? quadData
                        : location === "Falcon Bridge"
                        ? bridgeData
                        : entranceData;

                    const colorClass =
                      location === "Quadrangle"
                        ? "text-[#7BD3EA]"
                        : location === "Falcon Bridge"
                        ? "text-blue-400"
                        : "text-green-400";

                    return (
                      <div
                        key={location}
                        className="flex flex-col items-center p-3 rounded-lg bg-opacity-10 bg-white"
                      >
                        <span className={`${colorClass} text-md mb-1`}>
                          {location}
                        </span>
                        <span
                          className={`text-3xl font-bold ${getSeverityColor(
                            normalizeSeverity(data?.aqi || 0, "AQI")
                          )}`}
                        >
                          {data?.aqi || "—"} AQI
                        </span>
                        <span
                          className={`text-2xl ${getSeverityColor(
                            normalizeSeverity(data?.aqi || 0, "AQI")
                          )}`}
                        >
                          {getSeverityLabel(
                            normalizeSeverity(data?.aqi || 0, "AQI")
                          )}
                        </span>
                      </div>
                    );
                  })}
                </div>
                <SimpleArea
                  data={rows}
                  dataKey="aqi"
                  stroke="#ef4444"
                  fillId="aqi-fill"
                />
              </SensorCard>

              {/* UV */}
              <SensorCard
                title="UV Intensity"
                subtitle={locationDetails[activeLocation].title}
                value={latest ? `${latest.uv ?? "—"} UV` : "Loading..."}
                icon={
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="#a78bfa"
                    strokeWidth="2"
                    className="w-9 h-8 sm:w-12 sm:h-15 opacity-90 flex-shrink-0"
                  >
                    <circle cx="12" cy="12" r="5" />
                    <path d="M12 1v2m0 18v2m11-11h-2M3 12H1m16.95-6.95l-1.41 1.41M6.46 17.54l-1.41 1.41M17.54 17.54l1.41 1.41M6.46 6.46L5.05 5.05" />
                  </svg>
                }
                severity={uvSeverity as Severity}
                apiValue={googleData ? `${googleData.uv} UV` : "Loading..."}
                location={googleData?.uvLocation || "Unknown location"}
                source={googleData?.uvSource || "Loading..."}
              >
                {/* UV Card Grid */}
                <div className="grid grid-cols-2 gap-4 mb-4">
                  {getOtherLocations(activeLocation).map((location) => {
                    const data =
                      location === "Quadrangle"
                        ? quadData
                        : location === "Falcon Bridge"
                        ? bridgeData
                        : entranceData;

                    const colorClass =
                      location === "Quadrangle"
                        ? "text-[#7BD3EA]"
                        : location === "Falcon Bridge"
                        ? "text-blue-400"
                        : "text-green-400";

                    return (
                      <div
                        key={location}
                        className="flex flex-col items-center p-3 rounded-lg bg-opacity-10 bg-white"
                      >
                        <span className={`${colorClass} text-md mb-1`}>
                          {location}
                        </span>
                        <span
                          className={`text-2xl font-bold ${getSeverityColor(
                            normalizeSeverity(Number(data?.uv) || 0, "UV")
                          )}`}
                        >
                          {data?.uv !== undefined && data?.uv !== null
                            ? `${data.uv.toFixed(1)} UV`
                            : "—"}
                        </span>
                        <span
                          className={`text-2xl ${getSeverityColor(
                            normalizeSeverity(Number(data?.uv) || 0, "UV")
                          )}`}
                        >
                          {getSeverityLabel(
                            normalizeSeverity(Number(data?.uv) || 0, "UV")
                          )}
                        </span>
                      </div>
                    );
                  })}
                </div>
                <SimpleArea
                  data={rows}
                  dataKey="uv"
                  stroke="#9112BC"
                  fillId="uv-fill"
                />
              </SensorCard>

              {/* Heat */}
              <SensorCard
                title="Heat Index"
                subtitle={locationDetails[activeLocation].title}
                value={
                  latest.temperature
                    ? `${latest.temperature.toFixed(1)} °C`
                    : "—"
                }
                icon={
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="#ff9800"
                    strokeWidth="2"
                    className="w-9 h-8 sm:w-12 sm:h-15 opacity-90 flex-shrink-0"
                  >
                    <path d="M14 14.76V5a2 2 0 10-4 0v9.76a4 4 0 104 0z" />
                  </svg>
                }
                severity={heatSeverity as Severity}
                apiValue={googleData ? `${googleData.heat} °C` : "Loading..."}
                location={googleData?.heatLocation || "Unknown location"}
                source={googleData?.heatSource || "Loading..."}
                rawTemperature={
                  latest.temperature
                    ? `${latest.temperature.toFixed(1)} °C`
                    : "—"
                }
              >
                {/* Heat Card Grid */}
                <div className="grid grid-cols-2 gap-4 mb-4">
                  {getOtherLocations(activeLocation).map((location) => {
                    const data =
                      location === "Quadrangle"
                        ? quadData
                        : location === "Falcon Bridge"
                        ? bridgeData
                        : entranceData;

                    const colorClass =
                      location === "Quadrangle"
                        ? "text-[#7BD3EA]"
                        : location === "Falcon Bridge"
                        ? "text-blue-400"
                        : "text-green-400";

                    return (
                      <div
                        key={location}
                        className="flex flex-col items-center p-3 rounded-lg bg-opacity-10 bg-white"
                      >
                        <span className={`${colorClass} text-md mb-1`}>
                          {location}
                        </span>
                        <span
                          className={`text-2xl font-bold ${getSeverityColor(
                            normalizeSeverity(data?.temperature || 0, "Heat")
                          )}`}
                        >
                          {data?.temperature
                            ? `${data.temperature.toFixed(1)}°C`
                            : "—"}
                        </span>
                        <span
                          className={`text-2xl ${getSeverityColor(
                            normalizeSeverity(data?.temperature || 0, "Heat")
                          )}`}
                        >
                          {getSeverityLabel(
                            normalizeSeverity(data?.temperature || 0, "Heat")
                          )}
                        </span>
                      </div>
                    );
                  })}
                </div>
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
              <h3 className="text-lg font-semibold text-white mb-2">
                <p className="text-white mt-2 font-semibold text-lg">
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
              <h3 className="text-xl font-semibold text-white mb-4 text-center">
                Combined Analysis <br />
                {latest && (
                  <span className="ml-2 text-xl font-semibold text-white">
                    Now:{" "}
                    <span
                      className={` font-bold ${getSeverityColor(aqiSeverity)}`}
                    >
                      {latest.aqi} AQI
                    </span>
                    <span
                      className={`ml-2 font-bold ${getSeverityColor(
                        uvSeverity
                      )}`}
                    >
                      {latest.uv} UV
                    </span>
                    <span
                      className={`ml-2 font-bold ${getSeverityColor(
                        heatSeverity
                      )}`}
                    >
                      {latest.temperature?.toFixed(1)}°C`
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
    </div>
  );
}

"use client";

import React, { useState, useEffect } from "react";
import { useClock } from "@/hooks/useClock";
import { useSensorData, LocationKey } from "@/hooks/useSensorData";
import { SensorCard } from "@/components/SensorCard";
import { SimpleArea } from "@/components/charts/SimpleArea";
import { Combined } from "@/components/charts/Combined";
import CampusMap from "@/components/CampusMap";
import { FaClock } from "react-icons/fa";
import { useNotifications } from "@/hooks/useNotifications";

// Firestore
import { collection, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { severityColors, Severity } from "@/lib/severitycolors";

interface RecommendationData {
  min: number;
  max: number;
  recommendation: string;
  severity: string;
}

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

// Rank severities
const severityRank: Record<string, number> = {
  low: 1,
  moderate: 2,
  high: 3,
  extreme: 4,
};

// Rank severities in order
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

// severity background color
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
      return "bg-black";
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
      if (raw <= 27.5) return "low";
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

export default function Page() {
  const now = useClock();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const [activeLocation, setActiveLocation] = useState<LocationKey>(
    "SV Entrance / Parking Lot"
  );

  //  Notification hook
  const { permission, requestPermission } = useNotifications();
  const [showPrompt, setShowPrompt] = useState(true);

  // unified hook: latest + rows
  const { latest, rows } = useSensorData(activeLocation, 8);

  //  per-category recommendations
  const [aqiRec, setAqiRec] = useState("");
  const [heatRec, setHeatRec] = useState("");
  const [uvRec, setUvRec] = useState("");

  // per-sensor severities
  const [aqiSeverity, setAqiSeverity] = useState<Severity>("low");
  const [uvSeverity, setUvSeverity] = useState<Severity>("low");
  const [heatSeverity, setHeatSeverity] = useState<Severity>("low");

  // Google API data
  const [googleData, setGoogleData] = useState<GoogleData | null>(null);

  useEffect(() => {
    async function fetchGoogle() {
      try {
        const res = await fetch("/api/google-readings");
        const data: GoogleData = await res.json();
        setGoogleData(data);
      } catch (err) {
        console.error("Google API fetch error:", err);
      }
    }
    fetchGoogle();
  }, []);

  //  Get overall recommendation + per-sensor severities
  useEffect(() => {
    if (!latest) return;

    (async () => {
      const categories = ["AQI", "Heat", "UV"] as const;
      let maxSeverity: Severity = "low";

      for (const cat of categories) {
        const snap = await getDocs(
          collection(db, "categories", cat, "thresholds")
        );

        snap.forEach((docSnap) => {
          const data = docSnap.data() as RecommendationData;
          // Use temperature instead of heat for the Heat category
          const value =
            cat === "AQI"
              ? latest.aqi
              : cat === "Heat"
              ? latest.temperature || 0 // Use temperature, fallback to 0 if undefined
              : latest.uv;

          if (value >= data.min && value <= data.max) {
            if (cat === "AQI") setAqiRec(data.recommendation);
            if (cat === "Heat") setHeatRec(data.recommendation);
            if (cat === "UV") setUvRec(data.recommendation);

            const rawSeverity = data.severity;
            const sev = normalizeSeverity(rawSeverity, cat) as Severity;
            if (cat === "AQI") setAqiSeverity(sev);
            if (cat === "Heat") setHeatSeverity(sev);
            if (cat === "UV") setUvSeverity(sev);

            if (severityRank[sev] > severityRank[maxSeverity]) {
              maxSeverity = sev;
            }
          }
        });
      }
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
    <main
      className={`min-h-screen text-white font-['Inter'] p-2 sm:p-4 transition-colors duration-500 bg-[#0a1f44]`}
    >
      {/* Header */}
      <header className="mt-2 drop-shadow-2xl p-4 sm:p-2 text-white rounded-lg flex flex-col md:flex-row justify-between items-center gap-2 sm:gap-4">
        {/* Clock */}
        <div className="flex items-center gap-2">
          <FaClock className="text-lg sm:text-2xl text-[#FFB703]" />
          <div className="bg-[#0067B1] rounded-lg shadow text-center px-4 py-2 border border-[#A7A9AC]">
            <p className="text-lg font-medium">Adamson University</p>
            <div className="text-2xl font-bold">
              {mounted && now
                ? new Intl.DateTimeFormat("en-PH", {
                    timeZone: "Asia/Manila",
                    hour12: true,
                    hour: "2-digit",
                    minute: "2-digit",
                    second: "2-digit",
                  }).format(now)
                : "--:--:--"}
            </div>
          </div>
        </div>

        {/* Recommendation */}
        <div className="flex-1 flex justify-center">
          <div
            className={`flex-1 ${getBgColorFromSeverity(
              getHighestSeverity([aqiSeverity, uvSeverity, heatSeverity])
            )} text-black rounded-md shadow-md p-2`}
          >
            <h1 className="text-base sm:text-lg font-semibold flex-wrap flex sm:flex-nowrap items-center gap-2 sm:gap-4">
              ⚠️ <strong>Recommendation:</strong>
              {/* AQI */}
              {aqiRec && (
                <span className="flex items-center gap-2">
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="#ffeb3b"
                    strokeWidth="2"
                    className="w-9 h-9 sm:w-5 sm:h-5 opacity-90"
                  >
                    <path d="M3 15a4 4 0 014-4h1a5 5 0 119 0h1a4 4 0 110 8H7a4 4 0 01-4-4z" />
                  </svg>
                  <strong>AQI:</strong> {aqiRec}
                </span>
              )}
              {/* Heat */}
              {heatRec && (
                <span className="flex items-center gap-2">
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="#ff9800"
                    strokeWidth="2"
                    className="w-9 h-9 sm:w-5 sm:h-5 opacity-90"
                  >
                    <path d="M14 14.76V5a2 2 0 10-4 0v9.76a4 4 0 104 0z" />
                  </svg>
                  <strong>Heat:</strong> {heatRec}
                </span>
              )}
              {/* UV */}
              {uvRec && (
                <span className="flex items-center gap-2">
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="#a78bfa"
                    strokeWidth="2"
                    className="w-7 h-7 sm:w-5 sm:h-5 opacity-90"
                  >
                    <circle cx="12" cy="12" r="5" />
                    <path d="M12 1v2m0 18v2m11-11h-2M3 12H1m16.95-6.95l-1.41 1.41M6.46 17.54l-1.41 1.41M17.54 17.54l1.41 1.41M6.46 6.46L5.05 5.05" />
                  </svg>
                  <strong>UV:</strong> {uvRec}
                </span>
              )}
            </h1>
          </div>
        </div>
      </header>

      {/* Notification Prompt */}
      {showPrompt && permission === "default" && (
        <div className="my-4 p-4 rounded-lg shadow-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-2xl">🔔</span>
              <div className="text-white">
                <p className="font-semibold">Get Air Quality Alerts</p>
                <p className="text-sm text-">
                  Stay informed about significant changes in air quality, UV,
                  and heat levels.
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setShowPrompt(false)}
                className="px-4 py-2 text-white hover:bg-gray-100 rounded hover:text-black"
              >
                Not Now
              </button>
              <button
                onClick={async () => {
                  const success = await requestPermission();
                  if (success) setShowPrompt(false);
                }}
                className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
              >
                Enable
              </button>
            </div>
          </div>
        </div>
      )}

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
                      <span className={`${colorClass} text-xl mb-1`}>
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
                      <span className={`${colorClass} text-xl mb-1`}>
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
                latest.temperature ? `${latest.temperature.toFixed(1)} °C` : "—"
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
                latest.temperature ? `${latest.temperature.toFixed(1)} °C` : "—"
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
                      <span className={`${colorClass} text-xl mb-1`}>
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

        {/* Charts + Map */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 ">
          <div className="col-span-1 flex flex-col justify-center items-center">
            <h3 className="text-xl font-bold text-white mb-3">
              Location:{" "}
              <span
                className={`underline underline-offset-8 ${locationDetails[activeLocation].colorClass} ${locationDetails[activeLocation].fontSize}`}
              >
                {activeLocation}
              </span>
            </h3>
            <CampusMap
              onMarkerClick={(loc) => setActiveLocation(loc as LocationKey)}
            />
          </div>

          <div className="col-span-1 lg:col-span-2 p-2 text-center ">
            <h3 className="text-xl font-semibold text-white mb-2">
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
                    className={`ml-2 font-bold ${getSeverityColor(uvSeverity)}`}
                  >
                    {latest.uv} UV
                  </span>
                  <span
                    className={`ml-2 font-bold ${getSeverityColor(
                      heatSeverity
                    )}`}
                  >
                    {latest.temperature
                      ? `${latest.temperature.toFixed(1)} °C`
                      : "—"}
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

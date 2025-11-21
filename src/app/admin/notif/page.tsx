"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FaArrowLeft, FaClock, FaBullhorn, FaPaperPlane } from "react-icons/fa";
import {
  collection,
  onSnapshot,
  orderBy,
  query,
  limit,
  where,
  Timestamp,
  getDocs,
  getDoc,
  doc,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";

// Auth + Firestore
import { auth, db } from "@/lib/firebase";
import { onAuthStateChanged, signOut as fbSignOut } from "firebase/auth";

// Types
export type LocationKey =
  | "Quadrangle"
  | "Falcon Bridge"
  | "SV Entrance / Parking Lot";

// Update the SensorRow type
export type SensorRow = {
  timeLabel: string;
  aqi: number;
  uv: number;
  temperature: number | null;
  humidity: number | null;
};

const collectionMap: Record<LocationKey, string> = {
  Quadrangle: "sensor_dataQuad",
  "Falcon Bridge": "sensor_datafalconbridge",
  "SV Entrance / Parking Lot": "sensor_data",
};

const locationDetails: Record<LocationKey, { title: string }> = {
  Quadrangle: { title: "Quadrangle" },
  "Falcon Bridge": { title: "Falcon Bridge" },
  "SV Entrance / Parking Lot": { title: "SV Entrance / Parking Lot" },
};

const locationKeys = Object.keys(locationDetails) as LocationKey[];

// Severity ranking
const severityOrder = ["low", "moderate", "high", "extreme", "critical"];

// Decide highest severity
function getHighestSeverity(severities: (string | undefined)[]): string {
  let highest = "low";
  severities.forEach((sev) => {
    if (!sev) return;
    const currentIndex = severityOrder.indexOf(sev.toLowerCase());
    const highestIndex = severityOrder.indexOf(highest);
    if (currentIndex > highestIndex) highest = sev.toLowerCase();
  });
  return highest;
}

// bg color
function getBgColorFromSeverity(severity: string): string {
  switch (severity.toLowerCase()) {
    case "low":
      return "bg-green-500";
    case "moderate":
      return "bg-[#FFD93D] text-black";
    case "high":
      return "bg-[#FF9A00]";
    case "extreme":
      return "bg-[#E62727]";
    case "critical":
      return "bg-black";
    default:
      return "bg-gray-400";
  }
}

// map severity to Tailwind colors
const getSeverityColor = (severity: string) => {
  switch (severity.toLowerCase()) {
    case "low":
    case "good":
      return "text-green-500";
    case "moderate":
    case "caution":
    case "normal":
      return "text-[#FFD93D]";
    case "high":
    case "caution":
      return "text-[#FF9A00]";
    case "extreme":
    case "extreme danger":
    case "unhealthy":
      return "text-[#FF3D00]";
    case "critical":
      return "text-purple-600";
    default:
      return "text-gray-500";
  }
};

interface SensorDocument {
  created_at: Timestamp;
  pm2_5: string | number;
  uv_index: string | number;
  temperature: string | number;
  humidity: string | number;
}

interface ApiError extends Error {
  message: string;
}
export default function AdminNotifPage() {
  const [clock, setClock] = useState<string>(new Date().toLocaleTimeString());
  const [selectedDate, setSelectedDate] = useState<string>(
    new Date().toISOString().split("T")[0]
  );
  const [selectedLocation, setSelectedLocation] = useState<LocationKey>(
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

  const [rows, setRows] = useState<SensorRow[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Recommendation state
  const [body, setBody] = useState("Loading...");
  const [severity, setSeverity] = useState("low");

  // Per-sensor severities
  const [aqiSeverity, setAqiSeverity] = useState("low");
  const [uvSeverity, setUvSeverity] = useState("low");
  const [heatSeverity, setHeatSeverity] = useState("low");

  // Notification composer
  const [title, setTitle] = useState("Health & Safety Alert");

  useEffect(() => {
    setTitle(`Health & Safety Alert - Location: ${selectedLocation}`);
  }, [selectedLocation]);

  // auto notification toggle state
  const [autoEnabled, setAutoEnabled] = useState(false);
  const [loadingToggle, setLoadingToggle] = useState(true);

  useEffect(() => {
    const fetchAutoSetting = async () => {
      try {
        const snap = await getDoc(doc(db, "autonotify", "notifications"));
        if (snap.exists()) {
          const data = snap.data();
          setAutoEnabled(data.autoSend ?? false);
        }
      } catch (error) {
        console.error("❌ Error loading auto notification setting:", error);
      } finally {
        setLoadingToggle(false);
      }
    };
    fetchAutoSetting();
  }, []);

  const toggleAutoNotifications = async () => {
    const newValue = !autoEnabled;
    setAutoEnabled(newValue);
    setLoadingToggle(true);

    try {
      await setDoc(
        doc(db, "autonotify", "notifications"),
        { autoSend: newValue, updatedAt: serverTimestamp() },
        { merge: true }
      );
      console.log("✅ Auto notifications set to:", newValue);
    } catch (error) {
      console.error("❌ Error updating Firestore:", error);
    } finally {
      setLoadingToggle(false); //
    }
  };

  // Fetch Firestore setting when the page loads
  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;

    if (autoEnabled) {
      interval = setInterval(async () => {
        console.log("⏰ Auto notification triggered");

        try {
          // Get the latest sensor data
          const resData = await fetch("/api/auto-notify");
          const jsonData = await resData.json();

          // Optionally re-use your manual sender:
          await fetch("/api/send-notifications", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              title: jsonData.title,
              body: jsonData.body,
            }),
          });

          console.log("📩 Auto notification sent successfully");
        } catch (err) {
          console.error("❌ Auto notification failed:", err);
        }
      }, 1 * 60 * 1000); // every 1 minute
    }

    return () => clearInterval(interval);
  }, [autoEnabled]);

  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  // Fetch sensor data
  useEffect(() => {
    setLoading(true);
    const collectionName = collectionMap[selectedLocation];

    const [y, m, d] = selectedDate.split("-").map(Number);
    const start = new Date(y, m - 1, d, 0, 0, 0, 0);
    const end = new Date(y, m - 1, d + 1, 0, 0, 0, 0);

    const qRef = query(
      collection(db, collectionName),
      where("created_at", ">=", Timestamp.fromDate(start)),
      where("created_at", "<", Timestamp.fromDate(end)),
      orderBy("created_at", "desc"),
      limit(1)
    );

    const unsub = onSnapshot(
      qRef,
      (snap) => {
        // Update the data mapping in useEffect
        const mapped: SensorRow[] = snap.docs.map((doc) => {
          const d = doc.data() as SensorDocument;
          const date = d?.created_at?.toDate?.() ?? new Date();

          return {
            timeLabel: date.toLocaleTimeString(),
            aqi: d?.pm2_5 != null ? Number(parseFloat(d.pm2_5.toString())) : 0,
            uv:
              d?.uv_index != null
                ? Number(parseFloat(d.uv_index.toString()))
                : 0,
            temperature:
              d?.temperature != null
                ? Number(parseFloat(d.temperature.toString()))
                : null,
            humidity:
              d?.humidity != null
                ? Number(parseFloat(d.humidity.toString()))
                : null,
          };
        });

        console.log("Latest readings:", mapped[0]);
        setRows(mapped);
        setLoading(false);
      },
      (error) => {
        console.error("Error fetching data:", error);
        setLoading(false);
      }
    );

    return () => unsub();
  }, [selectedLocation, selectedDate]);

  // Clock updater
  useEffect(() => {
    const id = setInterval(
      () => setClock(new Date().toLocaleTimeString()),
      1000
    );
    return () => clearInterval(id);
  }, []);

  // Compute recommendation
  useEffect(() => {
    // Emoji icons for notification messages
    const metricIcons: Record<string, string> = {
      AQI: "🌫️",
      UV: "🔆",
      Heat: "🌡️",
    };

    if (!rows.length) return;
    const latest = rows[0];

    (async () => {
      let messages: string[] = [];
      let aqiSev = "low",
        uvSev = "low",
        heatSev = "low";

      // In the recommendation useEffect, modify the value assignment and condition check:
      for (const cat of ["AQI", "UV", "Heat"]) {
        const snap = await getDocs(
          collection(db, "categories", cat, "thresholds")
        );
        snap.forEach((docSnap) => {
          const { min, max, recommendation, severity } = docSnap.data();

          // Safely get the value with null check
          const value =
            cat === "AQI"
              ? latest.aqi
              : cat === "UV"
              ? latest.uv
              : latest.temperature ?? null; // Use nullish coalescing for temperature

          // Only process if value is not null
          if (value !== null && value >= min && value <= max) {
            let displayValue =
              cat === "Heat"
                ? latest.temperature !== null
                  ? `${latest.temperature.toFixed(1)} °C`
                  : "N/A"
                : value.toFixed(1);

            messages.push(
              `${metricIcons[cat]} ${cat}: ${recommendation} (Current: ${displayValue})`
            );

            if (cat === "AQI") aqiSev = severity.toLowerCase();
            if (cat === "UV") uvSev = severity.toLowerCase();
            if (cat === "Heat") heatSev = severity.toLowerCase();
          }
        });
      }

      // Combination rules
      const comboSnap = await getDocs(
        collection(db, "categories", "combinations", "rules")
      );
      comboSnap.forEach((docSnap) => {
        const {
          heat_min,
          heat_max,
          uv_min,
          uv_max,
          aqi_min,
          aqi_max,
          recommendation,
          severity,
        } = docSnap.data();

        if (
          latest.temperature !== null && // Add null check for temperature
          latest.temperature >= heat_min &&
          latest.temperature <= heat_max &&
          latest.uv >= uv_min &&
          latest.uv <= uv_max &&
          latest.aqi >= aqi_min &&
          latest.aqi <= aqi_max
        ) {
          messages = [recommendation];
          aqiSev = severity.toLowerCase();
          uvSev = severity.toLowerCase();
          heatSev = severity.toLowerCase();
        }
      });

      setAqiSeverity(aqiSev);
      setUvSeverity(uvSev);
      setHeatSeverity(heatSev);

      setBody(messages.join("\n") || "✅ All conditions are safe.");
      setSeverity(getHighestSeverity([aqiSev, uvSev, heatSev]));
    })();
  }, [rows, selectedLocation]);

  async function sendNotification() {
    if (!title || !body) return;
    setSending(true);
    setResult(null);

    try {
      const res = await fetch("/api/send-notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, body }),
      });
      const json = await res.json();
      if (res.ok) {
        setResult(
          `✅ Sent: ${json.successCount} succeeded, ${json.failureCount} failed`
        );
      } else {
        setResult(`❌ Error: ${json.error || "Failed to send"}`);
      }
    } catch (error: unknown) {
      const err = error as ApiError;
      setResult(`❌ Exception: ${err.message}`);
    } finally {
      setSending(false);
    }
  }

  const latest = rows.length > 0 ? rows[0] : null;

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
        <nav className="flex flex-col mt-4">
          {/* Dashboard */}
          <Link
            href="/admin"
            className="flex items-center gap-2.5 py-2.5 px-3 rounded-lg mb-1.5 transition-all text-[#e4e8f0] hover:bg-[#1d3557] hover:text-[#38bdf8]"
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
          {/* AQI */}
          <Link
            href="/admin/aqi"
            className="flex items-center gap-2.5 py-2.5 px-3 rounded-lg mb-1.5 transition-all text-[#e4e8f0] hover:bg-[#1d3557] hover:text-[#38bdf8]"
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
            className="flex items-center gap-2.5 py-2.5 px-3 rounded-lg mb-1.5 transition-all text-[#e4e8f0] hover:bg-[#1d3557] hover:text-[#38bdf8]"
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
            className="flex items-center gap-2.5 py-2.5 px-3 rounded-lg mb-1.5 transition-all text-[#e4e8f0] hover:bg-[#1d3557] hover:text-[#38bdf8]"
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
          {/* Notifications - active */}
          <Link
            href="/admin/notif"
            className="flex items-center gap-2.5 py-2.5 px-3 rounded-lg mb-1.5 transition-all bg-[#1d3557] text-[#38bdf8]"
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
      <div className="flex-1">
        <div className="p-5">
          <header className="mt-3.5 shadow-xl rounded-xl">
            <div className="flex justify-around p-2 gap-3 items-center">
              {/* Clock */}
              <div className="ml-2 my-2 self-center">
                <div className="flex items-center gap-2">
                  <FaClock className="text-2xl text-[#FFB703]" />
                  <div className="flex items-center gap-2 text-[#e4e8f0] bg-[#071327] rounded-xl px-4 py-2 shadow max-w-50">
                    <div className="text-lg font-medium text-white">
                      Adamson University
                    </div>
                    <div className="text-2xl font-bold text-white">{clock}</div>
                  </div>
                </div>
              </div>

              {/* Date */}
              <div className="flex items-end gap-4 text-black">
                <div>
                  <label className="block text-sm font-medium text-white">
                    Select Date
                  </label>
                  <input
                    type="date"
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    className="border border-gray-300 rounded-md px-3 py-1"
                  />
                </div>
                {/* Location */}
                <div>
                  <label className="block text-sm font-medium text-white">
                    Location
                  </label>
                  <select
                    value={selectedLocation}
                    onChange={(e) =>
                      setSelectedLocation(e.target.value as LocationKey)
                    }
                    className="border border-gray-300 rounded-md px-3 py-1"
                  >
                    {locationKeys.map((k) => (
                      <option key={k} value={k}>
                        {locationDetails[k].title}
                      </option>
                    ))}
                  </select>
                </div>
                {/* Auto Notifications Toggle
                <div>
                  <label className="block text-sm font-medium text-white">
                    Notifications
                  </label>
                  <div className="bg-white px-3 py-1 rounded-md ">
                    <span className="text-black font-medium px-2 py-2">
                      {autoEnabled
                        ? "Auto Notifications ON"
                        : "Auto Notifications OFF"}
                    </span>

                    <button
                      onClick={toggleAutoNotifications}
                      disabled={loadingToggle}
                      className={` relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-300 ${
                        autoEnabled ? "bg-green-500" : "bg-gray-400"
                      } ${
                        loadingToggle ? "opacity-50 cursor-not-allowed" : ""
                      }`}
                    >
                      <span
                        className={` inline-block h-5 w-5 transform rounded-full bg-white transition-transform duration-300 ${
                          autoEnabled ? "translate-x-5" : "translate-x-1"
                        }`}
                      />
                    </button>
                  </div>
                </div> */}
              </div>
            </div>
          </header>
        </div>

        {/* Recommendation Alert */}
        <div className="mx-5">
          <div
            className={`${getBgColorFromSeverity(
              severity
            )}  font-bold px-6 py-3 rounded-xl shadow-lg flex items-center gap-2`}
          >
            <FaBullhorn />
            <span>{body || "Loading recommendation..."}</span>
          </div>
        </div>

        {/* 3 Cards + Notification */}
        <div className="grid gap-6 md:grid-cols-3 mx-5 mt-6">
          {/* Air Quality */}
          <Metric
            label="Air Quality"
            value={latest ? `${latest.aqi.toFixed(1)} AQI` : "-"}
            color={getSeverityColor(aqiSeverity)}
            icon={
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="#ffeb3b"
                strokeWidth="2"
                className="w-5 h-5 opacity-90 flex-shrink-0"
              >
                <path d="M3 15a4 4 0 014-4h1a5 5 0 119 0h1a4 4 0 110 8H7a4 4 0 01-4-4z" />
              </svg>
            }
          />
          {/* UV Intensity */}
          <Metric
            label="UV Intensity"
            value={latest ? `${latest.uv.toFixed(1)} UV` : "-"}
            color={getSeverityColor(uvSeverity)}
            icon={
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="#a78bfa"
                strokeWidth="2"
                className="w-5 h-5 opacity-90 flex-shrink-0"
              >
                <circle cx="12" cy="12" r="5" />
                <path d="M12 1v2m0 18v2m11-11h-2M3 12H1m16.95-6.95l-1.41 1.41M6.46 17.54l-1.41 1.41M17.54 17.54l1.41 1.41M6.46 6.46L5.05 5.05" />
              </svg>
            }
          />
          {/* Temperature / Heat Index */}
          <Metric
            label="Temperature"
            value={latest ? `${latest.temperature?.toFixed(1)} °C` : "-"}
            color={getSeverityColor(heatSeverity)}
            icon={
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="#ff9800"
                strokeWidth="2"
                className="w-5 h-5 opacity-90 flex-shrink-0"
              >
                <path d="M14 14.76V5a2 2 0 10-4 0v9.76a4 4 0 104 0z" />
              </svg>
            }
          />
        </div>

        {/* Notification Composer */}
        <section className=" bg-white rounded-2xl shadow-xl border m-10   border-[#A7A9AC] overflow-hidden md:col-span-1">
          <div className="px-5 py-4 border-b border-[#A7A9AC] bg-blue-50">
            <h2 className="text-lg font-semibold text-black">
              Compose Notification
            </h2>
          </div>
          <div className=" px-5 py-5 space-y-4">
            <input
              type="text"
              placeholder="Notification Title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full text-black bg-white border border-[#A7A9AC] rounded-lg px-4 py-2 shadow-sm focus:outline-none focus:ring-2 focus:ring-[#0067B1]"
            />
            <textarea
              placeholder="Notification Body"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              className="text-black w-full h-auto bg-white border border-[#A7A9AC] rounded-lg px-4 py-2 shadow-sm focus:outline-none focus:ring-2 focus:ring-[#0067B1]"
              rows={8}
            />
            <div className="flex items-center justify-end">
              <button
                onClick={sendNotification}
                disabled={sending || !rows.length}
                className=" inline-flex items-center gap-2 bg-[#0067B1] hover:bg-[#005b95] disabled:bg-[#0067B1]/60 text-white px-4 py-2 rounded-lg shadow"
              >
                <FaPaperPlane className="text-white" />
                {sending ? "Sending..." : "Send"}
              </button>
            </div>
          </div>
        </section>

        {/* Result */}
        {result && (
          <div className="m-10 px-4 py-3 rounded-2xl border shadow-xl bg-gray-50 border-[#A7A9AC] text-gray-800">
            {result}
          </div>
        )}

        {/* Use loading state in UI */}
        {loading && <div className="text-center py-4">Loading...</div>}
      </div>
    </div>
  );
}

function Metric({
  label,
  value,
  color,
  icon,
  subValue,
}: {
  label: string;
  value: string;
  color: string;
  icon?: React.ReactNode;
  subValue?: string;
}) {
  const displayValue = value === "-" || !value ? "No data" : value;
  return (
    <div className="rounded-xl bg-white px-4 py-5 border border-[#A7A9AC] shadow-sm flex flex-col items-center justify-center">
      <div className="flex items-center gap-2 text-md font-medium text-gray-700">
        {icon}
        {label}
      </div>
      <div className={`text-2xl font-bold ${color}`}>
        {displayValue}
        {subValue && (
          <span className={`${color} text-sm  ml-1`}>{subValue}</span>
        )}
      </div>
    </div>
  );
}

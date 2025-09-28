"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { FaArrowLeft, FaClock } from "react-icons/fa";
import { db } from "@/lib/firebase";
import {
  collection,
  onSnapshot,
  orderBy,
  query,
  limit,
  where,
  Timestamp,
} from "firebase/firestore";

// Types
export type LocationKey =
  | "Quadrangle"
  | "Falcon Bridge"
  | "SV Entrance / Parking Lot";

export type SensorRow = {
  timeLabel: string;
  aqi: number; // pm2_5
  uv: number;
  heat: number;
};

// Add interface for Firestore document data
interface SensorData {
  created_at: Timestamp;
  pm2_5: string | number;
  uv_index: string | number;
  heat_index: string | number;
}

// Map locations to Firestore collections
const collectionMap: Record<LocationKey, string> = {
  Quadrangle: "sensor_dataQuad",
  "Falcon Bridge": "sensor_datafalconbridge",
  "SV Entrance / Parking Lot": "sensor_data",
};

// Location details for styling
const locationDetails: Record<
  LocationKey,
  { title: string; colorClass: string; fontSize: string }
> = {
  Quadrangle: {
    title: "Quadrangle",
    colorClass: "text-green-500",
    fontSize: "text-2xl",
  },
  "Falcon Bridge": {
    title: "Falcon Bridge",
    colorClass: "text-red-500",
    fontSize: "text-2xl",
  },
  "SV Entrance / Parking Lot": {
    title: "SV Entrance / Parking Lot",
    colorClass: "text-blue-500",
    fontSize: "text-1xl",
  },
};

const locationKeys = Object.keys(locationDetails) as LocationKey[];

export default function AdminAQIPage() {
  const [clock, setClock] = useState<string>(new Date().toLocaleTimeString());
  const [selectedDate, setSelectedDate] = useState<string>(
    new Date().toISOString().split("T")[0]
  );
  const [selectedLocation, setSelectedLocation] = useState<LocationKey>(
    "SV Entrance / Parking Lot"
  );

  const [rows, setRows] = useState<SensorRow[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Fetch directly from Firestore (date-filtered, newest-first)
  useEffect(() => {
    setLoading(true);

    const collectionName = collectionMap[selectedLocation];

    // Build [start, end) for the selected date
    const [y, m, d] = selectedDate.split("-").map(Number);
    const start = new Date(y, m - 1, d, 0, 0, 0, 0);
    const end = new Date(y, m - 1, d + 1, 0, 0, 0, 0);

    const qRef = query(
      collection(db, collectionName),
      where("created_at", ">=", Timestamp.fromDate(start)),
      where("created_at", "<", Timestamp.fromDate(end)),
      orderBy("created_at", "desc"), // newest first
      limit(150)
    );

    const unsub = onSnapshot(
      qRef,
      (snap) => {
        const mapped: SensorRow[] = snap.docs.map((doc) => {
          const d = doc.data() as SensorData;
          const date = d?.created_at?.toDate?.() ?? new Date();
          return {
            timeLabel: date.toLocaleTimeString(),
            aqi: d?.pm2_5 != null ? parseFloat(d.pm2_5.toString()) : 0,
            uv: d?.uv_index != null ? parseFloat(d.uv_index.toString()) : 0,
            heat:
              d?.heat_index != null ? parseFloat(d.heat_index.toString()) : 0,
          };
        });

        setRows(mapped);
        setLoading(false);
      },
      () => setLoading(false)
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

  // PM2.5 categories
  const enhanced = useMemo(
    () =>
      rows.map((r) => {
        const pm = typeof r.aqi === "number" ? r.aqi : 0;

        const category =
          pm <= 50
            ? "Good"
            : pm <= 100
            ? "Moderate"
            : pm <= 150
            ? "USG"
            : pm <= 200
            ? "Unhealthy"
            : pm <= 250.4
            ? "Very Unhealthy"
            : "Hazardous";

        const colorClass =
          category === "Good"
            ? "text-green-600"
            : category === "Moderate"
            ? "text-yellow-600"
            : category === "USG"
            ? "text-orange-600"
            : category === "Unhealthy"
            ? "text-red-600"
            : category === "Very Unhealthy"
            ? "text-purple-600"
            : "text-rose-700";

        return { ...r, category, colorClass };
      }),
    [rows]
  );

  const [showRaw, setShowRaw] = useState(false);

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
          <Link
            href="/admin/aqi"
            className="flex items-center gap-2.5 py-2.5 px-3 rounded-lg mb-1.5 transition-all bg-[#1d3557] text-[#38bdf8]"
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
          <Link
            href="/admin/notif"
            className="flex items-center gap-2.5 py-2.5 px-3 rounded-lg mb-1.5 transition-all text-[#e4e8f0] hover:bg-[#1d3557] hover:text-[#38bdf8]"
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
        <div className="text-xs text-[#6ea8d9]">© Adamson University 2025</div>
      </aside>

      {/* Main content */}
      <div className="flex-1">
        <div className="p-5">
          <header className="mt-3.5 shadow-xl rounded-xl">
            <div className="flex justify-around p-2 gap-3 items-center">
              {/* Clock */}
              <div className="ml-2 my-2 self-center ">
                <div className="flex items-center gap-2">
                  <FaClock className="text-2xl text-[#FFB703]" />
                  <div className="flex items-center gap-2 text-[#e4e8f0] bg-[#071327] rounded-xl px-4 py-2 shadow max-w-50">
                    <div className="text-2xl font-bold text-white">{clock}</div>
                  </div>
                </div>
              </div>

              {/* Filters */}
              <div className="flex items-end gap-4 text-black">
                <div>
                  <label
                    htmlFor="datePicker"
                    className="block text-sm font-medium text-white"
                  >
                    Select Date
                  </label>
                  <input
                    type="date"
                    id="datePicker"
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    className="border border-gray-300 rounded-md px-3 py-1"
                  />
                </div>
                <div>
                  <label
                    htmlFor="location"
                    className="block text-sm font-medium text-white"
                  >
                    Location
                  </label>
                  <select
                    id="location"
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
              </div>
            </div>
          </header>
        </div>

        {/* Table card */}
        <div className=" mt-6 rounded-xl shadow p-4 mx-5 text-white">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold">
              Air Quality (PM2.5) for {selectedDate}
            </h2>
            <div className="flex items-center gap-3">
              <span className="text-sm text-white">
                {locationDetails[selectedLocation].title} • {enhanced.length}{" "}
                records
              </span>
              <button
                type="button"
                onClick={() => setShowRaw((v) => !v)}
                className="text-xs border border-gray-300 rounded px-2 py-1 hover:bg-[#1d3557] hover:text-[#38bdf8]"
              >
                {showRaw ? "Hide raw" : "Show raw"}
              </button>
            </div>
          </div>

          {showRaw && (
            <div className="mb-4  border border-gray-200 rounded p-3 max-h-80 overflow-auto">
              <pre className="text-xs whitespace-pre-wrap break-words">
                {JSON.stringify(rows, null, 2)}
              </pre>
            </div>
          )}

          <div className="overflow-x-auto rounded-lg border border-gray-200">
            <table className="min-w-full table-auto text-sm ">
              <thead>
                <tr className=" bg-blue-200 text-black">
                  <th className="px-4 py-2 text-left">Time</th>
                  <th className="px-4 py-2 text-right">PM2.5 (µg/m³)</th>
                  <th className="px-4 py-2 text-center">Category</th>
                </tr>
              </thead>
              <tbody className="">
                {loading && (
                  <tr>
                    <td colSpan={3} className="py-6 text-center text-white">
                      Loading...
                    </td>
                  </tr>
                )}
                {!loading && enhanced.length === 0 && (
                  <tr>
                    <td colSpan={3} className="py-6 text-center text-white">
                      No data for this date and location.
                    </td>
                  </tr>
                )}
                {!loading &&
                  enhanced.length > 0 &&
                  enhanced.map((row, idx) => (
                    <tr
                      key={`${row.timeLabel}-${idx}`}
                      className=":hover:bg-[#1d3557] hover:text-[#38bdf8] transition"
                    >
                      <td className="px-4 py-2 whitespace-nowrap">
                        {row.timeLabel}
                      </td>
                      <td className="px-4 py-2 text-right">
                        {Number.isFinite(row.aqi)
                          ? (row.aqi as number).toFixed(1)
                          : "-"}
                      </td>
                      <td className="px-4 py-2 text-center">
                        <span className={`font-semibold ${row.colorClass}`}>
                          {row.category}
                        </span>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

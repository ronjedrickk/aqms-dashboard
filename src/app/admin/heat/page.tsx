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
  aqi: number;
  uv: number;
  heat: number;
  temperature?: number;
  humidity?: number;
};

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

// Helpers to coerce numbers and compute Heat Index
// Add interfaces for type safety
interface SensorData {
  created_at: Timestamp;
  pm2_5: string | number;
  uv_index: string | number;
  heat_index: string | number;
  temperature: string | number;
  humidity: string | number;
}

// Update the toNum helper with proper typing
const toNum = (v: string | number | null | undefined): number | null => {
  if (v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

function heatIndexCelsius(tempC?: number | null, rh?: number | null) {
  if (tempC == null || rh == null) return null;
  const T = (tempC * 9) / 5 + 32;
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

export default function AdminHeatPage() {
  const [clock, setClock] = useState<string>(new Date().toLocaleTimeString());
  const [selectedDate, setSelectedDate] = useState<string>(
    new Date().toISOString().split("T")[0]
  );
  const [selectedLocation, setSelectedLocation] = useState<LocationKey>(
    "SV Entrance / Parking Lot"
  );

  const [rows, setRows] = useState<SensorRow[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Fetch directly from Firestore (newest-first, filtered by selected date)
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
      limit(150)
    );

    const unsub = onSnapshot(
      qRef,
      (snap) => {
        const mapped: SensorRow[] = snap.docs.map((doc) => {
          const d = doc.data() as SensorData;
          const date = d?.created_at?.toDate?.() ?? new Date();
          const timeLabel = date.toLocaleTimeString();

          // Safely coerce values
          const pm25 = toNum(d?.pm2_5) ?? 0;
          const uv = toNum(d?.uv_index) ?? 0;
          const temperature = toNum(d?.temperature);
          const humidity = toNum(d?.humidity);
          const hiFromDoc = toNum(d?.heat_index);
          const hiComputed = heatIndexCelsius(temperature, humidity);
          const heat = hiFromDoc ?? hiComputed ?? 0;

          return {
            timeLabel,
            aqi: pm25,
            uv,
            heat,
            temperature: temperature ?? undefined,
            humidity: humidity ?? undefined,
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

  // Categorize Heat Index (°C)
  const enhanced = useMemo(
    () =>
      rows.map((r) => {
        const hi = typeof r.heat === "number" ? r.heat : 0;

        let category: "Safe" | "Caution" | "Extreme Caution" | "Danger" =
          "Safe";
        let colorClass = "text-green-500";

        if (hi > 41) {
          category = "Danger";
          colorClass = "text-red-500";
        } else if (hi > 32) {
          category = "Extreme Caution";
          colorClass = "text-yellow-500";
        } else if (hi > 27) {
          category = "Caution";
          colorClass = "text-yellow-300";
        }

        return { ...r, category, colorClass };
      }),
    [rows]
  );

  const [showRaw, setShowRaw] = useState(false);

  return (
    <div className="bg-blue-100 font-sans min-h-screen">
      <div className="p-5">
        <header className="mt-3.5 shadow-xl bg-white rounded-xl">
          <div className="flex justify-around p-2 gap-3 items-center">
            {/* Back */}
            <Link
              href="/admin"
              className="text-xl font-medium bg-blue-500 text-white px-4 py-2 rounded-md hover:bg-blue-600 transition flex items-center"
            >
              <span className="mr-2">
                <FaArrowLeft />
              </span>
              Back
            </Link>

            {/* Clock */}
            <div className="ml-2 my-2 self-center">
              <div className="flex items-center gap-2">
                <FaClock className="text-2xl text-[#FFB703]" />
                <div className="bg-[#0067B1] rounded-lg shadow text-center px-4 py-2 border border-[#A7A9AC]">
                  <p className="text-lg font-medium text-white">
                    Adamson University
                  </p>
                  <div className="text-2xl font-bold text-white">{clock}</div>
                </div>
              </div>
            </div>

            {/* Nav */}
            <div className="flex flex-row text-black">
              <div className="self-center">
                <nav className="mt-3 text-center space-x-8 text-2xl">
                  <Link
                    href="/admin/aqi"
                    className="hover:underline-offset-8 hover:underline"
                  >
                    Air Quality
                  </Link>
                  <Link
                    href="/admin/uv"
                    className="hover:underline-offset-8 hover:underline"
                  >
                    UV Intensity
                  </Link>
                  <Link
                    href="/admin/heat"
                    className="hover:underline-offset-8 hover:underline underline underline-offset-8"
                  >
                    Heat Index
                  </Link>
                  <Link
                    href="/admin/notif"
                    className="hover:underline-offset-8 hover:underline"
                  >
                    Notification
                  </Link>
                </nav>
              </div>
            </div>

            {/* Filters */}
            <div className="flex items-end gap-4 text-black">
              <div>
                <label
                  htmlFor="datePicker"
                  className="block text-sm font-medium text-gray-700"
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
                  className="block text-sm font-medium text-gray-700"
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
      <div className="bg-white mt-6 rounded-xl shadow p-4 mx-5 text-black">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold">Heat Index for {selectedDate}</h2>
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-600">
              {locationDetails[selectedLocation].title} • {enhanced.length}{" "}
              records
            </span>
            <button
              type="button"
              onClick={() => setShowRaw((v) => !v)}
              className="text-xs bg-gray-100 border border-gray-300 rounded px-2 py-1 hover:bg-gray-200"
            >
              {showRaw ? "Hide raw" : "Show raw"}
            </button>
          </div>
        </div>

        {showRaw && (
          <div className="mb-4 bg-gray-50 border border-gray-200 rounded p-3 max-h-80 overflow-auto">
            <pre className="text-xs whitespace-pre-wrap break-words">
              {JSON.stringify(rows, null, 2)}
            </pre>
          </div>
        )}

        <div className="overflow-x-auto rounded-lg border border-gray-200">
          <table className="min-w-full table-auto text-sm">
            <thead>
              <tr className="bg-blue-200 text-gray-800">
                <th className="px-4 py-2 text-left">Time</th>
                <th className="px-4 py-2 text-right">Temperature (°C)</th>
                <th className="px-4 py-2 text-right">Humidity (%)</th>
                <th className="px-4 py-2 text-right">Heat Index (°C)</th>
                <th className="px-4 py-2 text-center">Category</th>
              </tr>
            </thead>
            <tbody className="bg-white">
              {loading && (
                <tr>
                  <td colSpan={5} className="py-6 text-center text-gray-500">
                    Loading...
                  </td>
                </tr>
              )}
              {!loading && enhanced.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-6 text-center text-gray-500">
                    No data for this date and location.
                  </td>
                </tr>
              )}
              {!loading &&
                enhanced.length > 0 &&
                enhanced.map((row, idx) => (
                  <tr
                    key={`${row.timeLabel}-${idx}`}
                    className="hover:bg-blue-50 transition"
                  >
                    <td className="px-4 py-2 whitespace-nowrap">
                      {row.timeLabel}
                    </td>
                    <td className="px-4 py-2 text-right">
                      {row.temperature !== undefined
                        ? row.temperature.toFixed(1)
                        : "-"}
                    </td>
                    <td className="px-4 py-2 text-right">
                      {row.humidity !== undefined
                        ? row.humidity.toFixed(1)
                        : "-"}
                    </td>
                    <td className="px-4 py-2 text-right">
                      {Number.isFinite(row.heat) ? row.heat.toFixed(1) : "-"}
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
  );
}

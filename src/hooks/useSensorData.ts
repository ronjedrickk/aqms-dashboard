"use client";
import { useEffect, useState } from "react";
import {
  collection,
  onSnapshot,
  orderBy,
  query,
  limit,
  Timestamp,
  DocumentData,
  QueryDocumentSnapshot,
} from "firebase/firestore";
import { db } from "@/lib/firebase";

// sensor document data
interface SensorDocument {
  created_at: Timestamp;
  pm2_5: string | number;
  uv_index: string | number;
  heat_index: string | number;
  temperature?: string | number;
  humidity?: string | number;
}

export type SensorRow = {
  timeLabel: string;
  aqi: number;
  uv: number;
  heat: number;
  temperature?: number;
};

export type LocationKey =
  | "Quadrangle"
  | "Falcon Bridge"
  | "SV Entrance / Parking Lot";

const collectionMap: Record<LocationKey, string> = {
  Quadrangle: "sensor_dataQuad",
  "Falcon Bridge": "sensor_datafalconbridge",
  "SV Entrance / Parking Lot": "sensor_data",
};

// Compute heat index
function heatIndexCelsius(tempC?: number | null, rh?: number | null) {
  if (tempC == null || rh == null) return tempC ?? 0;
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

export function useSensorData(
  location: LocationKey | null,
  count = 20 // default window size
) {
  const [rows, setRows] = useState<SensorRow[]>([]);
  const [latest, setLatest] = useState<SensorRow | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!location) {
      setRows([]);
      setLatest(null);
      setLoading(false);
      return;
    }

    const collectionName = collectionMap[location];
    const q = query(
      collection(db, collectionName),
      orderBy("created_at", "desc"),
      limit(count)
    );

    setLoading(true);
    const unsub = onSnapshot(
      q,
      (snap) => {
        const mapped: SensorRow[] = snap.docs.map(
          (doc: QueryDocumentSnapshot<DocumentData>) => {
            try {
              const d = doc.data() as SensorDocument;
              const date = d?.created_at?.toDate
                ? d.created_at.toDate()
                : new Date();

              //  Asia/Manila time
              const timeLabel = date.toLocaleTimeString("en-PH", {
                timeZone: "Asia/Manila",
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit",
                hour12: true,
              });

              const temperature =
                d?.temperature != null
                  ? parseFloat(d.temperature.toString())
                  : null;
              const humidity =
                d?.humidity != null ? parseFloat(d.humidity.toString()) : null;

              const heat =
                d?.heat_index != null
                  ? parseFloat(d.heat_index.toString())
                  : heatIndexCelsius(temperature, humidity) ?? temperature ?? 0;

              return {
                timeLabel,
                aqi: d?.pm2_5 != null ? parseFloat(d.pm2_5.toString()) : 0,
                uv: d?.uv_index != null ? parseFloat(d.uv_index.toString()) : 0,
                heat:
                  typeof heat === "number" && !Number.isNaN(heat) ? heat : 0,
                temperature: temperature ?? undefined,
              };
            } catch (err) {
              console.error("Sensor data parse error:", err, doc.data());
              return {
                timeLabel: "Invalid",
                aqi: 0,
                uv: 0,
                heat: 0,
                temperature: undefined,
              };
            }
          }
        );

        const chronological = mapped.reverse();
        setRows(chronological);
        setLatest(chronological[chronological.length - 1] ?? null);
        setLoading(false);
      },
      () => setLoading(false)
    );

    return () => unsub();
  }, [location, count]);

  return { rows, latest, loading };
}

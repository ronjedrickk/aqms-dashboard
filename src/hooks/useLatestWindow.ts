"use client";

import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import {
  collection,
  query,
  orderBy,
  limit,
  onSnapshot,
  Timestamp,
} from "firebase/firestore";

// Update interface with Firestore Timestamp
interface SensorReading {
  created_at: Timestamp; // Changed from Date to Timestamp
  pm2_5: number;
  uv_index: number;
  heat_index: number;
  temperature?: number;
  humidity?: number;
}

interface ProcessedReading {
  created_at: Date;
  pm2_5: number;
  uv_index: number;
  heat_index: number;
  temperature?: number;
  humidity?: number;
}

export function useLatestWindow(collectionName: string | null, count = 8) {
  const [readings, setReadings] = useState<ProcessedReading[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!collectionName) {
      setReadings([]);
      setLoading(false);
      return;
    }
    setLoading(true);

    const qRef = query(
      collection(db, collectionName),
      orderBy("created_at", "desc"),
      limit(count)
    );
    const unsub = onSnapshot(
      qRef,
      (snap) => {
        const mapped = snap.docs.map((doc) => {
          const data = doc.data() as SensorReading;
          const date = data.created_at?.toDate() ?? new Date();

          return {
            created_at: date,
            pm2_5: Number(data.pm2_5) || 0,
            uv_index: Number(data.uv_index) || 0,
            heat_index: Number(data.heat_index) || 0,
            temperature: data.temperature
              ? Number(data.temperature)
              : undefined,
            humidity: data.humidity ? Number(data.humidity) : undefined,
          };
        });
        setReadings(mapped.reverse()); // chronological for charts
        setLoading(false);
      },
      () => setLoading(false)
    );

    return () => unsub();
  }, [collectionName, count]);

  return { readings, loading };
}

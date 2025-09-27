"use client";
import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import {
  collection,
  query,
  orderBy,
  limit,
  onSnapshot,
  DocumentData,
} from "firebase/firestore";

export type SensorRow = {
  timeLabel: string;
  aqi: number;
  uv: number;
  heat: number;
};

// Explicit type for Firestore sensor documents
interface FirestoreSensorDoc extends DocumentData {
  created_at?: { toDate?: () => Date };
  pm2_5?: number | string;
  uv_index?: number | string;
  heat_index?: number | string;
}

export function useLatestWindow(collectionName: string | null, count = 8) {
  const [rows, setRows] = useState<SensorRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!collectionName) {
      setRows([]);
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
        const mapped: SensorRow[] = snap.docs.map((doc) => {
          const d = doc.data() as FirestoreSensorDoc;
          const date = d?.created_at?.toDate?.() ?? new Date();
          return {
            timeLabel: date.toLocaleTimeString(),
            aqi: Number(d?.pm2_5 ?? 0),
            uv: Number(d?.uv_index ?? 0),
            heat: Number(d?.heat_index ?? 0),
          };
        });
        setRows(mapped.reverse());
        setLoading(false);
      },
      () => setLoading(false)
    );
    return () => unsub();
  }, [collectionName, count]);

  return { rows, loading };
}

interface CacheData {
  value: number | null;
  source?: string;
  locationName?: string;
  lastUpdated?: number;
}

interface DataCache {
  aqi: CacheData;
  uv: CacheData;
  heat: CacheData;
}

interface UpdateCacheParams {
  key: keyof DataCache;
  value: number | null;
  source?: string;
  locationName?: string;
}

// Initialize cache with proper types
const cache: DataCache = {
  aqi: { value: null },
  uv: { value: null },
  heat: { value: null },
};

// Update the function signature with proper types
export function getCache(): DataCache {
  return cache;
}

export function updateCache({
  key,
  value,
  source,
  locationName,
}: UpdateCacheParams): void {
  if (!cache[key]) return;

  cache[key] = {
    value,
    source,
    locationName,
    lastUpdated: Date.now(),
  };
}

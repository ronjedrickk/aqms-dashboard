"use client";
import { useState, useEffect } from "react";
import {
  Query,
  DocumentData,
  QuerySnapshot,
  Timestamp,
  onSnapshot,
} from "firebase/firestore";

// Strongly typed sensor reading
interface SensorReading {
  created_at: Timestamp;
  pm2_5: number;
  uv_index: number;
  heat_index: number;
  temperature?: number;
  humidity?: number;
}

export function useLatestReading(queryRef: Query<DocumentData>) {
  const [latest, setLatest] = useState<SensorReading | null>(null);

  useEffect(() => {
    const unsubscribe = onSnapshot(
      queryRef,
      (snapshot: QuerySnapshot<DocumentData>) => {
        if (snapshot.empty) return;

        // Firestore data with explicit type checks
        const raw = snapshot.docs[0].data();

        if (!raw.created_at || !(raw.created_at instanceof Timestamp)) {
          console.warn("⚠️ Missing or invalid created_at field:", raw);
          return;
        }

        const docData: SensorReading = {
          created_at: raw.created_at,
          pm2_5: Number(raw.pm2_5) || 0,
          uv_index: Number(raw.uv_index) || 0,
          heat_index: Number(raw.heat_index) || 0,
          temperature: raw.temperature ? Number(raw.temperature) : undefined,
          humidity: raw.humidity ? Number(raw.humidity) : undefined,
        };

        setLatest(docData);
      }
    );

    return () => unsubscribe();
  }, [queryRef]);

  return latest;
}

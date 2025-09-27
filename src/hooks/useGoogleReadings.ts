"use client";

import { useEffect, useState } from "react";

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
  error?: string;
}

export function useGoogleReadings() {
  const [data, setData] = useState<GoogleData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch("/api/google-readings"); // ✅ relative path
        const json = await res.json();
        setData(json);
      } catch (err) {
        console.error("❌ Failed to fetch readings:", err);
        setData({ error: "Failed to fetch readings" } as GoogleData);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  return { data, loading };
}

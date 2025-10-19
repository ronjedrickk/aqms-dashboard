"use client";
import { useEffect, useState } from "react";

export function useClock() {
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    // only on the client
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  return now;
}

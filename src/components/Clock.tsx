"use client";
import { useEffect, useState } from "react";

export default function Clock() {
  const [time, setTime] = useState<string>("");

  useEffect(() => {
    // update time every second
    const updateClock = () => {
      const now = new Date();
      setTime(now.toLocaleTimeString());
    };

    updateClock();
    const interval = setInterval(updateClock, 1000);

    return () => clearInterval(interval);
  }, []);

  // Don't render anything until time is set
  if (!time) return null;

  return (
    <div className="flex justify-center items-center h-screen bg-gray-100">
      <div className="text-5xl font-mono text-white">{time}</div>
    </div>
  );
}

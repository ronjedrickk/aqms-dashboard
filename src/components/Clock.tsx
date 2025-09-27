"use client";
import { useEffect, useState } from "react";

export default function Clock() {
  const [time, setTime] = useState<string>("");

  useEffect(() => {
    // Function to update time every second
    const updateClock = () => {
      const now = new Date();
      setTime(now.toLocaleTimeString());
    };

    updateClock(); // Initialize immediately
    const interval = setInterval(updateClock, 1000);

    return () => clearInterval(interval);
  }, []);

  // Don't render anything until time is set (avoids hydration mismatch)
  if (!time) return null;

  return (
    <div className="flex justify-center items-center h-screen bg-gray-100">
      <div className="text-5xl font-mono text-white">{time}</div>
    </div>
  );
}

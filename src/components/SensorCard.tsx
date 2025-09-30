"use client";
import React from "react";
import type { SeverityLevel } from "@/types/severity";

type ReadingType = "UV" | "Heat" | "AQI";

export function SensorCard({
  title,
  value,
  icon,
  iconsapiValue,
  severity,
  apiValue,
  location,
  source,
  children,
}: {
  title: string;
  value: string;
  icon: React.ReactNode;
  iconsapiValue?: React.ReactNode;
  severity: SeverityLevel; // Keep severity as it's used in parent components
  apiValue?: string;
  location?: string;
  source?: string;
  children?: React.ReactNode;
}) {
  // Add severity usage to prevent ESLint warning
  const severityClass = severity ? `severity-${severity}` : "";

  // Get numeric value from string (e.g. "24 °C" → 24)
  const numericValue = parseFloat(value);
  const type: ReadingType = title.includes("UV")
    ? "UV"
    : title.includes("Heat")
    ? "Heat"
    : "AQI";

  // Determine severity based on value ranges
  const getSeverityLevel = (
    value: number,
    type: ReadingType
  ): SeverityLevel => {
    switch (type) {
      case "UV":
        if (value <= 2) return "low";
        if (value <= 5) return "moderate";
        if (value <= 7) return "high";
        if (value <= 11) return "extreme";
        return "critical";
      case "Heat":
        if (value <= 32) return "low";
        if (value <= 39) return "moderate";
        if (value <= 51) return "high";
        if (value <= 60) return "extreme";
        return "critical";
      case "AQI":
        if (value <= 50) return "low";
        if (value <= 100) return "moderate";
        if (value <= 150) return "high";
        if (value <= 200) return "extreme";
        return "critical";
      default:
        return "low";
    }
  };

  // Get severity label
  const getSeverityLabel = (
    severity: SeverityLevel,
    type: ReadingType
  ): string => {
    switch (type) {
      case "Heat":
        return {
          low: "Caution",
          moderate: "Extreme Caution",
          high: "Danger",
          extreme: "Extreme Danger",
          critical: "Critical Danger",
        }[severity];
      case "AQI":
        return {
          low: "Good",
          moderate: "Moderate",
          high: "Unhealthy for Sensitive Groups",
          extreme: "Unhealthy",
          critical: "Hazardous",
        }[severity];
      default: // UV and fallback
        return severity.charAt(0).toUpperCase() + severity.slice(1);
    }
  };

  const severityColors: Record<SeverityLevel, string> = {
    low: "text-green-500",
    moderate: "text-[#FFD93D]",
    high: "text-[#FF9A00]",
    extreme: "text-[#E62727]",
    critical: "text-black",
  };

  const calculatedSeverity = getSeverityLevel(numericValue, type);
  const textColor = severityColors[calculatedSeverity];
  const severityLabel = getSeverityLabel(calculatedSeverity, type);

  return (
    <div
      className={`rounded-3xl shadow-lg p-6 flex flex-col gap-2 sm:gap-4 border-[rgba(56,189,248,0.18)] border-2 ${severityClass}`}
    >
      <div className="rounded-lg p-2 sm:p-4 flex items-center gap-4">
        <div className="sm:text-8xl text-xl">{icon}</div>
        <div>
          <h2 className="text-lg sm:text-2xl font-semibold text-white">
            {title}
          </h2>
          <p className="text-xl sm:text-2xl mt-2 font-bold">
            <span className={textColor}>{value}</span>
          </p>
          <div>
            <p className={`mt-2 text-2xl ${textColor}`}>{severityLabel}</p>
          </div>
        </div>
        <div className="ml-auto text-right">
          {location && <p className="text-xl text-gray-500">{location}</p>}
          {source && <p className="text-sm text-gray-400">Source: {source}</p>}
          <div className="flex items-center gap-2 justify-end">
            <p className="text-xl">{iconsapiValue}</p>
            {apiValue && (
              <p className="text-lg sm:text-xl text-gray-500">{apiValue}</p>
            )}
          </div>
        </div>
      </div>
      {children && <div className="overflow-x-auto">{children}</div>}
    </div>
  );
}

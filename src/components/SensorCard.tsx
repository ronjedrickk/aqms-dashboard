"use client";
import React from "react";
import type { SeverityLevel } from "@/types/severity";

type ReadingType = "UV" | "Heat" | "AQI";
type LocationType =
  | "Quadrangle"
  | "Falcon Bridge"
  | "SV Entrance / Parking Lot";

// Keep your existing LocationType definition
// type LocationType = "Quadrangle" | "Falcon Bridge" | "SV Entrance / Parking Lot";

// Update the SensorCardProps interface to use LocationType
interface SensorCardProps {
  title: string;
  subtitle?: string; // Change this back to string to accept any string value
  value: string;
  icon: React.ReactNode;
  iconsapiValue?: React.ReactNode;
  severity: SeverityLevel;
  apiValue?: string;
  location?: string;
  source?: string;
  children?: React.ReactNode;
  rawTemperature?: string;
}

// Update the locationColors to accept any string key
const locationColors: Record<string, string> = {
  Quadrangle: "text-[#7BD3EA]",
  "Falcon Bridge": "text-blue-400",
  "SV Entrance / Parking Lot": "text-green-400",
};

export function SensorCard({
  title,
  subtitle,
  value,
  icon,
  iconsapiValue,
  severity,
  apiValue,
  location,
  source,
  children,
  rawTemperature,
}: SensorCardProps) {
  // Add severity usage
  const severityClass = severity ? `severity-${severity}` : "";

  // Get numeric value - use raw temperature for Heat type
  const numericValue =
    title.includes("Heat") && rawTemperature
      ? parseFloat(rawTemperature)
      : parseFloat(value);

  const type: ReadingType = title.includes("UV")
    ? "UV"
    : title.includes("Heat")
    ? "Heat"
    : "AQI";

  // Updated temperature thresholds for raw temperature
  const getSeverityLevel = (
    value: number,
    type: ReadingType
  ): SeverityLevel => {
    switch (type) {
      case "UV":
        if (value <= 2) return "low";
        if (value <= 5) return "moderate";
        if (value <= 7) return "high";
        if (value <= 12) return "extreme";
        return "critical";
      case "Heat":
        if (value <= 27) return "low";
        if (value <= 32) return "moderate";
        if (value <= 39) return "high";
        if (value <= 100) return "extreme";
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

  // Updated severity labels for temperature
  const getSeverityLabel = (
    severity: SeverityLevel,
    type: ReadingType
  ): string => {
    switch (type) {
      case "Heat":
        return {
          low: "Normal",
          moderate: "Caution",
          high: "Extreme Caution",
          extreme: "Danger",
          critical: "Critical",
        }[severity];
      case "AQI":
        return {
          low: "Good",
          moderate: "Moderate",
          high: "Unhealthy for Sensitive Groups",
          extreme: "Unhealthy",
          critical: "Hazardous",
        }[severity];
      default:
        return severity.charAt(0).toUpperCase() + severity.slice(1);
    }
  };

  const severityColors: Record<SeverityLevel, string> = {
    low: "text-green-500",
    moderate: "text-[#FFD93D]",
    high: "text-[#FF9A00]",
    extreme: "text-[#FF3D00]",
    critical: "text-[#E62727]",
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
          <div className="flex flex-col items-start">
            <h2 className="text-lg sm:text-2xl font-semibold text-white">
              {title === "Heat Index" ? "Temperature" : title}
            </h2>
            {subtitle && (
              <span className={`text-xl ${locationColors[subtitle]} mt-1`}>
                {subtitle}
              </span>
            )}
          </div>
          <p className="text-xl sm:text-2xl mt-2 font-bold">
            <span className={textColor}>
              {title === "Heat Index" ? rawTemperature : value}
            </span>
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

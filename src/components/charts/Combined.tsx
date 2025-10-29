"use client";

import React, { useState, useEffect } from "react";
import {
  AreaChart,
  Area,
  CartesianGrid,
  XAxis,
  YAxis,
  ResponsiveContainer,
  ReferenceDot,
} from "recharts";

// get window size
const useWindowSize = () => {
  const [size, setSize] = useState<[number, number]>([0, 0]);
  useEffect(() => {
    function updateSize() {
      setSize([window.innerWidth, window.innerHeight]);
    }
    window.addEventListener("resize", updateSize);
    updateSize();
    return () => window.removeEventListener("resize", updateSize);
  }, []);
  return size;
};

interface ChartDataPoint {
  timeLabel: string;
  aqi: number;
  uv: number;
  heat: number;
  temperature?: number; // Add temperature to interface
}

export function Combined({ data }: { data: ChartDataPoint[] }) {
  const [width] = useWindowSize();

  const isSmallScreen = width < 768;
  const dataToShow = isSmallScreen ? 15 : 10;

  // Data comes newest-first;  oldest -> newest
  const latestChrono = [...data].slice(0, dataToShow);

  // Format heat to one decimal, prioritizing temperature over heat
  const formattedData = latestChrono.map((d) => ({
    ...d,
    heat: parseFloat((d.temperature ?? d.heat).toFixed(1)),
  }));

  // time labels
  const timeFormattedData = formattedData.map((d) => {
    const [time] = d.timeLabel.split(" ");
    const [h, m] = time.split(":");
    return { ...d, timeLabel: `${h}:${m}` };
  });

  // Dynamic Y domain across all three series
  const vals = formattedData.flatMap((d) => [d.aqi, d.uv, d.heat]);
  let min = Math.min(...vals);
  let max = Math.max(...vals);
  if (!isFinite(min) || !isFinite(max)) {
    min = 0;
    max = 1;
  }
  if (min === max) {
    const delta = min === 0 ? 1 : Math.abs(min) * 0.2;
    min = min - delta;
    max = max + delta;
  }
  const dynamicDomain: [number, number] = [min, max];

  // Latest point (rightmost)
  const lastPoint: ChartDataPoint | undefined =
    timeFormattedData[timeFormattedData.length - 1];

  const latestAqi = lastPoint?.aqi ?? null;
  const latestUv = lastPoint?.uv ?? null;
  const latestHeat = lastPoint?.heat ?? null;

  return (
    <div className="bg-auto rounded-3xl shadow-xl">
      <div className="w-full h-[300px] border-[rgba(56,189,248,0.18)] border-2 rounded-2xl overflow-hidden p-4">
        <div className="w-full overflow-x-auto lg:overflow-x-hidden">
          <div className="min-w-[900px] lg:min-w-0">
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart
                data={timeFormattedData}
                margin={{ top: 40, right: 30, left: 0, bottom: 10 }}
              >
                <defs>
                  <linearGradient id="aqi-fill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ef4444" stopOpacity={0.8} />
                    <stop offset="100%" stopColor="#ef4444" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="uv-fill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#7F5283" stopOpacity={0.8} />
                    <stop offset="100%" stopColor="#7F5283" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="heat-fill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#FCB53B" stopOpacity={0.8} />
                    <stop offset="100%" stopColor="#FCB53B" stopOpacity={0} />
                  </linearGradient>
                </defs>

                <XAxis
                  dataKey="timeLabel"
                  stroke="#273F4F"
                  tick={{ fill: "#ffffff", dy: 10, dx: 4 }}
                  interval={0}
                  textAnchor="middle"
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  domain={dynamicDomain}
                  stroke="#273F4F"
                  tick={{ fill: "#ffffff", dx: -10 }}
                  axisLine={false}
                  tickLine={false}
                />

                <CartesianGrid vertical stroke="#ffffff22" />

                <Area
                  type="monotone"
                  dataKey="aqi"
                  name="Air Quality (PM2.5)"
                  stroke="#ef4444"
                  fillOpacity={1}
                  fill="url(#aqi-fill)"
                  strokeWidth={3}
                />
                <Area
                  type="monotone"
                  dataKey="uv"
                  name="UV Index"
                  stroke="#7F5283"
                  fillOpacity={1}
                  fill="url(#uv-fill)"
                  strokeWidth={3}
                />
                <Area
                  type="monotone"
                  dataKey="heat"
                  name="Temperature (°C)"
                  stroke="#FCB53B"
                  fillOpacity={1}
                  fill="url(#heat-fill)"
                  strokeWidth={3}
                />

                {lastPoint !== undefined && Number.isFinite(latestAqi) && (
                  <ReferenceDot
                    x={timeFormattedData.length - 1}
                    y={latestAqi as number}
                    r={6}
                    fill="#ef4444"
                    stroke="#ffffff"
                    strokeWidth={2}
                    label={{
                      value: (latestAqi as number).toFixed(1),
                      position: "top",
                      fill: "#ffffff",
                      fontSize: 20,
                      fontWeight: "semibold",
                      offset: 6,
                    }}
                  />
                )}
                {lastPoint !== undefined && Number.isFinite(latestUv) && (
                  <ReferenceDot
                    x={timeFormattedData.length - 1}
                    y={latestUv as number}
                    r={6}
                    fill="#7F5283"
                    stroke="#ffffff"
                    strokeWidth={2}
                    label={{
                      value: (latestUv as number).toFixed(1),
                      position: "top",
                      fill: "#ffffff",
                      fontSize: 20,
                      offset: 6,
                    }}
                  />
                )}
                {lastPoint !== undefined && Number.isFinite(latestHeat) && (
                  <ReferenceDot
                    x={timeFormattedData.length - 1}
                    y={latestHeat as number}
                    r={6}
                    fill="#FCB53B"
                    stroke="#ffffff"
                    strokeWidth={2}
                    label={{
                      value: (latestHeat as number).toFixed(1),
                      position: "top",
                      fill: "#ffffff",
                      fontSize: 20,
                      offset: 6,
                    }}
                  />
                )}
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}

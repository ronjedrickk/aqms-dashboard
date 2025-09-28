"use client";
import React from "react";
import {
  AreaChart,
  Area,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceDot,
} from "recharts";
import type { SensorRow } from "@/hooks/useSensorData";

export function SimpleArea({
  data,
  dataKey,
  stroke,
  fillId,
}: {
  data: SensorRow[];
  dataKey: "aqi" | "uv" | "heat";
  stroke: string;
  fillId: string;
}) {
  // Limit to last 8 readings (now already ascending from the hook)
  const limitedData = data.slice(-8);

  // Decimals by marker (series)
  const decimalsByKey: Record<"aqi" | "uv" | "heat", number> = {
    aqi: 1,
    uv: 1,
    heat: 2,
  };
  const decimals = decimalsByKey[dataKey];

  // Format numeric values based on the active marker
  const formattedData: SensorRow[] = limitedData.map((d) => {
    const v = d[dataKey];
    const rounded =
      typeof v === "number" && Number.isFinite(v)
        ? parseFloat(v.toFixed(decimals))
        : 0;
    return { ...d, [dataKey]: rounded } as SensorRow;
  });

  // Build unique X key (HH:MM:SS) and readable tick (HH:MM)
  const parseTime = (label: string) => {
    const m = label.match(/(\d+):(\d+)(?::(\d+))?/); // HH:MM[:SS]
    if (!m) return { hhmm: label, hhmmss: label };
    const [, h, mm, ss] = m;
    return { hhmm: `${h}:${mm}`, hhmmss: `${h}:${mm}:${ss ?? "00"}` };
  };

  const timeData = formattedData.map((d) => {
    const { hhmm, hhmmss } = parseTime(d.timeLabel);
    return { ...d, timeLabelFull: hhmmss, timeTick: hhmm };
  });

  // Dynamic Y domain with safeguards
  const vals = formattedData.map((d) => d[dataKey]);
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

  // Latest (rightmost) point
  const lastPoint = timeData.length > 0 ? timeData[timeData.length - 1] : null;
  const latestValue = lastPoint?.[dataKey] as number | undefined;

  return (
    <div className="bg-auto rounded-3xl shadow-xl ">
      <div className="w-full h-[250px] border rounded-2xl overflow-hidden">
        <div className="w-full overflow-x-auto lg:overflow-x-hidden">
          <div className="min-w-[900px] lg:min-w-0">
            <ResponsiveContainer width="100%" height={240}>
              <AreaChart
                data={timeData}
                margin={{ top: 40, right: 30, left: 5, bottom: 10 }}
              >
                <defs>
                  <linearGradient id={fillId} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={stroke} stopOpacity={0.8} />
                    <stop offset="100%" stopColor={stroke} stopOpacity={0} />
                  </linearGradient>
                </defs>

                <XAxis
                  dataKey="timeLabelFull"
                  stroke="#273F4F"
                  tick={{ fill: "#ffffff", dy: 10 }}
                  interval={0}
                  textAnchor="middle"
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(_, i) => timeData[i]?.timeTick ?? ""}
                />
                <YAxis
                  domain={dynamicDomain}
                  stroke="#273F4F"
                  tick={{ fill: "#ffffff", dx: -10 }}
                  axisLine={false}
                  tickLine={false}
                />
                <CartesianGrid vertical stroke="#ffffff22" />
                <Tooltip
                  contentStyle={{ backgroundColor: "#1e293b", border: "#fff" }}
                  formatter={(value: number | string) =>
                    typeof value === "number" ? value.toFixed(decimals) : value
                  }
                  labelFormatter={(label: string) => {
                    const item = timeData.find(
                      (d) => d.timeLabelFull === String(label)
                    );
                    return item?.timeTick ?? String(label);
                  }}
                />

                <Area
                  type="monotone"
                  dataKey={dataKey}
                  stroke={stroke}
                  fillOpacity={1}
                  fill={`url(#${fillId})`}
                  strokeWidth={3}
                />

                {lastPoint &&
                  latestValue != null &&
                  Number.isFinite(latestValue) && (
                    <ReferenceDot
                      key={`${lastPoint.timeLabelFull}-${latestValue}`}
                      x={lastPoint.timeLabelFull}
                      y={latestValue}
                      r={8}
                      fill={stroke}
                      stroke="#ffffff"
                      strokeWidth={2}
                      ifOverflow="extendDomain"
                      label={{
                        value: latestValue.toFixed(decimals),
                        position: "top",
                        fill: "#ffffff",
                        fontSize: 20,
                        offset: 8,
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

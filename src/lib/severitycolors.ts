export type Severity = "low" | "moderate" | "high" | "extreme" | "critical";

export const severityColors: Record<
  Severity,
  { bg: string; text: string; badge?: string }
> = {
  low: { bg: "bg-green-500", text: "text-green-500" },
  moderate: { bg: "bg-[#FFD93D]", text: "text-[#FFD93D]" },
  high: { bg: "bg-[#FF9A00]", text: "text-[#FF9A00]" },
  extreme: { bg: "bg-[#E62727]", text: "text-[#E62727]" },
  critical: { bg: "bg-black", text: "text-black" },
};

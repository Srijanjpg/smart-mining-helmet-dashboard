import { THRESHOLDS } from "./thresholds";

export function getSensorLevel(key, value) {
  const t = THRESHOLDS[key];
  if (!t) return "safe";

  if (value === null || value === undefined || Number.isNaN(value)) return "unknown";

  // h2s uses >= because it is a 0/1/2 state, not a continuous reading.
  //
  // ch4 uses >= for a different reason: the MQ-4 saturates at 1.0 % vol, which
  // is exactly its danger threshold, so the firmware clamps there and a strict
  // > would keep a saturated sensor showing "warning" forever.
  if (key === "h2s" || key === "ch4") {
    if (value >= t.danger) return "danger";
    if (value >= t.warning) return "warning";
    return "safe";
  }

  if (t.lowIsBad) {
    if (value < t.danger) return "danger";
    if (value < t.warning) return "warning";
    return "safe";
  }

  if (value > t.danger) return "danger";
  if (value > t.warning) return "warning";
  return "safe";
}

export function getOverallStatus(data) {
  const checks = [
    getSensorLevel("oxygen", data.sensors.oxygen),
    getSensorLevel("co2", data.sensors.co2),
    getSensorLevel("co", data.sensors.co),
    getSensorLevel("ch4", data.sensors.ch4),
    getSensorLevel("h2s", data.sensors.h2s)
  ];
  if (checks.includes("danger")) return "DANGER";
  if (checks.includes("warning")) return "WARNING";
  if (checks.includes("unknown")) return "UNKNOWN";
  return "SAFE";
}

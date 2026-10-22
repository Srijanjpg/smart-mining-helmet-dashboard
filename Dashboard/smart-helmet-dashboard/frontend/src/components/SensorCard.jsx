const toneBy = {
  safe: "border-safe/50 bg-safe/10",
  warning: "border-warn/50 bg-warn/10",
  danger: "border-danger/50 bg-danger/10",
  unknown: "border-slate-700 bg-panel"
};

const levelTextBy = {
  safe: "text-safe",
  warning: "text-warn",
  danger: "text-danger",
  unknown: "text-textSoft"
};

function formatSensorValue(sensorKey, value) {
  if (sensorKey === "h2s") {
    if (value >= 2) return "DANGER";
    if (value >= 1) return "WARNING";
    if (value === 0) return "SAFE";
    return "Unknown";
  }

  if (Number.isFinite(value)) return value;
  return "Unknown";
}

export default function SensorCard({ title, value, unit, level, sensorKey, offline = false }) {
  const hasValue = Number.isFinite(value);

  const displayValue = offline ? "Sensor Offline" : formatSensorValue(sensorKey, value);
  const displayLevel = offline ? "UNKNOWN" : String(level).toUpperCase();
  const displayLevelKey = offline ? "unknown" : level;
  const showUnit = !offline && hasValue && sensorKey !== "h2s";

  return (
    <div
      className={`p-4 rounded-xl border ${toneBy[displayLevelKey] || "border-slate-800 bg-panel"} overflow-hidden`}
    >
      <p className="text-textSoft text-sm truncate">{title}</p>
      <p className="text-2xl font-semibold mt-2 truncate">
        {displayValue} {showUnit ? <span className="text-base text-textSoft">{unit}</span> : null}
      </p>
      <p className={`text-xs mt-2 uppercase tracking-wide ${levelTextBy[displayLevelKey] || "text-textSoft"}`}>
        {displayLevel}
      </p>
    </div>
  );
}

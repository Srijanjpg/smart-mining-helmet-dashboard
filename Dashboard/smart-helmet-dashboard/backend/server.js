import express from "express";
import cors from "cors";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { initializeDatabase, SESSION_GAP_MS } from "./database/init.js";
import {
  insertSensorReading,
  insertAlert,
  getSensorReadings,
  getAlertHistory,
  getSensorTrends,
  getAverageByHour,
  updateMinerProfile,
  getAllMiners,
  getMinerLatestData,
  createRescueMission,
  startSession,
  touchSession
} from "./database/queries.js";

const app = express();
const PORT = 4000;

// Initialize database on startup (async)
let db;
(async () => {
  try {
    db = await initializeDatabase();
    app.listen(PORT, "0.0.0.0", () => {
      console.log("Backend running on http://0.0.0.0:4000");
    });
  } catch (err) {
    console.error("Failed to initialize database:", err);
    process.exit(1);
  }
})();

app.use(cors());
app.use(express.json());

const MAX_ALERT_HISTORY = 1000;

// The helmet POSTs every 2 s, so a 3 s window meant a single dropped POST was
// enough to declare it offline and blank every reading on the dashboard. One
// failed POST costs about 4.5 s (2 s until the next attempt, plus the 2.5 s
// HTTP timeout), and two in a row about 7 s, so this rides out two consecutive
// failures while still catching a genuine disconnect inside 8 s. The helmet
// alerts the miner locally regardless of the link, so this window governs what
// the operator sees, not whether anyone is warned.
const HEARTBEAT_TIMEOUT_MS = 8000;

let lastEsp32SeenAt = Date.now();

// A recording session spans one continuous run of the helmet. Every sensor row
// carries its session id so that training windows are never built across the
// boundary between two recordings -- those gaps run to months in practice.
let currentSessionId = null;

/*
 * Wi-Fi zone positioning.
 *
 * GPS is unusable underground, so the helmet reports which access points it can
 * see and the strongest recognised BSSID names the miner's location. BSSIDs the
 * map does not know are collected and exposed via GET /api/zones so they can be
 * labelled without hunting through logs.
 */
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ZONES_PATH = path.join(__dirname, "zones.json");

let zoneMap = {};
const unmappedBssids = new Map();

function loadZones() {
  try {
    if (!fs.existsSync(ZONES_PATH)) {
      console.warn("zones.json not found — zone positioning disabled");
      return;
    }
    const raw = JSON.parse(fs.readFileSync(ZONES_PATH, "utf8"));
    zoneMap = Object.fromEntries(
      Object.entries(raw)
        .filter(([key]) => !key.startsWith("_"))
        .map(([bssid, zone]) => [bssid.toLowerCase(), zone])
    );
    console.log(`Loaded ${Object.keys(zoneMap).length} Wi-Fi zone mapping(s)`);
  } catch (err) {
    console.error("Failed to load zones.json:", err.message);
  }
}

loadZones();

// The strongest recognised access point wins. Unrecognised ones are remembered
// so they can be mapped later.
function resolveZone(wifiScan) {
  if (!Array.isArray(wifiScan) || wifiScan.length === 0) return null;

  let best = null;

  for (const ap of wifiScan) {
    if (!isPlainObject(ap)) continue;
    if (typeof ap.bssid !== "string") continue;

    const bssid = ap.bssid.toLowerCase();
    const rssi = toFiniteNumber(ap.rssi);
    const zone = zoneMap[bssid];

    if (zone) {
      if (best === null || (rssi !== null && rssi > best.rssi)) {
        best = { zone, rssi: rssi === null ? -999 : rssi };
      }
    } else {
      unmappedBssids.set(bssid, { rssi, lastSeen: new Date().toISOString() });
    }
  }

  return best === null ? null : best.zone;
}

let latestData = {
  timestamp: new Date().toISOString(),
  esp32Connected: true,
  minerId: "MINER-001",
  location: { lat: null, lng: null },
  gpsMeta: {
    hasFix: false,
    fixFresh: false,
    fixAgeMs: null
  },
  sensors: {
    oxygen: null,
    co2: null,
    co: null,
    ch4: null,
    h2s: null,
    temperature: null,
    humidity: null
  },
  sensorStatus: {
    oxygen: false,
    co2: false,
    co: false,
    ch4: false,
    h2s: false,
    temperature: false,
    humidity: false,
    gps: false,
    gpsFix: false
  },
  audio: { mic: true, speaker: true },
  zone: null,
  wifiScan: []
};

const alertHistory = [];

function isPlainObject(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function toFiniteNumber(value) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function toBoolean(value) {
  if (typeof value === "boolean") return value;
  if (value === "true") return true;
  if (value === "false") return false;
  return null;
}

function isEsp32Connected() {
  return Date.now() - lastEsp32SeenAt < HEARTBEAT_TIMEOUT_MS;
}

function evaluateAlerts(data) {
  const alerts = [];
  const s = data.sensors;

  const o2 = Number.isFinite(s.oxygen) ? s.oxygen : null;
  const co2 = Number.isFinite(s.co2) ? s.co2 : null;
  const co = Number.isFinite(s.co) ? s.co : null;
  const ch4 = Number.isFinite(s.ch4) ? s.ch4 : null;
  const h2s = Number.isFinite(s.h2s) ? s.h2s : null;

  if (o2 !== null && o2 < 19.5) alerts.push({ level: "danger", message: "Low oxygen level" });
  else if (o2 !== null && o2 < 20.0) alerts.push({ level: "warning", message: "Oxygen trending low" });

  if (co2 !== null && co2 > 3500) alerts.push({ level: "danger", message: "High CO2 level" });
  else if (co2 !== null && co2 > 1600) alerts.push({ level: "warning", message: "CO2 elevated" });

  if (co !== null && co > 35) alerts.push({ level: "danger", message: "CO level critical" });
  else if (co !== null && co > 20) alerts.push({ level: "warning", message: "CO level high" });
  else if (co !== null && co > 10) alerts.push({ level: "warning", message: "CO level increasing" });
  else if (co !== null && co > 2) alerts.push({ level: "warning", message: "CO detected" });

  // >= not >, because the MQ-4 saturates at 1.0 % vol and the firmware clamps
  // there. A clamped reading means "at least 1.0 %", so a strict > would leave
  // the sensor pinned at its ceiling and never raise danger.
  if (ch4 !== null && ch4 >= 1.0) alerts.push({ level: "danger", message: "Methane detected" });
  else if (ch4 !== null && ch4 >= 0.5) alerts.push({ level: "warning", message: "Methane rising" });

  if (h2s !== null && h2s >= 2) alerts.push({ level: "danger", message: "H2S detected (danger)" });
  else if (h2s !== null && h2s >= 1) alerts.push({ level: "warning", message: "H2S detected (warning)" });

  return alerts;
}

function validateIncomingPayload(incoming) {
  if (!isPlainObject(incoming)) return "Request body must be a JSON object.";

  if (incoming.minerId !== undefined && typeof incoming.minerId !== "string") {
    return "minerId must be a string.";
  }

  if (incoming.sensors !== undefined) {
    if (!isPlainObject(incoming.sensors)) return "sensors must be an object.";
    for (const [key, value] of Object.entries(incoming.sensors)) {
      if (toFiniteNumber(value) === null) {
        return "Invalid numeric value for sensors." + key;
      }
    }
  }

  if (incoming.location !== undefined) {
    if (!isPlainObject(incoming.location)) return "location must be an object.";
    if (
      incoming.location.lat !== undefined &&
      incoming.location.lat !== null &&
      toFiniteNumber(incoming.location.lat) === null
    ) {
      return "location.lat must be a finite number.";
    }
    if (
      incoming.location.lng !== undefined &&
      incoming.location.lng !== null &&
      toFiniteNumber(incoming.location.lng) === null
    ) {
      return "location.lng must be a finite number.";
    }
  }

  if (incoming.gpsMeta !== undefined) {
    if (!isPlainObject(incoming.gpsMeta)) return "gpsMeta must be an object.";
    if (incoming.gpsMeta.hasFix !== undefined && toBoolean(incoming.gpsMeta.hasFix) === null) {
      return "gpsMeta.hasFix must be boolean.";
    }
    if (incoming.gpsMeta.fixFresh !== undefined && toBoolean(incoming.gpsMeta.fixFresh) === null) {
      return "gpsMeta.fixFresh must be boolean.";
    }
    if (
      incoming.gpsMeta.fixAgeMs !== undefined &&
      incoming.gpsMeta.fixAgeMs !== null &&
      toFiniteNumber(incoming.gpsMeta.fixAgeMs) === null
    ) {
      return "gpsMeta.fixAgeMs must be a finite number or null.";
    }
  }

  if (incoming.audio !== undefined) {
    if (!isPlainObject(incoming.audio)) return "audio must be an object.";
    if (incoming.audio.mic !== undefined && toBoolean(incoming.audio.mic) === null) {
      return "audio.mic must be boolean.";
    }
    if (incoming.audio.speaker !== undefined && toBoolean(incoming.audio.speaker) === null) {
      return "audio.speaker must be boolean.";
    }
  }

  if (incoming.wifiScan !== undefined) {
    if (!Array.isArray(incoming.wifiScan)) return "wifiScan must be an array.";
    for (const ap of incoming.wifiScan) {
      if (!isPlainObject(ap)) return "wifiScan entries must be objects.";
      if (ap.bssid !== undefined && typeof ap.bssid !== "string") {
        return "wifiScan.bssid must be a string.";
      }
      if (ap.rssi !== undefined && toFiniteNumber(ap.rssi) === null) {
        return "wifiScan.rssi must be a finite number.";
      }
    }
  }

  if (incoming.sensorStatus !== undefined) {
    if (!isPlainObject(incoming.sensorStatus)) return "sensorStatus must be an object.";
    for (const [key, value] of Object.entries(incoming.sensorStatus)) {
      if (toBoolean(value) === null) {
        return "Invalid boolean value for sensorStatus." + key;
      }
    }
  }

  return null;
}

function normalizeSensors(sensors) {
  const normalized = Object.fromEntries(SENSOR_KEYS.map((k) => [k, null]));

  if (!isPlainObject(sensors)) return normalized;

  for (const key of SENSOR_KEYS) {
    const parsed = toFiniteNumber(sensors[key]);
    normalized[key] = parsed;
  }

  return normalized;
}

function mergeLocation(incomingLocation, currentLocation) {
  if (!isPlainObject(incomingLocation)) {
    return { lat: null, lng: null };
  }

  const lat =
    incomingLocation.lat === null
      ? null
      : incomingLocation.lat === undefined
      ? null
      : toFiniteNumber(incomingLocation.lat);
  const lng =
    incomingLocation.lng === null
      ? null
      : incomingLocation.lng === undefined
      ? null
      : toFiniteNumber(incomingLocation.lng);

  return {
    lat,
    lng
  };
}

function mergeAudio(incomingAudio, currentAudio) {
  if (!isPlainObject(incomingAudio)) return currentAudio;

  const mic = toBoolean(incomingAudio.mic);
  const speaker = toBoolean(incomingAudio.speaker);

  return {
    mic: mic !== null ? mic : currentAudio.mic,
    speaker: speaker !== null ? speaker : currentAudio.speaker
  };
}

function mergeSensorStatus(incomingSensorStatus, currentSensorStatus) {
  const base = { ...Object.fromEntries(SENSOR_STATUS_KEYS.map((k) => [k, false])), ...(currentSensorStatus || {}) };
  if (!isPlainObject(incomingSensorStatus)) return base;

  for (const key of SENSOR_STATUS_KEYS) {
    const parsed = toBoolean(incomingSensorStatus[key]);
    if (parsed !== null) base[key] = parsed;
  }

  return base;
}

function mergeGpsMeta(incomingGpsMeta, currentGpsMeta) {
  const base = {
    hasFix: false,
    fixFresh: false,
    fixAgeMs: null,
    ...(currentGpsMeta || {})
  };

  if (!isPlainObject(incomingGpsMeta)) return base;

  const hasFix = toBoolean(incomingGpsMeta.hasFix);
  const fixFresh = toBoolean(incomingGpsMeta.fixFresh);
  const fixAgeMs = toFiniteNumber(incomingGpsMeta.fixAgeMs);

  return {
    hasFix: hasFix !== null ? hasFix : base.hasFix,
    fixFresh: fixFresh !== null ? fixFresh : base.fixFresh,
    fixAgeMs: fixAgeMs !== null ? Math.max(0, Math.round(fixAgeMs)) : null
  };
}

// Scope note: heart rate and obstacle distance were removed from the project
// scope. The nullable heart_rate / obstacle_distance columns remain in the
// SQLite schema so they can be reinstated without a migration, but nothing
// writes to them. "ch4" stays because the MQ-4 is still planned.
const SENSOR_KEYS = [
  "oxygen",
  "co2",
  "co",
  "ch4",
  "h2s",
  "temperature",
  "humidity"
];

const SENSOR_STATUS_KEYS = [
  "oxygen",
  "co2",
  "co",
  "ch4",
  "h2s",
  "temperature",
  "humidity",
  "gps",
  "gpsFix"
];

app.get("/api/data", (req, res) => {
  const connected = isEsp32Connected();

  const sensors = connected
    ? latestData.sensors
    : Object.fromEntries(SENSOR_KEYS.map((k) => [k, null]));

  const location = connected ? latestData.location : { lat: null, lng: null };
  const sensorStatus = connected
    ? latestData.sensorStatus
    : Object.fromEntries(SENSOR_STATUS_KEYS.map((k) => [k, false]));
  const alerts = connected ? evaluateAlerts(latestData) : [];
  const zone = connected ? latestData.zone : null;

  res.json({
    ...latestData,
    esp32Connected: connected,
    sensors,
    location,
    sensorStatus,
    zone,
    alerts,
    alertHistory: alertHistory.slice(-100).reverse()
  });
});

app.post("/api/data", (req, res) => {
  const incoming = req.body ?? {};
  const validationError = validateIncomingPayload(incoming);

  if (validationError) {
    return res.status(400).json({ ok: false, error: validationError });
  }

  // Measure the real gap before the heartbeat is refreshed. This is what decides
  // whether the helmet has started a NEW recording, and it is deliberately not
  // the same question as whether the dashboard should show it online.
  const msSinceLastPost = Date.now() - lastEsp32SeenAt;
  lastEsp32SeenAt = Date.now();

  latestData = {
    ...latestData,
    minerId:
      typeof incoming.minerId === "string" && incoming.minerId.trim()
        ? incoming.minerId.trim()
        : latestData.minerId,
    sensors: normalizeSensors(incoming.sensors),
    location: mergeLocation(incoming.location, latestData.location),
    gpsMeta: mergeGpsMeta(incoming.gpsMeta, latestData.gpsMeta),
    sensorStatus: mergeSensorStatus(incoming.sensorStatus, latestData.sensorStatus),
    audio: mergeAudio(incoming.audio, latestData.audio),
    wifiScan: Array.isArray(incoming.wifiScan) ? incoming.wifiScan : latestData.wifiScan,
    zone: resolveZone(incoming.wifiScan) ?? latestData.zone,
    timestamp: new Date().toISOString()
  };

  const alerts = evaluateAlerts(latestData);
  alerts.forEach((a) => {
    const alertId = Date.now().toString() + "-" + Math.random().toString(16).slice(2);
    alertHistory.push({
      id: alertId,
      timestamp: new Date().toISOString(),
      ...a
    });

    // Write alert to database
    try {
      insertAlert(alertId, latestData.minerId, a);
    } catch (err) {
      console.error("Failed to insert alert to database:", err);
    }
  });

  if (alertHistory.length > MAX_ALERT_HISTORY) {
    alertHistory.splice(0, alertHistory.length - MAX_ALERT_HISTORY);
  }

  // A few seconds of lost telemetry is a dropped POST, not a new recording.
  // SESSION_GAP_MS is the same 60 s boundary the historical backfill in init.js
  // uses, so live and backfilled sessions are split by one consistent rule --
  // previously the live path fragmented on any 3 s blip while the migration
  // only split at 60 s.
  if (currentSessionId === null || msSinceLastPost >= SESSION_GAP_MS) {
    currentSessionId = `SESSION-${latestData.timestamp}-${Math.random().toString(16).slice(2, 8)}`;
    try {
      startSession(currentSessionId, latestData.minerId, latestData.timestamp);
      console.log(`New recording session: ${currentSessionId}`);
    } catch (err) {
      console.error("Failed to start session:", err);
      currentSessionId = null;
    }
  }

  // Write sensor reading to database
  try {
    insertSensorReading(
      latestData.minerId,
      latestData,
      latestData.location,
      currentSessionId
    );

    if (currentSessionId) {
      const hasLocation =
        latestData.location?.lat !== null && latestData.location?.lng !== null;
      touchSession(currentSessionId, latestData.timestamp, hasLocation);
    }
  } catch (err) {
    console.error("Failed to insert sensor reading to database:", err);
  }

  return res.status(200).json({
    ok: true,
    latestData: { ...latestData, esp32Connected: isEsp32Connected() },
    alerts
  });
});

app.get("/api/zones", (req, res) => {
  res.json({
    ok: true,
    zones: zoneMap,
    unmapped: Array.from(unmappedBssids.entries())
      .map(([bssid, info]) => ({ bssid, ...info }))
      .sort((a, b) => (b.rssi ?? -999) - (a.rssi ?? -999))
  });
});

app.post("/api/zones/reload", (req, res) => {
  loadZones();
  res.json({ ok: true, count: Object.keys(zoneMap).length });
});

app.get("/health", (req, res) => {
  res.json({ ok: true, ts: new Date().toISOString() });
});

// ===== Analytics Endpoints =====

app.get("/api/analytics/sensors", (req, res) => {
  try {
    const minerId = req.query.minerId || "MINER-001";
    const hoursBack = parseInt(req.query.hoursBack || "24", 10);

    const readings = getSensorReadings(minerId, hoursBack);
    res.json({ ok: true, data: readings });
  } catch (err) {
    console.error("Error fetching sensor readings:", err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.get("/api/analytics/trends", (req, res) => {
  try {
    const minerId = req.query.minerId || "MINER-001";
    const sensorName = req.query.sensor || "oxygen";
    const hoursBack = parseInt(req.query.hoursBack || "24", 10);

    const trends = getSensorTrends(minerId, sensorName, hoursBack);
    res.json({ ok: true, sensor: sensorName, data: trends });
  } catch (err) {
    console.error("Error fetching sensor trends:", err);
    res.status(400).json({ ok: false, error: err.message });
  }
});

app.get("/api/analytics/hourly-averages", (req, res) => {
  try {
    const minerId = req.query.minerId || "MINER-001";
    const sensorName = req.query.sensor || "oxygen";
    const hoursBack = parseInt(req.query.hoursBack || "24", 10);

    const averages = getAverageByHour(minerId, sensorName, hoursBack);
    res.json({ ok: true, sensor: sensorName, data: averages });
  } catch (err) {
    console.error("Error fetching hourly averages:", err);
    res.status(400).json({ ok: false, error: err.message });
  }
});

app.get("/api/alerts/history", (req, res) => {
  try {
    const minerId = req.query.minerId || "MINER-001";
    const hoursBack = parseInt(req.query.hoursBack || "24", 10);
    const level = req.query.level || null;

    const alerts = getAlertHistory(minerId, hoursBack, level);
    res.json({ ok: true, data: alerts });
  } catch (err) {
    console.error("Error fetching alert history:", err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.get("/api/miners", (req, res) => {
  try {
    const miners = getAllMiners();
    res.json({ ok: true, data: miners });
  } catch (err) {
    console.error("Error fetching miners:", err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.get("/api/miners/:minerId/latest", (req, res) => {
  try {
    const minerId = req.params.minerId;
    const latestData = getMinerLatestData(minerId);
    res.json({ ok: true, data: latestData });
  } catch (err) {
    console.error("Error fetching latest miner data:", err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.post("/api/miners/:minerId/profile", (req, res) => {
  try {
    const minerId = req.params.minerId;
    const { name, contactInfo, healthProfile } = req.body;

    updateMinerProfile(minerId, name || "", contactInfo || "", healthProfile || "");
    res.json({ ok: true, message: "Profile updated" });
  } catch (err) {
    console.error("Error updating miner profile:", err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.post("/api/rescue/mission", (req, res) => {
  try {
    const { minerId, sensorData, locationData } = req.body;
    const missionId = `MISSION-${Date.now()}-${Math.random().toString(16).slice(2)}`;

    createRescueMission(missionId, minerId || "MINER-001", sensorData, locationData);
    res.json({ ok: true, missionId, message: "Rescue mission created" });
  } catch (err) {
    console.error("Error creating rescue mission:", err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

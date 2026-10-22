import { getDatabase, saveDatabase } from './init.js';

// SQLite has no boolean type, so store 1/0 and leave unknown as NULL.
function toFlag(value) {
  if (value === true) return 1;
  if (value === false) return 0;
  return null;
}

export function insertSensorReading(minerId, sensorData, locationData, sessionId = null) {
  const db = getDatabase();
  const s = sensorData.sensors;
  const st = sensorData.sensorStatus || {};
  const l = locationData;

  db.run(
    `INSERT INTO sensors (
      timestamp, miner_id, session_id, zone, oxygen, co2, co, ch4, h2s,
      heart_rate, temperature, humidity, obstacle_distance,
      latitude, longitude,
      oxygen_ok, co2_ok, co_ok, ch4_ok, h2s_ok,
      temperature_ok, humidity_ok, gps_ok, gps_fix_ok
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      sensorData.timestamp,
      minerId,
      sessionId,
      sensorData.zone ?? null,
      s.oxygen ?? null,
      s.co2 ?? null,
      s.co ?? null,
      s.ch4 ?? null,
      s.h2s ?? null,
      null, // heart_rate: out of scope, column kept for future use
      s.temperature ?? null,
      s.humidity ?? null,
      null, // obstacle_distance: out of scope, column kept for future use
      l?.lat ?? null,
      l?.lng ?? null,
      toFlag(st.oxygen),
      toFlag(st.co2),
      toFlag(st.co),
      toFlag(st.ch4),
      toFlag(st.h2s),
      toFlag(st.temperature),
      toFlag(st.humidity),
      toFlag(st.gps),
      toFlag(st.gpsFix)
    ]
  );

  saveDatabase();
}

// The firmware only ever reports MINER-001 today, but a second helmet would
// otherwise trip the foreign key on sensors and silently drop every reading.
export function ensureMiner(minerId) {
  const db = getDatabase();
  db.run(
    'INSERT OR IGNORE INTO miners (miner_id, name, contact_info, health_profile) VALUES (?, ?, ?, ?)',
    [minerId, minerId, '', '']
  );
}

export function startSession(sessionId, minerId, startTime) {
  const db = getDatabase();
  ensureMiner(minerId);
  db.run(
    `INSERT OR REPLACE INTO sessions
     (session_id, miner_id, start_time, end_time, location_count)
     VALUES (?, ?, ?, ?, 0)`,
    [sessionId, minerId, startTime, startTime]
  );
  saveDatabase();
}

// Keeps end_time current so a session's span is correct even if the helmet is
// switched off without a clean shutdown.
export function touchSession(sessionId, endTime, hasLocation) {
  const db = getDatabase();
  db.run(
    `UPDATE sessions
     SET end_time = ?, location_count = location_count + ?
     WHERE session_id = ?`,
    [endTime, hasLocation ? 1 : 0, sessionId]
  );
}

export function insertAlert(alertId, minerId, alertData) {
  const db = getDatabase();

  // Detect sensor type from message
  const message = alertData.message.toLowerCase();
  let sensorType = 'unknown';
  if (message.includes('oxygen')) sensorType = 'oxygen';
  else if (message.includes('co2')) sensorType = 'co2';
  else if (message.includes('co ')) sensorType = 'co';
  else if (message.includes('methane')) sensorType = 'ch4';
  else if (message.includes('h2s')) sensorType = 'h2s';

  db.run(
    `INSERT INTO alerts (
      id, timestamp, miner_id, level, message, sensor_type
    ) VALUES (?, ?, ?, ?, ?, ?)`,
    [
      alertId,
      new Date().toISOString(),
      minerId,
      alertData.level,
      alertData.message,
      sensorType
    ]
  );

  saveDatabase();
}

export function getSensorReadings(minerId, hoursBack = 24) {
  const db = getDatabase();
  const cutoffTime = new Date(Date.now() - hoursBack * 60 * 60 * 1000).toISOString();

  const result = db.exec(
    `SELECT * FROM sensors
    WHERE miner_id = ? AND timestamp > ?
    ORDER BY timestamp DESC`,
    [minerId, cutoffTime]
  );

  return resultToArray(result);
}

export function getAlertHistory(minerId, hoursBack = 24, level = null) {
  const db = getDatabase();
  const cutoffTime = new Date(Date.now() - hoursBack * 60 * 60 * 1000).toISOString();

  let query = `
    SELECT * FROM alerts
    WHERE miner_id = ? AND timestamp > ?
  `;
  const params = [minerId, cutoffTime];

  if (level) {
    query += ' AND level = ?';
    params.push(level);
  }

  query += ' ORDER BY timestamp DESC';

  const result = db.exec(query, params);
  return resultToArray(result);
}

export function getSensorTrends(minerId, sensorName, hoursBack = 24) {
  const db = getDatabase();
  const cutoffTime = new Date(Date.now() - hoursBack * 60 * 60 * 1000).toISOString();

  // Map sensor name to column
  const columnMap = {
    oxygen: 'oxygen',
    co2: 'co2',
    co: 'co',
    ch4: 'ch4',
    h2s: 'h2s',
    temperature: 'temperature',
    humidity: 'humidity'
  };

  const column = columnMap[sensorName];
  if (!column) {
    throw new Error(`Unknown sensor: ${sensorName}`);
  }

  const query = `
    SELECT 
      timestamp,
      ${column} as value
    FROM sensors
    WHERE miner_id = ? AND timestamp > ? AND ${column} IS NOT NULL
    ORDER BY timestamp ASC
  `;

  const result = db.exec(query, [minerId, cutoffTime]);
  return resultToArray(result);
}

export function getAverageByHour(minerId, sensorName, hoursBack = 24) {
  const db = getDatabase();
  const cutoffTime = new Date(Date.now() - hoursBack * 60 * 60 * 1000).toISOString();

  const columnMap = {
    oxygen: 'oxygen',
    co2: 'co2',
    co: 'co',
    ch4: 'ch4',
    h2s: 'h2s',
    temperature: 'temperature',
    humidity: 'humidity'
  };

  const column = columnMap[sensorName];
  if (!column) {
    throw new Error(`Unknown sensor: ${sensorName}`);
  }

  const query = `
    SELECT 
      strftime('%Y-%m-%d %H:00:00', timestamp) as hour,
      AVG(${column}) as avg_value,
      MIN(${column}) as min_value,
      MAX(${column}) as max_value,
      COUNT(*) as reading_count
    FROM sensors
    WHERE miner_id = ? AND timestamp > ? AND ${column} IS NOT NULL
    GROUP BY hour
    ORDER BY hour ASC
  `;

  const result = db.exec(query, [minerId, cutoffTime]);
  return resultToArray(result);
}

export function createRescueMission(missionId, minerId, sensorData, locationData) {
  const db = getDatabase();
  const s = sensorData.sensors;
  const hazardLevel = determinHazardLevel(s);

  db.run(
    `INSERT INTO rescue_missions (
      mission_id, miner_id, timestamp, latitude, longitude,
      oxygen_level, co2_level, co_level, ch4_level, h2s_level,
      heart_rate, gas_hazard_level, status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      missionId,
      minerId,
      new Date().toISOString(),
      locationData?.lat ?? null,
      locationData?.lng ?? null,
      s.oxygen ?? null,
      s.co2 ?? null,
      s.co ?? null,
      s.ch4 ?? null,
      s.h2s ?? null,
      null, // heart_rate: out of scope, column kept for future use
      hazardLevel,
      'pending'
    ]
  );

  saveDatabase();
}

function determinHazardLevel(sensors) {
  const oxygen = Number.isFinite(sensors.oxygen) ? sensors.oxygen : null;
  const co2 = Number.isFinite(sensors.co2) ? sensors.co2 : null;
  const co = Number.isFinite(sensors.co) ? sensors.co : null;
  const ch4 = Number.isFinite(sensors.ch4) ? sensors.ch4 : null;
  const h2s = Number.isFinite(sensors.h2s) ? sensors.h2s : null;

  // Simple logic: if any danger-level threshold is breached, it's critical
  if (
    (oxygen !== null && oxygen < 19.5) ||
    (co2 !== null && co2 > 3500) ||
    (co !== null && co > 35) ||
    (ch4 !== null && ch4 >= 1.0) ||
    (h2s !== null && h2s >= 2)
  ) {
    return 'critical';
  }

  if (
    (oxygen !== null && oxygen < 20.0) ||
    (co2 !== null && co2 > 1600) ||
    (co !== null && co > 2) ||
    (ch4 !== null && ch4 >= 0.5) ||
    (h2s !== null && h2s >= 1)
  ) {
    return 'warning';
  }

  return 'normal';
}

export function updateMinerProfile(minerId, name, contactInfo, healthProfile) {
  const db = getDatabase();
  db.run(
    `UPDATE miners
    SET name = ?, contact_info = ?, health_profile = ?, updated_at = CURRENT_TIMESTAMP
    WHERE miner_id = ?`,
    [name, contactInfo, healthProfile, minerId]
  );

  saveDatabase();
}

export function getAllMiners() {
  const db = getDatabase();
  const result = db.exec(
    'SELECT * FROM miners ORDER BY created_at DESC'
  );
  return resultToArray(result);
}

export function getMinerLatestData(minerId) {
  const db = getDatabase();
  const result = db.exec(
    `SELECT * FROM sensors
    WHERE miner_id = ?
    ORDER BY timestamp DESC
    LIMIT 1`,
    [minerId]
  );
  const data = resultToArray(result);
  return data.length > 0 ? data[0] : null;
}

// Helper function to convert sql.js result to array of objects
function resultToArray(result) {
  if (!result || result.length === 0) {
    return [];
  }

  const rows = result[0];
  const columns = rows.columns;
  const values = rows.values;

  return values.map(row => {
    const obj = {};
    columns.forEach((col, idx) => {
      obj[col] = row[idx];
    });
    return obj;
  });
}


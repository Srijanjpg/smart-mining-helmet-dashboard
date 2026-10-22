import initSqlJs from 'sql.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DB_PATH = path.join(__dirname, '..', 'helmet.db');

let SQL;
let db;
let saveTimer = null;
const SAVE_DEBOUNCE_MS = 1000;

function writeDatabaseToDisk() {
  if (!db) return;
  const data = db.export();
  const buffer = Buffer.from(data);
  fs.writeFileSync(DB_PATH, buffer);
}

async function initSqlJsDb() {
  if (!SQL) {
    SQL = await initSqlJs();
  }

  // Try to load existing database file
  if (fs.existsSync(DB_PATH)) {
    const fileBuffer = fs.readFileSync(DB_PATH);
    db = new SQL.Database(fileBuffer);
  } else {
    db = new SQL.Database();
  }

  // Enable foreign keys
  db.run('PRAGMA foreign_keys = ON');

  // Create miners table
  db.run(`
    CREATE TABLE IF NOT EXISTS miners (
      miner_id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      contact_info TEXT,
      health_profile TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Create sensors table
  db.run(`
    CREATE TABLE IF NOT EXISTS sensors (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      timestamp TEXT NOT NULL,
      miner_id TEXT NOT NULL,
      oxygen REAL,
      co2 REAL,
      co REAL,
      ch4 REAL,
      h2s REAL,
      heart_rate REAL,
      temperature REAL,
      humidity REAL,
      obstacle_distance REAL,
      latitude REAL,
      longitude REAL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (miner_id) REFERENCES miners(miner_id)
    )
  `);

  // Create alerts table
  db.run(`
    CREATE TABLE IF NOT EXISTS alerts (
      id TEXT PRIMARY KEY,
      timestamp TEXT NOT NULL,
      miner_id TEXT NOT NULL,
      level TEXT NOT NULL CHECK(level IN ('warning', 'danger')),
      message TEXT NOT NULL,
      sensor_type TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (miner_id) REFERENCES miners(miner_id)
    )
  `);

  // Create sessions table
  db.run(`
    CREATE TABLE IF NOT EXISTS sessions (
      session_id TEXT PRIMARY KEY,
      miner_id TEXT NOT NULL,
      start_time TEXT NOT NULL,
      end_time TEXT,
      location_count INTEGER DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (miner_id) REFERENCES miners(miner_id)
    )
  `);

  // Create rescue missions table
  db.run(`
    CREATE TABLE IF NOT EXISTS rescue_missions (
      mission_id TEXT PRIMARY KEY,
      miner_id TEXT NOT NULL,
      timestamp TEXT NOT NULL,
      latitude REAL,
      longitude REAL,
      oxygen_level REAL,
      co2_level REAL,
      co_level REAL,
      ch4_level REAL,
      h2s_level REAL,
      heart_rate REAL,
      gas_hazard_level TEXT,
      status TEXT CHECK(status IN ('pending', 'in_progress', 'resolved', 'cancelled')),
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (miner_id) REFERENCES miners(miner_id)
    )
  `);

  runMigrations();

  // Seed default miner if not exists
  const result = db.exec('SELECT * FROM miners WHERE miner_id = "MINER-001"');
  if (!result || result.length === 0 || result[0].values.length === 0) {
    db.run(
      'INSERT INTO miners (miner_id, name, contact_info, health_profile) VALUES (?, ?, ?, ?)',
      ['MINER-001', 'Default Miner', '', '']
    );
  }

  // Save database to file
  saveDatabase();

  console.log(`Database initialized at: ${DB_PATH}`);
  return db;
}

// Per-sensor health flags stored alongside each reading. Without these a NULL
// reading is ambiguous -- sensor absent, or value dropped? -- and training data
// cannot distinguish a real gap from hardware that was never wired.
export const STATUS_COLUMNS = [
  'oxygen_ok',
  'co2_ok',
  'co_ok',
  'ch4_ok',
  'h2s_ok',
  'temperature_ok',
  'humidity_ok',
  'gps_ok',
  'gps_fix_ok'
];

// A gap larger than this means the helmet stopped reporting, so readings either
// side belong to different recording sessions.
export const SESSION_GAP_MS = 60 * 1000;

function tableColumns(table) {
  const res = db.exec(`PRAGMA table_info(${table})`);
  if (!res || res.length === 0) return [];
  const nameIdx = res[0].columns.indexOf('name');
  return res[0].values.map((row) => row[nameIdx]);
}

function ensureColumn(table, column, definition) {
  if (tableColumns(table).includes(column)) return false;
  db.run(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  return true;
}

/*
 * Assigns session ids to rows recorded before session tracking existed, by
 * splitting on gaps in the timestamp sequence.
 *
 * This matters for model training: a window built by sliding over
 * ORDER BY timestamp would otherwise straddle the boundary between two
 * recordings -- and the gaps here run to months, so those windows are noise
 * that looks like valid data.
 */
function backfillSessions() {
  const res = db.exec(
    `SELECT id, timestamp, miner_id, latitude FROM sensors
     WHERE session_id IS NULL ORDER BY timestamp ASC`
  );
  if (!res || res.length === 0) return 0;

  const rows = res[0].values;
  const sessions = new Map();
  const assignments = [];

  let sessionId = null;
  let prevMs = null;

  for (const [id, timestamp, minerId, latitude] of rows) {
    const ms = Date.parse(timestamp);
    const isNewSession =
      prevMs === null || !Number.isFinite(ms) || ms - prevMs > SESSION_GAP_MS;

    if (isNewSession) {
      sessionId = `BACKFILL-${timestamp}`;
      sessions.set(sessionId, {
        minerId,
        start: timestamp,
        end: timestamp,
        locationCount: 0
      });
    }

    const session = sessions.get(sessionId);
    session.end = timestamp;
    if (latitude !== null && latitude !== undefined) session.locationCount++;

    assignments.push([sessionId, id]);
    prevMs = Number.isFinite(ms) ? ms : prevMs;
  }

  const update = db.prepare('UPDATE sensors SET session_id = ? WHERE id = ?');
  for (const args of assignments) {
    update.run(args);
    update.reset();
  }
  update.free();

  const insert = db.prepare(
    `INSERT OR IGNORE INTO sessions
     (session_id, miner_id, start_time, end_time, location_count)
     VALUES (?, ?, ?, ?, ?)`
  );
  for (const [id, s] of sessions) {
    try {
      insert.run([id, s.minerId, s.start, s.end, s.locationCount]);
      insert.reset();
    } catch (err) {
      // A miner_id present in sensors but missing from miners would trip the
      // foreign key. Skip that session rather than abort the whole migration.
      console.warn(`Skipped backfilled session ${id}: ${err.message}`);
    }
  }
  insert.free();

  return sessions.size;
}

function runMigrations() {
  const addedSession = ensureColumn('sensors', 'session_id', 'TEXT');
  const addedZone = ensureColumn('sensors', 'zone', 'TEXT');
  let addedStatus = 0;
  for (const column of STATUS_COLUMNS) {
    if (ensureColumn('sensors', column, 'INTEGER')) addedStatus++;
  }

  if (addedSession || addedZone || addedStatus) {
    console.log(
      `Migration: added ${addedSession ? 'session_id ' : ''}${addedZone ? 'zone ' : ''}and ${addedStatus} sensor status columns`
    );
  }

  try {
    const backfilled = backfillSessions();
    if (backfilled > 0) {
      console.log(`Migration: backfilled ${backfilled} historical session(s)`);
    }
  } catch (err) {
    console.error('Session backfill failed:', err.message);
  }
}

export function saveDatabase() {
  if (!db) return;

  if (saveTimer) {
    clearTimeout(saveTimer);
  }

  saveTimer = setTimeout(() => {
    saveTimer = null;
    writeDatabaseToDisk();
  }, SAVE_DEBOUNCE_MS);
}

export async function initializeDatabase() {
  return await initSqlJsDb();
}

export function getDatabase() {
  return db;
}


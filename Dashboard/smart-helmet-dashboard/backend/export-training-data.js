/*
 * Exports recorded sensor data as CSV for model training.
 *
 *   node export-training-data.js                    -> training-data.csv
 *   node export-training-data.js out.csv            -> out.csv
 *   node export-training-data.js out.csv --min-rows 60
 *
 * Rows are grouped by recording session and ordered by time within it. Never
 * build a window that crosses a session_id boundary -- gaps between sessions
 * run to months, and a window spanning one is noise that looks like data.
 *
 * The *_ok columns say whether each sensor was reporting healthy at that
 * instant. A NULL reading with *_ok = 0 means the sensor was absent; a NULL
 * with *_ok = 1 should not happen and is worth investigating.
 */

import initSqlJs from 'sql.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.join(__dirname, 'helmet.db');

const args = process.argv.slice(2);
const outPath = args.find((a) => !a.startsWith('--')) || 'training-data.csv';
const minRowsIdx = args.indexOf('--min-rows');
const MIN_ROWS = minRowsIdx >= 0 ? parseInt(args[minRowsIdx + 1], 10) : 30;

const COLUMNS = [
  'session_id',
  'timestamp',
  'elapsed_s',
  'co',
  'co2',
  'ch4',
  'h2s',
  'oxygen',
  'temperature',
  'humidity',
  'co_ok',
  'co2_ok',
  'ch4_ok',
  'h2s_ok',
  'oxygen_ok',
  'temperature_ok',
  'humidity_ok',
  'latitude',
  'longitude'
];

function csvCell(value) {
  if (value === null || value === undefined) return '';
  const s = String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

async function main() {
  if (!fs.existsSync(DB_PATH)) {
    console.error(`No database at ${DB_PATH}`);
    process.exit(1);
  }

  const SQL = await initSqlJs();
  const db = new SQL.Database(fs.readFileSync(DB_PATH));

  const result = db.exec(`
    SELECT session_id, timestamp,
           co, co2, ch4, h2s, oxygen, temperature, humidity,
           co_ok, co2_ok, ch4_ok, h2s_ok, oxygen_ok, temperature_ok, humidity_ok,
           latitude, longitude
    FROM sensors
    WHERE session_id IS NOT NULL
    ORDER BY session_id ASC, timestamp ASC
  `);

  if (!result || result.length === 0) {
    console.error('No rows with a session_id. Start the backend and record first.');
    process.exit(1);
  }

  const cols = result[0].columns;
  const idx = Object.fromEntries(cols.map((c, i) => [c, i]));
  const rows = result[0].values;

  // Group by session so short fragments can be dropped and elapsed time is
  // measured from each session's own start.
  const sessions = new Map();
  for (const row of rows) {
    const id = row[idx.session_id];
    if (!sessions.has(id)) sessions.set(id, []);
    sessions.get(id).push(row);
  }

  const lines = [COLUMNS.join(',')];
  let kept = 0;
  let dropped = 0;

  for (const [sessionId, sessionRows] of sessions) {
    if (sessionRows.length < MIN_ROWS) {
      dropped++;
      continue;
    }

    const startMs = Date.parse(sessionRows[0][idx.timestamp]);

    for (const row of sessionRows) {
      const ms = Date.parse(row[idx.timestamp]);
      const elapsed = Number.isFinite(ms) && Number.isFinite(startMs)
        ? ((ms - startMs) / 1000).toFixed(2)
        : '';

      lines.push([
        sessionId,
        row[idx.timestamp],
        elapsed,
        row[idx.co], row[idx.co2], row[idx.ch4], row[idx.h2s],
        row[idx.oxygen], row[idx.temperature], row[idx.humidity],
        row[idx.co_ok], row[idx.co2_ok], row[idx.ch4_ok], row[idx.h2s_ok],
        row[idx.oxygen_ok], row[idx.temperature_ok], row[idx.humidity_ok],
        row[idx.latitude], row[idx.longitude]
      ].map(csvCell).join(','));
    }
    kept++;
  }

  fs.writeFileSync(outPath, lines.join('\n') + '\n');

  console.log(`Wrote ${lines.length - 1} rows from ${kept} session(s) to ${outPath}`);
  if (dropped > 0) {
    console.log(`Skipped ${dropped} session(s) shorter than ${MIN_ROWS} rows (--min-rows to change)`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

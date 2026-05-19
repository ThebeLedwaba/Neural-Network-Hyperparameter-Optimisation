const express = require("express");
const cors = require("cors");
const mqtt = require("mqtt");
const Database = require("better-sqlite3");
const path = require("path");

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------
const BROKER_URL = "ws://192.168.0.177:9001";
const TOPIC_DATA = "greenhouse/data";
const PORT = 3001;

// ---------------------------------------------------------------------------
// Database setup
// ---------------------------------------------------------------------------
const db = new Database("greenhouse.db");
db.pragma("journal_mode = WAL");

db.exec(`
  CREATE TABLE IF NOT EXISTS readings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp TEXT NOT NULL,
    temperature REAL,
    humidity REAL,
    avg_temp REAL,
    avg_hum REAL,
    alert INTEGER DEFAULT 0,
    thr_temp REAL,
    thr_hum REAL,
    wifi_rssi INTEGER,
    uptime INTEGER,
    free_heap INTEGER
  )
`);

// Insert a reading
const insertReading = db.prepare(`
  INSERT INTO readings (timestamp, temperature, humidity, avg_temp, avg_hum, alert, thr_temp, thr_hum, wifi_rssi, uptime, free_heap)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

// ---------------------------------------------------------------------------
// MQTT - listen and store
// ---------------------------------------------------------------------------
const mqttClient = mqtt.connect(BROKER_URL);

mqttClient.on("connect", () => {
  console.log("Connected to MQTT broker");
  mqttClient.subscribe(TOPIC_DATA);
});

mqttClient.on("message", (topic, message) => {
  try {
    const data = JSON.parse(message.toString());
    const timestamp = new Date().toISOString();

    insertReading.run(
      timestamp,
      data.temperature ?? null,
      data.humidity ?? null,
      data.avg_temp ?? null,
      data.avg_hum ?? null,
      data.alert ? 1 : 0,
      data.thr_temp ?? null,
      data.thr_hum ?? null,
      data.wifi_rssi ?? null,
      data.uptime ?? null,
      data.free_heap ?? null
    );

    console.log(`Stored reading at ${timestamp}`);
  } catch (err) {
    console.error("Failed to store reading:", err.message);
  }
});

// ---------------------------------------------------------------------------
// Express API
// ---------------------------------------------------------------------------
const app = express();
app.use(cors());
app.use(express.json());

// ---------------------------------------------------------------------------
// Core Data APIs
// ---------------------------------------------------------------------------

// Get recent readings
app.get("/api/history", (req, res) => {
  const limit = parseInt(req.query.limit) || 100;
  const offset = parseInt(req.query.offset) || 0;

  try {
    const rows = db
      .prepare("SELECT * FROM readings ORDER BY id DESC LIMIT ? OFFSET ?")
      .all(limit, offset);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get aggregated stats
app.get("/api/stats", (req, res) => {
  try {
    const stats = db
      .prepare(`
        SELECT 
          COUNT(*) as total_readings,
          MIN(temperature) as min_temp,
          MAX(temperature) as max_temp,
          AVG(temperature) as avg_temp,
          MIN(humidity) as min_hum,
          MAX(humidity) as max_hum,
          AVG(humidity) as avg_hum,
          SUM(alert) as total_alerts
        FROM readings
        WHERE timestamp > datetime('now', '-24 hours')
      `)
      .get();
    res.json(stats);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get readings for a specific date range
app.get("/api/history/range", (req, res) => {
  const { start, end } = req.query;

  if (!start || !end) {
    return res.status(400).json({ error: "start and end query parameters required" });
  }

  try {
    const rows = db
      .prepare("SELECT * FROM readings WHERE timestamp BETWEEN ? AND ? ORDER BY id ASC")
      .all(start, end);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete old data
app.delete("/api/history/cleanup", (req, res) => {
  const days = parseInt(req.query.days) || 30;

  try {
    const result = db
      .prepare("DELETE FROM readings WHERE timestamp < datetime('now', ? || ' days')")
      .run(`-${days}`);
    res.json({ deleted: result.changes, message: `Deleted records older than ${days} days` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Health check
app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    uptime: process.uptime(),
    dbSize: db.prepare("SELECT COUNT(*) as count FROM readings").get().count,
  });
});

// ---------------------------------------------------------------------------
// Visualization APIs
// ---------------------------------------------------------------------------

// Hourly averages for the last 24 hours
app.get("/api/visualization/hourly", (req, res) => {
  try {
    const rows = db
      .prepare(`
        SELECT 
          strftime('%Y-%m-%dT%H:00:00Z', timestamp) as hour,
          AVG(temperature) as avg_temp,
          MIN(temperature) as min_temp,
          MAX(temperature) as max_temp,
          AVG(humidity) as avg_hum,
          MIN(humidity) as min_hum,
          MAX(humidity) as max_hum,
          SUM(alert) as alert_count
        FROM readings
        WHERE timestamp > datetime('now', '-24 hours')
        GROUP BY strftime('%Y-%m-%dT%H:00:00Z', timestamp)
        ORDER BY hour ASC
      `)
      .all();
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Daily summary for the last 30 days
app.get("/api/visualization/daily", (req, res) => {
  try {
    const rows = db
      .prepare(`
        SELECT 
          date(timestamp) as day,
          AVG(temperature) as avg_temp,
          MIN(temperature) as min_temp,
          MAX(temperature) as max_temp,
          AVG(humidity) as avg_hum,
          MIN(humidity) as min_hum,
          MAX(humidity) as max_hum,
          SUM(alert) as alert_count,
          COUNT(*) as reading_count
        FROM readings
        WHERE timestamp > datetime('now', '-30 days')
        GROUP BY date(timestamp)
        ORDER BY day ASC
      `)
      .all();
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Alert distribution
app.get("/api/visualization/alert-distribution", (req, res) => {
  try {
    const row = db
      .prepare(`
        SELECT 
          COUNT(*) as total_readings,
          SUM(alert) as alert_readings,
          ROUND(CAST(SUM(alert) AS FLOAT) / CAST(COUNT(*) AS FLOAT) * 100, 2) as alert_percentage
        FROM readings
        WHERE timestamp > datetime('now', '-7 days')
      `)
      .get();
    res.json(row);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Temperature distribution
app.get("/api/visualization/temp-distribution", (req, res) => {
  try {
    const rows = db
      .prepare(`
        SELECT 
          ROUND(temperature, 0) as temp_bucket,
          COUNT(*) as count
        FROM readings
        WHERE timestamp > datetime('now', '-24 hours')
        GROUP BY ROUND(temperature, 0)
        ORDER BY temp_bucket ASC
      `)
      .all();
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Threshold breach analysis
app.get("/api/visualization/threshold-breach", (req, res) => {
  try {
    const rows = db
      .prepare(`
        SELECT 
          timestamp,
          temperature,
          humidity,
          thr_temp,
          thr_hum,
          CASE 
            WHEN temperature > thr_temp THEN 'temp_high'
            WHEN humidity < thr_hum THEN 'hum_low'
            ELSE 'normal'
          END as breach_type
        FROM readings
        WHERE timestamp > datetime('now', '-24 hours')
          AND (temperature > thr_temp OR humidity < thr_hum)
        ORDER BY timestamp ASC
      `)
      .all();
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Latest snapshot (current state)
app.get("/api/visualization/current", (req, res) => {
  try {
    const row = db
      .prepare("SELECT * FROM readings ORDER BY id DESC LIMIT 1")
      .get();
    res.json(row);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---------------------------------------------------------------------------
// Start server
// ---------------------------------------------------------------------------
app.listen(PORT, () => {
  console.log(`Backend API running on http://localhost:${PORT}`);
  console.log(`Endpoints:`);
  console.log(`  GET /api/history?limit=100&offset=0`);
  console.log(`  GET /api/history/range?start=...&end=...`);
  console.log(`  GET /api/stats`);
  console.log(`  GET /api/health`);
  console.log(`  GET /api/visualization/hourly`);
  console.log(`  GET /api/visualization/daily`);
  console.log(`  GET /api/visualization/alert-distribution`);
  console.log(`  GET /api/visualization/temp-distribution`);
  console.log(`  GET /api/visualization/threshold-breach`);
  console.log(`  GET /api/visualization/current`);
  console.log(`  DELETE /api/history/cleanup?days=30`);
});
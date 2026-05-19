import { useState, useEffect, useRef } from "react";
import mqtt from "mqtt";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from "recharts";

// --------------------------------------------------------------------------
// Configuration
// --------------------------------------------------------------------------
const BROKER_URL = "ws://192.168.0.177:9001";
const TOPIC_DATA = "greenhouse/data";
const TOPIC_CONTROL = "greenhouse/control";
const API_URL = "http://localhost:3001";
const MAX_HISTORY = 20;

// --------------------------------------------------------------------------
// Component
// --------------------------------------------------------------------------
export default function GreenhouseDashboard() {
  const [data, setData] = useState(null);
  const [history, setHistory] = useState([]);
  const [status, setStatus] = useState("Connecting...");
  const [lastSeen, setLastSeen] = useState(null);
  const [dbConnected, setDbConnected] = useState(false);

  // Analytics state
  const [hourlyData, setHourlyData] = useState([]);
  const [alertDistribution, setAlertDistribution] = useState(null);
  const [tempDistribution, setTempDistribution] = useState([]);
  const [breachData, setBreachData] = useState([]);
  const [showAnalytics, setShowAnalytics] = useState(false);

  // Live hardware states (from MQTT)
  const [liveThrTemp, setLiveThrTemp] = useState(32.0);
  const [liveThrHum, setLiveThrHum] = useState(40.0);

  // Local draft states for inputs
  const [draftThrTemp, setDraftThrTemp] = useState("32");
  const [draftThrHum, setDraftThrHum] = useState("40");

  const [lcdMsg, setLcdMsg] = useState("");
  const [buzzerOn, setBuzzerOn] = useState(false);
  const [ledRed, setLedRed] = useState(false);
  const [ledGreen, setLedGreen] = useState(true);

  const clientRef = useRef(null);
  const beepIntervalRef = useRef(null);

  // --------------------------------------------------------------------------
  // Load historical data from backend on mount
  // --------------------------------------------------------------------------
  useEffect(() => {
    fetch(`${API_URL}/api/history?limit=100`)
      .then((res) => res.json())
      .then((rows) => {
        if (Array.isArray(rows) && rows.length > 0) {
          const formatted = rows.reverse().map((row) => ({
            ...row,
            temperature: row.temperature,
            humidity: row.humidity,
            avg_temp: row.avg_temp,
            avg_hum: row.avg_hum,
            alert: row.alert === 1,
            thr_temp: row.thr_temp,
            thr_hum: row.thr_hum,
            wifi_rssi: row.wifi_rssi,
            uptime: row.uptime,
            free_heap: row.free_heap,
            time: new Date(row.timestamp).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
              second: "2-digit",
            }),
          }));
          setHistory(formatted.slice(-MAX_HISTORY));
        }
        setDbConnected(true);
      })
      .catch((err) => {
        console.error("Failed to load history from backend:", err);
        setDbConnected(false);
      });
  }, []);

  // --------------------------------------------------------------------------
  // Load analytics data
  // --------------------------------------------------------------------------
  const loadAnalytics = () => {
    fetch(`${API_URL}/api/visualization/hourly`)
      .then((res) => res.json())
      .then((data) => setHourlyData(data))
      .catch((err) => console.error("Failed to load hourly data:", err));

    fetch(`${API_URL}/api/visualization/alert-distribution`)
      .then((res) => res.json())
      .then((data) => setAlertDistribution(data))
      .catch((err) => console.error("Failed to load alert distribution:", err));

    fetch(`${API_URL}/api/visualization/temp-distribution`)
      .then((res) => res.json())
      .then((data) => setTempDistribution(data))
      .catch((err) => console.error("Failed to load temp distribution:", err));

    fetch(`${API_URL}/api/visualization/threshold-breach`)
      .then((res) => res.json())
      .then((data) => setBreachData(data))
      .catch((err) => console.error("Failed to load breach data:", err));
  };

  const toggleAnalytics = () => {
    if (!showAnalytics) {
      loadAnalytics();
    }
    setShowAnalytics(!showAnalytics);
  };

  // --------------------------------------------------------------------------
  // Helper to play a short beep
  // --------------------------------------------------------------------------
  const playBeep = () => {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      osc.type = "square";
      osc.frequency.setValueAtTime(800, ctx.currentTime);
      osc.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.15);
    } catch (err) {
      // Audio not supported or blocked
    }
  };

  // --------------------------------------------------------------------------
  // MQTT connection & message handling
  // --------------------------------------------------------------------------
  useEffect(() => {
    const client = mqtt.connect(BROKER_URL);
    clientRef.current = client;

    client.on("connect", () => {
      setStatus("Connected");
      client.subscribe(TOPIC_DATA);
    });

    client.on("message", (topic, message) => {
      try {
        const parsed = JSON.parse(message.toString());
        setData(parsed);
        setLastSeen(new Date());

        if (parsed.thr_temp !== undefined) setLiveThrTemp(parsed.thr_temp);
        if (parsed.thr_hum !== undefined) setLiveThrHum(parsed.thr_hum);

        setHistory((prev) =>
          [
            ...prev,
            {
              ...parsed,
              time: new Date().toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit",
              }),
            },
          ].slice(-MAX_HISTORY)
        );
      } catch (e) {
        console.error("Bad payload:", e);
      }
    });

    client.on("error", () => setStatus("Connection error"));
    client.on("close", () => setStatus("Disconnected"));

    return () => client.end();
  }, []);

  // --------------------------------------------------------------------------
  // Repeating alarm while alert is active
  // --------------------------------------------------------------------------
  useEffect(() => {
    if (data?.alert) {
      beepIntervalRef.current = setInterval(() => {
        playBeep();
      }, 800);
    } else {
      if (beepIntervalRef.current) {
        clearInterval(beepIntervalRef.current);
        beepIntervalRef.current = null;
      }
    }

    return () => {
      if (beepIntervalRef.current) {
        clearInterval(beepIntervalRef.current);
        beepIntervalRef.current = null;
      }
    };
  }, [data?.alert]);

  // --------------------------------------------------------------------------
  // Publish helper
  // --------------------------------------------------------------------------
  const publish = (payload) => {
    if (clientRef.current?.connected) {
      clientRef.current.publish(TOPIC_CONTROL, JSON.stringify(payload));
    }
  };

  // --------------------------------------------------------------------------
  // Control handlers
  // --------------------------------------------------------------------------
  const handleBuzzerToggle = () => {
    const next = !buzzerOn;
    setBuzzerOn(next);
    publish({ command: "buzzer", value: next });
  };

  const handleLedOverride = () =>
    publish({ command: "led", red: ledRed, green: ledGreen });
  const handleLedAuto = () => publish({ command: "led_auto" });
  const handleBuzzerAuto = () => {
    setBuzzerOn(false);
    publish({ command: "buzzer_auto" });
  };

  const handleThrTemp = () =>
    publish({ command: "threshold_temp", value: parseFloat(draftThrTemp) });
  const handleThrHum = () =>
    publish({ command: "threshold_hum", value: parseFloat(draftThrHum) });

  const applyPreset = (temp, hum) => {
    setDraftThrTemp(temp.toString());
    setDraftThrHum(hum.toString());
    publish({ command: "threshold_temp", value: parseFloat(temp) });
    publish({ command: "threshold_hum", value: parseFloat(hum) });
  };

  const handleLcdSend = () => {
    if (lcdMsg.trim()) {
      publish({
        command: "lcd_message",
        value: lcdMsg.trim().substring(0, 16),
      });
      setLcdMsg("");
    }
  };

  const alert = data?.alert;

  // Pie chart colors
  const PIE_COLORS = ["#22c55e", "#ef4444"];

  // --------------------------------------------------------------------------
  // Render
  // --------------------------------------------------------------------------
  return (
    <>
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>

      <div
        style={{
          minHeight: "100vh",
          background: "#0f1117",
          color: "#e2e8f0",
          fontFamily: "sans-serif",
          padding: "2rem",
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "2rem",
          }}
        >
          <div>
            <h1 style={{ margin: 0, fontSize: "1.6rem", color: "#f8fafc" }}>
              Greenhouse Monitor
            </h1>
            <p style={{ margin: "4px 0 0", fontSize: "0.85rem", color: "#64748b" }}>
              Smart Hydroponics — ESP32 Live Feed
            </p>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
            {lastSeen && (
              <span style={{ fontSize: "0.75rem", color: "#64748b" }}>
                Updated {Math.round((Date.now() - lastSeen) / 1000)}s ago
              </span>
            )}
            {dbConnected && (
              <span style={{ fontSize: "0.75rem", color: "#22c55e" }}>
                DB
              </span>
            )}
            <div
              style={{
                padding: "6px 14px",
                borderRadius: "20px",
                fontSize: "0.8rem",
                background: status === "Connected" ? "#14532d" : "#450a0a",
                color: status === "Connected" ? "#4ade80" : "#f87171",
                border: `1px solid ${status === "Connected" ? "#16a34a" : "#dc2626"}`,
              }}
            >
              {status === "Connected" ? "● " : "○ "}
              {status}
            </div>
          </div>
        </div>

        {/* Alert Banner */}
        {alert && (
          <div
            style={{
              background: "#450a0a",
              border: "1px solid #dc2626",
              borderRadius: "10px",
              padding: "14px 20px",
              marginBottom: "1.5rem",
              color: "#fca5a5",
              fontWeight: 500,
              animation: "pulse 2s infinite",
            }}
          >
            SYSTEM ALERT — Temperature or humidity outside safe range
          </div>
        )}

        {/* Stat Cards */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
            gap: "1rem",
            marginBottom: "2rem",
          }}
        >
          <StatCard
            label="Temperature"
            value={data ? `${data.temperature}C` : "--"}
            sub={data ? `Avg: ${data.avg_temp}C` : "Waiting..."}
            accent={alert ? "#ef4444" : "#22c55e"}
          />
          <StatCard
            label="Humidity"
            value={data ? `${data.humidity}%` : "--"}
            sub={data ? `Avg: ${data.avg_hum}%` : "Waiting..."}
            accent={alert ? "#ef4444" : "#3b82f6"}
          />
          <StatCard
            label="Status"
            value={alert ? "ALERT" : "Stable"}
            sub={alert ? "Check greenhouse" : "All within range"}
            accent={alert ? "#ef4444" : "#22c55e"}
          />
          <StatCard
            label="Button"
            value={data?.button === 1 ? "Pressed" : "Idle"}
            sub="LCD average toggle"
            accent="#a78bfa"
          />
        </div>

        {/* Live Chart */}
        <div
          style={{
            background: "#1e2130",
            border: "1px solid #2d3148",
            borderRadius: "12px",
            padding: "1.5rem",
            marginBottom: "2rem",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "1.25rem",
            }}
          >
            <h2 style={{ margin: 0, fontSize: "1rem", color: "#94a3b8" }}>
              Live Environmental Trends
            </h2>
            <button
              onClick={toggleAnalytics}
              style={{
                background: showAnalytics ? "#22c55e" : "#1e2130",
                border: "1px solid #475569",
                borderRadius: "6px",
                color: showAnalytics ? "#fff" : "#94a3b8",
                cursor: "pointer",
                fontSize: "0.75rem",
                padding: "6px 14px",
              }}
            >
              {showAnalytics ? "Hide Analytics" : "Show Analytics"}
            </button>
          </div>
          <div style={{ width: "100%", height: 250 }}>
            {history.length === 0 ? (
              <div
                style={{
                  display: "flex",
                  justifyContent: "center",
                  alignItems: "center",
                  height: "100%",
                  color: "#475569",
                }}
              >
                Awaiting data streaming to draw charts...
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={history}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#2d3148" />
                  <XAxis dataKey="time" stroke="#64748b" style={{ fontSize: "0.75rem" }} />
                  <YAxis stroke="#64748b" style={{ fontSize: "0.75rem" }} />
                  <Tooltip
                    contentStyle={{
                      background: "#161827",
                      border: "1px solid #2d3148",
                      borderRadius: "6px",
                    }}
                  />
                  <Line type="monotone" dataKey="temperature" name="Temp (C)" stroke="#22c55e" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="humidity" name="Hum (%)" stroke="#3b82f6" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Analytics Section */}
        {showAnalytics && (
          <div
            style={{
              background: "#1e2130",
              border: "1px solid #2d3148",
              borderRadius: "12px",
              padding: "1.5rem",
              marginBottom: "2rem",
            }}
          >
            <h2 style={{ margin: "0 0 1.25rem", fontSize: "1rem", color: "#94a3b8" }}>
              Analytics Dashboard
            </h2>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(400px, 1fr))",
                gap: "1.5rem",
              }}
            >
              {/* Hourly Trends Chart */}
              <div
                style={{
                  background: "#161827",
                  border: "1px solid #2d3148",
                  borderRadius: "10px",
                  padding: "1rem",
                }}
              >
                <h3 style={{ margin: "0 0 1rem", fontSize: "0.85rem", color: "#94a3b8" }}>
                  24-Hour Temperature Trends (Hourly)
                </h3>
                {hourlyData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={250}>
                    <BarChart data={hourlyData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#2d3148" />
                      <XAxis
                        dataKey="hour"
                        stroke="#64748b"
                        tick={{ fontSize: 10 }}
                        tickFormatter={(val) => {
                          const d = new Date(val);
                          return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
                        }}
                      />
                      <YAxis stroke="#64748b" style={{ fontSize: "0.75rem" }} />
                      <Tooltip
                        contentStyle={{
                          background: "#161827",
                          border: "1px solid #2d3148",
                          borderRadius: "6px",
                        }}
                      />
                      <Legend />
                      <Bar dataKey="avg_temp" name="Avg Temp (C)" fill="#22c55e" />
                      <Bar dataKey="max_temp" name="Max Temp (C)" fill="#ef4444" />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "center",
                      alignItems: "center",
                      height: 250,
                      color: "#475569",
                    }}
                  >
                    Loading hourly data...
                  </div>
                )}
              </div>

              {/* Alert Distribution Pie Chart */}
              <div
                style={{
                  background: "#161827",
                  border: "1px solid #2d3148",
                  borderRadius: "10px",
                  padding: "1rem",
                }}
              >
                <h3 style={{ margin: "0 0 1rem", fontSize: "0.85rem", color: "#94a3b8" }}>
                  Alert Distribution (Last 7 Days)
                </h3>
                {alertDistribution ? (
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <ResponsiveContainer width="100%" height={250}>
                      <PieChart>
                        <Pie
                          data={[
                            {
                              name: "Normal",
                              value:
                                alertDistribution.total_readings -
                                alertDistribution.alert_readings,
                            },
                            { name: "Alert", value: alertDistribution.alert_readings },
                          ]}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={100}
                          paddingAngle={5}
                          dataKey="value"
                          label={({ name, percent }) =>
                            `${name} ${(percent * 100).toFixed(0)}%`
                          }
                        >
                          {[0, 1].map((index) => (
                            <Cell key={`cell-${index}`} fill={PIE_COLORS[index]} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "center",
                      alignItems: "center",
                      height: 250,
                      color: "#475569",
                    }}
                  >
                    Loading alert distribution...
                  </div>
                )}
              </div>

              {/* Temperature Distribution */}
              <div
                style={{
                  background: "#161827",
                  border: "1px solid #2d3148",
                  borderRadius: "10px",
                  padding: "1rem",
                }}
              >
                <h3 style={{ margin: "0 0 1rem", fontSize: "0.85rem", color: "#94a3b8" }}>
                  Temperature Distribution (Last 24 Hours)
                </h3>
                {tempDistribution.length > 0 ? (
                  <ResponsiveContainer width="100%" height={250}>
                    <BarChart data={tempDistribution}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#2d3148" />
                      <XAxis
                        dataKey="temp_bucket"
                        stroke="#64748b"
                        tick={{ fontSize: 10 }}
                        label={{
                          value: "Temperature (C)",
                          position: "insideBottom",
                          offset: -5,
                          style: { fill: "#64748b", fontSize: 12 },
                        }}
                      />
                      <YAxis stroke="#64748b" style={{ fontSize: "0.75rem" }} />
                      <Tooltip
                        contentStyle={{
                          background: "#161827",
                          border: "1px solid #2d3148",
                          borderRadius: "6px",
                        }}
                      />
                      <Bar dataKey="count" name="Readings" fill="#3b82f6" />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "center",
                      alignItems: "center",
                      height: 250,
                      color: "#475569",
                    }}
                  >
                    Loading temperature distribution...
                  </div>
                )}
              </div>

              {/* Threshold Breach List */}
              <div
                style={{
                  background: "#161827",
                  border: "1px solid #2d3148",
                  borderRadius: "10px",
                  padding: "1rem",
                }}
              >
                <h3 style={{ margin: "0 0 1rem", fontSize: "0.85rem", color: "#94a3b8" }}>
                  Threshold Breaches (Last 24 Hours)
                </h3>
                {breachData.length > 0 ? (
                  <div style={{ maxHeight: 250, overflowY: "auto" }}>
                    <table
                      style={{
                        width: "100%",
                        borderCollapse: "collapse",
                        fontSize: "0.75rem",
                      }}
                    >
                      <thead>
                        <tr style={{ background: "#1e2130" }}>
                          <th style={{ padding: "8px", textAlign: "left", color: "#64748b" }}>Time</th>
                          <th style={{ padding: "8px", textAlign: "left", color: "#64748b" }}>Temp</th>
                          <th style={{ padding: "8px", textAlign: "left", color: "#64748b" }}>Hum</th>
                          <th style={{ padding: "8px", textAlign: "left", color: "#64748b" }}>Type</th>
                        </tr>
                      </thead>
                      <tbody>
                        {breachData.map((row, i) => (
                          <tr
                            key={i}
                            style={{
                              borderTop: "1px solid #2d3148",
                              background: i % 2 === 0 ? "transparent" : "#1e2130",
                            }}
                          >
                            <td style={{ padding: "8px", color: "#94a3b8" }}>
                              {new Date(row.timestamp).toLocaleTimeString()}
                            </td>
                            <td style={{ padding: "8px", color: "#f87171" }}>{row.temperature}C</td>
                            <td style={{ padding: "8px", color: "#60a5fa" }}>{row.humidity}%</td>
                            <td style={{ padding: "8px" }}>
                              <span
                                style={{
                                  padding: "2px 8px",
                                  borderRadius: "4px",
                                  fontSize: "0.7rem",
                                  background: row.breach_type === "temp_high" ? "#450a0a" : "#0a2a45",
                                  color: row.breach_type === "temp_high" ? "#fca5a5" : "#93c5fd",
                                }}
                              >
                                {row.breach_type === "temp_high" ? "Temp High" : "Hum Low"}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "center",
                      alignItems: "center",
                      height: 250,
                      color: "#475569",
                    }}
                  >
                    No breaches detected in the last 24 hours
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Control Panel */}
        <div
          style={{
            background: "#1e2130",
            border: "1px solid #2d3148",
            borderRadius: "12px",
            padding: "1.5rem",
            marginBottom: "2rem",
          }}
        >
          <h2 style={{ margin: "0 0 1.25rem", fontSize: "1rem", color: "#94a3b8" }}>
            Hardware Controls
          </h2>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
              gap: "1.25rem",
            }}
          >
            {/* Buzzer */}
            <ControlCard title="Buzzer">
              <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                <CtrlBtn
                  label={buzzerOn ? "Turn Buzzer OFF" : "Turn Buzzer ON"}
                  color={buzzerOn ? "#dc2626" : "#16a34a"}
                  onClick={handleBuzzerToggle}
                />
                <CtrlBtn label="Set to Auto" color="#475569" onClick={handleBuzzerAuto} />
              </div>
              <p style={{ margin: "8px 0 0", fontSize: "0.75rem", color: "#64748b" }}>
                {data?.buzzer_manual ? "Manual mode" : "Auto mode — follows alert state"}
              </p>
            </ControlCard>

            {/* LED Override */}
            <ControlCard title="LED Override">
              <div style={{ display: "flex", gap: "12px", marginBottom: "10px" }}>
                <label
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                    fontSize: "0.85rem",
                    cursor: "pointer",
                  }}
                >
                  <input type="checkbox" checked={ledRed} onChange={(e) => setLedRed(e.target.checked)} />
                  <span style={{ color: "#f87171" }}>Red LED</span>
                </label>
                <label
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                    fontSize: "0.85rem",
                    cursor: "pointer",
                  }}
                >
                  <input type="checkbox" checked={ledGreen} onChange={(e) => setLedGreen(e.target.checked)} />
                  <span style={{ color: "#4ade80" }}>Green LED</span>
                </label>
              </div>
              <div style={{ display: "flex", gap: "8px" }}>
                <CtrlBtn label="Apply" color="#2563eb" onClick={handleLedOverride} />
                <CtrlBtn label="Set to Auto" color="#475569" onClick={handleLedAuto} />
              </div>
              <p style={{ margin: "8px 0 0", fontSize: "0.75rem", color: "#64748b" }}>
                {data?.led_manual ? "Manual mode" : "Auto mode — follows alert state"}
              </p>
            </ControlCard>

            {/* Thresholds */}
            <ControlCard title="Alert Thresholds">
              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <div style={{ display: "flex", flexDirection: "column", width: "110px" }}>
                      <span style={{ fontSize: "0.8rem", color: "#94a3b8" }}>Temp (C) max</span>
                      <span style={{ fontSize: "0.7rem", color: "#64748b" }}>Live: {liveThrTemp}C</span>
                    </div>
                    <input type="range" min="10" max="50" step="0.5" value={draftThrTemp} onChange={(e) => setDraftThrTemp(e.target.value)} style={{ width: "70px" }} />
                    <input type="number" value={draftThrTemp} step="0.5" onChange={(e) => setDraftThrTemp(e.target.value)} style={inputStyle} />
                    <CtrlBtn label="Set" color="#d97706" onClick={handleThrTemp} small />
                  </div>
                </div>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <div style={{ display: "flex", flexDirection: "column", width: "110px" }}>
                      <span style={{ fontSize: "0.8rem", color: "#94a3b8" }}>Hum (%) min</span>
                      <span style={{ fontSize: "0.7rem", color: "#64748b" }}>Live: {liveThrHum}%</span>
                    </div>
                    <input type="range" min="10" max="90" step="1" value={draftThrHum} onChange={(e) => setDraftThrHum(e.target.value)} style={{ width: "70px" }} />
                    <input type="number" value={draftThrHum} step="1" onChange={(e) => setDraftThrHum(e.target.value)} style={inputStyle} />
                    <CtrlBtn label="Set" color="#d97706" onClick={handleThrHum} small />
                  </div>
                </div>
                <div style={{ marginTop: "6px", borderTop: "1px solid #2d3148", paddingTop: "8px" }}>
                  <p style={{ margin: "0 0 6px", fontSize: "0.7rem", color: "#64748b", textTransform: "uppercase" }}>
                    Quick Demo Presets
                  </p>
                  <div style={{ display: "flex", gap: "6px" }}>
                    <button onClick={() => applyPreset(35.0, 40.0)} style={presetBtnStyle}>Optimal</button>
                    <button onClick={() => applyPreset(22.0, 80.0)} style={presetBtnStyle}>Trigger Alert</button>
                  </div>
                </div>
              </div>
            </ControlCard>

            {/* LCD Message */}
            <ControlCard title="LCD Message">
              <input
                type="text"
                maxLength={16}
                value={lcdMsg}
                placeholder="Max 16 characters..."
                onChange={(e) => setLcdMsg(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleLcdSend()}
                style={{ ...inputStyle, width: "100%", marginBottom: "10px" }}
              />
              <CtrlBtn label="Send to LCD" color="#7c3aed" onClick={handleLcdSend} />
              <p style={{ margin: "8px 0 0", fontSize: "0.75rem", color: "#64748b" }}>
                Displays for 5 seconds then reverts
              </p>
            </ControlCard>
          </div>
        </div>

        {/* History Table */}
        <div
          style={{
            background: "#1e2130",
            borderRadius: "12px",
            border: "1px solid #2d3148",
            overflow: "hidden",
            marginBottom: "2rem",
          }}
        >
          <div style={{ padding: "1rem 1.5rem", borderBottom: "1px solid #2d3148" }}>
            <h2 style={{ margin: 0, fontSize: "1rem", color: "#94a3b8" }}>Recent Readings</h2>
          </div>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.875rem" }}>
            <thead>
              <tr style={{ background: "#161827" }}>
                {["Time", "Temp (C)", "Humidity (%)", "Status"].map((h) => (
                  <th key={h} style={{ padding: "10px 16px", textAlign: "left", color: "#64748b", fontWeight: 500 }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {history.length === 0 ? (
                <tr>
                  <td colSpan={4} style={{ padding: "20px 16px", color: "#475569", textAlign: "center" }}>
                    Waiting for data...
                  </td>
                </tr>
              ) : (
                [...history].reverse().map((row, i) => (
                  <tr
                    key={i}
                    style={{
                      borderTop: "1px solid #2d3148",
                      background: i % 2 === 0 ? "transparent" : "#161827",
                    }}
                  >
                    <td style={{ padding: "10px 16px", color: "#94a3b8" }}>{row.time}</td>
                    <td style={{ padding: "10px 16px", color: row.alert ? "#f87171" : "#4ade80" }}>
                      {row.temperature}
                    </td>
                    <td style={{ padding: "10px 16px", color: row.alert ? "#f87171" : "#60a5fa" }}>
                      {row.humidity}
                    </td>
                    <td style={{ padding: "10px 16px" }}>
                      <span
                        style={{
                          padding: "2px 10px",
                          borderRadius: "12px",
                          fontSize: "0.75rem",
                          background: row.alert ? "#450a0a" : "#14532d",
                          color: row.alert ? "#fca5a5" : "#4ade80",
                        }}
                      >
                        {row.alert ? "ALERT" : "Stable"}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* System Status Footer */}
        {(data?.wifi_rssi || data?.uptime || data?.free_heap) && (
          <div
            style={{
              background: "#1e2130",
              border: "1px solid #2d3148",
              borderRadius: "10px",
              padding: "0.75rem 1.25rem",
              display: "flex",
              gap: "1.5rem",
              flexWrap: "wrap",
              fontSize: "0.8rem",
              color: "#94a3b8",
            }}
          >
            {data.wifi_rssi && <span>WiFi: {data.wifi_rssi} dBm</span>}
            {data.uptime !== undefined && <span>Uptime: {data.uptime}s</span>}
            {data.free_heap && <span>Free heap: {data.free_heap} KB</span>}
          </div>
        )}
      </div>
    </>
  );
}

// ==========================================================================
// Reusable styled sub-components
// ==========================================================================
function StatCard({ label, value, sub, accent }) {
  return (
    <div
      style={{
        background: "#1e2130",
        border: `1px solid ${accent}33`,
        borderRadius: "12px",
        padding: "1.25rem",
      }}
    >
      <p
        style={{
          margin: "0 0 8px",
          fontSize: "0.8rem",
          color: "#64748b",
          textTransform: "uppercase",
          letterSpacing: "0.05em",
        }}
      >
        {label}
      </p>
      <p style={{ margin: "0 0 4px", fontSize: "2rem", fontWeight: 600, color: accent }}>
        {value}
      </p>
      <p style={{ margin: 0, fontSize: "0.8rem", color: "#475569" }}>{sub}</p>
    </div>
  );
}

function ControlCard({ title, children }) {
  return (
    <div
      style={{
        background: "#161827",
        border: "1px solid #2d3148",
        borderRadius: "10px",
        padding: "1rem",
      }}
    >
      <p
        style={{
          margin: "0 0 12px",
          fontSize: "0.8rem",
          color: "#64748b",
          textTransform: "uppercase",
          letterSpacing: "0.05em",
        }}
      >
        {title}
      </p>
      {children}
    </div>
  );
}

function CtrlBtn({ label, color, onClick, small }) {
  return (
    <button
      onClick={onClick}
      style={{
        background: color,
        border: "none",
        borderRadius: "6px",
        cursor: "pointer",
        color: "#fff",
        fontWeight: 500,
        padding: small ? "5px 12px" : "8px 16px",
        fontSize: small ? "0.75rem" : "0.85rem",
      }}
    >
      {label}
    </button>
  );
}

const inputStyle = {
  background: "#0f1117",
  border: "1px solid #2d3148",
  borderRadius: "6px",
  color: "#e2e8f0",
  padding: "6px 10px",
  fontSize: "0.85rem",
  width: "80px",
};

const presetBtnStyle = {
  background: "#1e2130",
  border: "1px solid #475569",
  borderRadius: "4px",
  color: "#94a3b8",
  cursor: "pointer",
  fontSize: "0.7rem",
  padding: "4px 8px",
};
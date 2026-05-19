# Smart Greenhouse Monitor

Real-time greenhouse monitoring system with bidirectional hardware control. ESP32 collects temperature/humidity via DHT22 sensors, publishes to MQTT broker, and React dashboard displays live charts with interactive threshold controls and hardware management.

## Features

- **Real-time sensor data** (DHT22, every 2 seconds)
- **Live line chart** (temperature + humidity trends, 20-reading history)
- **Bidirectional hardware control** (buzzer, LEDs, LCD messaging, thresholds)
- **Alert system** (pulsing banner, colour-coded warnings)
- **Offline resilience** (local LCD continues if WiFi drops)
- **Database persistence** (SQLite with WAL mode for reliability)

## System Demo

https://github.com/YOUR_USERNAME/Microsystems-Dash/assets/VID_20260519_194625.mp4

*Watch the ESP32 sensor readings stream live to the React dashboard with real-time charts and hardware control in action.*

## Project Structure

```
Microsystems Dash/
├── Final code c++/
│   └── sketch_may17a.ino         # ESP32 firmware with DHT22, MQTT, LCD, hardware control
├── greenhouse-backend/           # Express.js server
│   ├── server.js                # MQTT listener & REST API
│   ├── greenhouse.db            # SQLite readings database
│   └── package.json
├── greenhouse-dashboard/         # React + Vite frontend
│   ├── src/
│   │   ├── components/
│   │   │   └── GreenhouseDashboard.jsx  # Main dashboard, charts, controls
│   │   ├── App.jsx
│   │   ├── main.jsx
│   │   └── assets/
│   ├── vite.config.js
│   ├── eslint.config.js
│   └── package.json
├── README.md
├── INSTALL.md
└── ARCHITECTURE.md
```

## Quick Start

```bash
# 1. Start MQTT broker
mosquitto -c mosquitto.conf

# 2. Run backend
cd greenhouse-backend
npm install
node server.js

# 3. Run dashboard (new terminal)
cd greenhouse-dashboard
npm install
npm run dev
```

Open http://localhost:5173 in your browser.

## Getting Started

### Prerequisites

- Node.js v14+
- MQTT Broker (Mosquitto or HiveMQ Cloud)
- Arduino IDE (for ESP32 firmware upload)
- ESP32 development board

### ESP32 Firmware Setup

1. Open `Final code c++/sketch_may17a.ino` in Arduino IDE
2. Install required libraries:
   - PubSubClient (MQTT)
   - DHT sensor library (Adafruit)
   - LiquidCrystal_I2C (LCD display)
   - ArduinoJson (JSON parsing)

3. Configure ESP32 settings in code:
   ```cpp
   const char* WIFI_SSID     = "YOUR_SSID";
   const char* WIFI_PASSWORD = "YOUR_PASSWORD";
   const char* MQTT_BROKER   = "YOUR_BROKER_IP";
   ```

4. Configure pin assignments (if different from defaults):
   ```cpp
   #define I2C_SDA     21
   #define I2C_SCL     22
   #define DHTPIN      4
   #define LED_GREEN   5
   #define LED_RED     2
   #define BUZZER      23
   #define BUTTON_PIN  18
   ```

5. Select Board: ESP32 Dev Module
6. Upload to ESP32
7. Monitor serial output to confirm WiFi/MQTT connection

### Backend Setup

1. Configure MQTT broker in `greenhouse-backend/server.js`:
   ```javascript
   const BROKER_URL = "ws://YOUR_BROKER_IP:9001";
   ```

2. Install and run:
   ```bash
   cd greenhouse-backend
   npm install
   node server.js
   ```

3. Verify console shows: "Connected to MQTT broker"

### Frontend Setup

1. Configure in `greenhouse-dashboard/src/components/GreenhouseDashboard.jsx`:
   ```javascript
   const BROKER_URL = "ws://YOUR_BROKER_IP:9001";
   const API_URL = "http://localhost:3001";
   ```

2. Install and run:
   ```bash
   cd greenhouse-dashboard
   npm install
   npm run dev
   ```

3. Open http://localhost:5173 to view dashboard

## Tech Stack

| Layer | Technologies |
|-------|--------------|
| Firmware | C++ (ESP32, DHT22, MQTT, LCD I2C) |
| Broker | Mosquitto MQTT (WebSocket port 9001) |
| Dashboard | React 19, Recharts, MQTT.js, Vite |
| Backend | Express.js, SQLite, Better-sqlite3 |
| Deployment | Local network / cloud-ready |

## Hardware Components

- **Microcontroller**: ESP32 (WiFi + dual-core processor)
- **Temperature/Humidity Sensor**: DHT22 (±0.5C, ±2% RH accuracy)
- **Display**: 16x2 LCD with I2C interface
- **Indicators**: Green LED (normal), Red LED (alert)
- **Audio**: Buzzer for threshold alerts
- **Button**: Manual control input

## Database Schema

The SQLite database stores greenhouse readings with the following structure:

```sql
CREATE TABLE readings (
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
```

## Key Technical Challenge Solved

**Problem:** Incoming MQTT messages kept overwriting user-typed threshold values, preventing manual input.

**Solution:** Dual-state pattern separating device state from user input:
- `liveThrTemp` (device state from ESP32)
- `draftThrTemp` (user input in dashboard)

This pattern ensures smooth UX: user can type thresholds without interruption while device state updates independently.

**Applicable to:** Any IoT dashboard with bidirectional control.

## MQTT Communication

### Topics

- `greenhouse/data` (published by ESP32 every 2 seconds)
- `greenhouse/control` (subscribed by ESP32 for commands)

### Message Format

```json
{
  "temperature": 25.5,
  "humidity": 60.2,
  "avg_temp": 24.8,
  "avg_hum": 59.5,
  "alert": 0,
  "thr_temp": 32.0,
  "thr_hum": 40.0,
  "wifi_rssi": -45,
  "uptime": 3600000,
  "free_heap": 125000
}
```

### Control Commands

```json
{
  "command": "buzzer",
  "value": true
}
```

Supported commands: `buzzer`, `buzzer_auto`, `led`, `led_auto`, `lcd`, `lcd_clear`, `threshold_temp`, `threshold_hum`



## API Endpoints

### GET `/api/readings`
Retrieve stored sensor readings from database.

Query parameters:
- `limit` - Number of readings to return (default: 100)
- `offset` - Number of readings to skip (default: 0)

Response:
```json
[
  {
    "id": 1,
    "timestamp": "2026-05-19T10:30:00Z",
    "temperature": 25.5,
    "humidity": 60.2,
    "alert": 0
  }
]
```

### GET `/api/analytics`
Get analytics data for historical analysis.

Response includes hourly averages, alert distribution, temperature ranges.

### POST `/api/threshold`
Update device thresholds (sent to ESP32 via MQTT).

Body:
```json
{
  "temperature": 32.0,
  "humidity": 40.0
}
```

## Dashboard Features

### Real-Time Metrics Display
- Current temperature and humidity readings
- System status (WiFi connection, uptime)
- Threshold indicators (visual warning if values exceed thresholds)

### Interactive Charts
- Line chart showing 20-reading history of temperature and humidity trends
- Real-time updates every 2 seconds from ESP32

### Hardware Control Panel
- Toggle buzzer on/off
- Control LED colors (green/red)
- Send custom messages to LCD display
- Set temperature and humidity thresholds
- All controls sync bidirectionally with ESP32

### Alert System
- Pulsing banner when thresholds are breached
- Color-coded indicators (green = normal, red = alert)
- Audio alert via buzzer when configured

## Configuration

### ESP32 Firmware (`code/code.ino`)

```cpp
// WiFi
const char* WIFI_SSID     = "DStv_Internet_2.4G_974A03";
const char* WIFI_PASSWORD = "8VD8555U64";

// MQTT
const char* MQTT_BROKER   = "192.168.0.177";
const int   MQTT_PORT     = 1883;
const char* TOPIC_DATA    = "greenhouse/data";
const char* TOPIC_CONTROL = "greenhouse/control";

// Pins
#define I2C_SDA     21
#define I2C_SCL     22
#define DHTPIN      4
#define LED_GREEN   5
#define LED_RED     2
#define BUZZER      23
#define BUTTON_PIN  18

// Thresholds
float thresholdTemp = 32.0;  // degrees Celsius
float thresholdHum  = 40.0;  // percent humidity
```

### Backend (`greenhouse-backend/server.js`)

```javascript
const BROKER_URL = "ws://192.168.0.177:9001";
const TOPIC_DATA = "greenhouse/data";
const PORT = 3001;
```

### Frontend (`greenhouse-dashboard/src/components/GreenhouseDashboard.jsx`)

```javascript
const BROKER_URL = "ws://192.168.0.177:9001";
const API_URL = "http://localhost:3001";
const MAX_HISTORY = 20;  // readings to keep in chart
```

## Available Scripts

### Frontend
```bash
npm run dev      # Start Vite dev server (http://localhost:5173)
npm run build    # Build for production
npm run lint     # Run ESLint
npm run preview  # Preview production build
```

### Backend
```bash
node server.js   # Start Express server with MQTT listener
```

### MQTT Broker
```bash
mosquitto -c mosquitto.conf  # Start Mosquitto broker
```

## Troubleshooting

### ESP32 WiFi/MQTT Issues
- Check SSID and password match your network
- Verify MQTT broker IP is correct and accessible
- Check Serial Monitor (Tools > Serial Monitor, baud 115200) for connection status
- Restart ESP32 if connection drops

### Dashboard Shows "Connecting..."
- Verify MQTT broker is running: `mosquitto -v`
- Check firewall allows WebSocket on port 9001
- Open browser DevTools (F12) Console tab for connection errors
- Verify BROKER_URL in GreenhouseDashboard.jsx matches running broker

### No Data Appearing
- Confirm ESP32 is publishing to MQTT: use MQTT client to monitor `greenhouse/data`
- Check backend logs show "Connected to MQTT broker"
- Verify database permissions in greenhouse-backend/ directory

### Hardware Controls Not Working
- Check Serial Monitor for command reception on ESP32
- Verify pin definitions match your wiring
- Test buzzer/LEDs with simple blink sketch first
- Check LCD i2c address (default 0x27, may vary)

### LCD Not Displaying
- I2C Address may differ: scan with I2C Scanner sketch
- Update address in code: `LiquidCrystal_I2C lcd(0x27, 16, 2);`
- Check SDA/SCL pin definitions match your board

### Port Already in Use
```bash
# Kill process on port 3001
lsof -i :3001
kill -9 <PID>

# Or change PORT in server.js
```

##  Build & Deploy

### Production Build
```bash
cd greenhouse-dashboard
npm run build
# Static files in dist/ directory
```

### Docker Setup (Optional)
Create a Dockerfile for containerized deployment:
```dockerfile
FROM node:18
WORKDIR /app
COPY greenhouse-backend .
RUN npm install
EXPOSE 3001
CMD ["node", "server.js"]
```

## 📄 License

ISC

## Contributing

Contributions are welcome! Please:
1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Open a pull request

## Support

For issues or questions, please open an issue on GitHub or contact the maintainers.

---

**Last Updated**: May 2026  
**Version**: 1.0.0

# Architecture & System Design

## System Overview

```
Hardware Layer:
┌──────────────────────────────────────────────┐
│ ESP32 with DHT22 Sensor                      │
│ - Reads every 2 seconds                      │
│ - WiFi connectivity                          │
│ - MQTT publish/subscribe                     │
│ - Local LCD display                          │
│ - Buzzer, LED indicators                     │
└──────────────┬───────────────────────────────┘
               │ MQTT (1883)
               ▼
┌──────────────────────────────────────────────┐
│ MQTT Broker (Mosquitto)                      │
│ WebSocket interface (9001)                   │
└──────┬───────────────────────────┬───────────┘
       │                           │
   pub/sub               pub/sub (WebSocket)
       │                           │
       ▼                           ▼
┌──────────────────────┐    ┌──────────────────┐
│ Backend              │    │ Frontend         │
│ (Express.js)         │    │ (React + Vite)   │
│ SQLite persistence   │    │ Recharts charts  │
│ REST API             │    │ MQTT.js client   │
└──────────────────────┘    └──────────────────┘
```

## Component Details

### 1. Hardware Layer (ESP32)

**Sensors & Inputs:**
- DHT22: Temperature (±0.5C) and humidity (±2% RH)
- WiFi: Network connectivity
- Button: Manual control input

**Outputs:**
- I2C LCD (16x2): Local display, offline-resilient
- Green LED: Normal operation indicator
- Red LED: Alert indicator
- Buzzer: Audio alert for thresholds

**Responsibilities:**
- Read DHT22 every 2 seconds
- Calculate rolling averages
- Publish to `greenhouse/data` topic
- Subscribe to `greenhouse/control` for commands
- Display data on local LCD (survives WiFi outage)
- Control LEDs and buzzer based on thresholds/commands

**Pin Configuration:**
```
ESP32 Pin 4:   DHT22 data
ESP32 Pin 5:   Green LED
ESP32 Pin 2:   Red LED
ESP32 Pin 23:  Buzzer
ESP32 Pin 18:  Button (input)
ESP32 Pin 21:  I2C SDA (LCD)
ESP32 Pin 22:  I2C SCL (LCD)
```

### 2. MQTT Broker Layer (Mosquitto)

**Responsibilities:**
- Pub/sub message routing
- WebSocket bridge for browser clients
- Message persistence (optional)

**Configuration:**
- Port 1883: Native MQTT
- Port 9001: WebSocket
- Broker IP: 192.168.0.177 (configurable)

**Topics:**
- `greenhouse/data`: Sensor readings (ESP32 -> Broker)
- `greenhouse/control`: Commands (Dashboard -> Broker -> ESP32)

### 3. Backend Layer (Express.js + SQLite)

**Responsibilities:**
- Listen to MQTT messages on `greenhouse/data`
- Store readings in SQLite database
- Provide REST API for historical data
- Handle data aggregation

**Data Flow:**
```
MQTT Message → Parse JSON → Insert to SQLite → Available via API
```

**Database Schema:**
```sql
CREATE TABLE readings (
  id INTEGER PRIMARY KEY,
  timestamp TEXT,
  temperature REAL,
  humidity REAL,
  avg_temp REAL,
  avg_hum REAL,
  alert INTEGER,
  thr_temp REAL,
  thr_hum REAL,
  wifi_rssi INTEGER,
  uptime INTEGER,
  free_heap INTEGER
)
```

**Key Features:**
- WAL (Write-Ahead Logging) for reliability
- Concurrent access support
- Persistent storage of all readings

### 4. Frontend Layer (React + Vite)

**Responsibilities:**
- Display real-time sensor data
- Render live charts (20-reading history)
- Allow user threshold adjustment
- Send hardware control commands
- Display alert banners

**Key Technical Solution: Dual-State Pattern**

Problem: MQTT messages overwrote user-typed threshold values.

Solution: Separate states for device and user:
```javascript
// Device state from ESP32
const [liveThrTemp, setLiveThrTemp] = useState(32.0);

// User input (draft)
const [draftThrTemp, setDraftThrTemp] = useState("32");

// Send only on user click, not on MQTT updates
const handleSetThreshold = () => {
  const value = parseFloat(draftThrTemp);
  // Publish to MQTT
  // Display confirmation
};
```

Benefit: User can type continuously while device updates independently.

**Components:**
- Line Chart: Real-time temperature/humidity trends
- Alert Banner: Pulsing when thresholds breached
- Control Panel: Threshold inputs, hardware toggles
- Status Display: Current readings, connection status

## Data Flow Patterns

### Real-Time Sensor Flow (2-second cycle)
```
ESP32 reads DHT22
    ↓
Calculate averages (rolling window)
    ↓
Check thresholds → Set alert flag
    ↓
Control LEDs/Buzzer locally
    ↓
Publish JSON to MQTT greenhouse/data
    ↓
Backend subscribes, stores to SQLite
    ↓
Frontend subscribes, updates charts/display
```

### Hardware Control Flow
```
User clicks "Toggle Buzzer"
    ↓
React state updates
    ↓
Publish to greenhouse/control topic
    ↓
ESP32 subscribes, receives command
    ↓
Execute on buzzer pin
    ↓
Send confirmation status back to MQTT
    ↓
Dashboard displays result
```

### Historical Data Flow
```
Frontend requests /api/readings
    ↓
Backend queries SQLite
    ↓
Returns JSON array of readings
    ↓
Recharts renders visualization
```

## Offline Resilience

**ESP32 Local Features (WiFi down scenario):**
- LCD continues showing current readings
- Thresholds still enforced locally
- LEDs and buzzer still function
- Button still controls local state
- Data buffered in EEPROM (optional)

**Dashboard Features:**
- Shows last known readings if disconnected
- Displays "Offline" status
- Retries MQTT connection automatically

## Deployment Architecture

### Development (Local Network)
```
PC (WiFi 192.168.0.x)
├── ESP32 connects to WiFi
├── Mosquitto runs on PC (192.168.0.177:1883)
├── Backend runs on PC (localhost:3001)
└── Frontend runs on PC (localhost:5173)
```

### Production Options

**Option 1: Single Server**
- All services on one machine (Raspberry Pi, VPS)
- Static IP for WiFi connection
- Database backups scheduled

**Option 2: Docker Container**
```yaml
services:
  mqtt:
    image: eclipse-mosquitto
    ports: [1883, 9001]
  
  backend:
    image: node:18
    depends_on: [mqtt]
    environment:
      BROKER_URL: mqtt://mqtt:1883
  
  frontend:
    image: nginx:latest
    volumes:
      - ./dist:/usr/share/nginx/html
```

**Option 3: Cloud Deployment**
- Frontend on S3/CloudFront
- Backend on EC2/AppService
- Database on RDS/Cosmos DB
- MQTT on AWS IoT Core or HiveMQ Cloud
- ESP32 connects to cloud broker

## Performance Characteristics

**Latency:**
- DHT22 Read: ~250ms
- MQTT Publish: ~100ms (local network)
- Dashboard Update: ~1-2 seconds (browser refresh rate)
- Total sensor-to-dashboard: ~2-3 seconds

**Throughput:**
- 1 sensor @ 2-second interval = 30 messages/minute = 0.5 KB/s
- Database grows ~1.4 MB/month (with all fields)
- SQLite supports ~1M rows before performance degrades

**Memory:**
- ESP32: ~150KB for code + data structures
- Dashboard: ~50MB (React + Recharts)
- Browser history buffer: ~20 readings (5KB)

## Scaling Considerations

**Current Scale:**
- 1 ESP32 device
- Local MQTT broker
- SQLite database

**To Add More Sensors:**
1. Each device publishes with unique ID in topic
2. Backend routes to same database (add device_id column)
3. Frontend filters/displays by device
4. Database indexing on (device_id, timestamp)

**To Scale to Cloud:**
1. Use managed MQTT service (AWS IoT Core, HiveMQ Cloud)
2. Migrate SQLite to TimescaleDB/InfluxDB (time-series optimized)
3. Add authentication (certificates for ESP32, JWT for dashboard)
4. Implement data aggregation for old readings (hourly/daily summaries)

## Security Considerations

Current (Development):
- WiFi SSID/password in firmware (not encrypted)
- No MQTT authentication
- No API authentication
- HTTP only

Recommended (Production):
- WiFi credentials in secure storage (EEPROM with encryption)
- MQTT username/password authentication
- TLS/SSL for MQTT connections
- JWT tokens for API endpoints
- HTTPS for frontend
- Rate limiting on API
- Input validation on threshold values
- Regular dependency updates

## Monitoring & Observability

**Current Logging:**
- Serial Monitor output from ESP32
- Backend console logs
- Browser DevTools console

**Recommended:**
- Structured logging (Winston/Pino)
- Metrics collection (Prometheus)
- Application monitoring (Sentry/DataDog)
- Alerts for connection loss
- Database query performance tracking
- ESP32 uptime/health metrics

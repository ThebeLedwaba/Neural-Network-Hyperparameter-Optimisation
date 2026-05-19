# Installation & Setup Guide

## Quick Start (5 minutes)

### 1. Clone the repository
```bash
git clone https://github.com/YOUR_USERNAME/Microsystems-Dash.git
cd Microsystems\ Dash
```

### 2. Install all dependencies
```bash
# Backend
cd greenhouse-backend
npm install
cd ..

# Frontend
cd greenhouse-dashboard
npm install
cd ..
```

### 3. Configure your MQTT Broker

Edit these files with your MQTT broker IP address:

**Backend** - `greenhouse-backend/server.js` (line ~9):
```javascript
const BROKER_URL = "ws://YOUR_BROKER_IP:9001";
```

**Frontend** - `greenhouse-dashboard/src/components/GreenhouseDashboard.jsx` (line ~15):
```javascript
const BROKER_URL = "ws://YOUR_BROKER_IP:9001";
```

### 4. Start the backend
```bash
cd greenhouse-backend
node server.js
```

You should see: `Connected to MQTT broker` and `Server listening on port 3001`

### 5. Start the frontend (in a new terminal)
```bash
cd greenhouse-dashboard
npm run dev
```

Open your browser to `http://localhost:5173`

## Full System Setup

### MQTT Broker Setup

**Option A: Local Mosquitto Broker**
```bash
# Install
brew install mosquitto        # macOS
sudo apt-get install mosquitto  # Linux
choco install mosquitto       # Windows

# Run
mosquitto -c /path/to/config.conf
# Default: localhost:1883 (or :9001 for WebSocket)
```

**Option B: HiveMQ Cloud (Cloud-hosted)**
1. Create account at https://www.hivemq.com/
2. Create a cluster
3. Get WebSocket URL and credentials
4. Update BROKER_URL with your cluster URL

### ESP32 Configuration

Edit `Final code c++/sketch_may17a.ino`:
```cpp
// WiFi credentials
const char* WIFI_SSID = "YOUR_SSID";
const char* WIFI_PASSWORD = "YOUR_PASSWORD";

// MQTT broker
const char* MQTT_BROKER = "YOUR_BROKER_IP";
const int MQTT_PORT = 1883;

// Sensor pins (adjust to your setup)
#define DHTPIN      4  // DHT22 data pin
#define I2C_SDA     21  // LCD SDA
#define I2C_SCL     22  // LCD SCL
#define LED_GREEN   5
#define LED_RED     2
#define BUZZER      23
#define BUTTON_PIN  18
```

Install required libraries in Arduino IDE:
- PubSubClient (by Nick O'Leary)
- DHT sensor library (by Adafruit)
- LiquidCrystal_I2C (by Frank de Brabander)
- ArduinoJson (by Benoit Blanchon)
- WiFi (built-in for ESP32)

Upload to your board and monitor the Serial output (baud 115200) to confirm:
- WiFi connection
- MQTT connection
- Sensor readings from DHT22
- Hardware controls responding

## Verification Checklist

- [ ] MQTT broker running and accessible
- [ ] Backend running and connected to broker
- [ ] Frontend accessible at http://localhost:5173
- [ ] ESP32 publishing sensor data to greenhouse/data
- [ ] Dashboard showing live readings and charts
- [ ] Hardware controls (buzzer, LEDs, LCD) responding

## Troubleshooting

### ESP32 not connecting to WiFi
- Check SSID and password in code
- Verify WiFi signal strength
- Check Serial Monitor for error messages
- Restart ESP32 board

### Dashboard shows "Connecting..."
- Verify MQTT broker is running
- Check browser console (F12) for MQTT connection errors
- Confirm firewall allows WebSocket traffic on port 9001

### No data in database
- Check backend logs for database errors
- Verify database file has write permissions
- Restart backend to reinitialize database

### Port already in use
```bash
# Change PORT in greenhouse-backend/server.js
# Or kill existing process:

# macOS/Linux
lsof -i :3001
kill -9 <PID>

# Windows
netstat -ano | findstr :3001
taskkill /PID <PID> /F
```

## Next Steps

- Configure thresholds in the dashboard
- Test all hardware controls (buzzer, LEDs, LCD messaging)
- Set up data persistence with regular database backups
- Deploy to production environment
- Set up monitoring/alerting for threshold breaches

See [README.md](../README.md) for full documentation.

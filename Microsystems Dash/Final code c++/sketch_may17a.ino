#include <Wire.h>
#include <LiquidCrystal_I2C.h>
#include <DHT.h>
#include <WiFi.h>
#include <PubSubClient.h>
#include <ArduinoJson.h>

// --- Pin Definitions ---
#define I2C_SDA     21
#define I2C_SCL     22
#define DHTPIN      4
#define DHTTYPE     DHT22
#define LED_GREEN   5
#define LED_RED     2
#define BUZZER      23
#define BUTTON_PIN  18

const char* TOPIC_DATA    = "greenhouse/data";
const char* TOPIC_CONTROL = "greenhouse/control";

// --- WiFi & MQTT Config ---
const char* WIFI_SSID     = "DStv_Internet_2.4G_974A03";
const char* WIFI_PASSWORD = "8VD8555U64";
const char* MQTT_BROKER   = "192.168.0.177";
const int   MQTT_PORT     = 1883;
const char* MQTT_TOPIC    = "greenhouse/data";
const char* MQTT_CLIENT   = "ESP32_Greenhouse";

// --- Objects ---
LiquidCrystal_I2C lcd(0x27, 16, 2);
DHT dht(DHTPIN, DHTTYPE);
WiFiClient wifiClient;
PubSubClient mqtt(wifiClient);

// --- Averaging Variables ---
float tempSum = 0, humSum = 0;
float avgTemp = 0, avgHum = 0;
int   readings = 0;
bool  avgReady = false;

unsigned long lastRead = 0;

// --- WiFi Connection ---
void connectWiFi() {
  Serial.print("Connecting to WiFi");
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 20) {
    delay(500);
    Serial.print(".");
    attempts++;
  }
  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\nWiFi connected — IP: " + WiFi.localIP().toString());
  } else {
    Serial.println("\nWiFi failed — running offline");
  }
}

// Forward declaration
void mqttCallback(char* topic, byte* payload, unsigned int length);

// --- MQTT Connection ---
void connectMQTT() {
  int attempts = 0;
  while (!mqtt.connected() && attempts < 5) {
    Serial.print("Connecting to MQTT...");
    if (mqtt.connect(MQTT_CLIENT)) {
      Serial.println("connected");
      mqtt.subscribe(TOPIC_CONTROL);
    } else {
      Serial.print("failed, rc=");
      Serial.print(mqtt.state());
      Serial.println(" — retrying in 3s");
      delay(3000);
      attempts++;
    }
  }
}

void setup() {
  Serial.begin(115200);

  pinMode(LED_GREEN,  OUTPUT);
  pinMode(LED_RED,    OUTPUT);
  pinMode(BUZZER,     OUTPUT);
  pinMode(BUTTON_PIN, INPUT_PULLUP);

  digitalWrite(LED_GREEN, HIGH);
  digitalWrite(LED_RED,   LOW);
  digitalWrite(BUZZER,    LOW);

  dht.begin();
  Wire.begin(I2C_SDA, I2C_SCL);
  lcd.init();
  lcd.backlight();
  lcd.clear();

  lcd.setCursor(0, 0); lcd.print("Greenhouse Ready");
  lcd.setCursor(0, 1); lcd.print("Connecting WiFi.");
  
  connectWiFi();

  if (WiFi.status() == WL_CONNECTED) {
    mqtt.setServer(MQTT_BROKER, MQTT_PORT);
    mqtt.setCallback(mqttCallback);
    connectMQTT();
  }

  lcd.clear();
  lcd.setCursor(0, 0); lcd.print("Greenhouse Ready");
  lcd.setCursor(0, 1); lcd.print("Hold Btn for Avg");
  delay(2000);
  lcd.clear();
}

void loop() {
  // Keep MQTT alive
  if (WiFi.status() == WL_CONNECTED) {
    if (!mqtt.connected()) connectMQTT();
    mqtt.loop();
  }

  int buttonState = digitalRead(BUTTON_PIN);

  // Button: update LCD immediately on press
  if (buttonState == LOW) {
    lcd.setCursor(0, 0); lcd.print("--- AVERAGES ---");
    lcd.setCursor(0, 1);
    lcd.print("T:"); lcd.print(avgTemp, 1);
    lcd.print("C H:"); lcd.print(avgHum, 0); lcd.print("%   ");
  }

  // Sensor: every 2 seconds
  if (millis() - lastRead >= 2000) {
    lastRead = millis();

    float h = dht.readHumidity();
    float t = dht.readTemperature();

    if (!isnan(h) && !isnan(t)) {
      tempSum += t;
      humSum  += h;
      readings++;

      if (!avgReady) {
        avgTemp = t;
        avgHum  = h;
      }

      if (readings >= 10) {
        avgTemp  = tempSum / readings;
        avgHum   = humSum  / readings;
        tempSum  = 0;
        humSum   = 0;
        readings = 0;
        avgReady = true;
      }

      bool alert = (t > 17.0 || h < 40.0);
      digitalWrite(LED_RED,   alert ? HIGH : LOW);
      digitalWrite(LED_GREEN, alert ? LOW  : HIGH);
      digitalWrite(BUZZER,    alert ? HIGH : LOW);

      // Publish to MQTT
      if (mqtt.connected()) {
        StaticJsonDocument<200> doc;
        doc["temperature"] = round(t * 10) / 10.0;
        doc["humidity"]    = round(h);
        doc["avg_temp"]    = round(avgTemp * 10) / 10.0;
        doc["avg_hum"]     = round(avgHum);
        doc["alert"]       = alert;
        doc["button"]      = (buttonState == LOW) ? 1 : 0;

        char payload[200];
        serializeJson(doc, payload);
        mqtt.publish(MQTT_TOPIC, payload);
        Serial.print("Published: "); Serial.println(payload);
      }

      // Only update live display if button not held
      if (buttonState == HIGH) {
        lcd.setCursor(0, 0);
        lcd.print("Now:"); lcd.print(t, 1); lcd.print("C "); lcd.print(h, 0); lcd.print("%  ");
        lcd.setCursor(0, 1);
        lcd.print(alert ? "SYSTEM ALERT!!  " : "Env: Stable     ");
      }

      Serial.print("T:"); Serial.print(t, 1);
      Serial.print(" H:"); Serial.print(h, 0);
      Serial.print(" Alert:"); Serial.print(alert);
      Serial.print(" Btn:"); Serial.println(buttonState == LOW ? "PRESSED" : "IDLE");

    } else {
      lcd.setCursor(0, 0); lcd.print("Sensor Error!   ");
      lcd.setCursor(0, 1); lcd.print("Check DHT22     ");
    }
  }
}
/**
 * ==============================================================================
 * ESP32 A - SENSOR + MQTT + ESP-NOW SENDER
 * Tugas: Baca MPU6050, kirim data ke:
 *   1. Web Dashboard via MQTT (broker.emqx.io)
 *   2. ESP32 B via ESP-NOW (komunikasi lokal tanpa internet)
 * ==============================================================================
 *
 * Library yang wajib diinstall:
 * 1. MPU6050_tockn  - Baca sensor MPU6050
 * 2. PubSubClient   - Protokol MQTT
 * 3. ArduinoJson    - Pembuat data JSON
 *
 * Wiring MPU6050:
 * SDA -> GPIO 21
 * SCL -> GPIO 22
 *
 * PENTING: Isi MAC_ESP32_B dengan MAC address ESP32 B kamu.
 * Cara cek MAC ESP32 B: upload sketch ini ke ESP32 B dulu:
 *   #include <WiFi.h>
 *   void setup() { Serial.begin(115200); WiFi.mode(WIFI_STA); Serial.println(WiFi.macAddress()); }
 *   void loop() {}
 */

#include <Wire.h>
#include <MPU6050_tockn.h>
#include <WiFi.h>
#include <esp_now.h>
#include <esp_wifi.h>
#include <PubSubClient.h>
#include <ArduinoJson.h>

// ==============================================================================
// MAC ADDRESS ESP32 B (DISPLAY)
// Ganti dengan MAC address ESP32 B kamu!
// ==============================================================================
uint8_t MAC_ESP32_B[] = {0x4C, 0xC3, 0x82, 0xBF, 0x05, 0x94};

// ==============================================================================
// KONFIGURASI STASIUN SENSOR
// ==============================================================================
const char* STATION_NAME  = "Stasiun Sensor Puger";
const float STATION_LAT   = -8.3667;
const float STATION_LNG   = 113.4833;
const int   STATION_DEPTH = 10;

// ==============================================================================
// THRESHOLD DETEKSI GETARAN
//   > 5.0  = BAHAYA
//   > 3.0  = WASPADA
//   <= 3.0 = AMAN
// ==============================================================================
const float THRESHOLD_WASPADA = 3.0;
const float THRESHOLD_BAHAYA  = 5.0;

// ==============================================================================
// KONFIGURASI WI-FI
// ==============================================================================
const char* ssid     = "ZTE_2.4G_S999tt";
const char* password = "f23PUtDC";

// ==============================================================================
// KONFIGURASI MQTT
// ==============================================================================
const char* mqtt_broker = "broker.emqx.io";
const int   mqtt_port   = 1883;
const char* mqtt_topic  = "jember/quake";

// ==============================================================================
// STRUKTUR DATA ESP-NOW (harus sama persis di ESP32 B)
// ==============================================================================
typedef struct {
  float   vibration;
  float   magnitude;
  uint8_t statusCode; // 0=AMAN, 1=WASPADA, 2=BAHAYA
} QuakeData;

// ==============================================================================
// INISIALISASI OBJEK
// ==============================================================================
MPU6050 mpu6050(Wire);
WiFiClient espClient;
PubSubClient client(espClient);
esp_now_peer_info_t peerInfo;

float lastX     = 0;
float lastY     = 0;
float lastZ     = 0;
float vibration = 0;

unsigned long lastPublishTime = 0;
unsigned long lastEspNowTime  = 0;
unsigned long lastReconnectAttempt = 0;

const unsigned long debounceDelay  = 10000; // MQTT: kirim tiap min 10 detik
const unsigned long espNowInterval = 500;   // ESP-NOW: kirim tiap 500ms
const unsigned long reconnectDelay = 5000;  // Coba reconnect tiap 5 detik

// ==============================================================================
// FUNGSI WI-FI
// ==============================================================================
void setup_wifi() {
  WiFi.mode(WIFI_STA);
  WiFi.begin(ssid, password);
  Serial.print("Menghubungkan WiFi");
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("\nWiFi terhubung: " + WiFi.localIP().toString());
}

// ==============================================================================
// RECONNECT MQTT NON-BLOCKING
// ==============================================================================
void mqttReconnectNonBlocking() {
  if (client.connected()) return;
  if (millis() - lastReconnectAttempt < reconnectDelay) return;

  lastReconnectAttempt = millis();
  Serial.print("Mencoba koneksi MQTT...");
  String clientId = "ESP32A-";
  clientId += String(random(0xffff), HEX);

  if (client.connect(clientId.c_str())) {
    Serial.println("Terhubung ke MQTT EMQX!");
  } else {
    Serial.print("Gagal, rc=");
    Serial.println(client.state());
  }
}

// ==============================================================================
// HITUNG ESTIMASI MAGNITUDO
// ==============================================================================
float hitungMagnitudo(float vib) {
  float mag = 3.0 + (vib * 0.3);
  if (mag > 8.0) mag = 8.0;
  return round(mag * 10.0) / 10.0;
}

// ==============================================================================
// SETUP
// ==============================================================================
void setup() {
  Serial.begin(115200);
  delay(500);

  // Inisialisasi MPU6050
  Wire.begin(21, 22);
  Serial.println("Kalibrasi sensor... (jangan gerakkan)");
  mpu6050.begin();
  mpu6050.calcGyroOffsets(true);
  Serial.println("Sensor siap!");

  // Koneksi WiFi dulu
  setup_wifi();

  // Setelah WiFi konek, ambil channel WiFi yang aktif
  // lalu set ESP-NOW pakai channel yang sama agar tidak konflik
  uint8_t wifiChannel = WiFi.channel();
  Serial.print("WiFi Channel: ");
  Serial.println(wifiChannel);

  // Inisialisasi ESP-NOW
  if (esp_now_init() != ESP_OK) {
    Serial.println("ESP-NOW init gagal!");
  } else {
    // Set channel ESP-NOW sama dengan WiFi
    esp_wifi_set_channel(wifiChannel, WIFI_SECOND_CHAN_NONE);

    memcpy(peerInfo.peer_addr, MAC_ESP32_B, 6);
    peerInfo.channel = wifiChannel;
    peerInfo.encrypt = false;

    if (esp_now_add_peer(&peerInfo) != ESP_OK) {
      Serial.println("Gagal menambahkan peer ESP32 B!");
    } else {
      Serial.println("ESP-NOW peer terdaftar.");
    }
  }

  // Inisialisasi MQTT
  client.setServer(mqtt_broker, mqtt_port);
  client.setBufferSize(512);

  randomSeed(analogRead(0));
}

// ==============================================================================
// LOOP UTAMA
// ==============================================================================
void loop() {
  // Reconnect MQTT non-blocking (tidak menghentikan loop)
  mqttReconnectNonBlocking();
  if (client.connected()) {
    client.loop();
  }

  // Baca sensor MPU6050
  mpu6050.update();
  float ax = mpu6050.getAccX();
  float ay = mpu6050.getAccY();
  float az = mpu6050.getAccZ();

  float dx = ax - lastX;
  float dy = ay - lastY;
  float dz = az - lastZ;
  vibration = sqrt(dx * dx + dy * dy + dz * dz) * 10;

  lastX = ax;
  lastY = ay;
  lastZ = az;

  // Tentukan status
  String  statusStr;
  uint8_t statusCode;
  if (vibration > THRESHOLD_BAHAYA) {
    statusStr  = "BAHAYA";
    statusCode = 2;
  } else if (vibration > THRESHOLD_WASPADA) {
    statusStr  = "WASPADA";
    statusCode = 1;
  } else {
    statusStr  = "AMAN";
    statusCode = 0;
  }

  Serial.print("Getaran: "); Serial.print(vibration);
  Serial.print(" | STATUS: "); Serial.println(statusStr);

  float mag = hitungMagnitudo(vibration);

  // --- Kirim ke ESP32 B via ESP-NOW (tiap 500ms, selalu kirim termasuk AMAN) ---
  if (millis() - lastEspNowTime > espNowInterval) {
    lastEspNowTime = millis();
    QuakeData dataKirim;
    dataKirim.vibration  = vibration;
    dataKirim.magnitude  = mag;
    dataKirim.statusCode = statusCode;
    esp_now_send(MAC_ESP32_B, (uint8_t *)&dataKirim, sizeof(dataKirim));
  }

  // --- Kirim ke MQTT hanya jika WASPADA/BAHAYA dan debounce terpenuhi ---
  if (vibration > THRESHOLD_WASPADA && (millis() - lastPublishTime > debounceDelay)) {
    if (client.connected()) {
      lastPublishTime = millis();

      StaticJsonDocument<256> doc;
      doc["location"]  = STATION_NAME;
      doc["lat"]       = STATION_LAT;
      doc["lng"]       = STATION_LNG;
      doc["magnitude"] = mag;
      doc["depth"]     = STATION_DEPTH;
      doc["vibration"] = vibration;
      doc["status"]    = statusStr;

      char jsonBuffer[256];
      serializeJson(doc, jsonBuffer);

      Serial.print("Publishing MQTT: ");
      Serial.println(jsonBuffer);

      if (client.publish(mqtt_topic, jsonBuffer)) {
        Serial.println(">>> Data terkirim ke Dashboard!");
      } else {
        Serial.println(">>> Gagal kirim MQTT.");
      }
    } else {
      Serial.println("MQTT tidak terhubung, data tidak terkirim.");
    }
  }

  delay(100);
}

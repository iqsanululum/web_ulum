/**
 * ==============================================================================
 * KODE PROGRAM ESP32 - SISTEM DETEKSI GEMPA LENGKAP
 * Untuk Project Akhir: Quake Dashboard Next (Jember Area)
 * Stasiun: Puger, Jember
 * ==============================================================================
 *
 * Library yang wajib diinstall di Arduino IDE:
 * 1. MPU6050_tockn       - Baca sensor MPU6050
 * 2. LiquidCrystal_I2C   - LCD I2C
 * 3. PubSubClient        - Protokol MQTT
 * 4. ArduinoJson         - Pembuat data JSON
 *
 * Wiring:
 * MPU6050 SDA -> GPIO 21
 * MPU6050 SCL -> GPIO 22
 * LCD SDA     -> GPIO 21  (I2C shared)
 * LCD SCL     -> GPIO 22  (I2C shared)
 * LED HIJAU        -> GPIO 32
 * LED KUNING MERAH -> GPIO 25
 * LED KUNING HIJAU -> GPIO 26
 * LED MERAH        -> GPIO 27
 * BUZZER           -> GPIO 33
 */

#include <Wire.h>
#include <MPU6050_tockn.h>
#include <LiquidCrystal_I2C.h>
#include <WiFi.h>
#include <PubSubClient.h>
#include <ArduinoJson.h>

// ==============================================================================
// KONFIGURASI STASIUN SENSOR (KOORDINAT TETAP PUGER)
// ==============================================================================
const char* STATION_NAME  = "Stasiun Sensor Puger";
const float STATION_LAT   = -8.3667;
const float STATION_LNG   = 113.4833;
const int   STATION_DEPTH = 10;

// ==============================================================================
// THRESHOLD DETEKSI GETARAN
//   > 5.0  = BAHAYA  (gempa signifikan)
//   > 3.0  = WASPADA (getaran terasa)
//   <= 3.0 = AMAN    (noise / getaran kecil)
// ==============================================================================
const float THRESHOLD_WASPADA = 3.0;
const float THRESHOLD_BAHAYA  = 5.0;

// ==============================================================================
// KONFIGURASI WI-FI
// ==============================================================================
const char* ssid     = "ZTE_2.4G_S999tt";
const char* password = "f23PUtDC";

// ==============================================================================
// KONFIGURASI MQTT BROKER (EMQX)
// ==============================================================================
const char* mqtt_broker = "broker.emqx.io";
const int   mqtt_port   = 1883;
const char* mqtt_topic  = "jember/quake";

// ==============================================================================
// PIN LED & BUZZER (COMMON ANODE: LOW = NYALA, HIGH = MATI)
// ==============================================================================
#define LED_HIJAU        32
#define LED_KUNING_MERAH 25
#define LED_KUNING_HIJAU 26
#define LED_MERAH        27
#define BUZZER           33

// ==============================================================================
// INISIALISASI OBJEK
// ==============================================================================
MPU6050 mpu6050(Wire);
LiquidCrystal_I2C lcd(0x27, 20, 4);
WiFiClient espClient;
PubSubClient client(espClient);

float lastX     = 0;
float lastY     = 0;
float lastZ     = 0;
float vibration = 0;

unsigned long lastPublishTime = 0;
const unsigned long debounceDelay = 10000;

// ==============================================================================
// FUNGSI LED & BUZZER
// ==============================================================================
void semuaMati() {
  digitalWrite(LED_HIJAU,        HIGH);
  digitalWrite(LED_KUNING_MERAH, HIGH);
  digitalWrite(LED_KUNING_HIJAU, HIGH);
  digitalWrite(LED_MERAH,        HIGH);
}

void buzzerOff() {
  noTone(BUZZER);
}

// Bip 2x pendek untuk status WASPADA
void buzzerKuning() {
  tone(BUZZER, 1000); delay(200); noTone(BUZZER); delay(200);
  tone(BUZZER, 1000); delay(200); noTone(BUZZER);
}

// Bip cepat 4x lalu bip panjang 1 detik untuk status BAHAYA
// (diperpendek agar tidak blocking terlalu lama di loop)
void buzzerMerah() {
  for (int i = 0; i < 4; i++) {
    tone(BUZZER, 2000); delay(150);
    noTone(BUZZER);     delay(150);
  }
  tone(BUZZER, 2000); delay(1000);
  noTone(BUZZER);
}

// ==============================================================================
// FUNGSI STATUS LCD + LED + BUZZER
// ==============================================================================
void tampilAman() {
  semuaMati();
  buzzerOff();
  digitalWrite(LED_HIJAU, LOW);
  lcd.clear();
  lcd.setCursor(0, 0); lcd.print("STATUS : AMAN");
  lcd.setCursor(0, 1); lcd.print("SISTEM NORMAL");
}

void tampilWaspada(float vib) {
  semuaMati();
  digitalWrite(LED_KUNING_MERAH, LOW);
  digitalWrite(LED_KUNING_HIJAU, LOW);
  lcd.clear();
  lcd.setCursor(0, 0); lcd.print("STATUS : WASPADA");
  lcd.setCursor(0, 1); lcd.print("GETARAN DETEKSI");
  lcd.setCursor(0, 2);
  lcd.print("Vib: ");
  lcd.print(vib, 1);
  buzzerKuning();
}

void tampilBahaya(float vib) {
  semuaMati();
  digitalWrite(LED_MERAH, LOW);
  lcd.clear();
  lcd.setCursor(0, 0); lcd.print("STATUS : BAHAYA");
  lcd.setCursor(0, 1); lcd.print("SEGERA EVAKUASI");
  lcd.setCursor(0, 2);
  lcd.print("Vib: ");
  lcd.print(vib, 1);
  buzzerMerah();
}

// ==============================================================================
// FUNGSI WI-FI & MQTT
// ==============================================================================
void setup_wifi() {
  WiFi.begin(ssid, password);
  // Tampilkan status connecting di LCD
  lcd.clear();
  lcd.setCursor(0, 0); lcd.print("Menghubungkan WiFi");
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
  }
  lcd.clear();
  lcd.setCursor(0, 0); lcd.print("WiFi Terhubung!");
  delay(1000);
}

void reconnect() {
  while (!client.connected()) {
    String clientId = "ESP32QuakeSensor-";
    clientId += String(random(0xffff), HEX);
    if (!client.connect(clientId.c_str())) {
      delay(5000);
    }
  }
}

float hitungMagnitudo(float vib) {
  float mag = 3.0 + (vib * 0.3);
  if (mag > 8.0) mag = 8.0;
  return round(mag * 10.0) / 10.0;
}

// ==============================================================================
// SETUP
// ==============================================================================
void setup() {
  // I2C untuk MPU6050 dan LCD (shared bus)
  Wire.begin(21, 22);

  // Inisialisasi LCD
  lcd.init();
  lcd.backlight();
  lcd.clear();
  lcd.setCursor(0, 0); lcd.print("  SISTEM GEMPA  ");
  lcd.setCursor(0, 1); lcd.print("   STARTING...");
  delay(2000);

  // Inisialisasi LED & Buzzer
  pinMode(LED_HIJAU,        OUTPUT);
  pinMode(LED_KUNING_MERAH, OUTPUT);
  pinMode(LED_KUNING_HIJAU, OUTPUT);
  pinMode(LED_MERAH,        OUTPUT);
  pinMode(BUZZER,           OUTPUT);
  semuaMati();
  buzzerOff();

  // Inisialisasi MPU6050
  lcd.clear();
  lcd.setCursor(0, 0); lcd.print("Kalibrasi Sensor");
  mpu6050.begin();
  mpu6050.calcGyroOffsets(true); // kalibrasi (butuh ~3 detik, jangan gerakkan)
  lcd.clear();
  lcd.setCursor(0, 0); lcd.print("Sensor Siap!");
  delay(1000);

  // Koneksi WiFi & MQTT
  setup_wifi();
  client.setServer(mqtt_broker, mqtt_port);
  client.setBufferSize(512);
  randomSeed(analogRead(0));

  // Tampilan awal
  tampilAman();
}

// ==============================================================================
// LOOP UTAMA
// ==============================================================================
void loop() {
  // Jaga koneksi MQTT
  if (!client.connected()) {
    reconnect();
  }
  client.loop();

  // Baca sensor MPU6050
  mpu6050.update();
  float ax = mpu6050.getAccX();
  float ay = mpu6050.getAccY();
  float az = mpu6050.getAccZ();

  // Hitung delta getaran
  float dx = ax - lastX;
  float dy = ay - lastY;
  float dz = az - lastZ;
  vibration = sqrt(dx * dx + dy * dy + dz * dz) * 10;

  lastX = ax;
  lastY = ay;
  lastZ = az;

  // Tentukan status
  String status;
  if (vibration > THRESHOLD_BAHAYA) {
    status = "BAHAYA";
    tampilBahaya(vibration);
  } else if (vibration > THRESHOLD_WASPADA) {
    status = "WASPADA";
    tampilWaspada(vibration);
  } else {
    status = "AMAN";
    tampilAman();
  }

  // Kirim ke MQTT hanya jika WASPADA atau BAHAYA dan debounce terpenuhi
  if (vibration > THRESHOLD_WASPADA && (millis() - lastPublishTime > debounceDelay)) {
    lastPublishTime = millis();

    float estimasiMagnitudo = hitungMagnitudo(vibration);

    StaticJsonDocument<256> doc;
    doc["location"]  = STATION_NAME;
    doc["lat"]       = STATION_LAT;
    doc["lng"]       = STATION_LNG;
    doc["magnitude"] = estimasiMagnitudo;
    doc["depth"]     = STATION_DEPTH;
    doc["vibration"] = vibration;
    doc["status"]    = status;

    char jsonBuffer[256];
    serializeJson(doc, jsonBuffer);
    client.publish(mqtt_topic, jsonBuffer);
  }

  delay(100);
}

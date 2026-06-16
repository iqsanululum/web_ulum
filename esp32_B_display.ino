/**
 * ==============================================================================
 * ESP32 B - DISPLAY (LCD + LED + BUZZER) + ESP-NOW RECEIVER
 * Tugas: Terima data dari ESP32 A via ESP-NOW, tampilkan status di LCD/LED/Buzzer
 * TIDAK terhubung ke internet / MQTT
 * ==============================================================================
 *
 * Library yang wajib diinstall:
 * 1. LiquidCrystal_I2C - LCD I2C
 *
 * Wiring:
 * LCD SDA          -> GPIO 21
 * LCD SCL          -> GPIO 22
 * LED HIJAU        -> GPIO 32
 * LED KUNING MERAH -> GPIO 25
 * LED KUNING HIJAU -> GPIO 26
 * LED MERAH        -> GPIO 27
 * BUZZER           -> GPIO 33
 *
 * COMMON ANODE: LOW = NYALA, HIGH = MATI
 *
 * PENTING: Sebelum upload esp32_A_sender, cek MAC address ESP32 B ini
 * dengan cara upload sketch berikut ke ESP32 B:
 *   #include <WiFi.h>
 *   void setup() { Serial.begin(115200); Serial.println(WiFi.macAddress()); }
 *   void loop() {}
 * Lalu isi MAC_ESP32_B di esp32_A_sender.ino dengan hasilnya.
 */

#include <Wire.h>
#include <LiquidCrystal_I2C.h>
#include <WiFi.h>
#include <esp_now.h>

// ==============================================================================
// PIN LED & BUZZER
// ==============================================================================
#define LED_HIJAU        32
#define LED_KUNING_MERAH 25
#define LED_KUNING_HIJAU 26
#define LED_MERAH        27
#define BUZZER           33

// ==============================================================================
// INISIALISASI LCD
// ==============================================================================
LiquidCrystal_I2C lcd(0x27, 20, 4);

// ==============================================================================
// STRUKTUR DATA ESP-NOW (harus sama persis dengan ESP32 A)
// ==============================================================================
typedef struct {
  float vibration;
  float magnitude;
  uint8_t statusCode; // 0=AMAN, 1=WASPADA, 2=BAHAYA
} QuakeData;

// Variabel penerima data
QuakeData dataReceived;
volatile bool dataBaruMasuk = false;

// Timeout: jika tidak ada data dari ESP32 A selama 3 detik, tampilkan "NO SIGNAL"
unsigned long lastReceiveTime = 0;
const unsigned long timeoutMs = 3000;

// Debounce buzzer agar tidak berbunyi terus-terusan
unsigned long lastBuzzerTime = 0;
const unsigned long buzzerDebounce = 8000; // buzzer ulang minimal 8 detik

// ==============================================================================
// FUNGSI LED
// ==============================================================================
void semuaMati() {
  digitalWrite(LED_HIJAU,        HIGH);
  digitalWrite(LED_KUNING_MERAH, HIGH);
  digitalWrite(LED_KUNING_HIJAU, HIGH);
  digitalWrite(LED_MERAH,        HIGH);
}

// ==============================================================================
// FUNGSI BUZZER
// ==============================================================================
void buzzerOff() {
  noTone(BUZZER);
}

void buzzerKuning() {
  tone(BUZZER, 1000); delay(200); noTone(BUZZER); delay(200);
  tone(BUZZER, 1000); delay(200); noTone(BUZZER);
}

void buzzerMerah() {
  for (int i = 0; i < 4; i++) {
    tone(BUZZER, 2000); delay(150);
    noTone(BUZZER);     delay(150);
  }
  delay(200);
  tone(BUZZER, 2000); delay(5000);
  noTone(BUZZER);
}

// ==============================================================================
// FUNGSI TAMPILAN STATUS
// ==============================================================================
void tampilAman() {
  semuaMati();
  buzzerOff();
  digitalWrite(LED_HIJAU, LOW);
  lcd.clear();
  lcd.setCursor(0, 0); lcd.print("STATUS : AMAN");
  lcd.setCursor(0, 1); lcd.print("SISTEM NORMAL");
}

void tampilWaspada(float vib, float mag) {
  semuaMati();
  digitalWrite(LED_KUNING_MERAH, LOW);
  digitalWrite(LED_KUNING_HIJAU, LOW);
  lcd.clear();
  lcd.setCursor(0, 0); lcd.print("STATUS : WASPADA");
  lcd.setCursor(0, 1); lcd.print("GETARAN DETEKSI");
  lcd.setCursor(0, 2);
  lcd.print("Vib:");
  lcd.print(vib, 1);
  lcd.print(" Mag:");
  lcd.print(mag, 1);
  // Buzzer hanya berbunyi jika sudah lewat debounce
  if (millis() - lastBuzzerTime > buzzerDebounce) {
    lastBuzzerTime = millis();
    buzzerKuning();
  }
}

void tampilBahaya(float vib, float mag) {
  semuaMati();
  digitalWrite(LED_MERAH, LOW);
  lcd.clear();
  lcd.setCursor(0, 0); lcd.print("STATUS : BAHAYA");
  lcd.setCursor(0, 1); lcd.print("SEGERA EVAKUASI");
  lcd.setCursor(0, 2);
  lcd.print("Vib:");
  lcd.print(vib, 1);
  lcd.print(" Mag:");
  lcd.print(mag, 1);
  if (millis() - lastBuzzerTime > buzzerDebounce) {
    lastBuzzerTime = millis();
    buzzerMerah();
  }
}

void tampilNoSignal() {
  semuaMati();
  buzzerOff();
  lcd.clear();
  lcd.setCursor(0, 0); lcd.print("  NO SIGNAL  ");
  lcd.setCursor(0, 1); lcd.print("Menunggu sensor..");
}

// ==============================================================================
// CALLBACK ESP-NOW - dipanggil saat data masuk dari ESP32 A
// ==============================================================================
void onDataReceived(const esp_now_recv_info_t *info, const uint8_t *incomingData, int len) {
  memcpy(&dataReceived, incomingData, sizeof(dataReceived));
  dataBaruMasuk    = true;
  lastReceiveTime  = millis();
}

// ==============================================================================
// SETUP
// ==============================================================================
void setup() {
  Serial.begin(115200);

  // Inisialisasi I2C & LCD
  Wire.begin(21, 22);
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

  // Inisialisasi ESP-NOW (mode STA, tidak perlu konek WiFi)
  WiFi.mode(WIFI_STA);
  WiFi.disconnect(); // pastikan tidak konek ke AP manapun
  delay(100);        // beri waktu WiFi stack aktif

  // Print MAC Address ESP32 B ke Serial Monitor
  Serial.println("=== MAC ADDRESS ESP32 B ===");
  Serial.println(WiFi.macAddress());
  Serial.println("===========================");
  Serial.println("Salin MAC di atas ke MAC_ESP32_B pada esp32_A_sender.ino");

  if (esp_now_init() != ESP_OK) {
    lcd.clear();
    lcd.setCursor(0, 0); lcd.print("ESP-NOW GAGAL!");
    while (true) { delay(1000); }
  }
  esp_now_register_recv_cb(onDataReceived);

  lcd.clear();
  lcd.setCursor(0, 0); lcd.print("  SISTEM SIAP  ");
  lcd.setCursor(0, 1); lcd.print("Menunggu data...");
  delay(1000);

  lastReceiveTime = millis();
}

// ==============================================================================
// LOOP UTAMA
// ==============================================================================
void loop() {
  // Cek timeout — jika tidak ada data dari ESP32 A
  if (millis() - lastReceiveTime > timeoutMs) {
    tampilNoSignal();
    delay(500);
    return;
  }

  // Proses data baru yang masuk
  if (dataBaruMasuk) {
    dataBaruMasuk = false;

    switch (dataReceived.statusCode) {
      case 2:
        tampilBahaya(dataReceived.vibration, dataReceived.magnitude);
        break;
      case 1:
        tampilWaspada(dataReceived.vibration, dataReceived.magnitude);
        break;
      default:
        tampilAman();
        break;
    }
  }

  delay(100);
}

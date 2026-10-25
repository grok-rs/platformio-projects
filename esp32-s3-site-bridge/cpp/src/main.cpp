// «Мій стенд» — міст між платою і сайтом курсу (сторінка docs/live/, Web Serial).
//
// Той самий стенд, що й у уроках 1.5 і 1.6, нічого не перепаюємо:
//
//   3V3 ── LDR ──┬── 10 кОм ── GND        (esp32-s3-ldr-adc)
//                └── GPIO4 (ADC1_CH3)
//   GPIO21 ── кнопка ── GND               (esp32-s3-bounce-test, INPUT_PULLUP: натиснута = LOW)
//
// Плата пише в USB Serial (115200) рядки JSON, по одному об'єкту в рядку. Поле "t" — тип рядка:
//
//   {"t":"hello","fw":"site-bridge","ver":"1.0.0","lang":"cpp",...}   на старті й раз на 5 с
//   {"t":"adc","ms":12300,"raw":2861,"mv":2190}                        кожні 100 мс
//   {"t":"btn","kind":"press","n":3,"us":81234567,"edges":5,"bounce_us":830,
//    "missed":false,"at":[0,12,52,610,830]}                            після кожної події кнопки
//
// "at" — моменти фронтів події в мікросекундах від першого фронту (micros() у перериванні CHANGE).
// Подія закінчується після 50 мс тиші — як у esp32-s3-bounce-test. Опис протоколу — у README.md.

#include <Arduino.h>

namespace {

constexpr const char* kFirmware = "site-bridge";
constexpr const char* kVersion  = "1.0.0";
constexpr const char* kBoard    = "YD-ESP32-S3 N16R8";

// --- Піни: як у esp32-s3-ldr-adc і esp32-s3-bounce-test ------------------
constexpr uint8_t kLdrPin    = 4;   // ADC1: працює й з увімкненим Wi-Fi
constexpr uint8_t kButtonPin = 21;  // INPUT_PULLUP, кнопка до GND

// --- АЦП ----------------------------------------------------------------
constexpr uint8_t  kAdcBits       = 12;    // 0…4095
constexpr uint32_t kUrefMv        = 3100;  // 11 дБ на ESP32-S3: шкала 0…3100 мВ
constexpr uint32_t kAdcPeriodMs   = 100;   // як у домашньому завданні 1.6
constexpr uint32_t kHelloPeriodMs = 5000;  // сайт може під'єднатися будь-коли — нагадуємо, хто ми

// --- Кнопка ---------------------------------------------------------------
constexpr uint32_t kQuietUs  = 50000;  // 50 мс без фронтів = брязкіт закінчився
constexpr size_t   kMaxEdges = 64;     // більше фронтів на подію не запам'ятовуємо (лише рахуємо)

constexpr uint32_t kSerialBaud   = 115200;
constexpr uint32_t kSerialWaitMs = 2000;

// --- Спільні дані ISR і loop() -----------------------------------------------
volatile uint32_t gEdgeTimes[kMaxEdges];
volatile uint32_t gEdgeCount  = 0;  // усі фронти поточної події, навіть ті, що не влізли в масив
volatile uint32_t gLastEdgeUs = 0;

// Обробник переривання: лише записати час. Друкує loop().
void IRAM_ATTR onButtonEdge() {
  const uint32_t now = micros();
  if (gEdgeCount < kMaxEdges) gEdgeTimes[gEdgeCount] = now;
  gEdgeCount = gEdgeCount + 1;
  gLastEdgeUs = now;
}

// --- Стан loop() ------------------------------------------------------------
uint32_t lastAdcAt   = 0;
uint32_t lastHelloAt = 0;
bool     stableLow   = false;  // рівень після попередньої події (відпущена = HIGH)
uint32_t presses = 0, releases = 0, glitches = 0;

// Один рядок збираємо в буфер і відправляємо одним write(): так рядок не розірветься
// між пакетами USB посередині числа (сайт усе одно склеює шматки, але так охайніше).
char line[768];

void sendHello() {
  snprintf(line, sizeof line,
           "{\"t\":\"hello\",\"fw\":\"%s\",\"ver\":\"%s\",\"lang\":\"cpp\",\"board\":\"%s\","
           "\"ldr_pin\":%u,\"btn_pin\":%u,\"adc_ms\":%lu,\"bits\":%u,\"uref_mv\":%lu,"
           "\"quiet_ms\":%lu,\"max_edges\":%u,\"pressed\":%s,\"up_ms\":%lu}\n",
           kFirmware, kVersion, kBoard, kLdrPin, kButtonPin, static_cast<unsigned long>(kAdcPeriodMs), kAdcBits,
           static_cast<unsigned long>(kUrefMv), static_cast<unsigned long>(kQuietUs / 1000),
           static_cast<unsigned>(kMaxEdges), stableLow ? "true" : "false", static_cast<unsigned long>(millis()));
  Serial.write(line, strlen(line));
}

void sendAdc(uint32_t ms) {
  const uint16_t raw = analogRead(kLdrPin);
  // Окреме перетворення з калібруванням з eFuse — як analogReadMilliVolts() у ldr-adc.
  const uint32_t mv = analogReadMilliVolts(kLdrPin);
  const int n = snprintf(line, sizeof line, "{\"t\":\"adc\",\"ms\":%lu,\"raw\":%u,\"mv\":%lu}\n",
                         static_cast<unsigned long>(ms), raw, static_cast<unsigned long>(mv));
  Serial.write(line, n);
}

void sendButton(const uint32_t* times, uint32_t count) {
  const size_t stored = count < kMaxEdges ? count : kMaxEdges;

  // Після тиші рівень стабільний: став LOW — натиснули, став HIGH — відпустили,
  // не змінився — це був лише короткий імпульс (glitch).
  const bool low     = digitalRead(kButtonPin) == LOW;
  const bool changed = low != stableLow;
  stableLow = low;
  const char* kind  = !changed ? "glitch" : low ? "press" : "release";
  uint32_t&   index = !changed ? glitches : low ? presses : releases;
  ++index;
  // Зміна рівня — непарна кількість фронтів, повернення до того самого — парна.
  // Інша парність: імпульс був коротший за реакцію ISR і фронт загубився.
  const bool missed = (count % 2 == 1) != changed;

  int n = snprintf(line, sizeof line,
                   "{\"t\":\"btn\",\"kind\":\"%s\",\"n\":%lu,\"us\":%lu,\"edges\":%lu,\"bounce_us\":%lu,"
                   "\"missed\":%s,\"at\":[",
                   kind, static_cast<unsigned long>(index), static_cast<unsigned long>(times[0]),
                   static_cast<unsigned long>(count), static_cast<unsigned long>(times[stored - 1] - times[0]),
                   missed ? "true" : "false");
  for (size_t i = 0; i < stored && n < static_cast<int>(sizeof line) - 16; ++i) {
    n += snprintf(line + n, sizeof line - n, i ? ",%lu" : "%lu", static_cast<unsigned long>(times[i] - times[0]));
  }
  n += snprintf(line + n, sizeof line - n, "]}\n");
  Serial.write(line, n);
}

void waitForSerial(uint32_t timeoutMs) {
  const uint32_t start = millis();
  while (!Serial && millis() - start < timeoutMs) {
  }
}

}  // namespace

void setup() {
  Serial.begin(kSerialBaud);
  waitForSerial(kSerialWaitMs);

  analogReadResolution(kAdcBits);
  analogSetPinAttenuation(kLdrPin, ADC_11db);

  pinMode(kButtonPin, INPUT_PULLUP);  // внутрішній резистор ~45 кОм до 3.3 В
  stableLow = digitalRead(kButtonPin) == LOW;
  attachInterrupt(digitalPinToInterrupt(kButtonPin), onButtonEdge, CHANGE);

  sendHello();
  lastAdcAt   = millis();
  lastHelloAt = lastAdcAt;
}

void loop() {
  const uint32_t now = millis();

  if (now - lastAdcAt >= kAdcPeriodMs) {
    lastAdcAt += kAdcPeriodMs;  // крок не «повзе», навіть якщо loop() запізнився
    sendAdc(now);
  }
  if (now - lastHelloAt >= kHelloPeriodMs) {
    lastHelloAt += kHelloPeriodMs;
    sendHello();
  }

  // Подія кнопки закінчилася: фронти були, і після останнього минуло kQuietUs.
  if (gEdgeCount == 0 || micros() - gLastEdgeUs < kQuietUs) return;

  // Забрати дані атомарно: на мить вимкнути переривання, скопіювати й обнулити лічильник.
  uint32_t times[kMaxEdges];
  noInterrupts();
  const uint32_t count  = gEdgeCount;
  const size_t   stored = count < kMaxEdges ? count : kMaxEdges;
  for (size_t i = 0; i < stored; ++i) times[i] = gEdgeTimes[i];
  gEdgeCount = 0;
  interrupts();

  sendButton(times, count);
}

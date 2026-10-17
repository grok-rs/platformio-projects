// Урок: брязкіт кнопки — що бачить ESP32-S3 і що бачить логічний аналізатор.
//
//   GPIO21 ── кнопка ── GND        (INPUT_PULLUP: відпущена = HIGH, натиснута = LOW)
//   GPIO21 ── CH1 логічного аналізатора, GND аналізатора ── GND плати
//   GPIO40 ── CH2 «BOUNCE»: HIGH від другого фронту події до її кінця — тригер лише на брязкіт
//   GPIO41 ── CH3 «LABEL»: UART 115200, текст події (Async Serial у Logic 2 покаже його на шкалі)
//
// Переривання CHANGE спрацьовує на КОЖНОМУ фронті й записує його час у мікросекундах.
// loop() чекає, доки на кнопці 50 мс тиша, і друкує звіт про подію (натискання або
// відпускання): скільки фронтів, скільки тривав брязкіт, найкоротший імпульс.
// Ту саму подію знайдіть в аналізаторі й порівняйте кількість фронтів. Схема — у README.md.

#include <Arduino.h>

namespace {

constexpr uint8_t  kButtonPin    = 21;
constexpr uint8_t  kBouncePin    = 40;     // маркер для аналізатора (CH2)
constexpr uint8_t  kLabelTxPin   = 41;     // підписи подій для аналізатора (CH3), лише TX
constexpr uint32_t kLabelBaud    = 115200;
constexpr uint32_t kQuietUs      = 50000;  // 50 мс без фронтів = брязкіт закінчився
constexpr size_t   kMaxEdges     = 64;     // більше фронтів на подію не запам'ятовуємо (лише рахуємо)
constexpr uint8_t  kShowGaps     = 10;     // скільки перших інтервалів друкувати
constexpr uint32_t kSerialBaud   = 115200;
constexpr uint32_t kSerialWaitMs = 2000;   // чекати USB CDC, щоб не втратити банер

// --- Спільні дані ISR і loop() -----------------------------------------------
// volatile: значення змінює переривання, тому компілятор не має права кешувати їх у регістрах.
volatile uint32_t gEdgeTimes[kMaxEdges];
volatile uint32_t gEdgeCount = 0;  // усі фронти поточної події, навіть ті, що не влізли в масив
volatile uint32_t gLastEdgeUs = 0;

uint32_t pressCount   = 0;
uint32_t releaseCount = 0;
uint32_t glitchCount  = 0;
int      stableLevel  = HIGH;  // рівень після попередньої події (відпущена = HIGH)

// Обробник переривання: якомога коротший і в IRAM. Лише записати час — друкує loop().
void IRAM_ATTR onButtonEdge() {
  const uint32_t now = micros();
  if (gEdgeCount < kMaxEdges) gEdgeTimes[gEdgeCount] = now;
  gEdgeCount = gEdgeCount + 1;
  gLastEdgeUs = now;
  if (gEdgeCount == 2) digitalWrite(kBouncePin, HIGH);  // другий фронт = брязкіт; гасить loop()
}

void printEvent(const uint32_t* times, uint32_t count) {
  const size_t   stored   = count < kMaxEdges ? count : kMaxEdges;
  const uint32_t duration = times[stored - 1] - times[0];
  uint32_t shortest = UINT32_MAX;
  for (size_t i = 1; i < stored; ++i) shortest = min(shortest, times[i] - times[i - 1]);

  // Після тиші рівень стабільний: став LOW — натиснули, став HIGH — відпустили,
  // не змінився — це був лише короткий імпульс (GLITCH).
  const int  level   = digitalRead(kButtonPin);
  const bool changed = level != stableLevel;
  stableLevel = level;
  const char* kind  = !changed ? "GLITCH" : level == LOW ? "PRESS" : "RELEASE";
  uint32_t&   index = !changed ? glitchCount : level == LOW ? pressCount : releaseCount;
  Serial.printf("%-7s #%-3lu edges=%-3lu bounce=%6lu us", kind, static_cast<unsigned long>(++index),
                static_cast<unsigned long>(count), static_cast<unsigned long>(duration));
  if (stored > 1) Serial.printf("  shortest=%lu us", static_cast<unsigned long>(shortest));
  if (count == 1) Serial.print("  (clean, no bounce)");
  // Зміна рівня — це непарна кількість фронтів, повернення до того самого — парна.
  // Інша парність означає, що імпульс був коротший за реакцію ISR і фронт загубився.
  const bool missed = (count % 2 == 1) != changed;
  if (missed) Serial.print("  [ISR missed >=1 edge - see analyzer]");
  Serial.println();

  // Короткий підпис для каналу LABEL: Logic 2 декодує його як Async Serial і показує на шкалі
  // часу — через ~50 мс після останнього фронту (стільки триває очікування тиші).
  Serial1.printf("%s#%lu e=%lu %luus%s\n", kind, static_cast<unsigned long>(index),
                 static_cast<unsigned long>(count), static_cast<unsigned long>(duration),
                 missed ? " MISSED" : "");

  // Інтервали між сусідніми фронтами — так само, як курсори в аналізаторі.
  if (stored > 1) {
    Serial.print("        gaps us:");
    for (size_t i = 1; i < stored && i <= kShowGaps; ++i) {
      Serial.printf(" %lu", static_cast<unsigned long>(times[i] - times[i - 1]));
    }
    if (stored - 1 > kShowGaps) Serial.print(" ...");
    Serial.println();
  }
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

  pinMode(kButtonPin, INPUT_PULLUP);  // внутрішній резистор ~45 кОм до 3.3 В
  stableLevel = digitalRead(kButtonPin);
  pinMode(kBouncePin, OUTPUT);
  digitalWrite(kBouncePin, LOW);
  Serial1.begin(kLabelBaud, SERIAL_8N1, -1, kLabelTxPin);  // лише TX: RX не потрібен
  attachInterrupt(digitalPinToInterrupt(kButtonPin), onButtonEdge, CHANGE);

  Serial.println();
  Serial.println("=== ESP32-S3: button bounce test ===");
  Serial.printf("Button GPIO%u, interrupt CHANGE, event ends after %lu ms of quiet\n", kButtonPin,
                static_cast<unsigned long>(kQuietUs / 1000));
  Serial.printf("Analyzer: CH1=GPIO%u button, CH2=GPIO%u BOUNCE marker, CH3=GPIO%u LABEL (UART %lu)\n",
                kButtonPin, kBouncePin, kLabelTxPin, static_cast<unsigned long>(kLabelBaud));
  Serial.println("Press the button: one line per press and per release.");
}

void loop() {
  // Подія закінчилася, коли були фронти і після останнього минуло kQuietUs.
  if (gEdgeCount == 0 || micros() - gLastEdgeUs < kQuietUs) return;

  // Забрати дані атомарно: на мить вимкнути переривання, скопіювати й обнулити лічильник.
  uint32_t times[kMaxEdges];
  noInterrupts();
  const uint32_t count  = gEdgeCount;
  const size_t   stored = count < kMaxEdges ? count : kMaxEdges;
  for (size_t i = 0; i < stored; ++i) times[i] = gEdgeTimes[i];
  gEdgeCount = 0;
  interrupts();

  digitalWrite(kBouncePin, LOW);  // подія закінчилася
  printEvent(times, count);
}

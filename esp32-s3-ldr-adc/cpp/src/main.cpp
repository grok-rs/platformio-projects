// Модуль 1.6 — вимірювання освітленості: фоторезистор (LDR) + 10 кОм, АЦП ESP32-S3.
//
//   3V3 ── LDR ──┬── 10 кОм ── GND        Більше світла → менший опір LDR →
//                └── GPIO4 (ADC1_CH3)      вища напруга на GPIO4 → більше число RAW.
//
// Кожні 100 мс програма:
//   1. читає «сире» число АЦП:            RAW    = analogRead()            (0…4095);
//   2. переводить його в мілівольти:       U_calc = RAW / 4095 · 3100 мВ;
//   3. читає калібровану напругу:          U_meas = analogReadMilliVolts();
//   4. рахує відносну похибку:             error  = (U_calc − U_meas) / U_meas · 100 %;
//   5. друкує рядок таблиці в Serial.
// Раз на 10 с — підсумок: середня й найбільша |похибка|. Пояснення — у README.md.

#include <Arduino.h>

namespace {

// --- Вхід ---------------------------------------------------------------
// GPIO4 належить ADC1 (GPIO1…10): працює завжди, навіть з увімкненим Wi-Fi.
// ADC2 (GPIO11…20) ділить апаратуру з Wi-Fi — для датчиків його краще не брати.
constexpr uint8_t kLdrPin = 4;

// --- АЦП ----------------------------------------------------------------
// 12 біт → 2^12 = 4096 сходинок, числа 0…4095.
// Ослаблення 11 дБ: на ESP32-S3 це діапазон 0…3100 мВ, а не 0…3300 мВ.
// Усе, що вище ~3.1 В, АЦП показує як 4095 («впирається в стелю»).
constexpr float    kAdcMax   = 4095.0f;
constexpr float    kUrefMv   = 3100.0f;
constexpr uint8_t  kAdcBits  = 12;

// --- Таблиця ------------------------------------------------------------
constexpr uint32_t kSamplePeriodMs  = 100;    // з умови завдання
constexpr uint32_t kSummaryPeriodMs = 10000;  // підсумок похибки
constexpr uint32_t kHeaderEvery     = 25;     // повторювати шапку, щоб не губитися в стовпцях
// Біля 0 мВ знаменник похибки дуже малий: 3 мВ різниці при 10 мВ — це вже 30 %.
// У підсумок беремо лише виміри від 100 мВ, щоб він описував АЦП, а не ділення на «майже нуль».
constexpr uint32_t kMinMvForStats   = 100;
constexpr uint8_t  kBarWidth        = 16;     // ширина «шкали світла» у символах

constexpr uint32_t kSerialBaud   = 115200;
constexpr uint32_t kSerialWaitMs = 2000;      // чекати USB CDC, щоб не втратити банер

// Один вимір — усе, що потрапляє в рядок таблиці.
struct Sample {
  uint16_t raw;
  float    calcMv;
  uint32_t measMv;
  bool     hasError;  // false, якщо U_meas = 0 (ділити на нуль не можна)
  float    errorPct;
};

// Накопичувач для підсумку.
struct Stats {
  uint32_t count  = 0;
  float    sumAbs = 0;
  float    maxAbs = 0;

  void add(float errorPct) {
    const float a = fabsf(errorPct);
    ++count;
    sumAbs += a;
    if (a > maxAbs) maxAbs = a;
  }
};

// --- Стан програми -------------------------------------------------------
uint32_t lastSampleAt  = 0;
uint32_t lastSummaryAt = 0;
uint32_t rowsPrinted   = 0;
Stats    stats;

// Формула з умови: U_calc = RAW / ADC_max · U_ref.
float rawToMillivolts(uint16_t raw) { return raw / kAdcMax * kUrefMv; }

Sample measure() {
  Sample s{};
  s.raw    = analogRead(kLdrPin);
  // Це окреме перетворення, а не перерахунок того самого RAW: між ними кілька мікросекунд,
  // тож у «похибку» потрапляє й шум АЦП (±кілька одиниць RAW).
  s.measMv = analogReadMilliVolts(kLdrPin);
  s.calcMv = rawToMillivolts(s.raw);

  s.hasError = s.measMv > 0;
  if (s.hasError) {
    s.errorPct = (s.calcMv - static_cast<float>(s.measMv)) / s.measMv * 100.0f;
  }
  return s;
}

void printHeader() {
  Serial.println();
  Serial.println("  t, ms   RAW  U_calc,mV  U_meas,mV  error,%  light");
  Serial.println("-------  ----  ---------  ---------  -------  ----------------");
}

void printRow(uint32_t t, const Sample& s) {
  // Шкала світла: скільки «#» з kBarWidth — пропорційно U_meas до 3100 мВ.
  char bar[kBarWidth + 1];
  const uint32_t filled = min<uint32_t>(kBarWidth, (s.measMv * kBarWidth + kUrefMv / 2) / kUrefMv);
  for (uint8_t i = 0; i < kBarWidth; ++i) bar[i] = i < filled ? '#' : '.';
  bar[kBarWidth] = '\0';

  char err[12];
  if (s.hasError) {
    snprintf(err, sizeof err, "%+7.2f", s.errorPct);
  } else {
    snprintf(err, sizeof err, "%7s", "n/a");
  }

  Serial.printf("%7lu  %4u  %9.1f  %9lu  %s  %s\n",
                static_cast<unsigned long>(t), s.raw, s.calcMv,
                static_cast<unsigned long>(s.measMv), err, bar);
}

void printSummary() {
  if (stats.count == 0) {
    Serial.printf("--- summary: no samples >= %lu mV (too dark) ---\n",
                  static_cast<unsigned long>(kMinMvForStats));
  } else {
    Serial.printf("--- summary: %lu samples >= %lu mV, |error| avg %.2f %%, max %.2f %% ---\n",
                  static_cast<unsigned long>(stats.count), static_cast<unsigned long>(kMinMvForStats),
                  stats.sumAbs / stats.count, stats.maxAbs);
  }
  stats        = Stats{};
  rowsPrinted  = 0;  // після підсумку — знову шапка
}

void waitForSerial(uint32_t timeoutMs) {
  const uint32_t start = millis();
  while (!Serial && millis() - start < timeoutMs) {
  }
}

void printBanner() {
  Serial.println();
  Serial.println("=== ESP32-S3: LDR light meter (module 1.6) ===");
  Serial.printf("Divider: 3V3 - LDR - GPIO%u - 10k - GND (more light -> higher voltage)\n", kLdrPin);
  Serial.printf("ADC: %u bit (0..%.0f), 11 dB, Uref = %.0f mV, every %lu ms\n",
                kAdcBits, kAdcMax, kUrefMv, static_cast<unsigned long>(kSamplePeriodMs));
  Serial.println("U_calc = RAW / 4095 * 3100 mV; error = (U_calc - U_meas) / U_meas * 100 %");
}

}  // namespace

void setup() {
  Serial.begin(kSerialBaud);
  waitForSerial(kSerialWaitMs);

  analogReadResolution(kAdcBits);
  analogSetPinAttenuation(kLdrPin, ADC_11db);  // це й так типове значення; пишемо явно

  printBanner();
  lastSampleAt  = millis();
  lastSummaryAt = lastSampleAt;
}

void loop() {
  const uint32_t now = millis();

  // Неблокуючий таймер: `now - lastSampleAt` правильно рахується й після переповнення millis().
  // `+= period`, а не `= now`, — щоб крок не «повзав», якщо loop() трохи запізнився.
  if (now - lastSampleAt >= kSamplePeriodMs) {
    lastSampleAt += kSamplePeriodMs;

    const Sample s = measure();
    if (rowsPrinted % kHeaderEvery == 0) printHeader();
    printRow(now, s);
    ++rowsPrinted;
    if (s.hasError && s.measMv >= kMinMvForStats) stats.add(s.errorPct);
  }

  if (now - lastSummaryAt >= kSummaryPeriodMs) {
    lastSummaryAt += kSummaryPeriodMs;
    printSummary();
  }
}

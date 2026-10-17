// Урок, крок 2 — кожне натискання кнопки перемикає світлодіод (ESP32-S3-DevKitC-1).
//
//   GPIO15 → резистор 220 Ω → анод LED → катод → GND
//   GPIO21 → кнопка → GND, вхід INPUT_PULLUP (натиснута = LOW)
//
// На відміну від кроку 1, тут важлива не «натиснута зараз», а **подія** натискання —
// перехід HIGH → LOW. Механічний контакт при цьому кілька мілісекунд брязкотить, тому
// новий рівень приймаємо лише тоді, коли він тримається kDebounceMs. Схема — у README.md.

#include <Arduino.h>

namespace {

constexpr uint8_t  kLedPin       = 15;
constexpr uint8_t  kButtonPin    = 21;
constexpr uint32_t kDebounceMs   = 30;  // брязкіт звичайної тактової кнопки — до ~10 мс
constexpr uint32_t kSerialBaud   = 115200;
constexpr uint32_t kSerialWaitMs = 2000;  // чекати USB CDC, щоб не втратити банер

// --- Стан програми -------------------------------------------------------
bool     ledOn       = false;
int      stableLevel = HIGH;  // підтверджений рівень кнопки (відпущена = HIGH)
int      lastReading = HIGH;  // останнє «сире» читання, може брязкотіти
uint32_t lastChange  = 0;     // коли сире читання змінилося востаннє
uint32_t pressCount  = 0;

// Повертає true рівно один раз на кожне натискання.
// `millis() - lastChange` — беззнакова різниця, коректна й після переповнення millis().
bool buttonPressedEvent() {
  const int reading = digitalRead(kButtonPin);
  if (reading != lastReading) {
    lastReading = reading;
    lastChange  = millis();  // рівень ще «стрибає» — почати відлік заново
    return false;
  }
  if (millis() - lastChange < kDebounceMs || reading == stableLevel) return false;

  stableLevel = reading;  // рівень стабільний kDebounceMs — приймаємо його
  return stableLevel == LOW;
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

  pinMode(kLedPin, OUTPUT);
  pinMode(kButtonPin, INPUT_PULLUP);  // внутрішній резистор ~45 кОм до 3.3 В
  digitalWrite(kLedPin, LOW);

  Serial.println();
  Serial.println("=== ESP32-S3: button toggles LED ===");
  Serial.printf("LED GPIO%u, button GPIO%u, debounce %lu ms\n", kLedPin, kButtonPin,
                static_cast<unsigned long>(kDebounceMs));
}

void loop() {
  if (buttonPressedEvent()) {
    ledOn = !ledOn;
    digitalWrite(kLedPin, ledOn ? HIGH : LOW);
    Serial.printf("Press #%lu -> LED %s\n", static_cast<unsigned long>(++pressCount),
                  ledOn ? "ON" : "OFF");
  }
  delay(1);
}

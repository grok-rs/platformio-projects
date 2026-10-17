// Урок, крок 1 — світлодіод світить, поки кнопку тримають (ESP32-S3-DevKitC-1).
//
//   GPIO15 → резистор 220 Ω → анод LED → катод → GND
//   GPIO21 → кнопка → GND, вхід INPUT_PULLUP (натиснута = LOW)
//
// Програма щоразу читає кнопку й копіює її стан на світлодіод. Схема — у README.md.

#include <Arduino.h>

namespace {

constexpr uint8_t  kLedPin       = 15;
constexpr uint8_t  kButtonPin    = 21;
constexpr uint32_t kSerialBaud   = 115200;
constexpr uint32_t kSerialWaitMs = 2000;  // чекати USB CDC, щоб не втратити банер

bool wasPressed = false;

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
  Serial.println("=== ESP32-S3: LED follows button (hold) ===");
  Serial.printf("LED GPIO%u, button GPIO%u\n", kLedPin, kButtonPin);
}

void loop() {
  const bool pressed = digitalRead(kButtonPin) == LOW;
  digitalWrite(kLedPin, pressed ? HIGH : LOW);

  // Друкуємо лише зміни, інакше монітор заллє тисячами рядків на секунду.
  if (pressed != wasPressed) {
    wasPressed = pressed;
    Serial.println(pressed ? "Button pressed  -> LED ON" : "Button released -> LED OFF");
  }
  delay(1);
}

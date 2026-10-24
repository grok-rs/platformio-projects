// ТЗ-A, етап 2: GPIO5 як звичайний цифровий вихід, без ШІМ — HIGH і LOW по 3 с.
// Поки HIGH: LED світить, мультиметр між базою й емітером показує U(БЕ) ≈ 0,6–0,8 В,
// між колектором і емітером — U(КЕ) насичення (рівень «+»).

#include <Arduino.h>

#include <cinttypes>

#include "config.h"
#include "console.h"

namespace {

class SwitchApp {
 public:
  void init() {
    beginConsole(Config::Console::kBaud, Config::Console::kWaitMs);
    pinMode(Config::Pwm::kPin, OUTPUT);

    Serial.println();
    Serial.println("=== Bright module (TZ-A): stage 2, GPIO switch ===");
    Serial.printf("GPIO%u toggles every %" PRIu32 " ms: measure U(BE) while HIGH\n", Config::Pwm::kPin,
                  Config::Switch::kHalfPeriodMs);

    set(true, millis());
  }

  void update() {
    const uint32_t nowMs = millis();
    if (nowMs - lastToggleMs_ >= Config::Switch::kHalfPeriodMs) set(!high_, nowMs);
  }

 private:
  void set(bool high, uint32_t nowMs) {
    digitalWrite(Config::Pwm::kPin, high ? HIGH : LOW);
    high_         = high;
    lastToggleMs_ = nowMs;
    tryPrintf("GPIO%u %s\n", Config::Pwm::kPin, high ? "HIGH: LED on" : "LOW: LED off");
  }

  bool     high_         = false;
  uint32_t lastToggleMs_ = 0;
};

SwitchApp app;

}  // namespace

void setup() { app.init(); }

void loop() { app.update(); }

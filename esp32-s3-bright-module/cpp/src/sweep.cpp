// ТЗ-A, етап 3: заповнення LEDC плавно 0 → 255 → 0 з паузами на 255 і на 0.
// На паузах мультиметр (DC) між колектором і GND показує: при 255 ≈ 0,1–0,2 В (ключ у
// насиченні), при 0 — майже 5 В мінус падіння на LED. Під час розгону напруга плавно падає.

#include <Arduino.h>

#include <cinttypes>

#include "config.h"
#include "console.h"
#include "ledc_output.h"
#include "sweep.h"

namespace {

class SweepApp {
 public:
  void init() {
    beginConsole(Config::Console::kBaud, Config::Console::kWaitMs);
    const bool outputOk = output_.init();

    Serial.println();
    Serial.println("=== Bright module (TZ-A): stage 3, PWM sweep ===");
    output_.describe(Serial);
    Serial.printf("Ramp 0 -> 255 in %" PRIu32 " ms, hold %" PRIu32 " ms\n", sweep_.rampMs(),
                  Config::Sweep::kHoldMs);
    if (!outputOk) Serial.println("ERROR: PWM output init failed");

    sweep_.restart(millis());
  }

  void update() {
    const uint32_t nowMs = millis();
    const uint8_t  duty  = sweep_.duty(nowMs);
    if (duty != duty_) {  // писати в LEDC лише нове значення
      output_.write(duty);
      duty_ = duty;
    }
    reportPhase(sweep_.phase(nowMs));
  }

 private:
  void reportPhase(Sweep::Phase phase) {
    if (phase == phase_ && reported_) return;
    phase_    = phase;
    reported_ = true;
    switch (phase) {
      case Sweep::Phase::RampUp:   tryPrintf("Sweep: ramp up\n"); break;
      case Sweep::Phase::HoldHigh: tryPrintf("Sweep: hold duty 255, measure U(CE) ~0.2 V\n"); break;
      case Sweep::Phase::RampDown: tryPrintf("Sweep: ramp down\n"); break;
      case Sweep::Phase::HoldLow:  tryPrintf("Sweep: hold duty 0\n"); break;
    }
  }

  LedcOutput   output_{Config::Pwm::kPin, Config::Pwm::kChannel, Config::Pwm::kFrequencyHz,
                     Config::Pwm::kResolutionBits};
  Sweep        sweep_{Config::Sweep::kStepMs, Config::Sweep::kHoldMs};
  uint8_t      duty_     = 0;
  Sweep::Phase phase_    = Sweep::Phase::RampUp;
  bool         reported_ = false;  // перша фаза ще не надрукована
};

SweepApp app;

}  // namespace

void setup() { app.init(); }

void loop() { app.update(); }

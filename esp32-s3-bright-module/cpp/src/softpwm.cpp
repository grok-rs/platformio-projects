// ТЗ-A, рівень «+»: те саме, що levels.cpp, але ШІМ формує процесор на millis(), а не LEDC.
// Порівняння з апаратним ШІМ — README.md, розділ «Рівень +», і tools/vcd_pwm.py.

#include <Arduino.h>

#include "config.h"
#include "levels_app.h"
#include "soft_pwm_output.h"

namespace {

LevelsApp<SoftPwmOutput> app{Config::Pwm::kPin, Config::SoftPwm::kPeriodMs};

}  // namespace

void setup() { app.init(); }

void loop() { app.update(); }

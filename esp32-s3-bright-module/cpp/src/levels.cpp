// ТЗ-A «Яскравий модуль», основна прошивка (етап 4, ВП-1…ВП-8):
// кнопка перемикає яскравість LED по колу OFF → LOW → MID → HIGH → OFF.
//
//   +5 В MB-102 → LED → 220 Ом → колектор 2N2222, емітер → GND (спільна з ESP32)
//   GPIO5 → 1 кОм → база                ШІМ LEDC 5 кГц, 8 біт
//   3V3 → кнопка → GPIO6                INPUT_PULLDOWN, переривання RISING
//
// Схема й монтаж — README.md і docs/. Усі піни й рівні — include/config.h.

#include <Arduino.h>

#include "config.h"
#include "ledc_output.h"
#include "levels_app.h"

namespace {

// Увесь стан програми — один статичний об'єкт, видимий лише в цьому файлі: жодних глобальних
// змінних, жодного new / malloc. Навіть прапорець ISR — член Button усередині нього.
LevelsApp<LedcOutput> app{Config::Pwm::kPin, Config::Pwm::kChannel, Config::Pwm::kFrequencyHz,
                          Config::Pwm::kResolutionBits};

}  // namespace

void setup() { app.init(); }

void loop() { app.update(); }

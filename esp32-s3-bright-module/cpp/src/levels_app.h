// Застосунок «чотири рівні яскравості» (ВП-1…ВП-7), спільний для двох прошивок:
//   levels.cpp  — LevelsApp<LedcOutput>     апаратний ШІМ (основне завдання);
//   softpwm.cpp — LevelsApp<SoftPwmOutput>  програмний ШІМ на millis() (рівень «+»).
//
// Шаблон замість віртуального інтерфейсу: тип виходу відомий під час компіляції, тож виклики
// write()/update() вбудовуються без таблиці віртуальних функцій. Вимога до Output — методи
// init(), write(duty), update(nowMs) і describe(out).

#pragma once

#include <Arduino.h>

#include <cinttypes>

#include "brightness.h"
#include "button.h"
#include "config.h"
#include "console.h"
#include "press_detector.h"

template <class Output>
class LevelsApp {
 public:
  // Аргументи передаються конструктору виходу: LedcOutput і SoftPwmOutput мають різні параметри.
  template <class... OutputArgs>
  explicit constexpr LevelsApp(OutputArgs... outputArgs) : output_(outputArgs...) {}

  void init() {
    beginConsole(Config::Console::kBaud, Config::Console::kWaitMs);
    const bool outputOk = output_.init();
    button_.init();

    Serial.println();
    Serial.println("=== Bright module (TZ-A): PWM levels + button ===");
    output_.describe(Serial);
    Serial.printf("Button GPIO%u (INPUT_PULLDOWN, RISING), debounce %" PRIu32 " ms\n",
                  Config::Button::kPin, Config::Button::kDebounceMs);
    // Не мовчати: без ШІМ LED не світитиме, а кнопка й Serial працюватимуть далі.
    if (!outputOk) Serial.println("ERROR: PWM output init failed");

    apply(Brightness::Off);
    Serial.printf("Level: %s (duty %u, %u%%)\n", name(level_), kDuty[level_], dutyPercent(kDuty[level_]));
  }

  // Одна ітерація superloop. Нічого не чекає: кожен крок перевіряє «чи пора?» і повертається.
  void update() {
    const uint32_t nowMs = millis();  // один момент часу на весь прохід
    handleButton(nowMs);
    output_.update(nowMs);
  }

 private:
  // ВП-5: прапорець ISR + рівень входу → автомат PressDetector (див. press_detector.h):
  // одне натискання — одна подія, навіть коротке; брязкіт відпускання й утримання — жодної.
  void handleButton(uint32_t nowMs) {
    if (!presses_.update(button_.takeEdge(), button_.isPressed(), nowMs)) return;

    ++pressCount_;
    apply(next(level_));  // ВП-6
    // ВП-7. tryPrintf не блокує цикл, якщо монітор не читає порт (див. console.h).
    tryPrintf("Press #%" PRIu32 " -> %s (duty %u, %u%%)\n", pressCount_, name(level_), kDuty[level_],
              dutyPercent(kDuty[level_]));
  }

  void apply(Brightness level) {
    level_ = level;
    output_.write(kDuty[level_]);
  }

  // ВП-2: числа — з конфігурації, відповідність «рівень → заповнення» — у логіці.
  static constexpr DutyTable kDuty{Config::Level::kOff, Config::Level::kLow, Config::Level::kMid,
                                   Config::Level::kHigh};

  Output        output_;
  Button        button_{Config::Button::kPin};
  PressDetector presses_{Config::Button::kDebounceMs};
  Brightness    level_      = Brightness::Off;
  uint32_t      pressCount_ = 0;
};

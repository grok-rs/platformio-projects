// Усі налаштування прошивки в одному місці — у коді немає «магічних чисел» (завдання 2).
//
// `static constexpr` член структури — це константа часу компіляції:
//   * має тип (на відміну від #define) і область видимості: Config::Led::kPin, а не просто LED;
//   * не займає RAM: компілятор підставляє значення прямо в інструкції;
//   * годиться там, де потрібна константа на етапі компіляції, — у static_assert нижче.
// `static const` теж працював би для цілих чисел, але constexpr прямо обіцяє «відомо під час
// компіляції» і працює для будь-якого літерального типу. Від C++17 такі члени неявно inline,
// тож окреме визначення в .cpp не потрібне.

#pragma once

#include <cstdint>

struct Config {
  Config() = delete;  // це лише простір імен для констант, об'єктів не буває

  struct Led {
    static constexpr uint8_t  kPin             = 15;   // GPIO15 → 220 Ω → LED → GND
    static constexpr uint32_t kBlinkIntervalMs = 500;  // пів періоду: 1 Гц
  };

  struct Button {
    static constexpr uint8_t  kPin        = 21;  // GPIO21 → кнопка → GND, INPUT_PULLUP
    static constexpr uint32_t kDebounceMs = 30;  // тиша після останнього фронту = подія завершилась
  };

  struct Console {
    static constexpr uint32_t kBaud   = 115200;
    static constexpr uint32_t kWaitMs = 2000;  // чекати USB CDC, щоб не втратити банер
  };

  struct Profiler {
    static constexpr uint32_t kWindowIterations = 1000;  // звіт про superloop кожні N ітерацій
  };

  // Помилки конфігурації ловить компілятор, а не плата.
  static constexpr uint8_t kMaxGpio = 48;  // ESP32-S3: GPIO0…GPIO48
  static_assert(Led::kPin <= kMaxGpio && Button::kPin <= kMaxGpio, "no such GPIO on ESP32-S3");
  static_assert(Led::kPin != Button::kPin, "LED and button share a pin");
  static_assert(Button::kDebounceMs < Led::kBlinkIntervalMs, "debounce must be shorter than a blink");
  static_assert(Profiler::kWindowIterations > 0, "empty profiling window");
};

// ТЗ-A «Яскравий модуль»: усі піни, частоти й рівні — в одному місці (ВП-8).
// Прошивки (src/*.cpp) лише підключають цей файл — у коді немає «магічних чисел».
//
// `static constexpr` член структури — константа часу компіляції: має тип і область видимості
// (Config::Pwm::kPin, а не просто PIN), не займає RAM і годиться для static_assert нижче.

#pragma once

#include <cstdint>

// GPIO, які на N16R8 не можна брати під периферію: 22…25 у ESP32-S3 немає зовсім, strapping-піни
// (0, 3, 45, 46) задають режим старту, 19/20 — USB, 26…37 зайняті флешем і восьмибітною (OPI) PSRAM.
constexpr bool isFreeGpio(uint8_t pin) {
  return pin <= 48 && pin != 0 && pin != 3 && pin != 45 && pin != 46 && pin != 19 && pin != 20 &&
         !(pin >= 22 && pin <= 37);
}

struct Config {
  Config() = delete;  // лише простір імен для констант

  // ВП-1: ШІМ через апаратний блок LEDC.
  struct Pwm {
    static constexpr uint8_t  kPin            = 5;     // GPIO5 → R1 1 кОм → база 2N2222
    static constexpr uint8_t  kChannel        = 0;     // канал LEDC (потрібен лише ядру Arduino 2.x)
    static constexpr uint32_t kFrequencyHz    = 5000;  // 5 кГц: оку не видно мерехтіння
    static constexpr uint8_t  kResolutionBits = 8;     // заповнення 0…255
  };

  // ВП-2: заповнення ШІМ для кожного рівня яскравості, 0…255.
  // 255 — це 100 %: ядро Arduino саме перетворює максимум 255 на 256/256 (повністю увімкнено).
  struct Level {
    static constexpr uint8_t kOff  = 0;
    static constexpr uint8_t kLow  = 40;   // ≈16 %
    static constexpr uint8_t kMid  = 128;  // ≈50 %
    static constexpr uint8_t kHigh = 255;  // 100 %
  };

  // ВП-3, ВП-5: кнопка 3V3 → GPIO6, внутрішня підтяжка до GND.
  struct Button {
    static constexpr uint8_t  kPin        = 6;
    static constexpr uint32_t kDebounceMs = 50;  // тиша після останнього фронту = подія завершилась
  };

  // ВП-7.
  struct Console {
    static constexpr uint32_t kBaud   = 115200;
    static constexpr uint32_t kWaitMs = 2000;  // чекати USB CDC, щоб не втратити банер
  };

  // Етап 2 (прошивка switch): рівень тримається довго, щоб мультиметр встиг заміряти U(БЕ).
  struct Switch {
    static constexpr uint32_t kHalfPeriodMs = 3000;
  };

  // Етап 3 (прошивка sweep): 0 → 255 по одному кроку, пауза на 255 і на 0 для заміру U(КЕ).
  struct Sweep {
    static constexpr uint32_t kStepMs = 12;    // 255 кроків × 12 мс ≈ 3 с на розгін
    static constexpr uint32_t kHoldMs = 3000;
  };

  // Рівень «+» (прошивка softpwm): програмний ШІМ на millis() — період у мілісекундах.
  struct SoftPwm {
    static constexpr uint32_t kPeriodMs = 10;  // 100 Гц; кроків заповнення лише 10 (див. README)
  };
};

// --- Перевірки: помилку конфігурації ловить компілятор, а не плата ---------------------------
// (після структури: усередині неї тип ще неповний і її члени в static_assert недоступні)

static_assert(isFreeGpio(Config::Pwm::kPin) && isFreeGpio(Config::Button::kPin), "pin is reserved on ESP32-S3 N16R8");
static_assert(Config::Pwm::kPin != Config::Button::kPin, "PWM output and button share a pin");

// Таймер LEDC ділить свою тактову частоту: частота × 2^біт не може бути більшою за неї. Ядро
// Arduino 2.x на ESP32-S3 тактує LEDC від кварцу 40 МГц (LEDC_USE_XTAL_CLK), а не від APB 80 МГц.
static_assert(uint64_t{Config::Pwm::kFrequencyHz} << Config::Pwm::kResolutionBits <= 40'000'000,
              "LEDC: frequency x 2^bits exceeds the 40 MHz XTAL clock");
static_assert(Config::Pwm::kResolutionBits == 8, "duty levels are 8-bit values");
static_assert(Config::Level::kOff < Config::Level::kLow && Config::Level::kLow < Config::Level::kMid &&
                  Config::Level::kMid < Config::Level::kHigh,
              "levels must grow: OFF < LOW < MID < HIGH");
static_assert(Config::Button::kDebounceMs > 0 && Config::Button::kDebounceMs < 1000, "debounce out of range");
static_assert(Config::SoftPwm::kPeriodMs > 0, "empty soft-PWM period");

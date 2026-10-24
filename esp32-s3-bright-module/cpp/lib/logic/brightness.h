// Рівні яскравості (ВП-2, ВП-6) — без Arduino.h, тому тестуються на ПК (pio test -e native).

#pragma once

#include <cstdint>

// `enum class`: рівень не переплутати з числом заповнення чи номером піна,
// і в int він сам собою не перетворюється.
enum class Brightness : uint8_t { Off, Low, Mid, High };

// ВП-6: по колу OFF → LOW → MID → HIGH → OFF.
// switch без `default`: якщо додати рівень і забути його тут, -Wswitch попередить.
constexpr Brightness next(Brightness level) {
  switch (level) {
    case Brightness::Off:  return Brightness::Low;
    case Brightness::Low:  return Brightness::Mid;
    case Brightness::Mid:  return Brightness::High;
    case Brightness::High: return Brightness::Off;
  }
  return Brightness::Off;  // недосяжно; заспокоює -Wreturn-type
}

// Рядки — літерали у флеші: жодного String і жодної купи.
constexpr const char* name(Brightness level) {
  switch (level) {
    case Brightness::Off:  return "OFF";
    case Brightness::Low:  return "LOW";
    case Brightness::Mid:  return "MID";
    case Brightness::High: return "HIGH";
  }
  return "?";
}

// Яке заповнення відповідає кожному рівню. Самі числа — у Config::Level (include/config.h):
// логіка не знає конфігурації проєкту, а тести підставляють свою таблицю.
struct DutyTable {
  uint8_t off, low, mid, high;

  constexpr uint8_t operator[](Brightness level) const {
    switch (level) {
      case Brightness::Off:  return off;
      case Brightness::Low:  return low;
      case Brightness::Mid:  return mid;
      case Brightness::High: return high;
    }
    return 0;
  }
};

// Заповнення 0…255 → відсотки, з округленням до найближчого: 40 → 16 %, 128 → 50 %.
constexpr uint8_t dutyPercent(uint8_t duty) {
  return static_cast<uint8_t>((duty * 100U + 127U) / 255U);
}

static_assert(next(next(next(next(Brightness::Off)))) == Brightness::Off, "four presses = full cycle");
static_assert(dutyPercent(0) == 0 && dutyPercent(255) == 100);

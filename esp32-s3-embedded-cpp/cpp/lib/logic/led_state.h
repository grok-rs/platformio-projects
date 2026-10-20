// Стани й режими світлодіода — без Arduino.h, тому тестуються на ПК (pio test -e native).

#pragma once

#include <cstdint>

// `enum class` замість bool або HIGH/LOW: LedState не переплутати з номером піна чи з іншим
// перерахуванням, і він не перетворюється в int сам собою. `: uint8_t` — займає один байт.
enum class LedState : uint8_t { Off, On };

constexpr LedState toggled(LedState state) {
  return state == LedState::On ? LedState::Off : LedState::On;
}

// Режими з завдання 4, у порядку перемикання кнопкою.
enum class LedMode : uint8_t { Blink, SteadyOn, SteadyOff };

// switch без `default`: якщо додати режим і забути його тут, -Wswitch попередить.
constexpr LedMode nextMode(LedMode mode) {
  switch (mode) {
    case LedMode::Blink:     return LedMode::SteadyOn;
    case LedMode::SteadyOn:  return LedMode::SteadyOff;
    case LedMode::SteadyOff: return LedMode::Blink;
  }
  return LedMode::Blink;  // недосяжно; заспокоює -Wreturn-type
}

// Рядки — літерали у флеші: жодного String і жодної купи.
constexpr const char* modeName(LedMode mode) {
  switch (mode) {
    case LedMode::Blink:     return "BLINK";
    case LedMode::SteadyOn:  return "STEADY_ON";
    case LedMode::SteadyOff: return "STEADY_OFF";
  }
  return "?";
}

// constexpr-функції перевіряються ще під час компіляції.
static_assert(toggled(toggled(LedState::On)) == LedState::On);
static_assert(nextMode(nextMode(nextMode(LedMode::Blink))) == LedMode::Blink, "three presses = full cycle");

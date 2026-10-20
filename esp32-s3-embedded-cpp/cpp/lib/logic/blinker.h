// Неблокуюче блимання: замість delay() пам'ятаємо, коли LED перемикався востаннє, і на кожному
// проході superloop порівнюємо з поточним часом. Час приходить параметром — тестується на ПК.

#pragma once

#include <cstdint>

#include "led_state.h"

class Blinker {
 public:
  explicit constexpr Blinker(uint32_t intervalMs) : intervalMs_(intervalMs) {}

  // Почати новий цикл блимання з моменту nowMs, LED увімкнений.
  void restart(uint32_t nowMs) {
    lastToggleMs_ = nowMs;
    state_        = LedState::On;
  }

  // Один прохід superloop: повертає стан, який LED має мати зараз. Ніколи не чекає.
  LedState update(uint32_t nowMs) {
    // Беззнакова різниця коректна й після переповнення millis() (кожні ~49.7 доби).
    if (nowMs - lastToggleMs_ >= intervalMs_) {
      // += interval, а не = now: перемикання лишаються на сітці 0, 500, 1000… мс і не
      // «відстають» на затримку проходу циклу.
      lastToggleMs_ += intervalMs_;
      // Цикл простояв довше за період — синхронізуватися, а не надолужувати серією перемикань.
      if (nowMs - lastToggleMs_ >= intervalMs_) lastToggleMs_ = nowMs;
      state_ = toggled(state_);
    }
    return state_;
  }

  LedState state() const { return state_; }

 private:
  uint32_t intervalMs_;
  uint32_t lastToggleMs_ = 0;
  LedState state_        = LedState::On;
};

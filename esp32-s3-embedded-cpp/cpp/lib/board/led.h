// Світлодіод на одному GPIO (завдання 1: клас Led з init() і set()).

#pragma once

#include <Arduino.h>

#include "led_state.h"

class Led {
 public:
  // Конструктор лише запам'ятовує пін і не торкається заліза: глобальні об'єкти створюються
  // ще до ініціалізації ядра Arduino. Тому налаштування виводу — окремо, в init() із setup().
  explicit constexpr Led(uint8_t pin) : pin_(pin) {}

  // Один вивід — один власник: копія «смикала» б той самий пін, а її state_ розійшовся б з ним.
  Led(const Led&)            = delete;
  Led& operator=(const Led&) = delete;

  void init() {
    pinMode(pin_, OUTPUT);
    write(LedState::Off);
  }

  // Писати в GPIO лише тоді, коли стан справді змінюється.
  void set(LedState state) {
    if (state != state_) write(state);
  }

  LedState state() const { return state_; }

 private:
  void write(LedState state) {
    digitalWrite(pin_, state == LedState::On ? HIGH : LOW);
    state_ = state;
  }

  const uint8_t pin_;
  LedState      state_ = LedState::Off;
};

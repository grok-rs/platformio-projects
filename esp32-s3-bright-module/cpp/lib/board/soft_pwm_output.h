// Програмний ШІМ на millis() (рівень «+»): той самий інтерфейс, що й LedcOutput, але сигнал
// формує сам процесор — update() на кожному проході циклу вирішує, HIGH чи LOW зараз.
// Будь-яка затримка циклу (Serial, обробка кнопки) одразу видна як тремтіння фронтів.

#pragma once

#include <Arduino.h>

#include "soft_pwm.h"

class SoftPwmOutput {
 public:
  constexpr SoftPwmOutput(uint8_t pin, uint32_t periodMs) : pin_(pin), pwm_(periodMs) {}

  SoftPwmOutput(const SoftPwmOutput&)            = delete;
  SoftPwmOutput& operator=(const SoftPwmOutput&) = delete;

  [[nodiscard]] bool init() {
    pinMode(pin_, OUTPUT);
    digitalWrite(pin_, LOW);
    return true;
  }

  void write(uint8_t duty) { duty_ = duty; }

  // Писати в GPIO лише тоді, коли рівень справді змінюється.
  void update(uint32_t nowMs) {
    const bool high = pwm_.level(nowMs, duty_);
    if (high == high_) return;
    digitalWrite(pin_, high ? HIGH : LOW);
    high_ = high;
  }

  void describe(Print& out) const {
    out.printf("PWM GPIO%u: software, period %lu ms (millis)\n", pin_, static_cast<unsigned long>(pwm_.periodTicks()));
  }

 private:
  const uint8_t  pin_;
  const SoftPwm  pwm_;  // тик = 1 мс
  uint8_t        duty_ = 0;
  bool           high_ = false;
};

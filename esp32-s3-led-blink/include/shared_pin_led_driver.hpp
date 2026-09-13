#pragma once

#include <cstdint>

#include "led_driver.hpp"

// Обидва світлодіоди на ОДНОМУ виводі — використовуємо три стани GPIO.
//
//   pin ---[220R]---|>|--- GND     червоний, світить при HIGH
//   3V3 ---[100R]---|>|--- pin     синій,    світить при LOW (вивід втягує струм)
//   INPUT (Hi-Z): обидва вимкнені — двом LED послідовно треба ~4.8 В, а є 3.3 В.
//
// Одночасно обидва фізично неможливо, тому кадр Red|Blue імітується швидким
// чергуванням HIGH/LOW в update(): око бачить обидва увімкненими.
// Зелений у цій схемі відсутній, біт Green ігнорується.
class SharedPinLedDriver final : public LedDriver {
 public:
  SharedPinLedDriver(uint8_t pin, uint32_t multiplexPeriodUs);

  void begin() override;
  void show(Frame frame) override;
  void update() override;
  void describe(Print& out) const override;

 private:
  enum class State { Off, Red, Blue, Both };

  static State stateFor(Frame frame);
  void apply(State state);

  uint8_t  pin_;
  uint32_t multiplexPeriodUs_;
  State    state_        = State::Off;
  bool     redPhase_     = false;   // поточна фаза мультиплексу
  uint32_t lastToggleUs_ = 0;
};

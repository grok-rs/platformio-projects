#pragma once

#include <cstdint>

#include "led_driver.hpp"

// Класична схема: окремий вивід на кожен світлодіод.
//
//   pin ---[R]---|>|--- GND      HIGH -> світить, LOW -> вимкнений
class GpioLedDriver final : public LedDriver {
 public:
  struct Pins {
    uint8_t red;
    uint8_t green;
    uint8_t blue;
  };

  explicit GpioLedDriver(Pins pins);

  void begin() override;
  void show(Frame frame) override;
  void describe(Print& out) const override;

 private:
  Pins pins_;
};

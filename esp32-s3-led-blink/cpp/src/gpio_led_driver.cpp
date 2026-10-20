#include "gpio_led_driver.hpp"

#include <Arduino.h>

#include <initializer_list>

GpioLedDriver::GpioLedDriver(Pins pins) : pins_(pins) {}

void GpioLedDriver::begin() {
  for (uint8_t pin : { pins_.red, pins_.green, pins_.blue }) {
    pinMode(pin, OUTPUT);
    digitalWrite(pin, LOW);
  }
}

void GpioLedDriver::show(Frame frame) {
  digitalWrite(pins_.red,   frame.has(Led::Red)   ? HIGH : LOW);
  digitalWrite(pins_.green, frame.has(Led::Green) ? HIGH : LOW);
  digitalWrite(pins_.blue,  frame.has(Led::Blue)  ? HIGH : LOW);
}

void GpioLedDriver::describe(Print& out) const {
  out.println("Mode : TWO GPIO (one pin per LED)");
  out.printf("Wiring: GPIO%u -> [220R] -> RED   -> GND\n", pins_.red);
  out.printf("        GPIO%u -> [100R] -> BLUE  -> GND\n", pins_.blue);
  out.printf("        GPIO%u -> [220R] -> GREEN -> GND\n", pins_.green);
}

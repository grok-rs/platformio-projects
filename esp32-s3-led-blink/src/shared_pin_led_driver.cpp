#include "shared_pin_led_driver.hpp"

#include <Arduino.h>

SharedPinLedDriver::SharedPinLedDriver(uint8_t pin, uint32_t multiplexPeriodUs)
    : pin_(pin), multiplexPeriodUs_(multiplexPeriodUs) {}

void SharedPinLedDriver::begin() {
  apply(State::Off);
}

void SharedPinLedDriver::show(Frame frame) {
  apply(stateFor(frame));
}

// Мультиплекс: лише коли кадр вимагає обидва кольори.
void SharedPinLedDriver::update() {
  if (state_ != State::Both) return;

  const uint32_t now = micros();
  if (now - lastToggleUs_ < multiplexPeriodUs_) return;

  lastToggleUs_ = now;
  redPhase_     = !redPhase_;
  digitalWrite(pin_, redPhase_ ? HIGH : LOW);
}

void SharedPinLedDriver::describe(Print& out) const {
  out.println("Mode : SINGLE GPIO (both LEDs on one pin)");
  out.printf("Wiring: GPIO%u -> [220R] -> RED  -> GND     (lit when pin HIGH)\n", pin_);
  out.printf("        3V3   -> [100R] -> BLUE -> GPIO%u   (lit when pin LOW)\n", pin_);
}

SharedPinLedDriver::State SharedPinLedDriver::stateFor(Frame frame) {
  const bool red  = frame.has(Led::Red);
  const bool blue = frame.has(Led::Blue);
  if (red && blue) return State::Both;
  if (red)         return State::Red;
  if (blue)        return State::Blue;
  return State::Off;
}

void SharedPinLedDriver::apply(State state) {
  state_ = state;
  switch (state) {
    case State::Red:
      pinMode(pin_, OUTPUT);
      digitalWrite(pin_, HIGH);       // струм pin -> червоний -> GND
      break;
    case State::Blue:
      pinMode(pin_, OUTPUT);
      digitalWrite(pin_, LOW);        // струм 3V3 -> синій -> pin
      break;
    case State::Both:
      pinMode(pin_, OUTPUT);          // рівень далі чергує update()
      lastToggleUs_ = micros();
      break;
    case State::Off:
      pinMode(pin_, INPUT);           // Hi-Z: жодного шляху для струму
      break;
  }
}

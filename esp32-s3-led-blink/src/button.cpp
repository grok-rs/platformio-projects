#include "button.hpp"

#include <Arduino.h>

Button::Button(uint8_t pin, uint32_t debounceMs, uint32_t longPressMs)
    : pin_(pin), debounceMs_(debounceMs), longPressMs_(longPressMs) {}

void Button::begin() {
  pinMode(pin_, INPUT_PULLUP);
}

Button::Event Button::poll() {
  const bool     down = digitalRead(pin_) == LOW;
  const uint32_t now  = millis();

  if (down != pressed_) {
    if (now - lastEdgeMs_ < debounceMs_) return Event::None;   // дребезг контактів
    lastEdgeMs_ = now;
    pressed_    = down;

    if (pressed_) {
      pressStartMs_ = now;
      longReported_ = false;
      return Event::None;
    }
    return longReported_ ? Event::None : Event::ShortPress;   // відпустили
  }

  if (pressed_ && !longReported_ && now - pressStartMs_ >= longPressMs_) {
    longReported_ = true;
    return Event::LongPress;
  }
  return Event::None;
}

#pragma once

#include <cstdint>

// Кнопка на GPIO з підтягуванням до 3.3 В (натиснута = LOW), антидребезгом
// і розрізненням короткого та довгого натискання.
//
// Довге натискання повідомляється щойно кнопку протримали longPressMs —
// не чекаючи відпускання; наступне відпускання тоді вже не є коротким.
class Button {
 public:
  enum class Event { None, ShortPress, LongPress };

  Button(uint8_t pin, uint32_t debounceMs, uint32_t longPressMs);

  void  begin();
  Event poll();   // викликати з loop(); повертає подію, що сталася в цей виклик

 private:
  uint8_t  pin_;
  uint32_t debounceMs_;
  uint32_t longPressMs_;

  bool     pressed_       = false;   // стан після антидребезгу
  bool     longReported_  = false;
  uint32_t pressStartMs_  = 0;
  uint32_t lastEdgeMs_    = 0;
};

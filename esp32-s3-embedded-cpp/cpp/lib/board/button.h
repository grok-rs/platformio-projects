// Кнопка на перериванні (завдання 4). Вхід INPUT_PULLUP: відпущена = HIGH, натиснута = LOW.
//
// ISR мінімальний: лише піднімає volatile-прапорець. Антибрязкіт і вся логіка — у loop()
// (див. EdgeDebouncer).

#pragma once

#include <Arduino.h>

class Button {
 public:
  explicit constexpr Button(uint8_t pin) : pin_(pin) {}

  // ISR тримає вказівник на цей об'єкт (attachInterruptArg), тож копіювати його не можна.
  Button(const Button&)            = delete;
  Button& operator=(const Button&) = delete;

  // Вхід з підтяжкою + переривання на спадаючий фронт (натискання).
  void init();

  // Повертає, чи був фронт з попереднього виклику, і скидає прапорець.
  // [[nodiscard]]: проігнорувати результат — означає загубити фронт.
  [[nodiscard]] bool takeEdge();

  bool isPressed() const { return digitalRead(pin_) == LOW; }

 private:
  static void IRAM_ATTR onFallingEdge(void* self);

  const uint8_t pin_;
  // Пише ISR, читає loop(). volatile забороняє компілятору тримати значення в регістрі
  // («прапорець уже прочитано — він false») і викидати «зайві» читання з циклу.
  volatile bool edge_ = false;
  portMUX_TYPE  mux_  = portMUX_INITIALIZER_UNLOCKED;  // для критичної секції в takeEdge()
};

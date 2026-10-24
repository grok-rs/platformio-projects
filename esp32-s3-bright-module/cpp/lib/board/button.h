// Кнопка на перериванні (ВП-3, ВП-4). 3V3 → кнопка → GPIO6, вхід INPUT_PULLDOWN:
// відпущена = LOW (внутрішній резистор ~45 кОм до GND), натиснута = HIGH, переривання RISING.
//
// ISR мінімальний: лише піднімає volatile-прапорець. Антибрязкіт і вся логіка — у loop()
// (див. PressDetector).

#pragma once

#include <Arduino.h>

class Button {
 public:
  explicit constexpr Button(uint8_t pin) : pin_(pin) {}

  // ISR тримає вказівник на цей об'єкт (attachInterruptArg), тож копіювати його не можна.
  Button(const Button&)            = delete;
  Button& operator=(const Button&) = delete;

  // Вхід з підтяжкою до GND + переривання на зростаючий фронт (натискання).
  void init();

  // Повертає, чи був фронт з попереднього виклику, і скидає прапорець.
  // [[nodiscard]]: проігнорувати результат — означає загубити фронт.
  [[nodiscard]] bool takeEdge();

  bool isPressed() const { return digitalRead(pin_) == HIGH; }

 private:
  static void IRAM_ATTR onRisingEdge(void* self);

  const uint8_t pin_;
  // Пише ISR, читає loop(). volatile забороняє компілятору тримати значення в регістрі
  // («прапорець уже прочитано — він false») і викидати «зайві» читання з циклу.
  volatile bool edge_ = false;
  portMUX_TYPE  mux_  = portMUX_INITIALIZER_UNLOCKED;  // для критичної секції в takeEdge()
};

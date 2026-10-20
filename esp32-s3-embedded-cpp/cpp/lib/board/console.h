// Serial через вбудований USB (USB-Serial-JTAG, ARDUINO_USB_MODE=1).
//
// Увага, купа: Serial.printf форматує в буфер на стеку з 64 байт, а довший рядок —
// у malloc(). Тому кожен рядок printf у цьому проєкті коротший за 64 символи.

#pragma once

#include <Arduino.h>

inline void beginConsole(uint32_t baud, uint32_t waitMs) {
  Serial.begin(baud);
  // Чекати монітор (але не вічно), щоб не втратити банер. Це setup(), не loop(), — тут можна.
  const uint32_t start = millis();
  while (!Serial && millis() - start < waitMs) {
  }
}

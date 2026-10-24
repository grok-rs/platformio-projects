// Serial через вбудований USB (USB-Serial-JTAG, ARDUINO_USB_MODE=1).

#pragma once

#include <Arduino.h>

inline void beginConsole(uint32_t baud, uint32_t waitMs) {
  Serial.begin(baud);
  // Чекати монітор (але не вічно), щоб не втратити банер. Це setup(), не loop(), — тут можна.
  const uint32_t start = millis();
  while (!Serial && millis() - start < waitMs) {
  }
}

// Неблокуючий printf для superloop. Повертає false, якщо рядок пропущено.
//
// Serial.printf тут не годиться з двох причин:
//   * коли буфер передачі повний (плата в USB, але монітор не читає), HWCDC::write чекає хоста
//     з delay(1) — до 100 мс на виклик, і весь цикл стоїть;
//   * рядок від 64 байт Print::printf форматує в malloc().
// Тому рядок форматується в буфер на стеку й пишеться, лише якщо цілком влазить у буфер передачі.
// Не влазить — пропускається: діагностика не варта зупинки керування.
// Атрибут format дає компілятору перевіряти формат і аргументи, як у справжнього printf.
bool tryPrintf(const char* format, ...) __attribute__((format(printf, 1, 2)));

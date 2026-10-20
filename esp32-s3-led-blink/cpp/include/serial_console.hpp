#pragma once

#include <Stream.h>

#include "blink_player.hpp"
#include "led_driver.hpp"

// Текстовий інтерфейс через Serial-монітор: друк стану та однобуквені команди.
//
//   1 / 2 / 3  — тримати червоний / синій / зелений увімкненим (перевірка монтажу)
//   0          — усі вимкнути
//   p / v      — наступний патерн / швидкість (як довге / коротке натискання BOOT)
//   інше       — повернутися до автоматичного миготіння
class SerialConsole {
 public:
  SerialConsole(Stream& io, BlinkPlayer& player, const LedDriver& driver);

  SerialConsole(const SerialConsole&) = delete;
  SerialConsole& operator=(const SerialConsole&) = delete;

  void printBanner() const;
  void printState() const;
  void update();   // викликати з loop()

 private:
  void handleKey(char key);
  void holdForTest(Frame frame, const char* what);

  Stream&          io_;
  BlinkPlayer&     player_;
  const LedDriver& driver_;
};

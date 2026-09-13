#pragma once

#include <Print.h>

#include "frame.hpp"

// Інтерфейс виводу кадру на реальні світлодіоди.
// Це єдиний шар, який знає про схему підключення; решта програми працює
// лише з абстрактними кадрами (Frame) і не залежить від кількості виводів.
class LedDriver {
 public:
  virtual ~LedDriver() = default;

  virtual void begin() = 0;                       // налаштувати виводи, усе вимкнути
  virtual void show(Frame frame) = 0;             // вивести кадр на світлодіоди
  virtual void update() {}                        // викликати з loop(); для драйверів із часовою нарізкою
  virtual void describe(Print& out) const = 0;    // надрукувати схему підключення (для банера)
};

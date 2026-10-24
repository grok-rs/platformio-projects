// Апаратний ШІМ через блок LEDC (ВП-1). Після налаштування сигнал генерує периферія сама:
// процесор лише записує нове заповнення, коли змінюється рівень.
//
// API LEDC в ядрі Arduino-ESP32 змінився з версією 3.0:
//   2.x (цей проєкт, platform espressif32@^7):  ledcSetup(канал, Гц, біт); ledcAttachPin(пін, канал);
//                                               ledcWrite(КАНАЛ, заповнення)
//   3.x:                                        ledcAttach(пін, Гц, біт);  ledcWrite(ПІН, заповнення)
// Клас ховає різницю: решта коду викликає лише init() і write().

#pragma once

#include <Arduino.h>

class LedcOutput {
 public:
  constexpr LedcOutput(uint8_t pin, uint8_t channel, uint32_t frequencyHz, uint8_t resolutionBits)
      : pin_(pin), channel_(channel), frequencyHz_(frequencyHz), resolutionBits_(resolutionBits) {}

  // Один вивід — один власник: копія писала б у той самий канал LEDC.
  LedcOutput(const LedcOutput&)            = delete;
  LedcOutput& operator=(const LedcOutput&) = delete;

  // false — LEDC не зміг дати таку частоту з такою розрядністю.
  [[nodiscard]] bool init() {
#if ESP_ARDUINO_VERSION_MAJOR >= 3
    const bool ok = ledcAttach(pin_, frequencyHz_, resolutionBits_);
#else
    // ledcSetup повертає частоту, яку вдалося налаштувати, або 0 при помилці.
    const bool ok = ledcSetup(channel_, frequencyHz_, resolutionBits_) != 0;
    if (ok) ledcAttachPin(pin_, channel_);
#endif
    if (ok) write(0);
    return ok;
  }

  // Заповнення 0…2^біт−1. Максимум ядро перетворює на 2^біт — 100 %, вихід постійно HIGH.
  void write(uint32_t duty) {
#if ESP_ARDUINO_VERSION_MAJOR >= 3
    ledcWrite(pin_, duty);
#else
    ledcWrite(channel_, duty);
#endif
  }

  // Апаратному ШІМ нічого робити на кожному проході циклу (див. SoftPwmOutput::update).
  void update(uint32_t /*nowMs*/) {}

  void describe(Print& out) const {
    out.printf("PWM GPIO%u: LEDC %lu Hz, %u bit\n", pin_, static_cast<unsigned long>(frequencyHz_),
               resolutionBits_);
  }

 private:
  const uint8_t  pin_;
  const uint8_t  channel_;
  const uint32_t frequencyHz_;
  const uint8_t  resolutionBits_;
};

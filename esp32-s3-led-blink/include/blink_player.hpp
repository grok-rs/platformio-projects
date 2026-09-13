#pragma once

#include <cstddef>
#include <cstdint>

#include "led_driver.hpp"
#include "pattern.hpp"
#include "span.hpp"

// Неблокуючий програвач патернів.
//
// Кожні N мс (N — поточна швидкість) показує наступний кадр активного патерну,
// після останнього кадру повертається до першого. Не використовує delay():
// update() лише порівнює millis() з часом показу поточного кадру, тому кнопка
// та Serial лишаються чутливими навіть при кадрі тривалістю 1 с.
class BlinkPlayer {
 public:
  BlinkPlayer(LedDriver& driver, Span<const Pattern> patterns, Span<const uint16_t> speedsMs,
              size_t initialSpeedIndex);

  BlinkPlayer(const BlinkPlayer&) = delete;
  BlinkPlayer& operator=(const BlinkPlayer&) = delete;

  void begin();     // показати перший кадр і запустити таймер
  void update();    // викликати з loop()

  void nextPattern();
  void nextSpeed();

  // Ручний режим для перевірки монтажу: зупинити патерн і тримати один кадр.
  void hold(Frame frame);
  void resume();
  bool isHeld() const { return held_; }

  const Pattern& pattern() const { return patterns_[patternIndex_]; }
  uint16_t frameDurationMs() const { return speedsMs_[speedIndex_]; }

 private:
  void restartPattern();

  LedDriver&           driver_;
  Span<const Pattern>  patterns_;
  Span<const uint16_t> speedsMs_;

  size_t   patternIndex_ = 0;
  size_t   speedIndex_;
  size_t   frameIndex_   = 0;
  uint32_t frameStartMs_ = 0;
  bool     held_         = false;
};

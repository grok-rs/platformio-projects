#include "blink_player.hpp"

#include <Arduino.h>

BlinkPlayer::BlinkPlayer(LedDriver& driver, Span<const Pattern> patterns,
                         Span<const uint16_t> speedsMs, size_t initialSpeedIndex)
    : driver_(driver),
      patterns_(patterns),
      speedsMs_(speedsMs),
      speedIndex_(initialSpeedIndex % speedsMs.size()) {}

void BlinkPlayer::begin() {
  restartPattern();
}

void BlinkPlayer::update() {
  if (held_) return;

  // Беззнакова різниця коректна і після переповнення millis() (~49 діб).
  const uint32_t now = millis();
  if (now - frameStartMs_ < frameDurationMs()) return;

  frameStartMs_ = now;
  frameIndex_   = (frameIndex_ + 1) % pattern().frames.size();   // циклічно
  driver_.show(pattern().frames[frameIndex_]);
}

void BlinkPlayer::nextPattern() {
  held_         = false;
  patternIndex_ = (patternIndex_ + 1) % patterns_.size();
  restartPattern();
}

void BlinkPlayer::nextSpeed() {
  speedIndex_ = (speedIndex_ + 1) % speedsMs_.size();
}

void BlinkPlayer::hold(Frame frame) {
  held_ = true;
  driver_.show(frame);
}

void BlinkPlayer::resume() {
  if (!held_) return;
  held_ = false;
  restartPattern();
}

// Показати перший кадр негайно, щоб зміна патерну була видимою одразу.
void BlinkPlayer::restartPattern() {
  frameIndex_   = 0;
  frameStartMs_ = millis();
  driver_.show(pattern().frames[0]);
}

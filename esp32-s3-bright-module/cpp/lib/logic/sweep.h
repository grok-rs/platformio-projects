// Плавна зміна заповнення для етапу 3: 0 → 255 → пауза → 255 → 0 → пауза → знову.
//
// Заповнення — чиста функція часу від restart(): жодного накопиченого стану, тож пропущений
// прохід циклу не збиває графік, а тест може «перескочити» в будь-яку мить. Фаза — остача від
// ділення на тривалість циклу: на переповненні millis() (раз на ~49.7 доби) графік один раз
// стрибне в іншу точку циклу.
//
//   duty
//   255 ┤      ┌──────┐
//       │     ╱        ╲
//     0 ┼────╯          ╲──────┐ …
//       0   ramp  hold   ramp  hold

#pragma once

#include <cstdint>

class Sweep {
 public:
  enum class Phase : uint8_t { RampUp, HoldHigh, RampDown, HoldLow };

  static constexpr uint8_t kMaxDuty = 255;

  constexpr Sweep(uint32_t stepMs, uint32_t holdMs) : stepMs_(stepMs), holdMs_(holdMs) {}

  void restart(uint32_t nowMs) { startMs_ = nowMs; }

  // Заповнення в момент nowMs. Ніколи не чекає.
  [[nodiscard]] uint8_t duty(uint32_t nowMs) const {
    const uint32_t t = (nowMs - startMs_) % cycleMs();
    switch (phaseAt(t)) {
      case Phase::RampUp:   return static_cast<uint8_t>(t / stepMs_);
      case Phase::HoldHigh: return kMaxDuty;
      case Phase::RampDown: return static_cast<uint8_t>(kMaxDuty - (t - rampMs() - holdMs_) / stepMs_);
      case Phase::HoldLow:  return 0;
    }
    return 0;
  }

  [[nodiscard]] Phase phase(uint32_t nowMs) const { return phaseAt((nowMs - startMs_) % cycleMs()); }

  // Повний розгін триває 255 кроків: останній крок (255) настає рівно в кінці розгону.
  constexpr uint32_t rampMs() const { return kMaxDuty * stepMs_; }
  constexpr uint32_t cycleMs() const { return 2 * (rampMs() + holdMs_); }

 private:
  Phase phaseAt(uint32_t t) const {
    if (t < rampMs()) return Phase::RampUp;
    if (t < rampMs() + holdMs_) return Phase::HoldHigh;
    if (t < 2 * rampMs() + holdMs_) return Phase::RampDown;
    return Phase::HoldLow;
  }

  uint32_t stepMs_;
  uint32_t holdMs_;
  uint32_t startMs_ = 0;
};

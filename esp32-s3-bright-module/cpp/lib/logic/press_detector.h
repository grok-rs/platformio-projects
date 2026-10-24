// Антибрязкіт кнопки на перериванні (ВП-5: одне натискання = один перехід).
//
// ISR лише ставить прапорець «був фронт». Механічний контакт брязкотить, тож одне натискання —
// це пачка фронтів за кілька мілісекунд, а брязкіт при відпусканні теж дає зростаючі фронти.
// Тому рішення приймає не фронт, а автомат із трьох станів, якому loop() на кожному проході
// подає прапорець ISR, поточний рівень входу і час:
//
//   Released ──фронт──▶ Arming ──quietMs минуло, HIGH бачили──▶ Pressed ──LOW і без фронтів quietMs──▶ Released
//                         └──── quietMs минуло, HIGH не бачили (завада) ────▶ Released
//
//   * Arming: вікно quietMs від першого фронту. Натискання зараховується, якщо за цей час вхід
//     хоч раз був HIGH, — тож навіть коротке «тицяння» (відпустили через 40 мс) не губиться,
//     а одиночна голка завади, після якої вхід уже LOW, — ігнорується.
//   * Pressed: повернення в Released — лише після quietMs безперервного LOW без фронтів. Брязкіт
//     відпускання і «торохтіння» зношеного контакту під час утримання нового натискання не дають.
//
// Без Arduino.h і без власного годинника — тестується на ПК (pio test -e native).

#pragma once

#include <cstdint>

class PressDetector {
 public:
  explicit constexpr PressDetector(uint32_t quietMs) : quietMs_(quietMs) {}

  // edge — прапорець ISR був піднятий з попереднього виклику; high — рівень входу зараз.
  // Повертає true рівно один раз на натискання: через quietMs після його першого фронту.
  [[nodiscard]] bool update(bool edge, bool high, uint32_t nowMs) {
    switch (state_) {
      case State::Released:
        if (!edge) return false;
        state_   = State::Arming;
        sinceMs_ = nowMs;
        sawHigh_ = high;
        return false;

      case State::Arming:
        sawHigh_ = sawHigh_ || high;
        // Беззнакова різниця коректна й після переповнення millis() (кожні ~49.7 доби).
        if (nowMs - sinceMs_ < quietMs_) return false;
        if (!sawHigh_) {
          state_ = State::Released;  // фронт без HIGH — завада, а не натискання
          return false;
        }
        state_   = State::Pressed;
        sinceMs_ = nowMs;  // відлік тиші для відпускання
        return true;

      case State::Pressed:
        if (edge || high) {
          sinceMs_ = nowMs;  // ще натиснута або брязкотить — почати відлік тиші заново
          return false;
        }
        if (nowMs - sinceMs_ >= quietMs_) state_ = State::Released;
        return false;
    }
    return false;
  }

 private:
  enum class State : uint8_t { Released, Arming, Pressed };

  uint32_t quietMs_;
  uint32_t sinceMs_ = 0;
  State    state_   = State::Released;
  bool     sawHigh_ = false;
};

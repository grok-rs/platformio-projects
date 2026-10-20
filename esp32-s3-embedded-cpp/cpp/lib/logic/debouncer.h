// Антибрязкіт для кнопки на перериванні.
//
// ISR лише ставить прапорець «був фронт». Механічний контакт брязкотить, тож одне натискання —
// це пачка фронтів за кілька мілісекунд. Цей клас чекає, доки фронти припиняться на quietMs,
// і один раз каже «пачка закінчилась — читай рівень». Рівень вирішує, що це було:
// LOW — натискання; HIGH — брязкіт при відпусканні (він теж дає спадаючі фронти) або завада.

#pragma once

#include <cstdint>

class EdgeDebouncer {
 public:
  explicit constexpr EdgeDebouncer(uint32_t quietMs) : quietMs_(quietMs) {}

  // edge — прапорець ISR був піднятий з попереднього виклику.
  // Повертає true рівно один раз на пачку фронтів: через quietMs після останнього з них.
  [[nodiscard]] bool settled(bool edge, uint32_t nowMs) {
    if (edge) {
      pending_    = true;
      lastEdgeMs_ = nowMs;  // контакт ще брязкотить — почати відлік тиші заново
      return false;
    }
    if (!pending_ || nowMs - lastEdgeMs_ < quietMs_) return false;
    pending_ = false;
    return true;
  }

 private:
  uint32_t quietMs_;
  uint32_t lastEdgeMs_ = 0;
  bool     pending_    = false;
};

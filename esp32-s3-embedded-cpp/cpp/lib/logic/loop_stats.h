// Статистика тривалості ітерацій superloop за вікно з N ітерацій: мінімум, максимум, середнє.
//
// Без купи й без std::vector: зберігати всі N замірів не треба — досить суми й двох
// екстремумів. Пам'ять O(1), хоч вікно 1000 ітерацій, хоч мільйон.

#pragma once

#include <cstdint>
#include <limits>

class LoopStats {
 public:
  explicit constexpr LoopStats(uint32_t window) : window_(window) {}

  // Додати тривалість однієї ітерації (у будь-яких одиницях — тут такти CPU).
  // Повертає true, коли вікно заповнене: прочитати результати й викликати reset().
  bool add(uint32_t duration) {
    sum_ += duration;
    if (duration < min_) min_ = duration;
    if (duration > max_) max_ = duration;
    return ++count_ >= window_;
  }

  void reset() { *this = LoopStats(window_); }

  uint32_t count() const { return count_; }
  uint32_t min() const { return count_ ? min_ : 0; }
  uint32_t max() const { return max_; }
  uint32_t average() const { return count_ ? static_cast<uint32_t>(sum_ / count_) : 0; }

 private:
  uint32_t window_;
  uint32_t count_ = 0;
  uint64_t sum_   = 0;  // 1000 × 32-бітних тривалостей у 32 біти не влізуть
  uint32_t min_   = std::numeric_limits<uint32_t>::max();
  uint32_t max_   = 0;
};

// Такти CPU → наносекунди. Результат 64-бітний: 2³² тактів на 240 МГц — це ~17.9 с,
// у наносекундах за 32 біти не влізе.
constexpr uint64_t cyclesToNs(uint32_t cycles, uint32_t cpuMHz) {
  return uint64_t{cycles} * 1000U / cpuMHz;
}

static_assert(cyclesToNs(156, 240) == 650);

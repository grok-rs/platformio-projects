// Модульні тести логіки на ПК: pio test -e native
// Час подається параметром, тож «секунди» тут минають миттєво й детерміновано.

#include <unity.h>

#include "blinker.h"
#include "debouncer.h"
#include "led_state.h"
#include "loop_stats.h"

void setUp() {}
void tearDown() {}

// --- LedMode ----------------------------------------------------------------

void test_modes_cycle_blink_on_off() {
  TEST_ASSERT_TRUE(nextMode(LedMode::Blink) == LedMode::SteadyOn);
  TEST_ASSERT_TRUE(nextMode(LedMode::SteadyOn) == LedMode::SteadyOff);
  TEST_ASSERT_TRUE(nextMode(LedMode::SteadyOff) == LedMode::Blink);
  TEST_ASSERT_EQUAL_STRING("STEADY_OFF", modeName(LedMode::SteadyOff));
}

// --- Blinker ----------------------------------------------------------------

void test_blinker_toggles_every_interval() {
  Blinker b(500);
  b.restart(1000);
  TEST_ASSERT_TRUE(b.update(1000) == LedState::On);
  TEST_ASSERT_TRUE(b.update(1499) == LedState::On);
  TEST_ASSERT_TRUE(b.update(1500) == LedState::Off);
  TEST_ASSERT_TRUE(b.update(1999) == LedState::Off);
  TEST_ASSERT_TRUE(b.update(2000) == LedState::On);
}

void test_blinker_keeps_grid_despite_late_polls() {
  Blinker b(500);
  b.restart(0);
  TEST_ASSERT_TRUE(b.update(503) == LedState::Off);  // прохід запізнився на 3 мс…
  TEST_ASSERT_TRUE(b.update(999) == LedState::Off);
  TEST_ASSERT_TRUE(b.update(1000) == LedState::On);  // …а наступне перемикання — точно о 1000
}

void test_blinker_resyncs_after_stall_instead_of_bursting() {
  Blinker b(500);
  b.restart(0);
  TEST_ASSERT_TRUE(b.update(5200) == LedState::Off);  // простій 5 с — одне перемикання
  TEST_ASSERT_TRUE(b.update(5201) == LedState::Off);  // а не ще дев'ять поспіль
  TEST_ASSERT_TRUE(b.update(5700) == LedState::On);
}

void test_blinker_survives_millis_wraparound() {
  Blinker b(500);
  b.restart(0xFFFFFF00u);  // за 256 мс до переповнення millis()
  TEST_ASSERT_TRUE(b.update(0xFFFFFFFFu) == LedState::On);
  TEST_ASSERT_TRUE(b.update(244) == LedState::Off);  // 0xFFFFFF00 + 500 = 244 після переповнення
}

// --- EdgeDebouncer ----------------------------------------------------------

void test_debouncer_reports_once_after_quiet() {
  EdgeDebouncer d(30);
  TEST_ASSERT_FALSE(d.settled(true, 100));
  TEST_ASSERT_FALSE(d.settled(false, 129));
  TEST_ASSERT_TRUE(d.settled(false, 130));
  TEST_ASSERT_FALSE(d.settled(false, 131));  // лише один раз
  TEST_ASSERT_FALSE(d.settled(false, 1000));
}

void test_debouncer_restarts_on_every_bounce() {
  EdgeDebouncer d(30);
  for (uint32_t t = 100; t <= 108; t += 2) TEST_ASSERT_FALSE(d.settled(true, t));
  TEST_ASSERT_FALSE(d.settled(false, 130));  // 30 мс від ПЕРШОГО фронту — ще рано
  TEST_ASSERT_TRUE(d.settled(false, 138));   // 30 мс від останнього
}

void test_debouncer_idle_without_edges() {
  EdgeDebouncer d(30);
  for (uint32_t t = 0; t < 1000; t += 7) TEST_ASSERT_FALSE(d.settled(false, t));
}

// --- LoopStats --------------------------------------------------------------

void test_stats_window_min_max_average() {
  LoopStats s(4);
  TEST_ASSERT_FALSE(s.add(10));
  TEST_ASSERT_FALSE(s.add(30));
  TEST_ASSERT_FALSE(s.add(20));
  TEST_ASSERT_TRUE(s.add(40));
  TEST_ASSERT_EQUAL_UINT32(4, s.count());
  TEST_ASSERT_EQUAL_UINT32(10, s.min());
  TEST_ASSERT_EQUAL_UINT32(40, s.max());
  TEST_ASSERT_EQUAL_UINT32(25, s.average());

  s.reset();
  TEST_ASSERT_EQUAL_UINT32(0, s.count());
  TEST_ASSERT_EQUAL_UINT32(0, s.average());
  TEST_ASSERT_FALSE(s.add(7));
  TEST_ASSERT_EQUAL_UINT32(7, s.min());
}

void test_stats_sum_does_not_overflow_32_bits() {
  LoopStats s(1000);
  for (int i = 0; i < 999; ++i) s.add(10'000'000u);  // 999 × 10⁷ ≫ 2³²
  TEST_ASSERT_TRUE(s.add(10'000'000u));
  TEST_ASSERT_EQUAL_UINT32(10'000'000u, s.average());
}

void test_cycles_convert_to_nanoseconds() {
  TEST_ASSERT_EQUAL_UINT64(1000, cyclesToNs(240, 240));
  TEST_ASSERT_EQUAL_UINT64(650, cyclesToNs(156, 240));
  TEST_ASSERT_EQUAL_UINT64(17'895'697'062ULL, cyclesToNs(0xFFFFFFFFu, 240));  // > 2³²
}

int main() {
  UNITY_BEGIN();
  RUN_TEST(test_modes_cycle_blink_on_off);
  RUN_TEST(test_blinker_toggles_every_interval);
  RUN_TEST(test_blinker_keeps_grid_despite_late_polls);
  RUN_TEST(test_blinker_resyncs_after_stall_instead_of_bursting);
  RUN_TEST(test_blinker_survives_millis_wraparound);
  RUN_TEST(test_debouncer_reports_once_after_quiet);
  RUN_TEST(test_debouncer_restarts_on_every_bounce);
  RUN_TEST(test_debouncer_idle_without_edges);
  RUN_TEST(test_stats_window_min_max_average);
  RUN_TEST(test_stats_sum_does_not_overflow_32_bits);
  RUN_TEST(test_cycles_convert_to_nanoseconds);
  return UNITY_END();
}

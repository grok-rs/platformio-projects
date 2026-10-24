// Модульні тести логіки на ПК: pio test -e native
// Час подається параметром, тож «секунди» тут минають миттєво й детерміновано.

#include <unity.h>

#include "brightness.h"
#include "config.h"
#include "press_detector.h"
#include "soft_pwm.h"
#include "sweep.h"

// enum class не перетворюється в число сам — порівнюємо як uint8_t, щоб Unity при помилці
// показала очікуване й фактичне значення, а не лише «Expected TRUE».
#define TEST_ASSERT_EQUAL_ENUM(expected, actual) \
  TEST_ASSERT_EQUAL_UINT8(static_cast<uint8_t>(expected), static_cast<uint8_t>(actual))

void setUp() {}
void tearDown() {}

// --- Brightness (ВП-2, ВП-6) ---------------------------------------------------

void test_levels_cycle_off_low_mid_high() {
  TEST_ASSERT_EQUAL_ENUM(Brightness::Low, next(Brightness::Off));
  TEST_ASSERT_EQUAL_ENUM(Brightness::Mid, next(Brightness::Low));
  TEST_ASSERT_EQUAL_ENUM(Brightness::High, next(Brightness::Mid));
  TEST_ASSERT_EQUAL_ENUM(Brightness::Off, next(Brightness::High));
  TEST_ASSERT_EQUAL_STRING("MID", name(Brightness::Mid));
}

void test_duty_table_matches_spec() {
  constexpr DutyTable duty{Config::Level::kOff, Config::Level::kLow, Config::Level::kMid, Config::Level::kHigh};
  TEST_ASSERT_EQUAL_UINT8(0, duty[Brightness::Off]);
  TEST_ASSERT_EQUAL_UINT8(40, duty[Brightness::Low]);
  TEST_ASSERT_EQUAL_UINT8(128, duty[Brightness::Mid]);
  TEST_ASSERT_EQUAL_UINT8(255, duty[Brightness::High]);
}

void test_duty_percent_rounds_to_nearest() {
  TEST_ASSERT_EQUAL_UINT8(0, dutyPercent(0));
  TEST_ASSERT_EQUAL_UINT8(16, dutyPercent(40));    // 15.69 %
  TEST_ASSERT_EQUAL_UINT8(50, dutyPercent(128));   // 50.20 %
  TEST_ASSERT_EQUAL_UINT8(100, dutyPercent(255));
  TEST_ASSERT_EQUAL_UINT8(1, dutyPercent(2));      // 0.78 % → 1, а не 0
}

// --- PressDetector (ВП-5) -------------------------------------------------------
//
// Симуляція кнопки: кожна мілісекунда — один прохід loop(). Рівень входу задає функція часу,
// а прапорець ISR піднімається на кожному переході LOW → HIGH, як у справжнього RISING.

namespace {

// Відрізки часу [from, to), коли контакт замкнений (вхід HIGH).
struct Closed {
  uint32_t from, to;
};

template <size_t N>
int countPresses(const Closed (&closed)[N], uint32_t untilMs, uint32_t startMs = 0) {
  PressDetector detector(50);
  bool prev   = false;
  int  events = 0;
  for (uint32_t t = startMs; t != startMs + untilMs; ++t) {
    bool high = false;
    for (const Closed& c : closed) high = high || (t - startMs >= c.from && t - startMs < c.to);
    events += detector.update(high && !prev, high, t);
    prev = high;
  }
  return events;
}

}  // namespace

void test_press_with_bounce_is_one_event() {
  // Натискання з брязкотом 0…6 мс, утримання до 300 мс, брязкіт відпускання 300…306 мс.
  const Closed c[] = {{0, 1}, {2, 3}, {4, 300}, {301, 302}, {303, 304}, {305, 306}};
  TEST_ASSERT_EQUAL_INT(1, countPresses(c, 1000));
}

void test_press_reported_after_quiet_window() {
  PressDetector d(50);
  TEST_ASSERT_FALSE(d.update(true, true, 100));   // перший фронт
  TEST_ASSERT_FALSE(d.update(false, true, 149));
  TEST_ASSERT_TRUE(d.update(false, true, 150));   // 50 мс — натискання
  TEST_ASSERT_FALSE(d.update(false, true, 151));  // лише один раз
}

void test_fast_tap_is_not_lost() {
  // Коротке «тицяння»: відпустили через 40 мс, брязкіт відпускання до 45 мс.
  const Closed c[] = {{0, 1}, {2, 40}, {42, 43}, {44, 45}};
  TEST_ASSERT_EQUAL_INT(1, countPresses(c, 500));
}

void test_long_hold_is_one_event() {
  const Closed c[] = {{10, 5000}};
  TEST_ASSERT_EQUAL_INT(1, countPresses(c, 6000));
}

void test_chatter_while_held_is_not_a_second_press() {
  // Утримання 2 с, зношений контакт двічі «відпадає» на 3 мс.
  const Closed c[] = {{0, 700}, {703, 1400}, {1403, 2000}};
  TEST_ASSERT_EQUAL_INT(1, countPresses(c, 3000));
}

void test_two_separate_presses_are_two_events() {
  const Closed c[] = {{0, 2}, {3, 150}, {400, 401}, {402, 550}};
  TEST_ASSERT_EQUAL_INT(2, countPresses(c, 1000));
}

void test_noise_spike_without_high_is_ignored() {
  PressDetector d(50);
  TEST_ASSERT_FALSE(d.update(true, false, 100));  // фронт, але вхід уже знову LOW
  for (uint32_t t = 101; t < 300; ++t) TEST_ASSERT_FALSE(d.update(false, false, t));
  // Після завади детектор знову готовий до справжнього натискання.
  TEST_ASSERT_FALSE(d.update(true, true, 300));
  TEST_ASSERT_TRUE(d.update(false, true, 350));
}

void test_press_detector_survives_millis_wraparound() {
  const Closed c[] = {{0, 1}, {2, 200}};
  TEST_ASSERT_EQUAL_INT(1, countPresses(c, 500, 0xFFFFFF00u));  // натискання через переповнення
}

// --- Sweep (етап 3) -------------------------------------------------------------

void test_sweep_ramps_holds_and_returns() {
  Sweep s(12, 3000);  // розгін 255 × 12 = 3060 мс
  s.restart(1000);
  TEST_ASSERT_EQUAL_UINT8(0, s.duty(1000));
  TEST_ASSERT_EQUAL_UINT8(1, s.duty(1012));
  TEST_ASSERT_EQUAL_UINT8(254, s.duty(1000 + 3059));
  TEST_ASSERT_EQUAL_UINT8(255, s.duty(1000 + 3060));                       // пауза на 255
  TEST_ASSERT_EQUAL_ENUM(Sweep::Phase::HoldHigh, s.phase(1000 + 6059));
  TEST_ASSERT_EQUAL_UINT8(255, s.duty(1000 + 6060));                       // спад починається з 255
  TEST_ASSERT_EQUAL_ENUM(Sweep::Phase::RampDown, s.phase(1000 + 6060));
  TEST_ASSERT_EQUAL_UINT8(1, s.duty(1000 + 9119));
  TEST_ASSERT_EQUAL_UINT8(0, s.duty(1000 + 9120));                         // пауза на 0
  TEST_ASSERT_EQUAL_ENUM(Sweep::Phase::HoldLow, s.phase(1000 + 9120));
  TEST_ASSERT_EQUAL_UINT32(12120, s.cycleMs());
  TEST_ASSERT_EQUAL_UINT8(1, s.duty(1000 + 12120 + 12));                   // новий цикл
}

void test_sweep_is_monotonic_while_ramping_up() {
  Sweep s(12, 3000);
  s.restart(0);
  uint8_t prev = 0;
  for (uint32_t t = 0; t < s.rampMs(); ++t) {
    const uint8_t duty = s.duty(t);
    TEST_ASSERT_TRUE(duty >= prev && duty - prev <= 1);  // плавно: крок не більше одиниці
    prev = duty;
  }
}

void test_sweep_skips_stall_without_bursting() {
  Sweep s(12, 3000);
  s.restart(0);
  TEST_ASSERT_EQUAL_UINT8(100, s.duty(1200));  // прохід циклу «проспав» 1,2 с — одразу 100
}

// --- SoftPwm (рівень «+») ----------------------------------------------------------

void test_soft_pwm_on_ticks_quantized_to_period() {
  SoftPwm p(10);
  TEST_ASSERT_EQUAL_UINT32(0, p.onTicks(0));
  TEST_ASSERT_EQUAL_UINT32(1, p.onTicks(40));    // 1,57 мс → 1 мс: 10 % замість 16 %
  TEST_ASSERT_EQUAL_UINT32(5, p.onTicks(128));
  TEST_ASSERT_EQUAL_UINT32(10, p.onTicks(255));  // увесь період — 100 %
  TEST_ASSERT_EQUAL_UINT32(0, p.onTicks(25));    // менше 1/10 — LED не світить зовсім
}

void test_soft_pwm_level_over_one_period() {
  SoftPwm p(10);
  int high = 0;
  for (uint32_t t = 500; t < 510; ++t) high += p.level(t, 128);
  TEST_ASSERT_EQUAL_INT(5, high);
  TEST_ASSERT_TRUE(p.level(500, 128));   // період починається з HIGH
  TEST_ASSERT_FALSE(p.level(505, 128));
  for (uint32_t t = 0; t < 30; ++t) {
    TEST_ASSERT_TRUE(p.level(t, 255));
    TEST_ASSERT_FALSE(p.level(t, 0));
  }
}

int main(int, char**) {
  UNITY_BEGIN();
  RUN_TEST(test_levels_cycle_off_low_mid_high);
  RUN_TEST(test_duty_table_matches_spec);
  RUN_TEST(test_duty_percent_rounds_to_nearest);
  RUN_TEST(test_press_with_bounce_is_one_event);
  RUN_TEST(test_press_reported_after_quiet_window);
  RUN_TEST(test_fast_tap_is_not_lost);
  RUN_TEST(test_long_hold_is_one_event);
  RUN_TEST(test_chatter_while_held_is_not_a_second_press);
  RUN_TEST(test_two_separate_presses_are_two_events);
  RUN_TEST(test_noise_spike_without_high_is_ignored);
  RUN_TEST(test_press_detector_survives_millis_wraparound);
  RUN_TEST(test_sweep_ramps_holds_and_returns);
  RUN_TEST(test_sweep_is_monotonic_while_ramping_up);
  RUN_TEST(test_sweep_skips_stall_without_bursting);
  RUN_TEST(test_soft_pwm_on_ticks_quantized_to_period);
  RUN_TEST(test_soft_pwm_level_over_one_period);
  return UNITY_END();
}

//! Логіка ТЗ-A «Яскравий модуль» — без жодного звернення до заліза (те саме, що `cpp/lib/logic`).
//!
//! Час приходить параметром (мілісекунди `u32`, як `millis()`), тому логіку перевіряють тести на ПК:
//!
//! ```text
//! cargo +stable host-test -p bright-module
//! ```

#![cfg_attr(not(test), no_std)]

use core::fmt;

#[cfg(target_arch = "xtensa")]
pub mod hw;

/// Усі піни, частоти й рівні в одному місці (ВП-8; у C++ — `include/config.h`).
///
/// `const` у Rust — завжди константа часу компіляції: значення підставляється в код і не займає
/// RAM. Номери пінів тут для виводу в Serial і для перевірок нижче: сам пін у Rust — це тип
/// (`peripherals.GPIO5`), і взяти його двічі не дасть компілятор.
pub mod config {
    /// ВП-1: ШІМ через апаратний блок LEDC.
    pub mod pwm {
        pub const PIN: u8 = 5; // GPIO5 → R1 1 кОм → база 2N2222
        pub const FREQUENCY_HZ: u32 = 5000; // 5 кГц: оку не видно мерехтіння
        pub const RESOLUTION_BITS: u8 = 8; // заповнення 0…255
    }

    /// ВП-2: заповнення ШІМ для кожного рівня яскравості, 0…255 (255 — це 100 %, див. `ledc_duty`).
    pub mod level {
        pub const OFF: u8 = 0;
        pub const LOW: u8 = 40; // ≈16 %
        pub const MID: u8 = 128; // ≈50 %
        pub const HIGH: u8 = 255; // 100 %
    }

    /// ВП-3, ВП-5: кнопка 3V3 → GPIO6, внутрішня підтяжка до GND.
    pub mod button {
        pub const PIN: u8 = 6;
        pub const DEBOUNCE_MS: u32 = 50; // тиша після останнього фронту = подія завершилась
    }

    /// Етап 2 (бінарник switch): рівень тримається довго, щоб мультиметр встиг заміряти U(БЕ).
    pub mod switch {
        pub const HALF_PERIOD_MS: u32 = 3000;
    }

    /// Етап 3 (бінарник sweep): 0 → 255 по одному кроку, пауза на 255 і на 0 для заміру U(КЕ).
    pub mod sweep {
        pub const STEP_MS: u32 = 12; // 255 кроків × 12 мс ≈ 3 с на розгін
        pub const HOLD_MS: u32 = 3000;
    }

    /// Рівень «+» (бінарник softpwm): програмний ШІМ на мілісекундах — період у мс.
    pub mod soft_pwm {
        pub const PERIOD_MS: u32 = 10; // 100 Гц; кроків заповнення лише 10 (див. README)
    }

    /// GPIO, які на N16R8 не можна брати під периферію: 22…25 у ESP32-S3 немає зовсім,
    /// strapping-піни (0, 3, 45, 46) задають режим старту, 19/20 — USB, 26…37 зайняті флешем і
    /// восьмибітною (OPI) PSRAM.
    pub const fn is_free_gpio(pin: u8) -> bool {
        pin <= 48 && !matches!(pin, 0 | 3 | 45 | 46 | 19 | 20 | 22..=37)
    }

    // Помилки конфігурації ловить компілятор, а не плата (C++: static_assert).
    const _: () = assert!(is_free_gpio(pwm::PIN) && is_free_gpio(button::PIN), "pin is reserved on ESP32-S3 N16R8");
    const _: () = assert!(pwm::PIN != button::PIN, "PWM output and button share a pin");
    // Таймер LEDC ділить свою тактову частоту: частота × 2^біт не може бути більшою за неї. Тут LEDC
    // тактується від APB 80 МГц (`hw::ledc_timer`); ядро Arduino 2.x на S3 бере кварц 40 МГц.
    const _: () = assert!(
        (pwm::FREQUENCY_HZ as u64) << pwm::RESOLUTION_BITS <= 80_000_000,
        "LEDC: frequency x 2^bits exceeds the 80 MHz APB clock"
    );
    const _: () = assert!(pwm::RESOLUTION_BITS == 8, "duty levels are 8-bit values");
    const _: () = assert!(
        level::OFF < level::LOW && level::LOW < level::MID && level::MID < level::HIGH,
        "levels must grow: OFF < LOW < MID < HIGH"
    );
    const _: () = assert!(button::DEBOUNCE_MS > 0 && button::DEBOUNCE_MS < 1000, "debounce out of range");
    const _: () = assert!(soft_pwm::PERIOD_MS > 0, "empty soft-PWM period");
}

/// Рівень яскравості (ВП-2). C++: `enum class Brightness : uint8_t`.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Brightness {
    Off,
    Low,
    Mid,
    High,
}

impl Brightness {
    /// ВП-6: по колу OFF → LOW → MID → HIGH → OFF. `match` мусить охопити всі варіанти —
    /// інакше помилка компіляції (у C++ лише попередження -Wswitch).
    #[must_use]
    pub const fn next(self) -> Self {
        match self {
            Self::Off => Self::Low,
            Self::Low => Self::Mid,
            Self::Mid => Self::High,
            Self::High => Self::Off,
        }
    }

    /// Заповнення ШІМ 0…255 для цього рівня (числа — у `config::level`).
    #[must_use]
    pub const fn duty(self) -> u8 {
        match self {
            Self::Off => config::level::OFF,
            Self::Low => config::level::LOW,
            Self::Mid => config::level::MID,
            Self::High => config::level::HIGH,
        }
    }
}

/// `print_line(format_args!("Level: {level}"))` — тип «вміє себе друкувати» (C++: `name()`).
impl fmt::Display for Brightness {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_str(match self {
            Self::Off => "OFF",
            Self::Low => "LOW",
            Self::Mid => "MID",
            Self::High => "HIGH",
        })
    }
}

/// Заповнення 0…255 → відсотки, з округленням до найближчого: 40 → 16 %, 128 → 50 %.
#[allow(clippy::cast_possible_truncation, reason = "результат не більший за 100")]
pub const fn duty_percent(duty: u8) -> u8 {
    ((duty as u32 * 100 + 127) / 255) as u8
}

/// Заповнення 0…255 → значення для LEDC з 8-бітним таймером, де 100 % — це 256.
///
/// Ядро Arduino робить це саме: `ledcWrite(канал, 255)` пише 256, тож вихід постійно HIGH.
/// esp-hal нічого не підмінює (`max_duty_cycle()` = 256), і без цього 255 дало б 99,6 % —
/// короткі «провали» щоперіоду, а U(КЕ) на етапі 3 не була б ≈ 0,2 В.
pub const fn ledc_duty(duty: u8) -> u16 {
    if duty == u8::MAX { 1 << config::pwm::RESOLUTION_BITS } else { duty as u16 }
}

/// Антибрязкіт кнопки на перериванні (ВП-5: одне натискання = один перехід).
///
/// ISR лише ставить прапорець «був фронт», а рішення приймає автомат із трьох станів, якому цикл
/// на кожному проході подає прапорець, поточний рівень входу й час (C++: `press_detector.h`):
///
/// ```text
/// Released ──фронт──▶ Arming ──quiet_ms минуло, HIGH бачили──▶ Pressed ──LOW і без фронтів quiet_ms──▶ Released
///                       └──── quiet_ms минуло, HIGH не бачили (завада) ────▶ Released
/// ```
///
/// Навіть коротке «тицяння» зараховується (вхід був HIGH у вікні після фронту), одиночна голка
/// завади — ні; брязкіт відпускання й «торохтіння» контакту під час утримання нових натискань не дають.
#[derive(Debug)]
pub struct PressDetector {
    quiet_ms: u32,
    since_ms: u32,
    state: PressState,
    saw_high: bool,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
enum PressState {
    Released,
    Arming,
    Pressed,
}

impl PressDetector {
    pub const fn new(quiet_ms: u32) -> Self {
        Self { quiet_ms, since_ms: 0, state: PressState::Released, saw_high: false }
    }

    /// `edge` — прапорець ISR був піднятий з попереднього виклику; `high` — рівень входу зараз.
    /// Повертає `true` рівно один раз на натискання: через `quiet_ms` після його першого фронту.
    #[must_use]
    pub fn update(&mut self, edge: bool, high: bool, now_ms: u32) -> bool {
        match self.state {
            PressState::Released => {
                if edge {
                    self.state = PressState::Arming;
                    self.since_ms = now_ms;
                    self.saw_high = high;
                }
                false
            }
            PressState::Arming => {
                self.saw_high |= high;
                // `wrapping_sub` — беззнакова різниця, коректна й після переповнення лічильника мс.
                if now_ms.wrapping_sub(self.since_ms) < self.quiet_ms {
                    return false;
                }
                if !self.saw_high {
                    self.state = PressState::Released; // фронт без HIGH — завада, а не натискання
                    return false;
                }
                self.state = PressState::Pressed;
                self.since_ms = now_ms; // відлік тиші для відпускання
                true
            }
            PressState::Pressed => {
                if edge || high {
                    self.since_ms = now_ms; // ще натиснута або брязкотить — почати відлік заново
                } else if now_ms.wrapping_sub(self.since_ms) >= self.quiet_ms {
                    self.state = PressState::Released;
                }
                false
            }
        }
    }
}

/// Фаза плавної зміни заповнення (етап 3).
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum SweepPhase {
    RampUp,
    HoldHigh,
    RampDown,
    HoldLow,
}

/// Плавна зміна заповнення: 0 → 255 → пауза → 255 → 0 → пауза → знову.
///
/// Заповнення — чиста функція часу від `restart()`: пропущений прохід циклу не збиває графік.
#[derive(Debug)]
pub struct Sweep {
    step_ms: u32,
    hold_ms: u32,
    start_ms: u32,
}

impl Sweep {
    pub const MAX_DUTY: u8 = u8::MAX;

    pub const fn new(step_ms: u32, hold_ms: u32) -> Self {
        Self { step_ms, hold_ms, start_ms: 0 }
    }

    pub fn restart(&mut self, now_ms: u32) {
        self.start_ms = now_ms;
    }

    /// Повний розгін — 255 кроків: останній крок (255) настає рівно в кінці розгону.
    pub const fn ramp_ms(&self) -> u32 {
        Self::MAX_DUTY as u32 * self.step_ms
    }

    pub const fn cycle_ms(&self) -> u32 {
        2 * (self.ramp_ms() + self.hold_ms)
    }

    /// Заповнення в момент `now_ms`. Ніколи не чекає.
    #[must_use]
    #[allow(clippy::cast_possible_truncation, reason = "t / step_ms < 255 у фазах розгону й спаду")]
    pub fn duty(&self, now_ms: u32) -> u8 {
        let t = self.elapsed(now_ms);
        match self.phase_at(t) {
            SweepPhase::RampUp => (t / self.step_ms) as u8,
            SweepPhase::HoldHigh => Self::MAX_DUTY,
            SweepPhase::RampDown => Self::MAX_DUTY - ((t - self.ramp_ms() - self.hold_ms) / self.step_ms) as u8,
            SweepPhase::HoldLow => 0,
        }
    }

    #[must_use]
    pub fn phase(&self, now_ms: u32) -> SweepPhase {
        self.phase_at(self.elapsed(now_ms))
    }

    fn elapsed(&self, now_ms: u32) -> u32 {
        now_ms.wrapping_sub(self.start_ms) % self.cycle_ms()
    }

    const fn phase_at(&self, t: u32) -> SweepPhase {
        if t < self.ramp_ms() {
            SweepPhase::RampUp
        } else if t < self.ramp_ms() + self.hold_ms {
            SweepPhase::HoldHigh
        } else if t < 2 * self.ramp_ms() + self.hold_ms {
            SweepPhase::RampDown
        } else {
            SweepPhase::HoldLow
        }
    }
}

/// Програмний ШІМ (рівень «+»): рівень виводу як функція часу, без таймера й переривань.
///
/// Час — у тиках будь-якого годинника; бінарник softpwm подає мілісекунди. Звідси обмеження
/// порівняно з LEDC: за період 10 мс є лише 11 різних заповнень, а частота — 100 Гц, не 5 кГц.
#[derive(Clone, Copy, Debug)]
pub struct SoftPwm {
    period_ticks: u32,
}

impl SoftPwm {
    pub const fn new(period_ticks: u32) -> Self {
        Self { period_ticks }
    }

    pub const fn period_ticks(&self) -> u32 {
        self.period_ticks
    }

    /// Скільки тиків із періоду вихід увімкнений: округлення вниз, 255 — увесь період.
    pub const fn on_ticks(&self, duty: u8) -> u32 {
        duty as u32 * self.period_ticks / 255
    }

    /// Рівень виводу в момент `now_ticks` (`true` = HIGH). На переповненні лічильника мс
    /// (раз на ~49.7 доби) один період вийде коротшим.
    #[must_use]
    pub const fn level(&self, now_ticks: u32, duty: u8) -> bool {
        now_ticks % self.period_ticks < self.on_ticks(duty)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn levels_cycle_off_low_mid_high() {
        assert_eq!(Brightness::Off.next(), Brightness::Low);
        assert_eq!(Brightness::Low.next(), Brightness::Mid);
        assert_eq!(Brightness::Mid.next(), Brightness::High);
        assert_eq!(Brightness::High.next(), Brightness::Off);
        assert_eq!(Brightness::Mid.to_string(), "MID");
    }

    #[test]
    fn duty_table_matches_spec() {
        let duties = [Brightness::Off, Brightness::Low, Brightness::Mid, Brightness::High].map(Brightness::duty);
        assert_eq!(duties, [0, 40, 128, 255]);
    }

    #[test]
    fn duty_percent_rounds_to_nearest() {
        assert_eq!([0, 40, 128, 255, 2].map(duty_percent), [0, 16, 50, 100, 1]);
    }

    #[test]
    fn ledc_duty_makes_255_fully_on() {
        assert_eq!(ledc_duty(0), 0);
        assert_eq!(ledc_duty(128), 128);
        assert_eq!(ledc_duty(254), 254);
        assert_eq!(ledc_duty(255), 256); // = max_duty_cycle() 8-бітного таймера → 100 %
    }

    /// Симуляція кнопки: кожна мілісекунда — один прохід циклу. `closed` — відрізки `[від, до)`, коли
    /// контакт замкнений (вхід HIGH); прапорець ISR піднімається на кожному переході LOW → HIGH.
    fn count_presses(closed: &[(u32, u32)], until_ms: u32, start_ms: u32) -> usize {
        let mut detector = PressDetector::new(50);
        let mut prev = false;
        (0..until_ms)
            .filter(|&dt| {
                let high = closed.iter().any(|&(from, to)| (from..to).contains(&dt));
                let edge = high && !prev;
                prev = high;
                detector.update(edge, high, start_ms.wrapping_add(dt))
            })
            .count()
    }

    #[test]
    fn press_with_bounce_is_one_event() {
        let closed = [(0, 1), (2, 3), (4, 300), (301, 302), (303, 304), (305, 306)];
        assert_eq!(count_presses(&closed, 1000, 0), 1);
    }

    #[test]
    fn press_reported_after_quiet_window() {
        let mut d = PressDetector::new(50);
        assert!(!d.update(true, true, 100)); // перший фронт
        assert!(!d.update(false, true, 149));
        assert!(d.update(false, true, 150)); // 50 мс — натискання
        assert!(!d.update(false, true, 151)); // лише один раз
    }

    #[test]
    fn fast_tap_is_not_lost() {
        let closed = [(0, 1), (2, 40), (42, 43), (44, 45)]; // відпустили через 40 мс
        assert_eq!(count_presses(&closed, 500, 0), 1);
    }

    #[test]
    fn long_hold_is_one_event() {
        assert_eq!(count_presses(&[(10, 5000)], 6000, 0), 1);
    }

    #[test]
    fn chatter_while_held_is_not_a_second_press() {
        let closed = [(0, 700), (703, 1400), (1403, 2000)]; // контакт двічі «відпадає» на 3 мс
        assert_eq!(count_presses(&closed, 3000, 0), 1);
    }

    #[test]
    fn two_separate_presses_are_two_events() {
        let closed = [(0, 2), (3, 150), (400, 401), (402, 550)];
        assert_eq!(count_presses(&closed, 1000, 0), 2);
    }

    #[test]
    fn noise_spike_without_high_is_ignored() {
        let mut d = PressDetector::new(50);
        assert!(!d.update(true, false, 100)); // фронт, але вхід уже знову LOW
        assert!((101..300).all(|t| !d.update(false, false, t)));
        assert!(!d.update(true, true, 300)); // після завади — знову готовий
        assert!(d.update(false, true, 350));
    }

    #[test]
    fn press_detector_survives_millis_wraparound() {
        assert_eq!(count_presses(&[(0, 1), (2, 200)], 500, 0xFFFF_FF00), 1);
    }

    #[test]
    fn sweep_ramps_holds_and_returns() {
        let mut s = Sweep::new(12, 3000); // розгін 255 × 12 = 3060 мс
        s.restart(1000);
        assert_eq!(s.duty(1000), 0);
        assert_eq!(s.duty(1012), 1);
        assert_eq!(s.duty(1000 + 3059), 254);
        assert_eq!(s.duty(1000 + 3060), 255); // пауза на 255
        assert_eq!(s.phase(1000 + 6059), SweepPhase::HoldHigh);
        assert_eq!(s.duty(1000 + 6060), 255); // спад починається з 255
        assert_eq!(s.phase(1000 + 6060), SweepPhase::RampDown);
        assert_eq!(s.duty(1000 + 9119), 1);
        assert_eq!(s.duty(1000 + 9120), 0); // пауза на 0
        assert_eq!(s.phase(1000 + 9120), SweepPhase::HoldLow);
        assert_eq!(s.cycle_ms(), 12_120);
        assert_eq!(s.duty(1000 + 12_120 + 12), 1); // новий цикл
    }

    #[test]
    fn sweep_is_monotonic_while_ramping_up() {
        let s = Sweep::new(12, 3000);
        let duties: Vec<u8> = (0..s.ramp_ms()).map(|t| s.duty(t)).collect();
        assert!(duties.windows(2).all(|w| w[1] >= w[0] && w[1] - w[0] <= 1)); // плавно: крок ≤ 1
    }

    #[test]
    fn sweep_skips_stall_without_bursting() {
        let s = Sweep::new(12, 3000);
        assert_eq!(s.duty(1200), 100); // прохід циклу «проспав» 1,2 с — одразу 100
    }

    #[test]
    fn soft_pwm_on_ticks_quantized_to_period() {
        let p = SoftPwm::new(10);
        assert_eq!([0, 40, 128, 255, 25].map(|d| p.on_ticks(d)), [0, 1, 5, 10, 0]);
    }

    #[test]
    fn soft_pwm_level_over_one_period() {
        let p = SoftPwm::new(10);
        assert_eq!((500..510).filter(|&t| p.level(t, 128)).count(), 5);
        assert!(p.level(500, 128)); // період починається з HIGH
        assert!(!p.level(505, 128));
        assert!((0..30).all(|t| p.level(t, 255) && !p.level(t, 0)));
    }
}

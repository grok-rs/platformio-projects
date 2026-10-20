//! Логіка ДЗ модуля 2.1 — без жодного звернення до заліза (те саме, що `cpp/lib/logic`).
//!
//! Час приходить параметром (мілісекунди `u32`, як `millis()`), тому логіку перевіряють тести на ПК:
//!
//! ```text
//! cargo +stable host-test -p embedded-cpp
//! ```

#![cfg_attr(not(test), no_std)]

use core::fmt;

#[cfg(target_arch = "xtensa")]
pub mod hw;

/// Усі налаштування в одному місці (у C++ — `struct Config` зі `static constexpr`).
///
/// `const` у Rust — завжди константа часу компіляції: значення підставляється в код і не займає
/// RAM. (`static` — навпаки, одна змінна з адресою в пам'яті.) Номери пінів тут лише для
/// виводу в Serial: сам пін у Rust — це тип (`peripherals.GPIO15`), і взяти його двічі не дасть
/// компілятор.
pub mod config {
    pub mod led {
        pub const PIN: u8 = 15; // GPIO15 → 220 Ω → LED → GND
        pub const BLINK_INTERVAL_MS: u32 = 500; // пів періоду: 1 Гц
    }

    pub mod button {
        pub const PIN: u8 = 21; // GPIO21 → кнопка → GND, підтяжка вгору
        pub const DEBOUNCE_MS: u32 = 30; // тиша після останнього фронту = подія завершилась
    }

    pub mod profiler {
        pub const WINDOW_ITERATIONS: u32 = 1000; // звіт про superloop кожні N ітерацій
    }

    // Помилки конфігурації ловить компілятор, а не плата (C++: static_assert).
    const MAX_GPIO: u8 = 48; // ESP32-S3: GPIO0…GPIO48
    const _: () = assert!(led::PIN <= MAX_GPIO && button::PIN <= MAX_GPIO, "no such GPIO on ESP32-S3");
    const _: () = assert!(led::PIN != button::PIN, "LED and button share a pin");
    const _: () = assert!(button::DEBOUNCE_MS < led::BLINK_INTERVAL_MS, "debounce must be shorter than a blink");
    const _: () = assert!(profiler::WINDOW_ITERATIONS > 0, "empty profiling window");
}

/// Стан світлодіода. C++: `enum class LedState : uint8_t` — у Rust кожен `enum` і так
/// «class»: окремий тип, сам у число не перетворюється.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum LedState {
    Off,
    On,
}

impl LedState {
    #[must_use]
    pub const fn toggled(self) -> Self {
        match self {
            Self::On => Self::Off,
            Self::Off => Self::On,
        }
    }
}

/// Режими з завдання 4, у порядку перемикання кнопкою.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum LedMode {
    Blink,
    SteadyOn,
    SteadyOff,
}

impl LedMode {
    /// `match` мусить охопити всі варіанти — інакше помилка компіляції (у C++ лише -Wswitch).
    #[must_use]
    pub const fn next(self) -> Self {
        match self {
            Self::Blink => Self::SteadyOn,
            Self::SteadyOn => Self::SteadyOff,
            Self::SteadyOff => Self::Blink,
        }
    }
}

/// `println!("Mode: {mode}")` — так у Rust тип «вміє себе друкувати» (C++: `modeName()`).
impl fmt::Display for LedMode {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_str(match self {
            Self::Blink => "BLINK",
            Self::SteadyOn => "STEADY_ON",
            Self::SteadyOff => "STEADY_OFF",
        })
    }
}

/// Неблокуюче блимання: замість `delay()` пам'ятаємо, коли LED перемикався востаннє, і на
/// кожному проході superloop порівнюємо з поточним часом.
#[derive(Debug)]
pub struct Blinker {
    interval_ms: u32,
    last_toggle_ms: u32,
    state: LedState,
}

impl Blinker {
    pub const fn new(interval_ms: u32) -> Self {
        Self { interval_ms, last_toggle_ms: 0, state: LedState::On }
    }

    /// Почати новий цикл блимання з моменту `now_ms`, LED увімкнений.
    pub fn restart(&mut self, now_ms: u32) {
        self.last_toggle_ms = now_ms;
        self.state = LedState::On;
    }

    /// Один прохід superloop: повертає стан, який LED має мати зараз. Ніколи не чекає.
    #[must_use]
    pub fn update(&mut self, now_ms: u32) -> LedState {
        // `wrapping_sub` — та сама беззнакова різниця, що в C++, коректна й після переповнення
        // лічильника мілісекунд. Звичайне `-` у debug-збірці на переповненні панікує.
        if now_ms.wrapping_sub(self.last_toggle_ms) >= self.interval_ms {
            // += interval, а не = now: перемикання лишаються на сітці 0, 500, 1000… мс.
            self.last_toggle_ms = self.last_toggle_ms.wrapping_add(self.interval_ms);
            // Цикл простояв довше за період — синхронізуватися, а не надолужувати серією.
            if now_ms.wrapping_sub(self.last_toggle_ms) >= self.interval_ms {
                self.last_toggle_ms = now_ms;
            }
            self.state = self.state.toggled();
        }
        self.state
    }

    pub const fn state(&self) -> LedState {
        self.state
    }
}

/// Антибрязкіт для кнопки на перериванні.
///
/// ISR лише ставить прапорець «був фронт». Одне натискання — це пачка фронтів за кілька
/// мілісекунд; цей тип чекає, доки фронти припиняться на `quiet_ms`, і один раз каже «пачка
/// закінчилась — читай рівень». LOW — натискання; HIGH — брязкіт відпускання або завада.
#[derive(Debug)]
pub struct EdgeDebouncer {
    quiet_ms: u32,
    last_edge_ms: u32,
    pending: bool,
}

impl EdgeDebouncer {
    pub const fn new(quiet_ms: u32) -> Self {
        Self { quiet_ms, last_edge_ms: 0, pending: false }
    }

    /// `edge` — прапорець ISR був піднятий з попереднього виклику.
    /// Повертає `true` рівно один раз на пачку фронтів: через `quiet_ms` після останнього.
    #[must_use]
    pub fn settled(&mut self, edge: bool, now_ms: u32) -> bool {
        if edge {
            self.pending = true;
            self.last_edge_ms = now_ms; // контакт ще брязкотить — почати відлік тиші заново
            return false;
        }
        if !self.pending || now_ms.wrapping_sub(self.last_edge_ms) < self.quiet_ms {
            return false;
        }
        self.pending = false;
        true
    }
}

/// Статистика тривалості ітерацій superloop за вікно з N ітерацій.
/// Без купи й без `Vec`: досить суми й двох екстремумів — пам'ять O(1) за будь-якого N.
#[derive(Debug)]
pub struct LoopStats {
    window: u32,
    count: u32,
    sum: u64, // 1000 × 32-бітних тривалостей у 32 біти не влізуть
    min: u32,
    max: u32,
}

impl LoopStats {
    pub const fn new(window: u32) -> Self {
        Self { window, count: 0, sum: 0, min: u32::MAX, max: 0 }
    }

    /// Додати тривалість однієї ітерації (тут — такти CPU).
    /// Повертає `true`, коли вікно заповнене: прочитати результати й викликати `reset()`.
    #[must_use]
    pub fn add(&mut self, duration: u32) -> bool {
        self.sum += u64::from(duration);
        self.min = self.min.min(duration);
        self.max = self.max.max(duration);
        self.count += 1;
        self.count >= self.window
    }

    pub fn reset(&mut self) {
        *self = Self::new(self.window);
    }

    pub const fn count(&self) -> u32 {
        self.count
    }

    pub const fn min(&self) -> u32 {
        if self.count == 0 { 0 } else { self.min }
    }

    pub const fn max(&self) -> u32 {
        self.max
    }

    #[allow(clippy::cast_possible_truncation, reason = "середнє не більше за максимум, а він u32")]
    pub const fn average(&self) -> u32 {
        if self.count == 0 { 0 } else { (self.sum / self.count as u64) as u32 }
    }
}

/// Такти CPU → наносекунди. Результат `u64`: 2³² тактів на 240 МГц — це ~17.9 с, у нс за u32 не влізе.
pub const fn cycles_to_ns(cycles: u32, cpu_mhz: u32) -> u64 {
    cycles as u64 * 1000 / cpu_mhz as u64
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn modes_cycle_blink_on_off() {
        assert_eq!(LedMode::Blink.next(), LedMode::SteadyOn);
        assert_eq!(LedMode::SteadyOn.next(), LedMode::SteadyOff);
        assert_eq!(LedMode::SteadyOff.next(), LedMode::Blink);
        assert_eq!(LedMode::SteadyOff.to_string(), "STEADY_OFF");
    }

    #[test]
    fn blinker_toggles_every_interval() {
        let mut b = Blinker::new(500);
        b.restart(1000);
        assert_eq!(b.update(1000), LedState::On);
        assert_eq!(b.update(1499), LedState::On);
        assert_eq!(b.update(1500), LedState::Off);
        assert_eq!(b.update(1999), LedState::Off);
        assert_eq!(b.update(2000), LedState::On);
    }

    #[test]
    fn blinker_keeps_grid_despite_late_polls() {
        let mut b = Blinker::new(500);
        b.restart(0);
        assert_eq!(b.update(503), LedState::Off); // прохід запізнився на 3 мс…
        assert_eq!(b.update(999), LedState::Off);
        assert_eq!(b.update(1000), LedState::On); // …а наступне перемикання — точно о 1000
    }

    #[test]
    fn blinker_resyncs_after_stall_instead_of_bursting() {
        let mut b = Blinker::new(500);
        b.restart(0);
        assert_eq!(b.update(5200), LedState::Off); // простій 5 с — одне перемикання
        assert_eq!(b.update(5201), LedState::Off); // а не ще дев'ять поспіль
        assert_eq!(b.update(5700), LedState::On);
    }

    #[test]
    fn blinker_survives_millis_wraparound() {
        let mut b = Blinker::new(500);
        b.restart(0xFFFF_FF00); // за 256 мс до переповнення
        assert_eq!(b.update(0xFFFF_FFFF), LedState::On);
        assert_eq!(b.update(244), LedState::Off); // 0xFFFFFF00 + 500 = 244 після переповнення
    }

    #[test]
    fn debouncer_reports_once_after_quiet() {
        let mut d = EdgeDebouncer::new(30);
        assert!(!d.settled(true, 100));
        assert!(!d.settled(false, 129));
        assert!(d.settled(false, 130));
        assert!(!d.settled(false, 131)); // лише один раз
        assert!(!d.settled(false, 1000));
    }

    #[test]
    fn debouncer_restarts_on_every_bounce() {
        let mut d = EdgeDebouncer::new(30);
        for t in (100..=108).step_by(2) {
            assert!(!d.settled(true, t));
        }
        assert!(!d.settled(false, 130)); // 30 мс від ПЕРШОГО фронту — ще рано
        assert!(d.settled(false, 138)); // 30 мс від останнього
    }

    #[test]
    fn debouncer_idle_without_edges() {
        let mut d = EdgeDebouncer::new(30);
        assert!((0..1000).step_by(7).all(|t| !d.settled(false, t)));
    }

    #[test]
    fn stats_window_min_max_average() {
        let mut s = LoopStats::new(4);
        assert!(!s.add(10));
        assert!(!s.add(30));
        assert!(!s.add(20));
        assert!(s.add(40));
        assert_eq!((s.count(), s.min(), s.max(), s.average()), (4, 10, 40, 25));

        s.reset();
        assert_eq!((s.count(), s.average()), (0, 0));
        assert!(!s.add(7));
        assert_eq!(s.min(), 7);
    }

    #[test]
    fn stats_sum_does_not_overflow_32_bits() {
        let mut s = LoopStats::new(1000);
        for _ in 0..999 {
            assert!(!s.add(10_000_000)); // 999 × 10⁷ ≫ 2³²
        }
        assert!(s.add(10_000_000));
        assert_eq!(s.average(), 10_000_000);
    }

    #[test]
    fn cycles_convert_to_nanoseconds() {
        assert_eq!(cycles_to_ns(240, 240), 1000);
        assert_eq!(cycles_to_ns(156, 240), 650);
        assert_eq!(cycles_to_ns(u32::MAX, 240), 17_895_697_062);
    }
}

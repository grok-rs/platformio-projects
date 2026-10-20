//! Логіка модуля 1.4 — режими миготіння без жодного звернення до заліза.
//!
//! Режим — це послідовність кроків однакової тривалості; на кожному кроці [`Mode::is_on`]
//! каже, чи горить світлодіод `led`. Залізо (GPIO, кнопки, таймер) — у `src/main.rs`.
//!
//! ```text
//! cargo +stable host-test -p two-buttons
//! ```

#![cfg_attr(not(test), no_std)]

use embassy_time::Duration;

/// Режим (шаблон миготіння).
///
/// У C++ це таблиця `kPatterns[]` з вказівником на функцію `isOn` і окремий `enum PatternId`,
/// які тримає разом `static_assert`. Тут режим — `enum`, а його властивості — методи з `match`:
/// додати варіант і забути описати його крок або назву не дасть компілятор (вичерпний `match`).
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Mode {
    /// Режим 1: усі разом увімкнулися — усі разом вимкнулися, 200 мс.
    Sync,
    /// Режим 2: горить рівно один LED, «вогник» переїжджає по колу, 1000 мс.
    Alternate,
}

impl Mode {
    /// «Пам'ять» програми при старті — режим 1.
    pub const START: Self = Self::Sync;

    pub const fn name(self) -> &'static str {
        match self {
            Self::Sync => "1 (sync, 200 ms)",
            Self::Alternate => "2 (alternate, 1000 ms)",
        }
    }

    pub const fn step_duration(self) -> Duration {
        match self {
            Self::Sync => Duration::from_millis(200),
            Self::Alternate => Duration::from_millis(1000),
        }
    }

    pub const fn step_count(self, led_count: usize) -> usize {
        match self {
            Self::Sync => 2,
            Self::Alternate => led_count,
        }
    }

    /// Чи горить світлодіод `led` на кроці `step`. Шаблони описані через індекси, а не через
    /// конкретні виводи, тому автоматично масштабуються на будь-яку кількість LED.
    pub const fn is_on(self, step: usize, led: usize) -> bool {
        match self {
            Self::Sync => step == 0,
            // Для двох LED це саме «перший горить — другий згашений, і навпаки».
            Self::Alternate => step == led,
        }
    }
}

/// Стан програми: поточний режим і крок для `LEDS` світлодіодів.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct Blinker<const LEDS: usize> {
    mode: Mode,
    step: usize,
}

impl<const LEDS: usize> Default for Blinker<LEDS> {
    fn default() -> Self {
        Self { mode: Mode::START, step: 0 }
    }
}

impl<const LEDS: usize> Blinker<LEDS> {
    pub fn mode(&self) -> Mode {
        self.mode
    }

    /// Почати режим з першого кроку. Повертає `false`, якщо цей режим уже активний —
    /// повторне натискання тієї самої кнопки нічого не змінює.
    pub fn set_mode(&mut self, mode: Mode) -> bool {
        if mode == self.mode {
            return false;
        }
        self.mode = mode;
        self.step = 0;
        true
    }

    /// Перейти до наступного кроку (по колу).
    pub fn advance(&mut self) {
        self.step = (self.step + 1) % self.mode.step_count(LEDS);
    }

    /// Рівні всіх світлодіодів на поточному кроці.
    pub fn levels(&self) -> [bool; LEDS] {
        core::array::from_fn(|led| self.mode.is_on(self.step, led))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn sync_blinks_all_leds_together() {
        let mut b = Blinker::<2>::default();
        assert_eq!(b.mode(), Mode::Sync);
        assert_eq!(b.levels(), [true, true]);
        b.advance();
        assert_eq!(b.levels(), [false, false]);
        b.advance();
        assert_eq!(b.levels(), [true, true]);
    }

    #[test]
    fn alternate_moves_one_light_around() {
        let mut b = Blinker::<3>::default();
        assert!(b.set_mode(Mode::Alternate));
        assert_eq!(b.levels(), [true, false, false]);
        b.advance();
        assert_eq!(b.levels(), [false, true, false]);
        b.advance();
        b.advance();
        assert_eq!(b.levels(), [true, false, false]);
    }

    #[test]
    fn same_mode_is_sticky_and_does_not_restart() {
        let mut b = Blinker::<2>::default();
        b.advance();
        assert!(!b.set_mode(Mode::Sync));
        assert_eq!(b.levels(), [false, false], "step is kept");
    }

    #[test]
    fn new_mode_starts_from_first_step() {
        let mut b = Blinker::<2>::default();
        b.advance();
        assert!(b.set_mode(Mode::Alternate));
        assert_eq!(b.levels(), [true, false]);
    }
}

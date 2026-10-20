//! Антибрязкіт для кроку 2 (`toggle`) — без жодного звернення до заліза.
//!
//! Рівень кнопки й час приходять параметрами, тому логіку перевіряють тести на ПК:
//!
//! ```text
//! cargo +stable host-test -p led-button
//! ```

#![cfg_attr(not(test), no_std)]

use embassy_time::{Duration, Instant};

/// Подія «натиснули» з антибрязкотом: новий рівень приймаємо лише тоді,
/// коли він тримається `debounce`. Будь-який відскок перезапускає відлік.
///
/// У C++ це чотири глобальні змінні й функція `buttonPressedEvent()`;
/// тут той самий стан зібраний в одну структуру — її можна мати кілька і тестувати.
#[derive(Debug)]
pub struct Debouncer {
    debounce: Duration,
    stable_high: bool, // підтверджений рівень кнопки (відпущена = HIGH)
    last_high: bool,   // останнє «сире» читання, може брязкотіти
    last_change: Instant, // коли сире читання змінилося востаннє
}

impl Debouncer {
    pub const fn new(debounce: Duration) -> Self {
        Self { debounce, stable_high: true, last_high: true, last_change: Instant::MIN }
    }

    /// Повертає `true` рівно один раз на кожне натискання (перехід HIGH → LOW).
    pub fn pressed(&mut self, is_high: bool, now: Instant) -> bool {
        if is_high != self.last_high {
            self.last_high = is_high;
            self.last_change = now; // рівень ще «стрибає» — почати відлік заново
            return false;
        }
        // `Instant` — 64-бітний: про переповнення, як у `millis()`, думати не треба.
        if now - self.last_change < self.debounce || is_high == self.stable_high {
            return false;
        }
        self.stable_high = is_high; // рівень стабільний `debounce` — приймаємо його
        !self.stable_high
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Подати послідовність (мс, рівень HIGH?) і повернути моменти подій «натиснули».
    fn presses(samples: &[(u64, bool)]) -> Vec<u64> {
        let mut d = Debouncer::new(Duration::from_millis(30));
        samples
            .iter()
            .filter(|&&(t, high)| d.pressed(high, Instant::from_millis(t)))
            .map(|&(t, _)| t)
            .collect()
    }

    /// Опитування щомілісекунди: `level(t)` — рівень у момент t.
    fn every_ms(until: u64, level: impl Fn(u64) -> bool) -> Vec<(u64, bool)> {
        (0..until).map(|t| (t, level(t))).collect()
    }

    #[test]
    fn clean_press_is_reported_once_after_debounce() {
        // Натиснули о 100 мс, відпустили о 300 мс.
        let samples = every_ms(400, |t| !(100..300).contains(&t));
        assert_eq!(presses(&samples), [130]);
    }

    #[test]
    fn bouncing_contact_gives_one_press() {
        // Відскоки 100…108 мс (останній — о 108), далі стабільно LOW до 300 мс:
        // подія через 30 мс після ОСТАННЬОГО відскоку, а не після першого.
        let samples = every_ms(400, |t| match t {
            100..=108 => t % 2 == 1,
            109..300 => false,
            _ => true,
        });
        assert_eq!(presses(&samples), [138]);
    }

    #[test]
    fn release_is_not_a_press() {
        let samples = every_ms(600, |t| !(100..300).contains(&t));
        assert_eq!(presses(&samples).len(), 1);
    }
}

//! Рішення «вмикати реле чи ні» — без заліза, тому перевіряється тестами на ПК:
//!
//! ```text
//! cargo +stable host-test -p twilight-relay
//! ```

#![cfg_attr(not(test), no_std)]

/// Два пороги з гістерезисом. LDR зверху (до 3V3): темніше → менша напруга → менше число АЦП.
///
/// У C++ — глобальний `relayOn` і `if / else if` у `loop()`; тут стан і пороги разом,
/// а `new` під час компіляції перевіряє, що поріг «темно» нижчий за поріг «світло».
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct Hysteresis {
    dark: u16,  // нижче — темно: вмикаємо
    light: u16, // вище — світло: вимикаємо
    on: bool,
}

impl Hysteresis {
    /// # Panics
    /// Якщо `dark >= light` (у `const` — помилка компіляції): тоді проміжку немає і реле клацатиме.
    pub const fn new(dark: u16, light: u16) -> Self {
        assert!(dark < light, "dark threshold must be below light threshold");
        Self { dark, light, on: false }
    }

    /// Врахувати нове число АЦП і повернути, чи має реле бути увімкнене.
    pub fn update(&mut self, adc: u16) -> bool {
        if adc < self.dark {
            self.on = true; // темно
        } else if adc > self.light {
            self.on = false; // світло
        } // між порогами — нічого не міняємо
        self.on
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Запис із README: кімната, долоня, рука між порогами, знову світло.
    #[test]
    fn bench_log_from_readme() {
        let mut h = Hysteresis::new(500, 600);
        let states: Vec<bool> = [692, 351, 588, 689].into_iter().map(|adc| h.update(adc)).collect();
        assert_eq!(states, [false, true, true, false]);
    }

    #[test]
    fn between_thresholds_keeps_previous_state() {
        let mut h = Hysteresis::new(500, 600);
        assert!(!h.update(550), "starts OFF and stays OFF in the gap");
        h.update(499);
        assert!(h.update(600), "exactly at the light threshold is still ON");
        assert!(!h.update(601));
        assert!(!h.update(500), "exactly at the dark threshold is still OFF");
    }
}

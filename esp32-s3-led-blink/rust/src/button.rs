//! Кнопка з антибрязкотом і розрізненням короткого та довгого натискання.

use embassy_time::{Duration, Instant};

/// Що сталося з кнопкою під час чергового опитування.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ButtonEvent {
    ShortPress,
    LongPress,
}

/// Автомат стану кнопки. Сам вивід не читає: рівень (`down`) і час (`now`) приходять
/// параметрами, тому той самий код працює з будь-яким GPIO і перевіряється тестами.
///
/// Довге натискання повідомляється щойно кнопку протримали `long_press` — не чекаючи
/// відпускання; наступне відпускання тоді вже не є коротким.
#[derive(Debug)]
pub struct Button {
    debounce: Duration,
    long_press: Duration,
    pressed: bool, // стан після антибрязкоту
    long_reported: bool,
    press_start: Instant,
    last_edge: Instant,
}

impl Button {
    pub const fn new(debounce: Duration, long_press: Duration) -> Self {
        Self {
            debounce,
            long_press,
            pressed: false,
            long_reported: false,
            press_start: Instant::MIN,
            last_edge: Instant::MIN,
        }
    }

    /// Опитати кнопку. `None` замість `Event::None` з C++: «події немає» — це не подія.
    pub fn poll(&mut self, down: bool, now: Instant) -> Option<ButtonEvent> {
        if down != self.pressed {
            if now - self.last_edge < self.debounce {
                return None; // брязкіт контактів
            }
            self.last_edge = now;
            self.pressed = down;

            if down {
                self.press_start = now;
                self.long_reported = false;
                return None;
            }
            // Відпустили.
            return (!self.long_reported).then_some(ButtonEvent::ShortPress);
        }

        if self.pressed && !self.long_reported && now - self.press_start >= self.long_press {
            self.long_reported = true;
            return Some(ButtonEvent::LongPress);
        }
        None
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    const DEBOUNCE: Duration = Duration::from_millis(30);
    const LONG: Duration = Duration::from_millis(600);

    /// Подати на кнопку послідовність (мс, натиснута?) і зібрати всі події.
    fn run(samples: &[(u64, bool)]) -> Vec<(u64, ButtonEvent)> {
        let mut button = Button::new(DEBOUNCE, LONG);
        samples
            .iter()
            .filter_map(|&(t, down)| button.poll(down, Instant::from_millis(t)).map(|e| (t, e)))
            .collect()
    }

    #[test]
    fn short_press_is_reported_on_release() {
        let events = run(&[(100, true), (200, true), (250, false)]);
        assert_eq!(events, [(250, ButtonEvent::ShortPress)]);
    }

    #[test]
    fn long_press_is_reported_before_release_and_only_once() {
        let events = run(&[(100, true), (699, true), (700, true), (900, true), (1000, false)]);
        assert_eq!(events, [(700, ButtonEvent::LongPress)]);
    }

    #[test]
    fn bounce_inside_debounce_window_is_ignored() {
        // Натиснули о 100 мс; контакт «стрибнув» о 110 і 115 мс — у межах 30 мс.
        let events = run(&[(100, true), (110, false), (115, true), (300, false)]);
        assert_eq!(events, [(300, ButtonEvent::ShortPress)]);
    }
}

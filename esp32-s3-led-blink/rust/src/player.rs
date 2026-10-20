//! Неблокуючий програвач патернів.

use embassy_time::{Duration, Instant};

use crate::{Frame, LedDriver, Pattern};

/// Кожні N мс (N — поточна швидкість) показує наступний кадр активного патерну,
/// після останнього кадру повертається до першого.
///
/// Програвач володіє драйвером (`D`), а не тримає посилання, як `LedDriver&` у C++:
/// так компілятор гарантує, що ніхто інший не пише у ті самі виводи. Час передається
/// параметром `now`, тому в тестах його можна «перемотувати» без справжнього таймера.
#[derive(Debug)]
pub struct BlinkPlayer<D> {
    driver: D,
    patterns: &'static [Pattern],
    speeds: &'static [Duration],
    pattern_index: usize,
    speed_index: usize,
    frame_index: usize,
    frame_start: Instant,
    held: bool,
}

impl<D: LedDriver> BlinkPlayer<D> {
    /// # Panics
    /// Якщо `patterns` або `speeds` порожні.
    pub fn new(
        driver: D,
        patterns: &'static [Pattern],
        speeds: &'static [Duration],
        initial_speed_index: usize,
    ) -> Self {
        assert!(!patterns.is_empty() && !speeds.is_empty());
        Self {
            driver,
            patterns,
            speeds,
            pattern_index: 0,
            speed_index: initial_speed_index % speeds.len(),
            frame_index: 0,
            frame_start: Instant::MIN,
            held: false,
        }
    }

    /// Показати перший кадр і запустити відлік.
    pub fn start(&mut self, now: Instant) {
        self.restart_pattern(now);
    }

    /// Викликати регулярно (з головного циклу).
    pub fn update(&mut self, now: Instant) {
        if self.held {
            return;
        }
        // `Instant` — 64-бітний лічильник тиків: переповнення через ~584 000 років,
        // тож пастки «millis() переповнився через 49 діб» тут немає взагалі.
        if now - self.frame_start < self.frame_duration() {
            return;
        }
        self.frame_start = now;
        self.frame_index = (self.frame_index + 1) % self.pattern().frames.len();
        self.driver.show(self.pattern().frames[self.frame_index]);
    }

    pub fn next_pattern(&mut self, now: Instant) {
        self.held = false;
        self.pattern_index = (self.pattern_index + 1) % self.patterns.len();
        self.restart_pattern(now);
    }

    pub fn next_speed(&mut self) {
        self.speed_index = (self.speed_index + 1) % self.speeds.len();
    }

    /// Ручний режим для перевірки монтажу: зупинити патерн і тримати один кадр.
    pub fn hold(&mut self, frame: Frame) {
        self.held = true;
        self.driver.show(frame);
    }

    pub fn resume(&mut self, now: Instant) {
        if self.held {
            self.held = false;
            self.restart_pattern(now);
        }
    }

    pub fn is_held(&self) -> bool {
        self.held
    }

    pub fn pattern(&self) -> &Pattern {
        &self.patterns[self.pattern_index]
    }

    pub fn frame_duration(&self) -> Duration {
        self.speeds[self.speed_index]
    }

    pub fn driver(&self) -> &D {
        &self.driver
    }

    pub fn driver_mut(&mut self) -> &mut D {
        &mut self.driver
    }

    /// Показати перший кадр негайно, щоб зміна патерну була видимою одразу.
    fn restart_pattern(&mut self, now: Instant) {
        self.frame_index = 0;
        self.frame_start = now;
        self.driver.show(self.pattern().frames[0]);
    }
}

#[cfg(test)]
mod tests {
    use core::fmt;

    use super::*;
    use crate::pattern::{INITIAL_SPEED_INDEX, PATTERNS, SPEEDS};

    /// Драйвер-шпигун: запам'ятовує останній показаний кадр.
    #[derive(Debug, Default)]
    struct Spy {
        shown: Option<Frame>,
    }

    impl fmt::Display for Spy {
        fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
            f.write_str("spy")
        }
    }

    impl LedDriver for Spy {
        fn show(&mut self, frame: Frame) {
            self.shown = Some(frame);
        }
    }

    fn ms(ms: u64) -> Instant {
        Instant::from_millis(ms)
    }

    fn player() -> BlinkPlayer<Spy> {
        let mut p = BlinkPlayer::new(Spy::default(), PATTERNS, SPEEDS, INITIAL_SPEED_INDEX);
        p.start(ms(0));
        p
    }

    #[test]
    fn starts_with_first_frame_of_alternate() {
        let p = player();
        assert_eq!(p.pattern().name, "alternate");
        assert_eq!(p.frame_duration(), Duration::from_millis(500));
        assert_eq!(p.driver().shown, Some(Frame::RED));
    }

    #[test]
    fn advances_only_after_frame_duration() {
        let mut p = player();
        p.update(ms(499));
        assert_eq!(p.driver().shown, Some(Frame::RED));
        p.update(ms(500));
        assert_eq!(p.driver().shown, Some(Frame::BLUE));
        p.update(ms(1000));
        assert_eq!(p.driver().shown, Some(Frame::RED), "wraps around to the first frame");
    }

    #[test]
    fn speeds_cycle_through_presets() {
        let mut p = player();
        let seen: Vec<u64> = (0..SPEEDS.len())
            .map(|_| {
                p.next_speed();
                p.frame_duration().as_millis()
            })
            .collect();
        assert_eq!(seen, [250, 120, 1000, 500]);
    }

    #[test]
    fn hold_freezes_pattern_until_resume() {
        let mut p = player();
        p.hold(Frame::GREEN);
        p.update(ms(5000));
        assert_eq!(p.driver().shown, Some(Frame::GREEN));
        assert!(p.is_held());

        p.resume(ms(5000));
        assert!(!p.is_held());
        assert_eq!(p.driver().shown, Some(Frame::RED), "resume restarts the pattern");
    }

    #[test]
    fn next_pattern_shows_its_first_frame_immediately() {
        let mut p = player();
        p.update(ms(500)); // BLUE
        p.next_pattern(ms(600));
        assert_eq!(p.pattern().name, "alternate_gap");
        assert_eq!(p.driver().shown, Some(Frame::RED));
    }

    #[test]
    fn next_pattern_wraps_around() {
        let mut p = player();
        for _ in 0..PATTERNS.len() {
            p.next_pattern(ms(0));
        }
        assert_eq!(p.pattern().name, "alternate");
    }
}

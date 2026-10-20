//! Аналіз брязкоту — без жодного звернення до заліза.
//!
//! Обробник переривання лише записує моменти фронтів у [`EdgeLog`]; коли на кнопці 50 мс
//! тиша, головний цикл забирає журнал і [`Classifier`] перетворює його на [`Report`]:
//! натискання, відпускання чи короткий імпульс, скільки фронтів, скільки тривав брязкіт,
//! найкоротший імпульс і чи не загубило переривання фронт. Звіт друкується через
//! [`core::fmt::Display`], тож той самий текст перевіряють тести на ПК:
//!
//! ```text
//! cargo +stable host-test -p bounce-test
//! ```

#![cfg_attr(not(test), no_std)]

use core::fmt;

use heapless::Vec;

/// 50 мс без фронтів = брязкіт закінчився.
pub const QUIET_US: u32 = 50_000;
/// Більше фронтів на подію не запам'ятовуємо (лише рахуємо).
pub const MAX_EDGES: usize = 64;
/// Скільки перших інтервалів друкувати.
pub const SHOW_GAPS: usize = 10;

/// Фронти однієї події: моменти перших [`MAX_EDGES`] (мкс) і загальна кількість.
///
/// У C++ це три `volatile` глобальні змінні (`gEdgeTimes`, `gEdgeCount`, `gLastEdgeUs`).
/// Тут — одна структура, яку прошивка тримає в `critical_section::Mutex`: компілятор не дасть
/// звернутися до неї без критичної секції, тож «забути `noInterrupts()`» неможливо.
#[derive(Debug, Clone, Default)]
pub struct EdgeLog {
    times: Vec<u32, MAX_EDGES>,
    count: u32, // усі фронти, навіть ті, що не влізли в `times`
    last_us: u32,
}

impl EdgeLog {
    pub const fn new() -> Self {
        Self { times: Vec::new(), count: 0, last_us: 0 }
    }

    /// Записати фронт (викликає обробник переривання). Повертає номер фронту в події.
    pub fn record(&mut self, now_us: u32) -> u32 {
        let _ = self.times.push(now_us); // повний — лише рахуємо
        self.count += 1;
        self.last_us = now_us;
        self.count
    }

    /// Подія закінчилася: фронти були, і після останнього минуло [`QUIET_US`].
    /// `wrapping_sub` — та сама беззнакова різниця, що й `micros() - gLastEdgeUs` у C++.
    pub fn is_finished(&self, now_us: u32) -> bool {
        self.count > 0 && now_us.wrapping_sub(self.last_us) >= QUIET_US
    }

    pub fn count(&self) -> u32 {
        self.count
    }

    /// Інтервали між сусідніми записаними фронтами — так само, як курсори в аналізаторі.
    pub fn gaps(&self) -> impl Iterator<Item = u32> + '_ {
        self.times.windows(2).map(|w| w[1].wrapping_sub(w[0]))
    }

    fn duration_us(&self) -> u32 {
        match (self.times.first(), self.times.last()) {
            (Some(first), Some(last)) => last.wrapping_sub(*first),
            _ => 0,
        }
    }
}

/// Тип події — за рівнем, на якому все заспокоїлось.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Kind {
    Press,
    Release,
    /// Фронти були, а рівень не змінився — лише короткий імпульс.
    Glitch,
}

impl fmt::Display for Kind {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        // `pad`, а не `write_str`, — щоб працювала ширина `{:<7}` (як `%-7s`).
        f.pad(match self {
            Self::Press => "PRESS",
            Self::Release => "RELEASE",
            Self::Glitch => "GLITCH",
        })
    }
}

/// Лічильники подій і рівень кнопки після попередньої події.
#[derive(Debug)]
pub struct Classifier {
    stable_low: bool,
    presses: u32,
    releases: u32,
    glitches: u32,
}

impl Classifier {
    /// `low` — рівень кнопки на старті (відпущена = HIGH, тобто `false`).
    pub const fn new(low: bool) -> Self {
        Self { stable_low: low, presses: 0, releases: 0, glitches: 0 }
    }

    /// Після тиші рівень стабільний: став LOW — натиснули, став HIGH — відпустили,
    /// не змінився — це був лише короткий імпульс (GLITCH).
    pub fn classify(&mut self, log: EdgeLog, low: bool) -> Report {
        let changed = low != self.stable_low;
        self.stable_low = low;
        let (kind, counter) = match (changed, low) {
            (false, _) => (Kind::Glitch, &mut self.glitches),
            (true, true) => (Kind::Press, &mut self.presses),
            (true, false) => (Kind::Release, &mut self.releases),
        };
        *counter += 1;
        // Зміна рівня — це непарна кількість фронтів, повернення до того самого — парна.
        // Інша парність означає, що імпульс був коротший за реакцію ISR і фронт загубився.
        let missed = (log.count % 2 == 1) != changed;
        Report { kind, index: *counter, missed, log }
    }
}

/// Звіт про одну подію: `{report}` — рядки для Serial, `{}` з [`Report::label`] — для LABEL.
#[derive(Debug)]
pub struct Report {
    pub kind: Kind,
    pub index: u32,
    pub missed: bool,
    pub log: EdgeLog,
}

impl Report {
    /// Короткий підпис для каналу LABEL: Logic 2 декодує його як Async Serial і показує на
    /// шкалі часу — через ~50 мс після останнього фронту (стільки триває очікування тиші).
    pub fn label(&self) -> impl fmt::Display + '_ {
        Label(self)
    }
}

impl fmt::Display for Report {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        let log = &self.log;
        write!(
            f,
            "{:<7} #{:<3} edges={:<3} bounce={:>6} us",
            self.kind,
            self.index,
            log.count,
            log.duration_us()
        )?;
        if let Some(shortest) = log.gaps().min() {
            write!(f, "  shortest={shortest} us")?;
        }
        if log.count == 1 {
            f.write_str("  (clean, no bounce)")?;
        }
        if self.missed {
            f.write_str("  [ISR missed >=1 edge - see analyzer]")?;
        }
        if log.times.len() > 1 {
            f.write_str("\n        gaps us:")?;
            for gap in log.gaps().take(SHOW_GAPS) {
                write!(f, " {gap}")?;
            }
            if log.times.len() - 1 > SHOW_GAPS {
                f.write_str(" ...")?;
            }
        }
        Ok(())
    }
}

struct Label<'a>(&'a Report);

impl fmt::Display for Label<'_> {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        let r = self.0;
        let missed = if r.missed { " MISSED" } else { "" };
        writeln!(f, "{}#{} e={} {}us{missed}", r.kind, r.index, r.log.count, r.log.duration_us())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn log(times: &[u32]) -> EdgeLog {
        let mut log = EdgeLog::new();
        for &t in times {
            log.record(t);
        }
        log
    }

    #[test]
    fn clean_press_and_release_match_bench_output() {
        let mut c = Classifier::new(false);
        let press = c.classify(log(&[1000]), true);
        assert_eq!(
            press.to_string(),
            "PRESS   #1   edges=1   bounce=     0 us  (clean, no bounce)"
        );
        let release = c.classify(log(&[2000, 2131]), true);
        // Рівень не змінився після парної кількості фронтів — це імпульс, а не відпускання.
        assert_eq!(release.kind, Kind::Glitch);
        assert!(!release.missed);
    }

    #[test]
    fn bouncy_release_prints_gaps() {
        let mut c = Classifier::new(true);
        let r = c.classify(log(&[0, 131, 150]), false);
        assert_eq!(
            r.to_string(),
            "RELEASE #1   edges=3   bounce=   150 us  shortest=19 us\n        gaps us: 131 19"
        );
        assert_eq!(r.label().to_string(), "RELEASE#1 e=3 150us\n");
    }

    #[test]
    fn wrong_parity_means_isr_missed_an_edge() {
        let mut c = Classifier::new(false);
        // Рівень змінився (натиснули), а фронтів парна кількість — один загубився.
        let r = c.classify(log(&[0, 40]), true);
        assert_eq!(r.kind, Kind::Press);
        assert!(r.missed);
        assert!(r.to_string().contains("[ISR missed >=1 edge - see analyzer]"));
        assert_eq!(r.label().to_string(), "PRESS#1 e=2 40us MISSED\n");
    }

    #[test]
    fn long_bounce_is_truncated_but_counted() {
        let times: std::vec::Vec<u32> = (0..100).map(|i| i * 10).collect();
        let mut c = Classifier::new(false);
        let r = c.classify(log(&times), false);
        assert_eq!(r.log.count(), 100);
        assert_eq!(r.log.gaps().count(), MAX_EDGES - 1);
        assert!(r.to_string().ends_with(" 10 10 10 10 10 10 10 10 10 10 ..."));
    }

    #[test]
    fn event_finishes_after_quiet_even_across_wraparound() {
        let log = log(&[u32::MAX - 10]);
        assert!(!log.is_finished(u32::MAX));
        assert!(log.is_finished(QUIET_US - 11));
        assert!(!EdgeLog::new().is_finished(1_000_000));
    }
}

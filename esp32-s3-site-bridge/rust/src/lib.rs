//! Протокол «Мого стенду» — рядки JSON для сайту, без жодного звернення до заліза.
//!
//! Прошивка (`src/main.rs`) лише читає АЦП і записує моменти фронтів кнопки; тут вони
//! стають рядками, які сторінка `docs/live/` читає через Web Serial. Текст рядків той самий,
//! що й у C++-версії (`../cpp/src/main.cpp`), тож тести на ПК перевіряють обидві:
//!
//! ```text
//! cargo +stable host-test -p site-bridge
//! ```

#![cfg_attr(not(test), no_std)]

use core::fmt;

use heapless::Vec;

pub const FIRMWARE: &str = "site-bridge";
pub const VERSION: &str = "1.0.0";
pub const BOARD: &str = "YD-ESP32-S3 N16R8";

/// Піни — як у `esp32-s3-ldr-adc` і `esp32-s3-bounce-test`, стенд не перебираємо.
pub const LDR_PIN: u8 = 4;
pub const BUTTON_PIN: u8 = 21;

pub const ADC_BITS: u8 = 12;
/// Ослаблення 11 дБ: на ESP32-S3 шкала 0…3100 мВ.
pub const UREF_MV: u32 = 3100;
pub const ADC_PERIOD_MS: u64 = 100;
/// Сайт може під'єднатися будь-коли — раз на 5 с нагадуємо, хто ми.
pub const HELLO_PERIOD_MS: u64 = 5000;

/// 50 мс без фронтів = брязкіт закінчився.
pub const QUIET_US: u32 = 50_000;
/// Більше фронтів на подію не запам'ятовуємо (лише рахуємо).
pub const MAX_EDGES: usize = 64;

/// Фронти однієї події: моменти перших [`MAX_EDGES`] (мкс) і загальна кількість.
///
/// У C++ це три `volatile` глобальні змінні; тут — одна структура в `critical_section::Mutex`.
#[derive(Debug, Clone, Default)]
pub struct EdgeLog {
    times: Vec<u32, MAX_EDGES>,
    count: u32,
    last_us: u32,
}

impl EdgeLog {
    pub const fn new() -> Self {
        Self { times: Vec::new(), count: 0, last_us: 0 }
    }

    /// Записати фронт (викликає обробник переривання).
    pub fn record(&mut self, now_us: u32) {
        let _ = self.times.push(now_us); // повний — лише рахуємо
        self.count += 1;
        self.last_us = now_us;
    }

    /// Подія закінчилася: фронти були, і після останнього минуло [`QUIET_US`].
    pub fn is_finished(&self, now_us: u32) -> bool {
        self.count > 0 && now_us.wrapping_sub(self.last_us) >= QUIET_US
    }

    pub fn count(&self) -> u32 {
        self.count
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

impl Kind {
    pub const fn as_str(self) -> &'static str {
        match self {
            Self::Press => "press",
            Self::Release => "release",
            Self::Glitch => "glitch",
        }
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

    /// Чи натиснута кнопка після останньої події (для рядка `hello`).
    pub const fn pressed(&self) -> bool {
        self.stable_low
    }

    /// Після тиші рівень стабільний: став LOW — натиснули, став HIGH — відпустили,
    /// не змінився — короткий імпульс.
    pub fn classify(&mut self, log: EdgeLog, low: bool) -> ButtonLine {
        let changed = low != self.stable_low;
        self.stable_low = low;
        let (kind, counter) = match (changed, low) {
            (false, _) => (Kind::Glitch, &mut self.glitches),
            (true, true) => (Kind::Press, &mut self.presses),
            (true, false) => (Kind::Release, &mut self.releases),
        };
        *counter += 1;
        // Зміна рівня — непарна кількість фронтів, повернення до того самого — парна.
        let missed = (log.count % 2 == 1) != changed;
        ButtonLine { kind, index: *counter, missed, log }
    }
}

/// `{"t":"hello",…}` — хто на тому боці кабелю.
#[derive(Debug, Clone, Copy)]
pub struct Hello {
    pub pressed: bool,
    pub up_ms: u64,
}

impl fmt::Display for Hello {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(
            f,
            "{{\"t\":\"hello\",\"fw\":\"{FIRMWARE}\",\"ver\":\"{VERSION}\",\"lang\":\"rust\",\"board\":\"{BOARD}\",\
             \"ldr_pin\":{LDR_PIN},\"btn_pin\":{BUTTON_PIN},\"adc_ms\":{ADC_PERIOD_MS},\"bits\":{ADC_BITS},\
             \"uref_mv\":{UREF_MV},\"quiet_ms\":{},\"max_edges\":{MAX_EDGES},\"pressed\":{},\"up_ms\":{}}}",
            QUIET_US / 1000,
            self.pressed,
            self.up_ms
        )
    }
}

/// `{"t":"adc",…}` — один вимір фоторезистора.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct AdcLine {
    pub ms: u64,
    pub raw: u16,
    pub mv: u32,
}

impl fmt::Display for AdcLine {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{{\"t\":\"adc\",\"ms\":{},\"raw\":{},\"mv\":{}}}", self.ms, self.raw, self.mv)
    }
}

/// `{"t":"btn",…}` — одна подія кнопки з моментами всіх записаних фронтів.
#[derive(Debug)]
pub struct ButtonLine {
    pub kind: Kind,
    pub index: u32,
    pub missed: bool,
    pub log: EdgeLog,
}

impl fmt::Display for ButtonLine {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        let times = &self.log.times;
        let first = times.first().copied().unwrap_or(0);
        let bounce = times.last().map_or(0, |last| last.wrapping_sub(first));
        write!(
            f,
            "{{\"t\":\"btn\",\"kind\":\"{}\",\"n\":{},\"us\":{first},\"edges\":{},\"bounce_us\":{bounce},\
             \"missed\":{},\"at\":[",
            self.kind.as_str(),
            self.index,
            self.log.count,
            self.missed
        )?;
        for (i, t) in times.iter().enumerate() {
            if i > 0 {
                f.write_str(",")?;
            }
            write!(f, "{}", t.wrapping_sub(first))?;
        }
        f.write_str("]}")
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn log_of(times: &[u32]) -> EdgeLog {
        let mut log = EdgeLog::new();
        times.iter().for_each(|&t| log.record(t));
        log
    }

    #[test]
    fn adc_line() {
        let l = AdcLine { ms: 12_300, raw: 2861, mv: 2190 };
        assert_eq!(l.to_string(), r#"{"t":"adc","ms":12300,"raw":2861,"mv":2190}"#);
    }

    #[test]
    fn hello_line() {
        let s = Hello { pressed: false, up_ms: 42 }.to_string();
        assert_eq!(
            s,
            r#"{"t":"hello","fw":"site-bridge","ver":"1.0.0","lang":"rust","board":"YD-ESP32-S3 N16R8","ldr_pin":4,"btn_pin":21,"adc_ms":100,"bits":12,"uref_mv":3100,"quiet_ms":50,"max_edges":64,"pressed":false,"up_ms":42}"#
        );
    }

    #[test]
    fn press_with_bounce() {
        let mut c = Classifier::new(false);
        let line = c.classify(log_of(&[1000, 1012, 1052, 1610, 1830]), true);
        assert_eq!(
            line.to_string(),
            r#"{"t":"btn","kind":"press","n":1,"us":1000,"edges":5,"bounce_us":830,"missed":false,"at":[0,12,52,610,830]}"#
        );
        assert!(c.pressed());
    }

    #[test]
    fn clean_release_then_glitch_and_missed_edge() {
        let mut c = Classifier::new(true);
        let r = c.classify(log_of(&[5]), false);
        assert_eq!(r.kind, Kind::Release);
        assert!(!r.missed);
        assert!(r.to_string().ends_with(r#""edges":1,"bounce_us":0,"missed":false,"at":[0]}"#));
        // два фронти, рівень той самий — короткий імпульс
        let g = c.classify(log_of(&[100, 103]), false);
        assert_eq!(g.kind, Kind::Glitch);
        assert!(!g.missed);
        // два фронти, але рівень змінився — один фронт ISR пропустив
        let p = c.classify(log_of(&[200, 201]), true);
        assert_eq!((p.kind, p.missed, p.index), (Kind::Press, true, 1));
    }

    #[test]
    fn overflow_counts_all_edges_but_lists_first_64() {
        let times: std::vec::Vec<u32> = (0..71).map(|k| k * 3).collect();
        let line = Classifier::new(false).classify(log_of(&times), true).to_string();
        assert!(line.contains(r#""edges":71,"bounce_us":189,"#));
        assert_eq!(line.matches(',').count() - 7, 63); // 64 числа в "at"
    }

    #[test]
    fn quiet_detection_survives_micros_wraparound() {
        let log = log_of(&[u32::MAX - 10]);
        assert!(!log.is_finished(u32::MAX));
        assert!(log.is_finished(QUIET_US - 11));
    }
}

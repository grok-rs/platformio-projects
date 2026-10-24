//! Логіка модуля 1.6 — формула, похибка, підсумок і рядок таблиці, без звернення до АЦП.
//!
//! Числа АЦП приходять параметрами, тому все тут перевіряється на ПК:
//!
//! ```text
//! cargo +stable host-test -p ldr-adc
//! ```
//!
//! Читання АЦП і таймер — у `src/main.rs`.

#![cfg_attr(not(test), no_std)]

use core::fmt;

// --- АЦП ----------------------------------------------------------------
// 12 біт → 2^12 = 4096 сходинок, числа 0…4095.
// Ослаблення 11 дБ: на ESP32-S3 це діапазон 0…3100 мВ, а не 0…3300 мВ.
// Усе, що вище ~3.1 В, АЦП показує як 4095 («впирається в стелю»).
pub const ADC_BITS: u8 = 12;
pub const ADC_MAX: f32 = 4095.0;
pub const UREF_MV: f32 = 3100.0;

// --- Таблиця ------------------------------------------------------------
pub const HEADER_EVERY: u32 = 25; // повторювати шапку, щоб не губитися в стовпцях
/// Біля 0 мВ знаменник похибки дуже малий: 3 мВ різниці при 10 мВ — це вже 30 %.
/// У підсумок беремо лише виміри від 100 мВ, щоб він описував АЦП, а не ділення на «майже нуль».
pub const MIN_MV_FOR_STATS: u32 = 100;
pub const BAR_WIDTH: u32 = 16; // ширина «шкали світла» у символах

/// Формула з умови: U_calc = RAW / ADC_max · U_ref.
pub fn raw_to_millivolts(raw: u16) -> f32 {
    f32::from(raw) / ADC_MAX * UREF_MV
}

/// Один вимір — усе, що потрапляє в рядок таблиці.
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct Sample {
    pub raw: u16,
    pub calc_mv: f32,
    pub meas_mv: u32,
    /// `None`, якщо U_meas = 0 (ділити на нуль не можна). У C++ для цього є окремий
    /// прапорець `hasError`, і ніщо не заважає прочитати `errorPct`, коли він `false`.
    pub error_pct: Option<f32>,
}

impl Sample {
    pub fn new(raw: u16, meas_mv: u32) -> Self {
        let calc_mv = raw_to_millivolts(raw);
        let error_pct = (meas_mv > 0).then(|| (calc_mv - meas_mv as f32) / meas_mv as f32 * 100.0);
        Self { raw, calc_mv, meas_mv, error_pct }
    }

    /// Чи брати вимір у підсумок похибки.
    pub fn error_for_stats(&self) -> Option<f32> {
        self.error_pct.filter(|_| self.meas_mv >= MIN_MV_FOR_STATS)
    }
}

/// Накопичувач для підсумку.
#[derive(Debug, Clone, Copy, Default, PartialEq)]
pub struct Stats {
    pub count: u32,
    pub sum_abs: f32,
    pub max_abs: f32,
}

impl Stats {
    pub fn add(&mut self, error_pct: f32) {
        let a = error_pct.abs();
        self.count += 1;
        self.sum_abs += a;
        self.max_abs = self.max_abs.max(a);
    }

    pub fn average(&self) -> Option<f32> {
        (self.count > 0).then(|| self.sum_abs / self.count as f32)
    }
}

/// Рядок підсумку: `--- summary: … ---`.
impl fmt::Display for Stats {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self.average() {
            None => write!(f, "--- summary: no samples >= {MIN_MV_FOR_STATS} mV (too dark) ---"),
            Some(avg) => write!(
                f,
                "--- summary: {} samples >= {MIN_MV_FOR_STATS} mV, |error| avg {avg:.2} %, max {:.2} % ---",
                self.count, self.max_abs
            ),
        }
    }
}

/// Шкала світла: скільки «#» з `BAR_WIDTH` — пропорційно U_meas до 3100 мВ (з округленням).
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct LightBar(pub u32);

impl LightBar {
    pub fn filled(&self) -> u32 {
        let uref = UREF_MV as u32;
        ((self.0 * BAR_WIDTH + uref / 2) / uref).min(BAR_WIDTH)
    }
}

/// Пише символи прямо у вихід — без проміжного буфера `char bar[17]` і `'\0'`.
impl fmt::Display for LightBar {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        let filled = self.filled();
        (0..BAR_WIDTH).try_for_each(|i| f.write_str(if i < filled { "#" } else { "." }))
    }
}

/// Рядок таблиці: час, RAW, U_calc, U_meas, похибка і шкала.
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct Row {
    pub t_ms: u64,
    pub sample: Sample,
}

impl fmt::Display for Row {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        let s = &self.sample;
        write!(f, "{:>7}  {:>4}  {:>9.1}  {:>9}  ", self.t_ms, s.raw, s.calc_mv, s.meas_mv)?;
        match s.error_pct {
            Some(err) => write!(f, "{err:+7.2}")?,
            None => write!(f, "{:>7}", "n/a")?,
        }
        write!(f, "  {}", LightBar(s.meas_mv))
    }
}

pub const HEADER: [&str; 2] = [
    "  t, ms   RAW  U_calc,mV  U_meas,mV  error,%  light",
    "-------  ----  ---------  ---------  -------  ----------------",
];

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn formula_matches_reference_readings() {
        // Опорні точки: сирий відлік → мВ (лінійна формула, 4095 → 3100 мВ).
        assert_eq!(format!("{:.1}", raw_to_millivolts(1744)), "1320.2");
        assert_eq!(format!("{:.1}", raw_to_millivolts(113)), "85.5");
        assert_eq!(format!("{:.1}", raw_to_millivolts(4095)), "3100.0");
    }

    #[test]
    fn row_has_the_same_columns_as_cpp_printf() {
        let row = Row { t_ms: 1234, sample: Sample::new(1744, 1300) };
        assert_eq!(row.to_string(), "   1234  1744     1320.2       1300    +1.56  #######.........");
        assert!(row.to_string().contains("  1744     1320.2"));
    }

    #[test]
    fn zero_millivolts_has_no_error() {
        let s = Sample::new(0, 0);
        assert_eq!(s.error_pct, None);
        let row = Row { t_ms: 0, sample: s };
        assert_eq!(row.to_string(), "      0     0        0.0          0      n/a  ................");
    }

    #[test]
    fn dark_samples_are_left_out_of_stats() {
        assert_eq!(Sample::new(80, 50).error_for_stats(), None);
        assert!(Sample::new(1744, 1300).error_for_stats().is_some());
    }

    #[test]
    fn bar_is_rounded_and_clamped() {
        assert_eq!(LightBar(0).filled(), 0);
        assert_eq!(LightBar(96).filled(), 0); // 0.495 «#»
        assert_eq!(LightBar(97).filled(), 1); // 0.5006 «#»
        assert_eq!(LightBar(3100).filled(), 16);
        assert_eq!(LightBar(3300).filled(), 16);
    }

    #[test]
    fn summary_lines() {
        assert_eq!(Stats::default().to_string(), "--- summary: no samples >= 100 mV (too dark) ---");
        let mut stats = Stats::default();
        stats.add(-2.0);
        stats.add(1.0);
        assert_eq!(
            stats.to_string(),
            "--- summary: 2 samples >= 100 mV, |error| avg 1.50 %, max 2.00 % ---"
        );
    }
}

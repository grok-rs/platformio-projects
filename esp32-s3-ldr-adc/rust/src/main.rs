//! Модуль 1.6 — вимірювання освітленості: фоторезистор (LDR) + 10 кОм, АЦП ESP32-S3.
//!
//!   3V3 ── LDR ──┬── 10 кОм ── GND        Більше світла → менший опір LDR →
//!                └── GPIO4 (ADC1_CH3)      вища напруга на GPIO4 → більше число RAW.
//!
//! Кожні 100 мс програма:
//!   1. читає «сире» число АЦП:            RAW    (0…4095);
//!   2. переводить його в мілівольти:       U_calc = RAW / 4095 · 3100 мВ;
//!   3. читає калібровану напругу:          U_meas (калібрування з eFuse, як analogReadMilliVolts());
//!   4. рахує відносну похибку:             error  = (U_calc − U_meas) / U_meas · 100 %;
//!   5. друкує рядок таблиці в Serial.
//!
//! Раз на 10 с — підсумок: середня й найбільша |похибка|. Пояснення — у README.md.

#![no_std]
#![no_main]

use embassy_executor::Spawner;
use embassy_time::{Duration, Instant, Ticker};
use esp_backtrace as _;
use esp_hal::{
    analog::adc::{Adc, AdcCalBasic, AdcCalCurve, AdcCalScheme, AdcConfig, Attenuation},
    clock::CpuClock,
    peripherals::ADC1,
    timer::timg::TimerGroup,
};
use esp_println::println;
use ldr_adc::{ADC_BITS, ADC_MAX, HEADER, HEADER_EVERY, Row, Sample, Stats, UREF_MV};

esp_bootloader_esp_idf::esp_app_desc!();

const SAMPLE_PERIOD: Duration = Duration::from_millis(100); // з умови завдання
const SUMMARY_PERIOD: Duration = Duration::from_secs(10); // підсумок похибки

#[esp_rtos::main]
async fn main(_spawner: Spawner) -> ! {
    let peripherals = esp_hal::init(esp_hal::Config::default().with_cpu_clock(CpuClock::max()));
    let timg0 = TimerGroup::new(peripherals.TIMG0);
    esp_rtos::start(timg0.timer0, peripherals.FROM_CPU_INTR0);

    // --- Вхід ---------------------------------------------------------------
    // GPIO4 належить ADC1 (GPIO1…10): працює завжди, навіть з увімкненим Wi-Fi.
    // ADC2 (GPIO11…20) ділить апаратуру з Wi-Fi — для датчиків його краще не брати.
    // Тип пам'ятає, що GPIO4 — канал саме ADC1: передати пін ADC2 сюди — помилка компіляції.
    let mut adc_config = AdcConfig::new();
    // `AdcCalBasic` лише віднімає «нуль» АЦП (код при 0 В з eFuse) — це й є RAW, як analogRead().
    let mut ldr =
        adc_config.enable_pin_with_cal::<_, AdcCalBasic<ADC1>>(peripherals.GPIO4, Attenuation::_11dB);
    let mut adc = Adc::new(peripherals.ADC1, adc_config);
    // Крива калібрування з eFuse: RAW → мілівольти, як analogReadMilliVolts().
    let curve = AdcCalCurve::<ADC1>::new_cal(Attenuation::_11dB);

    print_banner();

    let mut ticker = Ticker::every(SAMPLE_PERIOD); // крок не «повзе», як `lastSampleAt += period`
    let mut last_summary = Instant::now();
    let mut rows_printed: u32 = 0;
    let mut stats = Stats::default();

    loop {
        ticker.next().await;
        let now = Instant::now();

        let raw = adc.read_blocking(&mut ldr);
        // Це окреме перетворення, а не перерахунок того самого RAW: між ними кілька мікросекунд,
        // тож у «похибку» потрапляє й шум АЦП (±кілька одиниць RAW).
        let meas_mv = u32::from(curve.adc_val(adc.read_blocking(&mut ldr)));
        let sample = Sample::new(raw, meas_mv);

        if rows_printed.is_multiple_of(HEADER_EVERY) {
            println!();
            HEADER.iter().for_each(|line| println!("{line}"));
        }
        println!("{}", Row { t_ms: now.as_millis(), sample });
        rows_printed += 1;
        if let Some(err) = sample.error_for_stats() {
            stats.add(err);
        }

        if now - last_summary >= SUMMARY_PERIOD {
            last_summary += SUMMARY_PERIOD;
            println!("{stats}");
            stats = Stats::default();
            rows_printed = 0; // після підсумку — знову шапка
        }
    }
}

fn print_banner() {
    println!();
    println!("=== ESP32-S3: LDR light meter (module 1.6) ===");
    println!("Divider: 3V3 - LDR - GPIO4 - 10k - GND (more light -> higher voltage)");
    println!(
        "ADC: {ADC_BITS} bit (0..{ADC_MAX:.0}), 11 dB, Uref = {UREF_MV:.0} mV, every {} ms",
        SAMPLE_PERIOD.as_millis()
    );
    println!("U_calc = RAW / 4095 * 3100 mV; error = (U_calc - U_meas) / U_meas * 100 %");
}

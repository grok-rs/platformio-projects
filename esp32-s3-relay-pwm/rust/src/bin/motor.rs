//! Модуль 2.2, ДЗ 2 — те саме, що cpp/src/motor.cpp: швидкість мотора від потенціометра,
//! ШІМ формує сам процесор (без LEDC).

#![no_std]
#![no_main]

use esp_backtrace as _;
use esp_hal::{
    analog::adc::{Adc, AdcCalBasic, AdcConfig, Attenuation},
    clock::CpuClock,
    delay::Delay,
    gpio::{Level, Output, OutputConfig},
    main,
    peripherals::ADC1,
    time::{Duration, Instant},
};
use esp_println::println;

esp_bootloader_esp_idf::esp_app_desc!();

const PERIOD_US: u32 = 1000; // період ШІМ 1000 мкс = 1 кГц
const PRINT: Duration = Duration::from_millis(500);

#[main]
fn main() -> ! {
    let p = esp_hal::init(esp_hal::Config::default().with_cpu_clock(CpuClock::max()));

    // потенціометр 10 кОм: кінці на 3V3 і GND, повзунок → GPIO4 (ADC1), 12 біт, 11 дБ — до ≈3,1 В
    let mut adc_config = AdcConfig::new();
    let mut pot = adc_config.enable_pin_with_cal::<_, AdcCalBasic<ADC1>>(p.GPIO4, Attenuation::_11dB);
    let mut adc = Adc::new(p.ADC1, adc_config);

    // GPIO6 → 220 Ом → база 2N2222; мотор між +5 В (MB-102) і колектором
    let mut motor = Output::new(p.GPIO6, Level::Low, OutputConfig::default());
    let delay = Delay::new();
    println!("Мотор: програмний ШІМ 1 кГц на GPIO6, потенціометр на GPIO4");

    let mut last_print = Instant::now();
    loop {
        // 1. АЦП → тривалість HIGH і LOW в одному періоді
        let raw = adc.read_blocking(&mut pot);
        let high_us = u32::from(raw) * PERIOD_US / 4095;
        let low_us = PERIOD_US - high_us;

        // 2. Один період ШІМ: HIGH — ключ відкритий, мотор під струмом; LOW — крутиться за інерцією
        if high_us > 0 {
            motor.set_high();
            delay.delay_micros(high_us);
        }
        if low_us > 0 {
            motor.set_low();
            delay.delay_micros(low_us);
        }

        // 3. Двічі на секунду — що бачить програма
        if last_print.elapsed() >= PRINT {
            last_print = Instant::now();
            println!(
                "ADC {raw:4}  HIGH {high_us:4} мкс  LOW {low_us:4} мкс  duty {:3} %",
                high_us * 100 / PERIOD_US
            );
        }
    }
}

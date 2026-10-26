//! Сутінковий перемикач — те саме, що cpp/src/main.cpp:
//! LDR → АЦП → гістерезис → GPIO2 → BC547B → модуль реле.

#![no_std]
#![no_main]

use esp_backtrace as _;
use esp_hal::{
    analog::adc::{Adc, AdcCalBasic, AdcConfig, Attenuation},
    clock::CpuClock,
    gpio::{Level, Output, OutputConfig},
    main,
    peripherals::ADC1,
    time::{Duration, Instant},
};
use esp_println::println;

esp_bootloader_esp_idf::esp_app_desc!();

// LDR зверху: темніше → менша напруга → менше число АЦП.
// Пороги підібрані за Serial на моїй макетці: кімната ≈ 690, LDR під долонею ≈ 350.
const DARK: u16 = 500; // нижче — темно: вмикаємо
const LIGHT: u16 = 600; // вище — світло: вимикаємо
const PERIOD: Duration = Duration::from_millis(100);

#[main]
fn main() -> ! {
    let p = esp_hal::init(esp_hal::Config::default().with_cpu_clock(CpuClock::max()));

    // GPIO4 = ADC1_CH3, 12 біт (0…4095), 11 дБ — до ≈3,1 В. З піном ADC2 цей рядок не збереться.
    let mut adc_config = AdcConfig::new();
    let mut ldr = adc_config.enable_pin_with_cal::<_, AdcCalBasic<ADC1>>(p.GPIO4, Attenuation::_11dB);
    let mut adc = Adc::new(p.ADC1, adc_config);

    // GPIO2 → 10 кОм → база BC547B. LOW: VT1 закритий → IN = 5 В → реле вимкнене.
    let mut relay = Output::new(p.GPIO2, Level::Low, OutputConfig::default());

    let mut relay_on = false;
    let mut last = Instant::now();

    loop {
        if Instant::now() - last < PERIOD {
            continue;
        }
        last += PERIOD; // крок не «повзе», навіть якщо цикл запізнився

        // 1. Зчитати АЦП
        let adc_value = adc.read_blocking(&mut ldr);

        // 2. Порівняти з порогами (гістерезис)
        if adc_value < DARK {
            relay_on = true; // темно
        } else if adc_value > LIGHT {
            relay_on = false; // світло
        } // між порогами — нічого не міняємо

        // 3. HIGH → VT1 відкритий → IN ≈ 0 В → реле вмикається
        relay.set_level(Level::from(relay_on));
        println!("adc={adc_value:>4} relay={}", if relay_on { "ON" } else { "OFF" });
    }
}

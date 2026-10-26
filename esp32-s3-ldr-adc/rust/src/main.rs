//! Модуль 1.6 — те саме, що cpp/src/main.cpp: кожні 100 мс RAW, мВ за формулою, калібровані мВ і похибка.

#![no_std]
#![no_main]

use esp_backtrace as _;
use esp_hal::{
    analog::adc::{Adc, AdcCalBasic, AdcCalCurve, AdcCalScheme, AdcConfig, Attenuation},
    clock::CpuClock,
    main,
    peripherals::ADC1,
    time::{Duration, Instant},
};
use esp_println::{print, println};

esp_bootloader_esp_idf::esp_app_desc!();

const ADC_MAX: f32 = 4095.0; // 12 біт: 0…4095
const UREF_MV: f32 = 3100.0; // ослаблення 11 дБ на ESP32-S3: 0…3100 мВ, а не 3300

#[main]
fn main() -> ! {
    let p = esp_hal::init(esp_hal::Config::default().with_cpu_clock(CpuClock::max()));
    // GPIO4 — канал ADC1; AdcCalBasic лише віднімає «нуль» АЦП — це RAW, як analogRead()
    let mut config = AdcConfig::new();
    let mut ldr = config.enable_pin_with_cal::<_, AdcCalBasic<ADC1>>(p.GPIO4, Attenuation::_11dB);
    let mut adc = Adc::new(p.ADC1, config);
    // крива калібрування з eFuse: RAW → мВ, як analogReadMilliVolts()
    let curve = AdcCalCurve::<ADC1>::new_cal(Attenuation::_11dB);
    println!(
        "LDR на GPIO4: U_calc = RAW / 4095 * 3100 мВ, error = (U_calc - U_meas) / U_meas * 100 %"
    );

    let mut last_sample = Instant::now();
    loop {
        let now = Instant::now();
        if now - last_sample < Duration::from_millis(100) {
            continue;
        }
        last_sample = now;

        let raw = adc.read_blocking(&mut ldr); // «сире» число АЦП
        let meas_mv = curve.adc_val(adc.read_blocking(&mut ldr)); // калібровані мВ — окреме перетворення
        let calc_mv = f32::from(raw) / ADC_MAX * UREF_MV; // формула з умови

        print!("RAW: {raw:4}  U_calc: {calc_mv:6.1} mV  U_meas: {meas_mv:4} mV  error: ");
        if meas_mv > 0 {
            let meas = f32::from(meas_mv);
            println!("{:+.2} %", (calc_mv - meas) / meas * 100.0);
        } else {
            println!("n/a"); // ділити на нуль не можна
        }
    }
}

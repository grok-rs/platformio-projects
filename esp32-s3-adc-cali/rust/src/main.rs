//! Модуль 3, урок 3.2, ДЗ — те саме, що cpp/src/main.c, але Rust поверх ESP-IDF.
//! Потенціометр на GPIO4 (ADC1, канал 3). Кожні 100 мс друкуємо
//! сире число, напругу за формулою, калібровану напругу і похибку формули.

use esp_idf_svc::hal::{
    adc::{
        attenuation::DB_12,
        oneshot::{
            AdcChannelDriver, AdcDriver,
            config::{AdcChannelConfig, Calibration},
        },
    },
    delay::FreeRtos,
    peripherals::Peripherals,
};
use esp_idf_svc::sys::EspError;

const V_FULL: f32 = 3300.0; // «повна шкала» для формули, мВ: перевірте й 3100

fn main() -> Result<(), EspError> {
    esp_idf_svc::sys::link_patches();
    let p = Peripherals::take()?;

    let adc = AdcDriver::new(p.adc1)?;
    // Калібрування з eFuse (curve fitting) з тим самим ослабленням, що й у каналу.
    // Якщо на чипі немає даних eFuse, new() поверне помилку, і програма зупиниться з її текстом.
    let config = AdcChannelConfig { attenuation: DB_12, calibration: Calibration::Curve, ..Default::default() };
    let mut pot = AdcChannelDriver::new(&adc, p.pins.gpio4, &config)?; // GPIO4 = ADC1_CH3

    FreeRtos::delay_ms(2000); // монітор порту встигає під'єднатися після прошивки
    println!("ATTEN 12 дБ, 12 біт, curve fitting, V_FULL = {V_FULL:.0} мВ");
    println!(" RAW  U_manual(mV)  U_cali(mV)  Error(%)");
    loop {
        let raw = pot.read_raw()?;
        let manual = f32::from(raw) * V_FULL / 4095.0; // формула: 4095 — найбільше число 12-бітного АЦП
        match pot.raw_to_mv(raw) {
            Ok(mv) if mv > 0 => {
                let err = (manual - f32::from(mv)) * 100.0 / f32::from(mv);
                println!("{raw:4}  {manual:12.1}  {mv:10}  {err:8.2}");
            }
            _ => println!("{raw:4}  {manual:12.1}  {:>10}  {:>8}", "-", "-"), // біля нуля ділити на mv не можна
        }
        FreeRtos::delay_ms(100);
    }
}

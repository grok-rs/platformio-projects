//! Модуль 3, урок 3.1, ДЗ — те саме, що cpp/src/main.c, але Rust поверх ESP-IDF.
//! LDR-подільник на GPIO4 (ADC1_CH3), LED на GPIO15 через 220 Ом.
//! Oneshot кожні 20 мс → ковзне середнє (SMA) з 16 відліків → два пороги (гістерезис), щоб LED не мерехтів.

use std::thread;
use std::time::{Duration, Instant};

use esp_idf_svc::hal::{
    adc::{
        attenuation::DB_12,
        oneshot::{AdcChannelDriver, AdcDriver, config::AdcChannelConfig},
    },
    delay::FreeRtos,
    gpio::PinDriver,
    peripherals::Peripherals,
};
use esp_idf_svc::sys::EspError;

const N: usize = 16; // вікно SMA: 16 × 20 мс = 320 мс
const PERIOD: Duration = Duration::from_millis(20);
const DARK: u32 = 1800; // середнє нижче — темно: LED вмикаємо (стенд: долоня ≈ 1200, кімната ≈ 3560)
const LIGHT: u32 = 2600; // середнє вище — світло: LED вимикаємо (запас 800 ≫ шуму ±15)

fn main() -> Result<(), EspError> {
    esp_idf_svc::sys::link_patches();
    let p = Peripherals::take()?;

    let adc = AdcDriver::new(p.adc1)?; // oneshot-драйвер АЦП1, як adc_oneshot_new_unit() у C
    let config = AdcChannelConfig { attenuation: DB_12, ..Default::default() }; // вхід до ≈3,1 В, 12 біт
    let mut ldr = AdcChannelDriver::new(&adc, p.pins.gpio4, &config)?; // GPIO4 = ADC1_CH3, канал бере сам
    let mut led = PinDriver::output(p.pins.gpio15)?;

    FreeRtos::delay_ms(2000); // монітор порту встигає під'єднатися після прошивки
    println!("ДЗ 3.1: LDR, SMA з {N} відліків, пороги DARK {DARK} / LIGHT {LIGHT}");

    let mut buf = [0u32; N]; // кільцевий буфер останніх N відліків
    let mut sum = 0u32; // їхня сума: до 16 × 4095 = 65 520
    let mut i = 0;
    let mut filled = 0;
    let mut on = false;
    let mut wake = Instant::now();
    loop {
        wake += PERIOD; // рівно кожні 20 мс, як vTaskDelayUntil()
        thread::sleep(wake.saturating_duration_since(Instant::now()));

        let raw = u32::from(ldr.read_raw()?);
        sum = sum - buf[i] + raw; // найстаріше виходить, нове входить
        buf[i] = raw;
        i = (i + 1) % N;
        if filled < N {
            // поки вікно не повне, не вирішуємо
            filled += 1;
            continue;
        }

        let sma = sum / N as u32;
        if !on && sma < DARK {
            on = true;
            led.set_high()?;
        }
        if on && sma > LIGHT {
            on = false;
            led.set_low()?;
        }
        if i == 0 {
            // раз на вікно, 320 мс
            println!("raw: {raw:4}  sma: {sma:4}  led: {}", if on { "ON" } else { "OFF" });
        }
    }
}

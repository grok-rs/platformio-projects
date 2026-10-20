//! Сутінковий перемикач: LDR → АЦП → гістерезис → GPIO2 → BC547B → модуль реле.

#![no_std]
#![no_main]

use embassy_executor::Spawner;
use embassy_time::{Duration, Ticker};
use esp_backtrace as _;
use esp_hal::{
    analog::adc::{Adc, AdcCalBasic, AdcConfig, Attenuation},
    clock::CpuClock,
    gpio::{Level, Output, OutputConfig},
    peripherals::ADC1,
    timer::timg::TimerGroup,
};
use esp_println::println;
use twilight_relay::Hysteresis;

esp_bootloader_esp_idf::esp_app_desc!();

// Пороги відкалібровані на моїй макетці за Serial: кімната ≈ 690, LDR під долонею ≈ 350.
// Проміжок 100 більший за шум АЦП (±20) і тінь від руки (≈ 600), тож реле не клацає.
const THRESHOLD_DARK: u16 = 500; // нижче — темно: вмикаємо
const THRESHOLD_LIGHT: u16 = 600; // вище — світло: вимикаємо
const PERIOD: Duration = Duration::from_millis(100);

#[esp_rtos::main]
async fn main(_spawner: Spawner) -> ! {
    let peripherals = esp_hal::init(esp_hal::Config::default().with_cpu_clock(CpuClock::max()));
    let timg0 = TimerGroup::new(peripherals.TIMG0);
    esp_rtos::start(timg0.timer0, peripherals.FROM_CPU_INTR0);

    // GPIO In: ADC1_CH3, середня точка R1 (LDR) + R2. 12 біт (0…4095), 11 дБ — до ≈3,1 В.
    // `AdcCalBasic` лише вписує заводський код нуля АЦП, як `analogRead()`: число лишається «сирим».
    // Що GPIO4 належить саме ADC1, перевіряє компілятор: з ADC2 цей рядок не збереться.
    let mut adc_config = AdcConfig::new();
    let mut ldr = adc_config
        .enable_pin_with_cal::<_, AdcCalBasic<ADC1>>(peripherals.GPIO4, Attenuation::_11dB);
    let mut adc = Adc::new(peripherals.ADC1, adc_config);

    // GPIO Out: через R3 10 кОм на базу VT1. LOW: VT1 закритий → IN = 5 В → реле вимкнене.
    let mut relay = Output::new(peripherals.GPIO2, Level::Low, OutputConfig::default());

    let mut hysteresis = const { Hysteresis::new(THRESHOLD_DARK, THRESHOLD_LIGHT) };
    // `Ticker` рахує наступний момент від попереднього, а не від «зараз», — як
    // `lastReadAt += kPeriodMs` у C++: крок не «повзе», навіть якщо цикл трохи запізнився.
    let mut ticker = Ticker::every(PERIOD);

    loop {
        ticker.next().await;

        // 1. Зчитати АЦП
        let raw = adc.read_blocking(&mut ldr);

        // 2. Порівняти з порогами (гістерезис)
        let relay_on = hysteresis.update(raw);

        // 3. HIGH → VT1 відкритий → IN ≈ 0 В → реле вмикається
        relay.set_level(relay_on.into());
        println!("adc={raw:>4} relay={}", if relay_on { "ON" } else { "OFF" });
    }
}

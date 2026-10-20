//! Урок: ШІМ (PWM) — яскравість світлодіода на GPIO15 через апаратний блок LEDC.
//!
//! Ті самі три кроки, що й `ledcSetup` → `ledcAttachPin` → `ledcWrite` у C++:
//! таймер (частота й розрядність) → канал, прив'язаний до піна → коефіцієнт заповнення.

#![no_std]
#![no_main]

use embassy_executor::Spawner;
use embassy_time::Timer;
use embedded_hal::pwm::SetDutyCycle;
use esp_backtrace as _;
use esp_hal::{
    clock::CpuClock,
    gpio::DriveMode,
    ledc::{
        LSGlobalClkSource, Ledc, LowSpeed,
        channel::{self, ChannelIFace},
        timer::{self, TimerIFace},
    },
    time::Rate,
    timer::timg::TimerGroup,
};

esp_bootloader_esp_idf::esp_app_desc!();

/// Заповнення: 128 з 256 кроків = 50 % часу HIGH (як `ledcWrite(ledChannel, 128)` у C++).
const DUTY: u16 = 128;

#[esp_rtos::main]
async fn main(_spawner: Spawner) -> ! {
    let peripherals = esp_hal::init(esp_hal::Config::default().with_cpu_clock(CpuClock::max()));
    let timg0 = TimerGroup::new(peripherals.TIMG0);
    esp_rtos::start(timg0.timer0, peripherals.FROM_CPU_INTR0);

    let mut ledc = Ledc::new(peripherals.LEDC);
    ledc.set_global_slow_clock(LSGlobalClkSource::APBClk);

    // 1. Таймер ШІМ: частота 5000 Гц, розрядність 8 біт → значення 0…255 (256 рівнів).
    //    Помилка конфігурації (напр. частота × 2^біт > 80 МГц) — це `Result`, а не мовчазний 0.
    let mut lstimer0 = ledc.timer::<LowSpeed>(timer::Number::Timer0);
    lstimer0
        .configure(timer::config::Config {
            duty: timer::config::Duty::Duty8Bit,
            clock_source: timer::LSClockSource::APBClk,
            frequency: Rate::from_khz(5),
        })
        .expect("5 kHz x 8 bit fits the 80 MHz APB clock");

    // 2. Канал 0 на GPIO15. Пін переміщується в канал — іншим кодом його вже не взяти.
    let mut channel0 = ledc.channel(channel::Number::Channel0, peripherals.GPIO15);
    channel0
        .configure(channel::config::Config {
            timer: &lstimer0,
            duty_pct: 0,
            drive_mode: DriveMode::PushPull,
        })
        .expect("channel 0 uses a configured timer");

    // 3. Заповнення через трейт embedded-hal `SetDutyCycle` — той самий виклик працює з будь-яким
    //    ШІМ (STM32, RP2040, nRF…). Максимум для 8 біт — 256 (`max_duty_cycle()`).
    channel0.set_duty_cycle(DUTY).expect("LEDC duty update cannot fail");

    // `loop()` у C++ порожній: сигнал генерує апаратний блок сам, процесор може спати.
    loop {
        Timer::after_secs(1).await;
    }
}

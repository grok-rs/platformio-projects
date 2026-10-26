//! Урок: ШІМ — те саме, що cpp/src/main.cpp: LEDC на GPIO15, 5000 Гц, 8 біт, 25 %.

#![no_std]
#![no_main]

use esp_backtrace as _;
use esp_hal::{
    clock::CpuClock,
    delay::Delay,
    gpio::DriveMode,
    ledc::{
        LSGlobalClkSource, Ledc, LowSpeed,
        channel::{self, ChannelIFace},
        timer::{self, TimerIFace},
    },
    main,
    time::Rate,
};
use esp_println::println;

esp_bootloader_esp_idf::esp_app_desc!();

#[main]
fn main() -> ! {
    let p = esp_hal::init(esp_hal::Config::default().with_cpu_clock(CpuClock::max()));
    let mut ledc = Ledc::new(p.LEDC);
    ledc.set_global_slow_clock(LSGlobalClkSource::APBClk);

    // 1. Таймер ШІМ: 5000 Гц, 8 біт → значення 0…255 (ledcSetup)
    let mut timer0 = ledc.timer::<LowSpeed>(timer::Number::Timer0);
    timer0
        .configure(timer::config::Config {
            duty: timer::config::Duty::Duty8Bit,
            clock_source: timer::LSClockSource::APBClk,
            frequency: Rate::from_khz(5),
        })
        .unwrap();

    // 2. Канал 0 на GPIO15 (ledcAttachPin)
    let mut channel0 = ledc.channel(channel::Number::Channel0, p.GPIO15);
    channel0
        .configure(channel::config::Config { timer: &timer0, duty_pct: 0, drive_mode: DriveMode::PushPull })
        .unwrap();

    // 3. Заповнення: 64 / 256 = 25 % часу HIGH (ledcWrite)
    channel0.set_duty(25).unwrap(); // esp-hal бере відсотки: 25 % від 256 = 64
    println!("LED PWM: GPIO15, 5000 Гц, 8 біт, duty 64/256 = 25 %");

    // loop() порожній: сигнал генерує LEDC сам
    let delay = Delay::new();
    loop {
        delay.delay_millis(1000);
    }
}

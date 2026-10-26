//! Крок 1 — те саме, що cpp/src/hold.cpp: LED світить, поки кнопку тримають.

#![no_std]
#![no_main]

use esp_backtrace as _;
use esp_hal::{
    clock::CpuClock,
    delay::Delay,
    gpio::{Input, InputConfig, Level, Output, OutputConfig, Pull},
    main,
};
use esp_println::println;

esp_bootloader_esp_idf::esp_app_desc!();

#[main]
fn main() -> ! {
    let p = esp_hal::init(esp_hal::Config::default().with_cpu_clock(CpuClock::max()));
    let mut led = Output::new(p.GPIO15, Level::Low, OutputConfig::default()); // GPIO15 → 220 Ом → LED → GND
    let button = Input::new(p.GPIO21, InputConfig::default().with_pull(Pull::Up)); // натиснута = LOW
    let delay = Delay::new();
    println!("=== ESP32-S3: LED follows button (hold) ===");

    let mut was_pressed = false;
    loop {
        let pressed = button.is_low();
        led.set_level(pressed.into()); // просто копіюємо стан кнопки на LED

        // друкуємо лише зміни
        if pressed != was_pressed {
            was_pressed = pressed;
            println!("{}", if pressed { "Button pressed  -> LED ON" } else { "Button released -> LED OFF" });
        }
        delay.delay_millis(1);
    }
}

//! ДЗ модуля 2.1, завдання 1–2: неблокуючий blink (`cargo run --release --bin blink`).
//!
//!   GPIO15 → резистор 220 Ω → анод LED → катод → GND
//!
//! Без Embassy й без `delay`: `main` — звичайний нескінченний цикл, який на кожному проході
//! питає `Blinker`, чи пора перемкнути LED.

#![no_std]
#![no_main]

use embedded_cpp::{
    Blinker, config,
    hw::{Led, millis},
};
use esp_backtrace as _;
use esp_hal::{clock::CpuClock, main};
use esp_println::println;

esp_bootloader_esp_idf::esp_app_desc!();

#[main]
fn main() -> ! {
    let peripherals = esp_hal::init(esp_hal::Config::default().with_cpu_clock(CpuClock::_240MHz));
    let mut led = Led::new(peripherals.GPIO15); // config::led::PIN

    println!();
    println!("=== ESP32-S3: non-blocking blink ===");
    println!("LED GPIO{}, interval {} ms", config::led::PIN, config::led::BLINK_INTERVAL_MS);

    // Стан — локальні змінні: `main` ніколи не повертається, тож глобальні не потрібні
    // (в Arduino їх вимагає поділ на setup() і loop()).
    let mut blinker = Blinker::new(config::led::BLINK_INTERVAL_MS);
    blinker.restart(millis());
    led.set(blinker.state());

    loop {
        led.set(blinker.update(millis()));
    }
}

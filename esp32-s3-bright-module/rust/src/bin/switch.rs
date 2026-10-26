//! ТЗ-A, етап 2 — те саме, що cpp/src/switch.cpp: GPIO5 HIGH і LOW по 3 с, без ШІМ.
//! Поки HIGH: LED світить, мультиметр між базою й емітером — U(БЕ) ≈ 0,6–0,8 В.

#![no_std]
#![no_main]

use esp_backtrace as _;
use esp_hal::{
    clock::CpuClock,
    delay::Delay,
    gpio::{Level, Output, OutputConfig},
    main,
};
use esp_println::println;

esp_bootloader_esp_idf::esp_app_desc!();

const HALF_MS: u32 = 3000;

#[main]
fn main() -> ! {
    let p = esp_hal::init(esp_hal::Config::default().with_cpu_clock(CpuClock::max()));
    let mut key = Output::new(p.GPIO5, Level::Low, OutputConfig::default()); // → 1 кОм → база 2N2222
    let delay = Delay::new();
    println!("Етап 2: GPIO5 HIGH/LOW по 3 с — міряйте U(БЕ), поки HIGH");

    loop {
        key.set_high();
        println!("GPIO5 HIGH: LED on");
        delay.delay_millis(HALF_MS);

        key.set_low();
        println!("GPIO5 LOW: LED off");
        delay.delay_millis(HALF_MS);
    }
}

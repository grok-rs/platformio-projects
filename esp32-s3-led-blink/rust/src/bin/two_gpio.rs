//! Червоний і синій LED по черзі — те саме, що cpp/src/two_gpio.cpp.

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

const STEP_MS: u32 = 500; // скільки мс світить кожен

#[main]
fn main() -> ! {
    let p = esp_hal::init(esp_hal::Config::default().with_cpu_clock(CpuClock::max()));
    let mut red = Output::new(p.GPIO4, Level::Low, OutputConfig::default()); // 220 Ом
    let mut blue = Output::new(p.GPIO5, Level::Low, OutputConfig::default()); // 100 Ом
    let delay = Delay::new();
    println!("LED blink: червоний GPIO4 / синій GPIO5 по черзі");

    loop {
        red.set_high(); blue.set_low(); // світить червоний
        delay.delay_millis(STEP_MS);
        red.set_low(); blue.set_high(); // світить синій
        delay.delay_millis(STEP_MS);
    }
}

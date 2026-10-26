//! Обидва LED на одному GPIO7 — те саме, що cpp/src/single_gpio.cpp.
//! HIGH → червоний, LOW → синій, вихід вимкнено (Hi-Z) → обидва згаслі.

#![no_std]
#![no_main]

use esp_backtrace as _;
use esp_hal::{
    clock::CpuClock,
    delay::Delay,
    gpio::{Flex, Level},
    main,
};
use esp_println::println;

esp_bootloader_esp_idf::esp_app_desc!();

const STEP_MS: u32 = 500; // мс на кожен стан

#[main]
fn main() -> ! {
    let p = esp_hal::init(esp_hal::Config::default().with_cpu_clock(CpuClock::max()));
    let mut led = Flex::new(p.GPIO7); // Flex — вивід, що на ходу стає то виходом, то входом
    let delay = Delay::new();
    println!("LED blink: обидва LED на GPIO7 (HIGH / LOW / Hi-Z)");

    loop {
        led.set_level(Level::High); // червоний
        led.set_output_enable(true); // pinMode(OUTPUT)
        delay.delay_millis(STEP_MS);
        led.set_level(Level::Low); // синій
        delay.delay_millis(STEP_MS);
        led.set_output_enable(false); // pinMode(INPUT): Hi-Z, обидва вимкнені
        delay.delay_millis(STEP_MS);
    }
}

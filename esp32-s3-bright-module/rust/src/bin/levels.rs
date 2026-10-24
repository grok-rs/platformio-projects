//! ТЗ-A «Яскравий модуль», основна прошивка (етап 4, ВП-1…ВП-8; `cargo run --release`):
//! кнопка перемикає яскравість LED по колу OFF → LOW → MID → HIGH → OFF.
//!
//!   +5 В MB-102 → LED → 220 Ом → колектор 2N2222, емітер → GND (спільна з ESP32)
//!   GPIO5 → 1 кОм → база                ШІМ LEDC 5 кГц, 8 біт
//!   3V3 → кнопка → GPIO6                підтяжка до GND, переривання на зростаючий фронт

#![no_std]
#![no_main]

use bright_module::{
    config,
    hw::{Button, LedcOutput, checked_pin, ledc, ledc_timer, run_levels},
};
use esp_backtrace as _;
use esp_hal::{clock::CpuClock, main};

esp_bootloader_esp_idf::esp_app_desc!();

#[main]
fn main() -> ! {
    let peripherals = esp_hal::init(esp_hal::Config::default().with_cpu_clock(CpuClock::max()));

    let ledc = ledc(peripherals.LEDC);
    let timer = ledc_timer(&ledc);
    let output = LedcOutput::new(&ledc, &timer, checked_pin(peripherals.GPIO5, config::pwm::PIN));

    let button = Button::new(checked_pin(peripherals.GPIO6, config::button::PIN), peripherals.IO_MUX);

    run_levels(output, &button)
}

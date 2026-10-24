//! ТЗ-A, етап 2 (`cargo run --release --bin switch`): GPIO5 як звичайний цифровий вихід, без ШІМ —
//! HIGH і LOW по 3 с. Поки HIGH: LED світить, мультиметр між базою й емітером показує
//! U(БЕ) ≈ 0,6–0,8 В, між колектором і емітером — U(КЕ) насичення (рівень «+»).

#![no_std]
#![no_main]

use bright_module::{
    config,
    hw::{checked_pin, millis, print_line},
};
use esp_backtrace as _;
use esp_hal::{
    clock::CpuClock,
    gpio::{Level, Output, OutputConfig},
    main,
};
use esp_println::println;

esp_bootloader_esp_idf::esp_app_desc!();

#[main]
fn main() -> ! {
    let peripherals = esp_hal::init(esp_hal::Config::default().with_cpu_clock(CpuClock::max()));
    let mut pin = Output::new(checked_pin(peripherals.GPIO5, config::pwm::PIN), Level::Low, OutputConfig::default());

    println!();
    println!("=== Bright module (TZ-A): stage 2, GPIO switch ===");
    println!(
        "GPIO{} toggles every {} ms: measure U(BE) while HIGH",
        config::pwm::PIN,
        config::switch::HALF_PERIOD_MS
    );

    let mut set = |level: Level, now_ms: u32| {
        pin.set_level(level);
        let text = if level == Level::High { "HIGH: LED on" } else { "LOW: LED off" };
        print_line(format_args!("GPIO{} {text}", config::pwm::PIN));
        now_ms
    };

    let mut level = Level::High;
    let mut last_toggle_ms = set(level, millis());
    loop {
        let now_ms = millis();
        if now_ms.wrapping_sub(last_toggle_ms) >= config::switch::HALF_PERIOD_MS {
            level = !level;
            last_toggle_ms = set(level, now_ms);
        }
    }
}

//! Крок 2 — те саме, що cpp/src/toggle.cpp: кожне натискання перемикає LED (з антибрязкотом).

#![no_std]
#![no_main]

use esp_backtrace as _;
use esp_hal::{
    clock::CpuClock,
    delay::Delay,
    gpio::{Input, InputConfig, Level, Output, OutputConfig, Pull},
    main,
    time::{Duration, Instant},
};
use esp_println::println;

esp_bootloader_esp_idf::esp_app_desc!();

const DEBOUNCE: Duration = Duration::from_millis(30); // брязкіт звичайної кнопки — до ~10 мс

#[main]
fn main() -> ! {
    let p = esp_hal::init(esp_hal::Config::default().with_cpu_clock(CpuClock::max()));
    let mut led = Output::new(p.GPIO15, Level::Low, OutputConfig::default());
    let button = Input::new(p.GPIO21, InputConfig::default().with_pull(Pull::Up)); // натиснута = LOW
    let delay = Delay::new();
    println!("=== ESP32-S3: button toggles LED ===");

    let mut led_on = false;
    let mut stable = true; // підтверджений рівень (відпущена = HIGH)
    let mut last_read = true; // останнє «сире» читання
    let mut last_change = Instant::now();
    let mut presses: u32 = 0;

    loop {
        let r = button.is_high();
        if r != last_read { last_read = r; last_change = Instant::now(); } // відскок — відлік заново

        // рівень тримається 30 мс і він новий — приймаємо
        if last_change.elapsed() >= DEBOUNCE && r != stable {
            stable = r;
            if !stable { // подія: натиснули (а не відпустили)
                led_on = !led_on;
                led.set_level(led_on.into());
                presses += 1;
                println!("Press #{presses} -> LED {}", if led_on { "ON" } else { "OFF" });
            }
        }
        delay.delay_millis(1);
    }
}

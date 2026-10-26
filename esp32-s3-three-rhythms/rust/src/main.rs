//! Проєкт A «Три ритми» — те саме, що cpp/src/main.cpp: три LED, три таймери, без delay.

#![no_std]
#![no_main]

use esp_backtrace as _;
use esp_hal::{
    clock::CpuClock,
    gpio::{Level, Output, OutputConfig},
    main,
    time::{Duration, Instant},
};
use esp_println::println;

esp_bootloader_esp_idf::esp_app_desc!();

// різні періоди
const T1: Duration = Duration::from_millis(200);
const T2: Duration = Duration::from_millis(500);
const T3: Duration = Duration::from_millis(1000);

#[main]
fn main() -> ! {
    let p = esp_hal::init(esp_hal::Config::default().with_cpu_clock(CpuClock::max()));
    let mut led1 = Output::new(p.GPIO6, Level::Low, OutputConfig::default()); // червоний
    let mut led2 = Output::new(p.GPIO5, Level::Low, OutputConfig::default()); // жовтий
    let mut led3 = Output::new(p.GPIO4, Level::Low, OutputConfig::default()); // зелений
    println!("Три ритми: 200 / 500 / 1000 мс");

    // у кожного LED — свій останній момент (стан пам'ятає сам вивід)
    let (mut last1, mut last2, mut last3) = (Instant::now(), Instant::now(), Instant::now());
    let mut loops: u32 = 0;
    let mut last_report = Instant::now();

    loop {
        let now = Instant::now(); // один «знімок часу» на весь прохід
        loops += 1;

        if now - last1 >= T1 { last1 = now; led1.toggle(); }
        if now - last2 >= T2 { last2 = now; led2.toggle(); }
        if now - last3 >= T3 { last3 = now; led3.toggle(); }

        if now - last_report >= Duration::from_millis(1000) {
            last_report = now;
            println!("Loops/s: {loops}");
            loops = 0;
        }
    }
}

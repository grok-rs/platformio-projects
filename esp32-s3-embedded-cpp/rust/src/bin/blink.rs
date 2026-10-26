//! ДЗ 2.1, завдання 1–2 — те саме, що cpp/src/blink.cpp: blink без delay і без магічних чисел.

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

// завдання 2: усі числа — в одній структурі (пін задає тип p.GPIO15)
struct Config;
impl Config {
    const BLINK: Duration = Duration::from_millis(500); // пів періоду: 1 Гц
}

// стан LED — enum, а не bool
#[derive(Clone, Copy, PartialEq, Eq)]
enum LedState { Off, On }

struct Led<'d> { pin: Output<'d>, state: LedState }

impl Led<'_> {
    fn set(&mut self, s: LedState) {
        self.state = s;
        self.pin.set_level(if s == LedState::On { Level::High } else { Level::Low });
    }
}

#[main]
fn main() -> ! {
    let p = esp_hal::init(esp_hal::Config::default().with_cpu_clock(CpuClock::max()));
    // GPIO15 → 220 Ом → LED → GND; створення = init(): ненастроєного LED не буває
    let mut led = Led { pin: Output::new(p.GPIO15, Level::Low, OutputConfig::default()), state: LedState::Off };
    println!("=== ESP32-S3: non-blocking blink ===");

    // стан — локальні змінні: main ніколи не повертається, глобальні не потрібні
    let mut last = Instant::now();
    loop {
        if last.elapsed() >= Config::BLINK {
            last = Instant::now();
            led.set(if led.state == LedState::On { LedState::Off } else { LedState::On });
        }
    }
}

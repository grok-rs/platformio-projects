//! Модуль 1.4 — те саме, що cpp/src/main.cpp: дві кнопки вибирають режим миготіння двох LED.
//!   режим 1 (старт) — обидва LED разом, 200 мс;  вмикає зовнішня кнопка
//!   режим 2         — LED по черзі, 1000 мс;     вмикає BOOT

#![no_std]
#![no_main]

use esp_backtrace as _;
use esp_hal::{
    clock::CpuClock,
    gpio::{Input, InputConfig, Level, Output, OutputConfig, Pull},
    main,
    time::{Duration, Instant},
};
use esp_println::println;

esp_bootloader_esp_idf::esp_app_desc!();

#[main]
fn main() -> ! {
    let p = esp_hal::init(esp_hal::Config::default().with_cpu_clock(CpuClock::max()));
    let mut led1 = Output::new(p.GPIO15, Level::Low, OutputConfig::default()); // → 220 Ом → LED → GND
    let mut led2 = Output::new(p.GPIO16, Level::Low, OutputConfig::default());
    let btn = Input::new(p.GPIO21, InputConfig::default().with_pull(Pull::Up)); // зовнішня кнопка → GND
    let boot = Input::new(p.GPIO0, InputConfig::default()); // BOOT, підтяжка вже є на платі
    println!("=== ESP32-S3: LEDs, external button + BOOT ===");
    println!("Start mode: 1 (sync, 200 ms)");

    let mut mode = 1; // «пам'ять» програми: змінюється лише кнопкою
    let mut phase = true; // перша чи друга половина такту
    let mut last = Instant::now();

    loop {
        // кнопки опитуються щопроходу; та сама кнопка ще раз — нічого не змінює
        let want = if btn.is_low() { 1 } else if boot.is_low() { 2 } else { mode };
        if want != mode {
            mode = want;
            phase = true; // новий режим — одразу з першої половини
            last = Instant::now();
            println!("{}", if mode == 1 { "Mode -> 1 (sync, 200 ms)" } else { "Mode -> 2 (alternate, 1000 ms)" });
        }

        let period = Duration::from_millis(if mode == 1 { 200 } else { 1000 });
        if last.elapsed() >= period {
            last = Instant::now();
            phase = !phase;
        }
        led1.set_level(phase.into());
        led2.set_level((if mode == 1 { phase } else { !phase }).into()); // режим 2: LED2 — навпаки
    }
}

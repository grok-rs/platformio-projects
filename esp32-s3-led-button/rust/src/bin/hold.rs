//! Урок, крок 1 — світлодіод світить, поки кнопку тримають (ESP32-S3-DevKitC-1).
//!
//!   GPIO15 → резистор 220 Ω → анод LED → катод → GND
//!   GPIO21 → кнопка → GND, вхід з підтяжкою вгору (натиснута = LOW)
//!
//! Програма щоразу читає кнопку й копіює її стан на світлодіод. Схема — у README.md.

#![no_std]
#![no_main]

use embassy_executor::Spawner;
use embassy_time::Timer;
use esp_backtrace as _;
use esp_hal::{
    clock::CpuClock,
    gpio::{Input, InputConfig, Level, Output, OutputConfig, Pull},
    timer::timg::TimerGroup,
};
use esp_println::println;

esp_bootloader_esp_idf::esp_app_desc!();

#[esp_rtos::main]
async fn main(_spawner: Spawner) -> ! {
    let peripherals = esp_hal::init(esp_hal::Config::default().with_cpu_clock(CpuClock::max()));
    let timg0 = TimerGroup::new(peripherals.TIMG0);
    esp_rtos::start(timg0.timer0, peripherals.FROM_CPU_INTR0);

    // Виводи «переміщуються» в драйвери: GPIO15 більше ніде не можна використати випадково.
    let mut led = Output::new(peripherals.GPIO15, Level::Low, OutputConfig::default());
    // Внутрішній резистор ~45 кОм до 3.3 В (INPUT_PULLUP).
    let button = Input::new(peripherals.GPIO21, InputConfig::default().with_pull(Pull::Up));

    println!();
    println!("=== ESP32-S3: LED follows button (hold) ===");
    println!("LED GPIO15, button GPIO21");

    let mut was_pressed = false;
    loop {
        let pressed = button.is_low();
        led.set_level(pressed.into()); // `Level: From<bool>` — true = HIGH

        // Друкуємо лише зміни, інакше монітор заллє тисячами рядків на секунду.
        if pressed != was_pressed {
            was_pressed = pressed;
            println!(
                "{}",
                if pressed { "Button pressed  -> LED ON" } else { "Button released -> LED OFF" }
            );
        }
        Timer::after_millis(1).await; // як delay(1), але не блокує процесор
    }
}

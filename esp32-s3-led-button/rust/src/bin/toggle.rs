//! Урок, крок 2 — кожне натискання кнопки перемикає світлодіод (ESP32-S3-DevKitC-1).
//!
//!   GPIO15 → резистор 220 Ω → анод LED → катод → GND
//!   GPIO21 → кнопка → GND, вхід з підтяжкою вгору (натиснута = LOW)
//!
//! На відміну від кроку 1, тут важлива не «натиснута зараз», а **подія** натискання —
//! перехід HIGH → LOW. Механічний контакт при цьому кілька мілісекунд брязкотить, тому
//! новий рівень приймаємо лише тоді, коли він тримається `DEBOUNCE` ([`Debouncer`]).

#![no_std]
#![no_main]

use embassy_executor::Spawner;
use embassy_time::{Duration, Instant, Ticker};
use esp_backtrace as _;
use esp_hal::{
    clock::CpuClock,
    gpio::{Input, InputConfig, Level, Output, OutputConfig, Pull},
    timer::timg::TimerGroup,
};
use esp_println::println;
use led_button::Debouncer;

esp_bootloader_esp_idf::esp_app_desc!();

const DEBOUNCE: Duration = Duration::from_millis(30); // брязкіт звичайної тактової кнопки — до ~10 мс

#[esp_rtos::main]
async fn main(_spawner: Spawner) -> ! {
    let peripherals = esp_hal::init(esp_hal::Config::default().with_cpu_clock(CpuClock::max()));
    let timg0 = TimerGroup::new(peripherals.TIMG0);
    esp_rtos::start(timg0.timer0, peripherals.FROM_CPU_INTR0);

    let mut led = Output::new(peripherals.GPIO15, Level::Low, OutputConfig::default());
    // Внутрішній резистор ~45 кОм до 3.3 В (INPUT_PULLUP).
    let button = Input::new(peripherals.GPIO21, InputConfig::default().with_pull(Pull::Up));

    println!();
    println!("=== ESP32-S3: button toggles LED ===");
    println!("LED GPIO15, button GPIO21, debounce {} ms", DEBOUNCE.as_millis());

    // Стан програми — локальні змінні, а не глобальні: їх бачить лише цей цикл.
    let mut debouncer = Debouncer::new(DEBOUNCE);
    let mut led_on = false;
    let mut press_count: u32 = 0;
    let mut ticker = Ticker::every(Duration::from_millis(1)); // опитування щомілісекунди

    loop {
        if debouncer.pressed(button.is_high(), Instant::now()) {
            led_on = !led_on;
            led.set_level(led_on.into());
            press_count += 1;
            println!("Press #{press_count} -> LED {}", if led_on { "ON" } else { "OFF" });
        }
        ticker.next().await;
    }
}

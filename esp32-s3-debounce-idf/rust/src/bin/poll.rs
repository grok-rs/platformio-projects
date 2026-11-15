//! Завдання 4 — те саме, що cpp/src/poll.c, але Rust поверх ESP-IDF: без переривань.
//! Кожні POLL_MS читаємо кнопку, debounce — машина станів IDLE → PRESSED → HELD → RELEASE → IDLE.
//! Рівень мусить протриматися STABLE_US.
//! Очікуємо: найстабільніша поведінка, реакція трохи більша (STABLE_US + період опитування).

use esp_idf_svc::hal::{
    delay::TickType,
    gpio::{PinDriver, Pull},
    peripherals::Peripherals,
};
use esp_idf_svc::sys::{EspError, esp_timer_get_time, xTaskDelayUntil, xTaskGetTickCount};

const POLL_MS: u64 = 10;
const STABLE_US: i64 = 50_000;
const LONG_US: i64 = 2_000_000; // довше — довге натискання

enum State {
    Idle,
    Pressed,
    Held,
    Release,
}

fn main() -> Result<(), EspError> {
    esp_idf_svc::sys::link_patches();
    let p = Peripherals::take()?;
    let button = PinDriver::input(p.pins.gpio7, Pull::Floating)?; // кнопка на GND, підтяжка 10 кОм до 3V3; без переривання
    let mut led = PinDriver::output(p.pins.gpio15)?; // LED через 220 Ом: перемикається на кожне прийняте натискання

    println!("Завдання 4: опитування кожні {POLL_MS} мс + машина станів");
    let mut state = State::Idle;
    let (mut since, mut pressed_at) = (0i64, 0i64);
    let (mut presses, mut bounces) = (0u32, 0u32);
    // SAFETY: функції FreeRTOS без передумов, викликаємо із задачі
    let mut wake = unsafe { xTaskGetTickCount() };
    loop {
        // Рівно кожні POLL_MS, скільки б не тривав код нижче (vTaskDelayUntil у C)
        unsafe { xTaskDelayUntil(&mut wake, TickType::new_millis(POLL_MS).ticks()) };
        let down = button.is_low();
        let now = unsafe { esp_timer_get_time() };

        state = match state {
            State::Idle if down => {
                since = now;
                State::Pressed
            }
            State::Pressed if !down => {
                bounces += 1; // відскочило: це ще брязкіт
                State::Idle
            }
            State::Pressed if now - since >= STABLE_US => {
                pressed_at = since;
                presses += 1;
                led.set_level((presses & 1 == 1).into())?;
                println!("натискань: {presses}, відскоків: {bounces}, реакція: {} мкс", now - since);
                State::Held
            }
            State::Held if !down => {
                since = now;
                State::Release
            }
            State::Release if down => {
                bounces += 1; // брязкіт відпускання
                State::Held
            }
            State::Release if now - since >= STABLE_US => {
                let kind = if since - pressed_at < LONG_US { "коротке" } else { "довге" };
                println!("{kind} натискання");
                State::Idle
            }
            unchanged => unchanged,
        };
    }
}

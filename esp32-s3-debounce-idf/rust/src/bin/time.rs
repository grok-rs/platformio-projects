//! Завдання 2 — те саме, що cpp/src/time.c, але Rust поверх ESP-IDF: debounce за часом.
//! ISR лише кладе час переривання в чергу FreeRTOS, а рішення приймає main:
//! менше ніж DEBOUNCE_US від попереднього переривання — ігноруємо.
//! Очікуємо: хибних менше, але брязкіт відпускання все ще може дати зайве натискання.

use std::ffi::c_void;
use std::sync::OnceLock;

use esp_idf_svc::hal::{
    delay::TickType,
    gpio::{InterruptType, PinDriver, Pull},
    peripherals::Peripherals,
    task::{do_yield, queue::Queue},
};
use esp_idf_svc::sys::{EspError, esp, esp_timer_get_time, gpio_install_isr_service, gpio_isr_handler_add};

const DEBOUNCE_US: i64 = 50_000;
const QUIET_MS: u64 = 200; // друкуємо підсумок, коли стало тихо

static EDGES: OnceLock<Queue<i64>> = OnceLock::new(); // час кожного переривання, мкс

/// Обробник переривання кнопки: лише записує час у чергу.
unsafe extern "C" fn on_fall(_arg: *mut c_void) {
    // SAFETY: esp_timer_get_time можна викликати з переривання
    let t = unsafe { esp_timer_get_time() };
    if let Some(edges) = EDGES.get() {
        if let Ok(true) = edges.send_back(t, 0) {
            do_yield(); // розбудили задачу з вищим пріоритетом — перемикаємося одразу
        }
    }
}

fn main() -> Result<(), EspError> {
    esp_idf_svc::sys::link_patches();
    let p = Peripherals::take()?;
    let edges = EDGES.get_or_init(|| Queue::new(64));
    let mut button = PinDriver::input(p.pins.gpio7, Pull::Floating)?; // кнопка на GND, підтяжка 10 кОм до 3V3
    let mut led = PinDriver::output(p.pins.gpio15)?; // LED через 220 Ом: перемикається на кожне прийняте натискання

    // Як у C: обробник esp-idf-hal вимикає переривання після кожного спрацювання і загубив би брязкіт
    button.set_interrupt_type(InterruptType::NegEdge)?;
    // SAFETY: on_fall лише читає таймер і пише в чергу FreeRTOS, а це дозволено в перериванні
    unsafe {
        esp!(gpio_install_isr_service(0))?;
        esp!(gpio_isr_handler_add(button.pin().into(), Some(on_fall), std::ptr::null_mut()))?;
    }

    println!("Завдання 2: debounce за часом, {} мс", DEBOUNCE_US / 1000);
    let mut last = -DEBOUNCE_US;
    let mut reaction = 0;
    let (mut accepted, mut ignored) = (0u32, 0u32);
    let mut fresh = false;
    loop {
        let Some((t, _)) = edges.recv_front(TickType::new_millis(QUIET_MS).ticks()) else {
            if fresh {
                println!("прийнято: {accepted}, відкинуто: {ignored}, реакція: {reaction} мкс");
            }
            fresh = false;
            continue;
        };
        fresh = true;
        let ok = t - last >= DEBOUNCE_US;
        last = t; // рахуємо від попереднього переривання, не від прийнятого
        if !ok {
            ignored += 1;
            continue;
        }
        accepted += 1;
        led.set_level((accepted & 1 == 1).into())?;
        // SAFETY: esp_timer_get_time не має передумов
        reaction = unsafe { esp_timer_get_time() } - t;
    }
}

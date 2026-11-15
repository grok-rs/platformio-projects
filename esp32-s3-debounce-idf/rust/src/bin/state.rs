//! Завдання 3 — те саме, що cpp/src/state.c, але Rust поверх ESP-IDF: debounce за рівнем.
//! ISR лише сигналізує «подія», а main чекає, поки брязкіт затихне, і приймає подію,
//! тільки якщо кнопка досі натиснута. Відпускання нічого не робить.
//! Очікуємо: рівно 1 реакція на 1 натискання.

use std::ffi::c_void;
use std::sync::OnceLock;
use std::sync::atomic::{AtomicU32, Ordering::Relaxed};

use esp_idf_svc::hal::{
    delay::{BLOCK, FreeRtos, NON_BLOCK},
    gpio::{InterruptType, PinDriver, Pull},
    peripherals::Peripherals,
    task::{do_yield, queue::Queue},
};
use esp_idf_svc::sys::{EspError, esp, esp_timer_get_time, gpio_install_isr_service, gpio_isr_handler_add};

const DEBOUNCE_MS: u32 = 50;

// Черга на 1 порожній елемент — це і є двійковий семафор FreeRTOS (xSemaphoreCreateBinary у C)
static EVENT: OnceLock<Queue<()>> = OnceLock::new();
static EDGES: AtomicU32 = AtomicU32::new(0); // скільки переривань було насправді

/// Обробник переривання кнопки: рахує й сигналізує задачі.
unsafe extern "C" fn on_fall(_arg: *mut c_void) {
    EDGES.fetch_add(1, Relaxed);
    if let Some(event) = EVENT.get() {
        if let Ok(true) = event.send_back((), 0) {
            do_yield();
        }
    }
}

fn main() -> Result<(), EspError> {
    esp_idf_svc::sys::link_patches();
    let p = Peripherals::take()?;
    let event = EVENT.get_or_init(|| Queue::new(1));
    let mut button = PinDriver::input(p.pins.gpio7, Pull::Floating)?; // кнопка на GND, підтяжка 10 кОм до 3V3
    let mut led = PinDriver::output(p.pins.gpio15)?; // LED через 220 Ом: перемикається на кожне прийняте натискання

    // Як у C: обробник esp-idf-hal вимикає переривання після кожного спрацювання і загубив би брязкіт
    button.set_interrupt_type(InterruptType::NegEdge)?;
    // SAFETY: on_fall лише пише атомарний лічильник і чергу FreeRTOS, а це дозволено в перериванні
    unsafe {
        esp!(gpio_install_isr_service(0))?;
        esp!(gpio_isr_handler_add(button.pin().into(), Some(on_fall), std::ptr::null_mut()))?;
    }

    println!("Завдання 3: debounce за рівнем, {DEBOUNCE_MS} мс");
    let (mut presses, mut ignored) = (0u32, 0u32);
    loop {
        event.recv_front(BLOCK);
        // SAFETY: esp_timer_get_time не має передумов
        let t0 = unsafe { esp_timer_get_time() };
        FreeRtos::delay_ms(DEBOUNCE_MS); // чекає лише ця задача, не весь чип

        if button.is_high() {
            ignored += 1; // уже HIGH: це був брязкіт відпускання або завада
            continue;
        }

        presses += 1;
        led.set_level((presses & 1 == 1).into())?;
        let reaction = unsafe { esp_timer_get_time() } - t0;
        println!(
            "натискань: {presses}, відкинуто подій: {ignored}, переривань: {}, реакція: {reaction} мкс",
            EDGES.load(Relaxed)
        );

        while button.is_low() {
            FreeRtos::delay_ms(10); // довге утримання — одна реакція
        }
        FreeRtos::delay_ms(DEBOUNCE_MS); // брязкіт відпускання затихає
        event.recv_front(NON_BLOCK); // і його подію теж прибираємо
    }
}

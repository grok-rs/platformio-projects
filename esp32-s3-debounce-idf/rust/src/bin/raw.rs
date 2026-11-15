//! Завдання 1 — те саме, що cpp/src/raw.c, але Rust поверх ESP-IDF: переривання на FALLING лише рахує,
//! debounce немає. Очікуємо: одне натискання дає кілька переривань, і при відпусканні вони теж бувають.

use std::ffi::c_void;
use std::sync::atomic::{AtomicU32, Ordering::Relaxed};

use esp_idf_svc::hal::{
    delay::FreeRtos,
    gpio::{InterruptType, PinDriver, Pull},
    peripherals::Peripherals,
};
use esp_idf_svc::sys::{EspError, esp, gpio_install_isr_service, gpio_isr_handler_add};

static COUNT: AtomicU32 = AtomicU32::new(0); // пише ISR, читає main

/// Обробник переривання кнопки: лише рахує.
unsafe extern "C" fn on_fall(_arg: *mut c_void) {
    COUNT.fetch_add(1, Relaxed);
}

fn main() -> Result<(), EspError> {
    esp_idf_svc::sys::link_patches();
    let p = Peripherals::take()?;
    let mut button = PinDriver::input(p.pins.gpio7, Pull::Floating)?; // кнопка на GND, підтяжка 10 кОм до 3V3
    let mut led = PinDriver::output(p.pins.gpio15)?; // LED через 220 Ом: перемикається на кожне переривання

    // Переривання підключаємо тими самими викликами ESP-IDF, що й у C: обробник esp-idf-hal вимикає
    // переривання після кожного спрацювання, і брязкіт, який ми тут рахуємо, загубився б.
    button.set_interrupt_type(InterruptType::NegEdge)?;
    // SAFETY: on_fall лише збільшує атомарний лічильник, а це дозволено в перериванні
    unsafe {
        esp!(gpio_install_isr_service(0))?;
        esp!(gpio_isr_handler_add(button.pin().into(), Some(on_fall), std::ptr::null_mut()))?;
    }

    println!("Завдання 1: лише переривання");
    let mut shown = 0;
    loop {
        let count = COUNT.load(Relaxed);
        if count != shown {
            shown = count;
            led.set_level((shown & 1 == 1).into())?;
            println!("переривань: {shown}");
        }
        FreeRtos::delay_ms(10);
    }
}

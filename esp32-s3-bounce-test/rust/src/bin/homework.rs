//! ДЗ модуля 1.5 — те саме, що cpp/src/homework.cpp: лічильник переривань FALLING, кнопка на GPIO21.

#![no_std]
#![no_main]

use core::cell::RefCell;
use core::sync::atomic::{AtomicU32, Ordering};

use critical_section::Mutex;
use esp_backtrace as _;
use esp_hal::{
    clock::CpuClock,
    delay::Delay,
    gpio::{Event, Input, InputConfig, Io, Pull},
    handler, main, ram,
};
use esp_println::println;

esp_bootloader_esp_idf::esp_app_desc!();

// лічильник, який змінює переривання (у C++ — volatile)
static BUTTON_COUNTER: AtomicU32 = AtomicU32::new(0);
// кнопка потрібна обробнику, щоб скинути прапорець переривання
static BUTTON: Mutex<RefCell<Option<Input<'static>>>> = Mutex::new(RefCell::new(None));

// обробник переривання у внутрішній RAM (#[ram] = IRAM_ATTR)
#[handler]
#[ram]
fn button_isr() {
    critical_section::with(|cs| {
        if let Some(b) = BUTTON.borrow_ref_mut(cs).as_mut() {
            b.clear_interrupt();
        }
    });
    BUTTON_COUNTER.fetch_add(1, Ordering::Relaxed);
}

#[main]
fn main() -> ! {
    let p = esp_hal::init(esp_hal::Config::default().with_cpu_clock(CpuClock::max()));
    let mut button = Input::new(p.GPIO21, InputConfig::default().with_pull(Pull::Up)); // в умові — GPIO16

    // FALLING: спрацьовує при натисканні (перехід з 1 в 0)
    let mut io = Io::new(p.IO_MUX);
    io.set_interrupt_handler(button_isr);
    button.listen(Event::FallingEdge);
    critical_section::with(|cs| BUTTON.borrow_ref_mut(cs).replace(button));

    let delay = Delay::new();
    let mut last_count = 0;
    loop {
        let count = BUTTON_COUNTER.load(Ordering::Relaxed);
        if count != last_count {
            last_count = count;
            println!("Button Pressed! Count: {last_count}");
        }
        delay.delay_millis(10);
    }
}

//! ТЗ-A, рівень «+» — те саме, що cpp/src/softpwm.cpp: як levels, але ШІМ формує процесор
//! за мілісекундами, без LEDC. Період 10 мс: «увімкнено» лише 0…10 цілих мс.

#![no_std]
#![no_main]

use core::{
    cell::RefCell,
    sync::atomic::{AtomicBool, Ordering},
};

use critical_section::Mutex;
use esp_backtrace as _;
use esp_hal::{
    clock::CpuClock,
    gpio::{Event, Input, InputConfig, Io, Level, Output, OutputConfig, Pull},
    handler, main, ram,
    time::{Duration, Instant},
};
use esp_println::{print, println};

esp_bootloader_esp_idf::esp_app_desc!();

const PERIOD_MS: u64 = 10; // період програмного ШІМ
const LEVELS: [u8; 4] = [0, 40, 128, 255];
const NAMES: [&str; 4] = ["OFF", "LOW", "MID", "HIGH"];
const DEBOUNCE: Duration = Duration::from_millis(50);

static EDGE: AtomicBool = AtomicBool::new(false); // обробник лише ставить прапорець
static BUTTON: Mutex<RefCell<Option<Input<'static>>>> = Mutex::new(RefCell::new(None));

#[handler]
#[ram]
fn on_button() {
    critical_section::with(|cs| {
        if let Some(button) = BUTTON.borrow_ref_mut(cs).as_mut() {
            button.clear_interrupt();
        }
    });
    EDGE.store(true, Ordering::Relaxed);
}

fn pressed() -> bool {
    critical_section::with(|cs| BUTTON.borrow_ref(cs).as_ref().is_some_and(Input::is_high))
}

fn print_level(level: usize) {
    let duty = LEVELS[level];
    println!("{} (duty {duty}, {}%)", NAMES[level], (u32::from(duty) * 100 + 127) / 255);
}

#[main]
fn main() -> ! {
    let p = esp_hal::init(esp_hal::Config::default().with_cpu_clock(CpuClock::max()));
    let mut key = Output::new(p.GPIO5, Level::Low, OutputConfig::default()); // → 1 кОм → база 2N2222

    let mut io = Io::new(p.IO_MUX);
    io.set_interrupt_handler(on_button);
    let mut button = Input::new(p.GPIO6, InputConfig::default().with_pull(Pull::Down));
    critical_section::with(|cs| {
        button.listen(Event::RisingEdge);
        BUTTON.borrow_ref_mut(cs).replace(button);
    });

    println!("Яскравий модуль: програмний ШІМ, період 10 мс (millis)");
    let mut level = 0;
    let mut presses: u32 = 0;
    print!("Level: ");
    print_level(level);

    let mut waiting = false;
    let mut edge_at = Instant::now();

    loop {
        let now = Instant::now();

        // кнопка — як у levels
        if EDGE.load(Ordering::Relaxed) && !waiting {
            waiting = true;
            edge_at = now;
        }
        if waiting && now - edge_at >= DEBOUNCE {
            waiting = false;
            EDGE.store(false, Ordering::Relaxed);
            if pressed() {
                presses += 1;
                print!("Press #{presses} -> ");
                level = (level + 1) % 4;
                print_level(level);
            }
        }

        // ШІМ: на початку кожного періоду HIGH, поки не мине частка duty/255 періоду
        let on_ms = u64::from(LEVELS[level]) * PERIOD_MS / 255;
        let ms = now.duration_since_epoch().as_millis();
        key.set_level(Level::from(ms % PERIOD_MS < on_ms));
    }
}

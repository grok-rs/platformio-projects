//! Модуль 2.2, ДЗ 1 — те саме, що cpp/src/relay.cpp: час спрацювання (увімкнення)
//! і відпускання (вимкнення) реле, 10 циклів.

#![no_std]
#![no_main]

use core::{
    cell::RefCell,
    sync::atomic::{AtomicU32, Ordering::Relaxed},
};

use critical_section::Mutex;
use esp_backtrace as _;
use esp_hal::{
    clock::CpuClock,
    delay::Delay,
    gpio::{Event, Input, InputConfig, Io, Level, Output, OutputConfig, Pull},
    handler, main, ram,
    time::Instant,
};
use esp_println::{print, println};

esp_bootloader_esp_idf::esp_app_desc!();

const CYCLES: usize = 10; // циклів «увімкнути — вимкнути»
const WAIT_MS: u32 = 50; // після команди: реле перемкнеться (≤ 10 мс за даташитом) і брязкіт стихне
const PAUSE_MS: u32 = 1000; // між перемиканнями: SRD-05 — до 30 перемикань на хвилину

// обробник пише, main читає; u32 мкс — як micros() в Arduino (AtomicU64 на Xtensa немає)
static FIRST_EDGE: AtomicU32 = AtomicU32::new(0); // мкс першого фронту — момент спрацювання
static LAST_EDGE: AtomicU32 = AtomicU32::new(0); // мкс останнього фронту — кінець брязкоту
static EDGES: AtomicU32 = AtomicU32::new(0); // скільки фронтів побачило переривання
// контакт (GPIO5) потрібен обробнику, щоб скинути переривання
static CONTACT: Mutex<RefCell<Option<Input<'static>>>> = Mutex::new(RefCell::new(None));

/// Як `micros()`: мікросекунди від старту, переповнюється через ≈ 71,6 хв.
fn micros() -> u32 {
    Instant::now().duration_since_epoch().as_micros() as u32
}

/// Брязкіт дає кілька фронтів на одне перемикання. Час беремо лише з першого,
/// наступні тільки зсувають LAST_EDGE — так видно, скільки тривав брязкіт.
#[handler]
#[ram]
fn on_contact() {
    let t = micros();
    critical_section::with(|cs| {
        if let Some(contact) = CONTACT.borrow_ref_mut(cs).as_mut() {
            contact.clear_interrupt(); // інакше обробник викликатиметься без кінця
        }
    });
    if EDGES.load(Relaxed) == 0 {
        FIRST_EDGE.store(t, Relaxed);
    }
    LAST_EDGE.store(t, Relaxed);
    EDGES.fetch_add(1, Relaxed);
}

/// Перемикає реле, друкує рядок і повертає час від команди до першого фронту контакту, мкс.
fn measure(relay: &mut Output, on: bool, cycle: usize) -> Option<u32> {
    EDGES.store(0, Relaxed); // контакт після паузи стоїть, обробник зараз не спрацює
    let t0 = micros();
    relay.set_level(Level::from(on));
    Delay::new().delay_millis(WAIT_MS); // тим часом обробник ловить фронти

    print!("#{:<2} {} ", cycle + 1, if on { "увімк" } else { "вимк " });
    let edges = EDGES.load(Relaxed);
    if edges == 0 {
        println!("фронту немає: COM → GND? NO → GPIO5? реле клацає?");
        return None;
    }
    let first = FIRST_EDGE.load(Relaxed);
    let bounce = LAST_EDGE.load(Relaxed).wrapping_sub(first);
    println!("{:5} мкс  брязкіт {bounce:4} мкс  фронтів {edges}", first.wrapping_sub(t0));
    Some(first.wrapping_sub(t0))
}

fn summary(name: &str, us: &[Option<u32>]) {
    let valid = || us.iter().flatten().copied(); // вимірювання без фронту не рахуємо
    let n = valid().count();
    if n == 0 {
        println!("{name}: жодного вимірювання");
        return;
    }
    let sum: u32 = valid().sum();
    let (lo, hi) = (valid().min().unwrap_or(0), valid().max().unwrap_or(0));
    println!("{name}: середнє {} мкс, мін {lo}, макс {hi} ({n} з {CYCLES})", sum / n as u32);
}

#[main]
fn main() -> ! {
    let p = esp_hal::init(esp_hal::Config::default().with_cpu_clock(CpuClock::max()));
    // GPIO2 → 10 кОм → BC547B → IN модуля реле; LOW — реле вимкнене
    let mut relay = Output::new(p.GPIO2, Level::Low, OutputConfig::default());

    // COM → GND, NO → GPIO5 з підтяжкою до 3V3: розімкнений = HIGH, замкнений = LOW
    let mut io = Io::new(p.IO_MUX);
    io.set_interrupt_handler(on_contact);
    let mut contact = Input::new(p.GPIO5, InputConfig::default().with_pull(Pull::Up));
    critical_section::with(|cs| {
        contact.listen(Event::AnyEdge); // брязкіт — фронти в обидва боки
        CONTACT.borrow_ref_mut(cs).replace(contact);
    });

    let delay = Delay::new();
    delay.delay_millis(2000); // монітор порту встигає під'єднатися після прошивки
    println!("Реле: час від команди (GPIO2) до першого фронту контакту NO (GPIO5), 10 циклів");

    let mut on_us = [None; CYCLES]; // результати, мкс; None — фронту не було
    let mut off_us = [None; CYCLES];
    let mut cycle = 0;

    loop {
        if cycle == CYCLES {
            continue; // серію виміряно; нова серія — кнопка RST
        }

        on_us[cycle] = measure(&mut relay, true, cycle);
        delay.delay_millis(PAUSE_MS);
        off_us[cycle] = measure(&mut relay, false, cycle);
        delay.delay_millis(PAUSE_MS);

        cycle += 1;
        if cycle == CYCLES {
            summary("Увімкнення", &on_us);
            summary("Вимкнення", &off_us);
        }
    }
}

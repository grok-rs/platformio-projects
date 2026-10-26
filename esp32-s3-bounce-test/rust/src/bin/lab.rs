//! Брязкіт кнопки — те саме, що cpp/src/main.cpp: переривання на обидва фронти записує час
//! кожного фронту, головний цикл після 50 мс тиші друкує звіт про подію.

#![no_std]
#![no_main]

use core::cell::RefCell;
use core::fmt::Write as _;

use critical_section::Mutex;
use esp_backtrace as _;
use esp_hal::{
    clock::CpuClock,
    gpio::{Event, Input, InputConfig, Io, Level, Output, OutputConfig, Pull},
    handler, main, ram,
    time::Instant,
    uart::{self, UartTx},
};
use esp_println::{print, println};

esp_bootloader_esp_idf::esp_app_desc!();

const QUIET_US: u32 = 50_000; // 50 мс без фронтів = подія закінчилась
const MAX_EDGES: usize = 64;

// спільне з перериванням: кнопка, мітка BOUNCE (GPIO40), часи фронтів, їх кількість, останній фронт
struct Shared {
    button: Input<'static>,
    bounce: Output<'static>,
    times: [u32; MAX_EDGES],
    count: u32,
    last_us: u32,
}
static SHARED: Mutex<RefCell<Option<Shared>>> = Mutex::new(RefCell::new(None));

// мікросекунди від старту, обрізані до 32 біт — як micros()
fn micros() -> u32 {
    Instant::now().duration_since_epoch().as_micros() as u32
}

// обробник: лише записати час, друкує головний цикл
#[handler]
#[ram]
fn on_edge() {
    let now = micros();
    critical_section::with(|cs| {
        let mut shared = SHARED.borrow_ref_mut(cs);
        let Some(s) = shared.as_mut() else { return };
        s.button.clear_interrupt();
        if (s.count as usize) < MAX_EDGES {
            s.times[s.count as usize] = now;
        }
        s.count += 1;
        s.last_us = now;
        if s.count == 2 {
            s.bounce.set_high(); // другий фронт = брязкіт
        }
    });
}

#[main]
fn main() -> ! {
    let p = esp_hal::init(esp_hal::Config::default().with_cpu_clock(CpuClock::max()));
    let mut button = Input::new(p.GPIO21, InputConfig::default().with_pull(Pull::Up));
    let bounce = Output::new(p.GPIO40, Level::Low, OutputConfig::default());
    let mut label = UartTx::new(p.UART1, uart::Config::default().with_baudrate(115_200))
        .unwrap()
        .with_tx(p.GPIO41); // лише TX
    let mut stable_low = button.is_low(); // рівень після попередньої події
    let (mut presses, mut releases, mut glitches) = (0u32, 0u32, 0u32);

    let mut io = Io::new(p.IO_MUX);
    io.set_interrupt_handler(on_edge);
    button.listen(Event::AnyEdge); // CHANGE
    critical_section::with(|cs| {
        SHARED.borrow_ref_mut(cs).replace(Shared {
            button,
            bounce,
            times: [0; MAX_EDGES],
            count: 0,
            last_us: 0,
        });
    });
    println!("=== ESP32-S3: button bounce test ===");
    println!("Button GPIO21, interrupt CHANGE, event ends after 50 ms of quiet");

    loop {
        // подія закінчилась? тоді забрати дані в критичній секції
        let event = critical_section::with(|cs| {
            let mut shared = SHARED.borrow_ref_mut(cs);
            let s = shared.as_mut()?;
            if s.count == 0 || micros().wrapping_sub(s.last_us) < QUIET_US {
                return None;
            }
            let count = s.count;
            s.count = 0;
            s.bounce.set_low();
            Some((s.times, count, s.button.is_low()))
        });
        let Some((t, count, low)) = event else {
            continue;
        };

        // рівень став LOW — натиснули, HIGH — відпустили, не змінився — короткий імпульс
        let changed = low != stable_low;
        stable_low = low;
        let (kind, counter) = match (changed, low) {
            (false, _) => ("GLITCH", &mut glitches),
            (true, true) => ("PRESS", &mut presses),
            (true, false) => ("RELEASE", &mut releases),
        };
        *counter += 1;
        let index = *counter;
        // зміна рівня = непарна кількість фронтів; інша парність — ISR загубила фронт
        let missed = (count % 2 == 1) != changed;

        let t = &t[..(count as usize).min(MAX_EDGES)];
        let bounce = t[t.len() - 1].wrapping_sub(t[0]);
        let gaps = t.windows(2).map(|w| w[1].wrapping_sub(w[0]));

        print!("{kind:<7} #{index:<3} edges={count:<3} bounce={bounce:>6} us");
        if let Some(shortest) = gaps.clone().min() {
            print!("  shortest={shortest} us");
        }
        if count == 1 {
            print!("  (clean, no bounce)");
        }
        if missed {
            print!("  [ISR missed >=1 edge - see analyzer]");
        }
        println!();
        if t.len() > 1 {
            // інтервали між фронтами — як курсори в аналізаторі (перші 10)
            print!("        gaps us:");
            gaps.take(10).for_each(|g| print!(" {g}"));
            println!("{}", if t.len() > 11 { " ..." } else { "" });
        }
        let missed = if missed { " MISSED" } else { "" };
        let _ = writeln!(label, "{kind}#{index} e={count} {bounce}us{missed}");
    }
}

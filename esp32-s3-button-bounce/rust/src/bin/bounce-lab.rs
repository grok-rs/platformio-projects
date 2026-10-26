//! Модуль 1.5 — те саме, що cpp/src/main.cpp: переривання на обидва фронти записує час і рівень
//! кожного фронту, головний цикл після 50 мс тиші друкує рядок про подію.

#![no_std]
#![no_main]

use core::cell::RefCell;

use critical_section::Mutex;
use esp_backtrace as _;
use esp_hal::{
    clock::CpuClock,
    gpio::{Event, Input, InputConfig, Io, Level, Output, OutputConfig, Pull},
    handler, main, ram,
    time::Instant,
};
use esp_println::{print, println};

esp_bootloader_esp_idf::esp_app_desc!();

const QUIET_US: u32 = 50_000; // 50 мс без фронтів = подія закінчилась
const MAX_EDGES: usize = 64;
const SHOW_EDGES: usize = 12; // скільки фронтів розписати в рядку

// спільне з перериванням: кнопка, маркер ISR (GPIO17), часи й рівні фронтів, їх кількість
struct Shared {
    button: Input<'static>,
    marker: Output<'static>,
    times: [u32; MAX_EDGES],
    high: [bool; MAX_EDGES],
    count: u32,
    last_us: u32,
}
static SHARED: Mutex<RefCell<Option<Shared>>> = Mutex::new(RefCell::new(None));

// мікросекунди від старту, обрізані до 32 біт — як micros()
fn micros() -> u32 {
    Instant::now().duration_since_epoch().as_micros() as u32
}

// обробник: лише записати час і рівень, друкує головний цикл
#[handler]
#[ram]
fn on_edge() {
    critical_section::with(|cs| {
        let mut shared = SHARED.borrow_ref_mut(cs);
        let Some(s) = shared.as_mut() else { return };
        s.marker.set_high(); // маркер ISR: HIGH
        let now = micros();
        let i = s.count as usize;
        if i < MAX_EDGES {
            s.times[i] = now;
            s.high[i] = s.button.is_high();
        }
        s.count += 1;
        s.last_us = now;
        s.button.clear_interrupt();
        s.marker.set_low(); // маркер ISR: LOW
    });
}

fn print_header() {
    println!(
        "  #  event    edges  fall  rise  bounce,us  min gap,us  edges, us from the first (v = LOW, ^ = HIGH)"
    );
    println!(
        "---  -------  -----  ----  ----  ---------  ----------  ----------------------------------------------"
    );
}

#[main]
fn main() -> ! {
    let p = esp_hal::init(esp_hal::Config::default().with_cpu_clock(CpuClock::max()));
    let mut button = Input::new(p.GPIO16, InputConfig::default().with_pull(Pull::Up));
    let marker = Output::new(p.GPIO17, Level::Low, OutputConfig::default());
    let mut stable_high = button.is_high(); // рівень після попередньої події
    let (mut presses, mut releases, mut fall_total) = (0u32, 0u32, 0u32);
    let (mut press_max_us, mut release_max_us) = (0u32, 0u32);

    let mut io = Io::new(p.IO_MUX);
    io.set_interrupt_handler(on_edge);
    button.listen(Event::AnyEdge); // CHANGE
    critical_section::with(|cs| {
        SHARED.borrow_ref_mut(cs).replace(Shared {
            button,
            marker,
            times: [0; MAX_EDGES],
            high: [false; MAX_EDGES],
            count: 0,
            last_us: 0,
        });
    });
    println!("=== ESP32-S3: button bounce lab (module 1.5) ===");
    println!("Button GPIO16, interrupt CHANGE, ISR marker GPIO17, event ends after 50 ms of quiet");
    print_header();

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
            Some((s.times, s.high, count, s.button.is_high()))
        });
        let Some((times, high, count, now_high)) = event else {
            continue;
        };

        // став LOW — натиснули, став HIGH — відпустили, не змінився — завада (glitch)
        let press = !now_high && stable_high;
        let release = now_high && !stable_high;
        stable_high = now_high;

        let n = (count as usize).min(MAX_EDGES);
        let (t, high) = (&times[..n], &high[..n]);
        let bounce = t[n - 1].wrapping_sub(t[0]);
        let min_gap = t.windows(2).map(|w| w[1].wrapping_sub(w[0])).min();
        let fall = high.iter().filter(|h| !**h).count() as u32;
        fall_total += fall;
        if press {
            presses += 1;
            press_max_us = press_max_us.max(bounce);
        }
        if release {
            releases += 1;
            release_max_us = release_max_us.max(bounce);
        }

        let (index, name) = match (press, release) {
            (true, _) => (presses, "PRESS"),
            (_, true) => (releases, "release"),
            _ => (0, "glitch"),
        };
        print!(
            "{index:3}  {name:<7}  {count:5}  {fall:4}  {:4}  {bounce:9}  ",
            n as u32 - fall
        );
        match min_gap {
            Some(g) => print!("{g:10}  "),
            None => print!("{:>10}  ", "-"),
        }
        for i in 0..n.min(SHOW_EDGES) {
            print!(
                "{}{} ",
                if high[i] { '^' } else { 'v' },
                t[i].wrapping_sub(t[0])
            );
        }
        if count as usize > SHOW_EDGES {
            print!("... +{}", count as usize - SHOW_EDGES);
        }
        println!();

        // підсумок на кожні 10 натискань
        if release && releases % 10 == 0 {
            let worst = press_max_us.max(release_max_us);
            let debounce_ms = (worst * 3 / 2).div_ceil(1000).max(1); // запас ×1.5, вгору до мс
            println!("\n=== summary: {presses} presses, {releases} releases ===");
            println!("max bounce: press {press_max_us} us, release {release_max_us} us");
            println!(
                "edges read as LOW (~ homework FALLING counter): {fall_total} for {presses} presses"
            );
            println!("debounce >= {debounce_ms} ms (worst bounce {worst} us x 1.5)\n");
            print_header();
        }
    }
}

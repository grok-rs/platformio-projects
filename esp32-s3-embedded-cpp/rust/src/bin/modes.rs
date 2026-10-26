//! ДЗ 2.1, завдання 1–4 — те саме, що cpp/src/modes.cpp: blink без delay, заміри loop,
//! кнопка на перериванні перемикає BLINK → STEADY_ON → STEADY_OFF → BLINK…

#![no_std]
#![no_main]

use core::cell::RefCell;
use core::sync::atomic::{AtomicBool, Ordering};
use critical_section::Mutex;
use esp_backtrace as _;
use esp_hal::{
    clock::CpuClock,
    gpio::{Event, Input, InputConfig, Io, Level, Output, OutputConfig, Pull},
    handler, main, ram,
    time::{Duration, Instant},
};
use esp_println::println;

esp_bootloader_esp_idf::esp_app_desc!();

// завдання 2: усі числа — в одній структурі (піни задають типи p.GPIO15 / p.GPIO21)
struct Config;
impl Config {
    const BLINK: Duration = Duration::from_millis(500); // пів періоду: 1 Гц
    const DEBOUNCE: Duration = Duration::from_millis(30); // тиша після останнього фронту
    const REPORT_EVERY: u32 = 1000; // звіт кожні N ітерацій
}

#[derive(Clone, Copy, PartialEq, Eq)]
enum LedState { Off, On }

#[derive(Clone, Copy, PartialEq, Eq)]
enum Mode { Blink, SteadyOn, SteadyOff }

impl Mode {
    fn next(self) -> Self {
        match self { Self::Blink => Self::SteadyOn, Self::SteadyOn => Self::SteadyOff, Self::SteadyOff => Self::Blink }
    }
    fn name(self) -> &'static str {
        match self { Self::Blink => "BLINK", Self::SteadyOn => "STEADY_ON", Self::SteadyOff => "STEADY_OFF" }
    }
}

struct Led<'d> { pin: Output<'d>, state: LedState }

impl Led<'_> {
    fn set(&mut self, s: LedState) {
        self.state = s;
        self.pin.set_level(if s == LedState::On { Level::High } else { Level::Low });
    }
}

// завдання 4: прапорець від переривання. Аналог volatile bool — атомік (swap = прочитати й скинути разом).
static EDGE: AtomicBool = AtomicBool::new(false);
// вхід потрібен обробнику, щоб скинути прапорець переривання GPIO
static BUTTON: Mutex<RefCell<Option<Input<'static>>>> = Mutex::new(RefCell::new(None));

// обробник: лише скинути апаратний прапорець і підняти свій; #[ram] = IRAM_ATTR
#[handler]
#[ram]
fn on_fall() {
    critical_section::with(|cs| {
        if let Some(b) = BUTTON.borrow_ref_mut(cs).as_mut() {
            b.clear_interrupt();
        }
    });
    EDGE.store(true, Ordering::Relaxed);
}

fn button_pressed() -> bool {
    critical_section::with(|cs| BUTTON.borrow_ref(cs).as_ref().is_some_and(Input::is_low))
}

#[main]
fn main() -> ! {
    let p = esp_hal::init(esp_hal::Config::default().with_cpu_clock(CpuClock::max()));
    // GPIO15 → 220 Ом → LED → GND
    let mut led = Led { pin: Output::new(p.GPIO15, Level::Low, OutputConfig::default()), state: LedState::Off };

    // GPIO21 → кнопка → GND, підтяжка вгору, переривання на спадаючий фронт
    let mut io = Io::new(p.IO_MUX);
    io.set_interrupt_handler(on_fall);
    let mut button = Input::new(p.GPIO21, InputConfig::default().with_pull(Pull::Up));
    critical_section::with(|cs| {
        button.listen(Event::FallingEdge);
        BUTTON.borrow_ref_mut(cs).replace(button);
    });

    println!("=== ESP32-S3: LED modes, superloop + ISR ===");
    println!("Mode: BLINK");

    // стан — локальні змінні main (глобальні лише ті два, що бачить обробник)
    let mut mode = Mode::Blink;
    let mut presses: u32 = 0;
    let (mut last_blink, mut last_edge, mut pending) = (Instant::now(), Instant::now(), false);
    let (mut loops, mut sum_us, mut min_us, mut max_us) = (0u32, 0u64, u64::MAX, 0u64);
    let mut last_pass = Instant::now();

    loop {
        let now = Instant::now(); // один «знімок часу» на весь прохід

        // кнопка: після фронту чекаємо 30 мс тиші, тоді LOW = натиснули, HIGH = брязкіт відпускання
        if EDGE.swap(false, Ordering::Relaxed) { last_edge = now; pending = true; }
        if pending && now - last_edge >= Config::DEBOUNCE {
            pending = false;
            if button_pressed() {
                mode = mode.next();
                if mode == Mode::Blink { last_blink = now; led.set(LedState::On); }
                presses += 1;
                println!("Press #{presses} -> mode {}", mode.name());
            }
        }

        // LED за режимом
        match mode {
            Mode::Blink => {
                if now - last_blink >= Config::BLINK {
                    last_blink = now;
                    led.set(if led.state == LedState::On { LedState::Off } else { LedState::On });
                }
            }
            Mode::SteadyOn => led.set(LedState::On),
            Mode::SteadyOff => led.set(LedState::Off),
        }

        // завдання 3: тривалість ітерації = час між двома проходами цієї точки
        let t = Instant::now();
        let dt = (t - last_pass).as_micros();
        last_pass = t;
        sum_us += dt;
        min_us = min_us.min(dt);
        max_us = max_us.max(dt);
        loops += 1;
        if loops >= Config::REPORT_EVERY {
            #[allow(clippy::cast_precision_loss, reason = "середнє лише для друку")]
            let avg = sum_us as f32 / loops as f32;
            println!("Loop x{loops}: avg {avg:.2} us, min {min_us} us, max {max_us} us");
            (loops, sum_us, min_us, max_us) = (0, 0, u64::MAX, 0);
            last_pass = Instant::now(); // сам звіт не рахувати в наступне вікно
        }
    }
}

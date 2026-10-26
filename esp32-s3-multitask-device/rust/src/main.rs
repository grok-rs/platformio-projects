//! Фінальний проєкт «Мультизадачний пристрій» — те саме, що cpp/src/main.cpp.

#![no_std]
#![no_main]

use esp_backtrace as _;
use esp_hal::{
    clock::CpuClock,
    gpio::{Input, InputConfig, Level, Output, OutputConfig, Pull},
    main,
    time::{Duration, Instant},
};
use esp_println::println;

esp_bootloader_esp_idf::esp_app_desc!();

const LED3_INTERVAL: Duration = Duration::from_millis(1000);
const SPEEDS: [u64; 3] = [1000, 500, 200]; // період LED2 по колу, мс
const DEBOUNCE: Duration = Duration::from_millis(40);

/// Кнопка: прийнятий рівень + останній «сирий» рівень і момент, коли він змінився.
struct Button<'d> {
    pin: Input<'d>,
    stable: bool,
    raw: bool,
    changed_at: Instant,
}

impl Button<'_> {
    /// `true` рівно один раз на натискання: рівень змінився й протримався DEBOUNCE.
    fn pressed(&mut self, now: Instant) -> bool {
        let level = self.pin.is_high();
        if level != self.raw { self.raw = level; self.changed_at = now; } // брязкіт — відлік заново
        if now - self.changed_at >= DEBOUNCE && self.raw != self.stable {
            self.stable = self.raw;
            return self.stable; // фронт натискання; відпускання подій не дає
        }
        false
    }
}

#[main]
fn main() -> ! {
    let p = esp_hal::init(esp_hal::Config::default().with_cpu_clock(CpuClock::max()));
    let mut led1 = Output::new(p.GPIO15, Level::Low, OutputConfig::default()); // червоний — пауза
    let mut led2 = Output::new(p.GPIO16, Level::Low, OutputConfig::default()); // жовтий — швидкість
    let mut led3 = Output::new(p.GPIO17, Level::Low, OutputConfig::default()); // зелений — 1000 мс
    let pull_down = InputConfig::default().with_pull(Pull::Down);
    let start = Instant::now();
    let mut btn1 = Button { pin: Input::new(p.GPIO21, pull_down), stable: false, raw: false, changed_at: start };
    let mut btn2 = Button { pin: Input::new(p.GPIO18, pull_down), stable: false, raw: false, changed_at: start };
    // стартовий рівень — «прийнятий», щоб HIGH на GPIO21 після старту не став натисканням
    for b in [&mut btn1, &mut btn2] { b.raw = b.pin.is_high(); b.stable = b.raw; }
    println!("Мультизадачний пристрій: BTN1 — швидкість LED2, BTN2 — пауза");

    let mut speed = 0; // індекс у SPEEDS
    let mut paused = false;
    let (mut last2, mut last3) = (start, start);
    let mut loops: u32 = 0;
    let mut last_report = start;

    loop {
        let now = Instant::now(); // один «знімок часу» на весь прохід
        loops += 1;

        // кнопки опитуємо щопроходу, навіть у паузі
        let b1 = btn1.pressed(now);
        let b2 = btn2.pressed(now);

        if b2 {
            paused = !paused;
            led1.set_level(paused.into());
            if !paused { last2 = now; last3 = now; } // після паузи — повний інтервал
            println!("{}", if paused { "ПАУЗА вкл" } else { "ПАУЗА викл" });
        }
        if b1 && !paused {
            speed = (speed + 1) % SPEEDS.len();
            println!("BTN1 -> LED2 = {} мс", SPEEDS[speed]);
        }

        if !paused {
            if now - last2 >= Duration::from_millis(SPEEDS[speed]) { last2 = now; led2.toggle(); }
            if now - last3 >= LED3_INTERVAL { last3 = now; led3.toggle(); }
        }

        if now - last_report >= Duration::from_millis(1000) {
            last_report = now;
            println!("Loops/s: {loops}");
            loops = 0;
        }
    }
}

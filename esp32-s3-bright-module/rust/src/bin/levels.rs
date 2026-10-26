//! ТЗ-A, етап 4 — те саме, що cpp/src/levels.cpp: кнопка перемикає яскравість LED
//! по колу OFF → LOW → MID → HIGH → OFF.

#![no_std]
#![no_main]

use core::{
    cell::RefCell,
    sync::atomic::{AtomicBool, Ordering},
};

use critical_section::Mutex;
use embedded_hal::pwm::SetDutyCycle;
use esp_backtrace as _;
use esp_hal::{
    clock::CpuClock,
    gpio::{DriveMode, Event, Input, InputConfig, Io, Pull},
    handler,
    ledc::{
        LSGlobalClkSource, Ledc, LowSpeed,
        channel::{self, ChannelIFace},
        timer::{self, TimerIFace},
    },
    main, ram,
    time::{Duration, Instant, Rate},
};
use esp_println::{print, println};

esp_bootloader_esp_idf::esp_app_desc!();

const LEVELS: [u8; 4] = [0, 40, 128, 255]; // ВП-2
const NAMES: [&str; 4] = ["OFF", "LOW", "MID", "HIGH"];
const DEBOUNCE: Duration = Duration::from_millis(50);

static EDGE: AtomicBool = AtomicBool::new(false); // ВП-4: обробник лише ставить прапорець
// кнопка (GPIO6) потрібна обробнику, щоб скинути переривання, і loop — щоб прочитати рівень
static BUTTON: Mutex<RefCell<Option<Input<'static>>>> = Mutex::new(RefCell::new(None));

#[handler]
#[ram]
fn on_button() {
    critical_section::with(|cs| {
        if let Some(button) = BUTTON.borrow_ref_mut(cs).as_mut() {
            button.clear_interrupt(); // інакше обробник викликатиметься без кінця
        }
    });
    EDGE.store(true, Ordering::Relaxed);
}

fn pressed() -> bool {
    critical_section::with(|cs| BUTTON.borrow_ref(cs).as_ref().is_some_and(Input::is_high))
}

fn set_level(pwm: &mut impl SetDutyCycle, level: usize) {
    let duty = LEVELS[level];
    // esp-hal не робить 255 → 100 % сам (як ядро Arduino): 100 % — це 256 з 256
    pwm.set_duty_cycle(if duty == 255 { 256 } else { u16::from(duty) }).unwrap();
    println!("{} (duty {duty}, {}%)", NAMES[level], (u32::from(duty) * 100 + 127) / 255);
}

#[main]
fn main() -> ! {
    let p = esp_hal::init(esp_hal::Config::default().with_cpu_clock(CpuClock::max()));

    // ВП-1: LEDC 5 кГц, 8 біт → канал 0 на GPIO5 (→ 1 кОм → база 2N2222)
    let mut ledc = Ledc::new(p.LEDC);
    ledc.set_global_slow_clock(LSGlobalClkSource::APBClk);
    let mut timer = ledc.timer::<LowSpeed>(timer::Number::Timer0);
    timer
        .configure(timer::config::Config {
            duty: timer::config::Duty::Duty8Bit,
            clock_source: timer::LSClockSource::APBClk,
            frequency: Rate::from_hz(5000),
        })
        .unwrap();
    let mut pwm = ledc.channel(channel::Number::Channel0, p.GPIO5);
    pwm.configure(channel::config::Config { timer: &timer, duty_pct: 0, drive_mode: DriveMode::PushPull })
        .unwrap();

    // ВП-3: 3V3 → кнопка → GPIO6, підтяжка до GND, переривання на зростаючий фронт
    let mut io = Io::new(p.IO_MUX);
    io.set_interrupt_handler(on_button);
    let mut button = Input::new(p.GPIO6, InputConfig::default().with_pull(Pull::Down));
    critical_section::with(|cs| {
        button.listen(Event::RisingEdge);
        BUTTON.borrow_ref_mut(cs).replace(button);
    });

    println!("Яскравий модуль: LEDC 5 кГц, 8 біт; кнопка GPIO6");
    let mut level = 0;
    let mut presses: u32 = 0;
    print!("Level: ");
    set_level(&mut pwm, level);

    let mut waiting = false; // фронт був — чекаємо, поки стихне брязкіт
    let mut edge_at = Instant::now();

    loop {
        let now = Instant::now();

        // ВП-5: перший фронт запускає 50 мс тиші; після неї кнопка ще натиснута — це натискання.
        // Відскоки за ці 50 мс забуваємо; брязкіт при відпусканні відсіюється, бо тоді вхід уже LOW.
        if EDGE.load(Ordering::Relaxed) && !waiting {
            waiting = true;
            edge_at = now;
        }
        if waiting && now - edge_at >= DEBOUNCE {
            waiting = false;
            EDGE.store(false, Ordering::Relaxed);
            if pressed() {
                presses += 1;
                print!("Press #{presses} -> "); // ВП-7
                level = (level + 1) % 4; // ВП-6
                set_level(&mut pwm, level);
            }
        }
    }
}

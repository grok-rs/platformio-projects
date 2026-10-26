//! ТЗ-A, етап 3 — те саме, що cpp/src/sweep.cpp: заповнення LEDC 0 → 255, пауза 3 с, 255 → 0, пауза 3 с.
//! На паузі 255 мультиметр (DC) між колектором і GND показує ≈ 0,1–0,2 В (ключ у насиченні).

#![no_std]
#![no_main]

use embedded_hal::pwm::SetDutyCycle;
use esp_backtrace as _;
use esp_hal::{
    clock::CpuClock,
    gpio::DriveMode,
    ledc::{
        LSGlobalClkSource, Ledc, LowSpeed,
        channel::{self, ChannelIFace},
        timer::{self, TimerIFace},
    },
    main,
    time::{Duration, Instant, Rate},
};
use esp_println::println;

esp_bootloader_esp_idf::esp_app_desc!();

const STEP: Duration = Duration::from_millis(12); // 255 кроків × 12 мс ≈ 3 с на розгін
const HOLD: Duration = Duration::from_millis(3000);

// фаза: 0 розгін, 1 пауза на 255, 2 спад, 3 пауза на 0
const PHASES: [&str; 4] = ["ramp up", "hold duty 255, measure U(CE) ~0.2 V", "ramp down", "hold duty 0"];

#[main]
fn main() -> ! {
    let p = esp_hal::init(esp_hal::Config::default().with_cpu_clock(CpuClock::max()));

    // LEDC: таймер 5 кГц, 8 біт → канал 0 на GPIO5
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

    println!("Етап 3: ШІМ 0 → 255 → 0, паузи по 3 с");
    let mut phase = 0;
    let mut duty: u16 = 0;
    let mut last = Instant::now();
    println!("Sweep: {}", PHASES[phase]);

    loop {
        let now = Instant::now();

        if phase == 0 || phase == 2 {
            // розгін або спад: крок кожні 12 мс
            if now - last >= STEP {
                last = now;
                if phase == 0 { duty += 1 } else { duty -= 1 }
                // esp-hal не робить 255 → 100 % сам (як ядро Arduino): 100 % — це 256 з 256
                pwm.set_duty_cycle(if duty == 255 { 256 } else { duty }).unwrap();
                if duty == 255 || duty == 0 {
                    phase += 1;
                    println!("Sweep: {}", PHASES[phase]);
                }
            }
        } else if now - last >= HOLD {
            // пауза скінчилась
            last = now;
            phase = (phase + 1) % 4;
            println!("Sweep: {}", PHASES[phase]);
        }
    }
}

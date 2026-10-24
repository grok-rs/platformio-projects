//! ТЗ-A, етап 3 (`cargo run --release --bin sweep`): заповнення LEDC плавно 0 → 255 → 0 з паузами.
//! На паузах мультиметр (DC) між колектором і GND показує: при 255 ≈ 0,1–0,2 В (ключ у
//! насиченні), при 0 — майже 5 В мінус падіння на LED. Під час розгону напруга плавно падає.

#![no_std]
#![no_main]

use bright_module::{
    Sweep, SweepPhase, config,
    hw::{DutyOutput, LedcOutput, checked_pin, ledc, ledc_timer, millis, print_line},
};
use esp_backtrace as _;
use esp_hal::{clock::CpuClock, main};
use esp_println::println;

esp_bootloader_esp_idf::esp_app_desc!();

#[main]
fn main() -> ! {
    let peripherals = esp_hal::init(esp_hal::Config::default().with_cpu_clock(CpuClock::max()));
    let ledc = ledc(peripherals.LEDC);
    let timer = ledc_timer(&ledc);
    let mut output = LedcOutput::new(&ledc, &timer, checked_pin(peripherals.GPIO5, config::pwm::PIN));
    let mut sweep = Sweep::new(config::sweep::STEP_MS, config::sweep::HOLD_MS);

    println!();
    println!("=== Bright module (TZ-A): stage 3, PWM sweep ===");
    output.describe();
    println!("Ramp 0 -> 255 in {} ms, hold {} ms", sweep.ramp_ms(), config::sweep::HOLD_MS);

    sweep.restart(millis());
    let mut duty = 0;
    let mut phase = None; // перша фаза ще не надрукована
    loop {
        let now_ms = millis();
        let new_duty = sweep.duty(now_ms);
        if new_duty != duty {
            output.write(new_duty); // писати в LEDC лише нове значення
            duty = new_duty;
        }

        let new_phase = sweep.phase(now_ms);
        if phase != Some(new_phase) {
            phase = Some(new_phase);
            print_line(format_args!(
                "Sweep: {}",
                match new_phase {
                    SweepPhase::RampUp => "ramp up",
                    SweepPhase::HoldHigh => "hold duty 255, measure U(CE) ~0.2 V",
                    SweepPhase::RampDown => "ramp down",
                    SweepPhase::HoldLow => "hold duty 0",
                }
            ));
        }
    }
}

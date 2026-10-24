//! ТЗ-A, рівень «+»: те саме, що `levels`, але ШІМ формує процесор за лічильником мілісекунд,
//! а не LEDC (`cargo run --release --bin softpwm`). Порівняння — README і `tools/vcd_pwm.py`.

#![no_std]
#![no_main]

use bright_module::{
    config,
    hw::{Button, SoftPwmOutput, checked_pin, run_levels},
};
use esp_backtrace as _;
use esp_hal::{clock::CpuClock, main};

esp_bootloader_esp_idf::esp_app_desc!();

#[main]
fn main() -> ! {
    let peripherals = esp_hal::init(esp_hal::Config::default().with_cpu_clock(CpuClock::max()));

    let output = SoftPwmOutput::new(checked_pin(peripherals.GPIO5, config::pwm::PIN));

    let button = Button::new(checked_pin(peripherals.GPIO6, config::button::PIN), peripherals.IO_MUX);

    run_levels(output, &button)
}

//! Класична схема: окремий вивід на кожен світлодіод.

use core::fmt;

use esp_hal::gpio::{Level, Output, OutputConfig, OutputPin};
use led_blink::{Frame, LedDriver};

/// Класична схема: окремий вивід на кожен світлодіод.
///
/// ```text
/// pin ---[R]---|>|--- GND      HIGH -> світить, LOW -> вимкнений
/// ```
#[derive(Debug)]
pub struct GpioLedDriver {
    red: Output<'static>,
    green: Output<'static>,
    blue: Output<'static>,
    numbers: [u8; 3], // номери GPIO для банера: червоний, зелений, синій
}

impl GpioLedDriver {
    /// Налаштувати виводи як виходи з рівнем LOW (у C++ це робить `begin()`).
    pub fn new(
        red: impl OutputPin + 'static,
        green: impl OutputPin + 'static,
        blue: impl OutputPin + 'static,
    ) -> Self {
        let numbers = [red.number(), green.number(), blue.number()];
        Self { red: off(red), green: off(green), blue: off(blue), numbers }
    }
}

fn off(pin: impl OutputPin + 'static) -> Output<'static> {
    Output::new(pin, Level::Low, OutputConfig::default())
}

impl LedDriver for GpioLedDriver {
    fn show(&mut self, frame: Frame) {
        // `Level: From<bool>` — true = HIGH; `?:` з HIGH/LOW, як у C++, не потрібен.
        self.red.set_level(frame.contains(Frame::RED).into());
        self.green.set_level(frame.contains(Frame::GREEN).into());
        self.blue.set_level(frame.contains(Frame::BLUE).into());
    }
}

impl fmt::Display for GpioLedDriver {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        let [red, green, blue] = self.numbers;
        writeln!(f, "Mode : TWO GPIO (one pin per LED)")?;
        writeln!(f, "Wiring: GPIO{red} -> [220R] -> RED   -> GND")?;
        writeln!(f, "        GPIO{blue} -> [100R] -> BLUE  -> GND")?;
        write!(f, "        GPIO{green} -> [220R] -> GREEN -> GND")
    }
}

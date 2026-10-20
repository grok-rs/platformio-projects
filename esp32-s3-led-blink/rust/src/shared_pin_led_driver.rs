//! Режим одного GPIO: обидва світлодіоди на одному виводі.

use core::fmt;

use esp_hal::gpio::{Flex, Level, OutputPin};
use led_blink::{Frame, LedDriver, SharedPinState};

/// Обидва світлодіоди на ОДНОМУ виводі — використовуємо три стани GPIO.
///
/// ```text
/// pin ---[220R]---|>|--- GND     червоний, світить при HIGH
/// 3V3 ---[100R]---|>|--- pin     синій,    світить при LOW (вивід втягує струм)
/// Hi-Z (вихід вимкнений): обидва згаслі — двом LED послідовно треба ~4.8 В, а є 3.3 В.
/// ```
///
/// Одночасно обидва фізично неможливо, тому кадр RED|BLUE імітується чергуванням HIGH/LOW
/// на кожному тіку (1 мс): око бачить обидва увімкненими. `Flex` — вивід, який можна
/// перемикати між входом і виходом на ходу (у C++ — `pinMode()` у будь-який момент).
#[derive(Debug)]
pub struct SharedPinLedDriver {
    pin: Flex<'static>,
    number: u8,
    state: SharedPinState,
    red_phase: bool, // поточна фаза мультиплексу
}

impl SharedPinLedDriver {
    pub fn new(pin: impl OutputPin + 'static) -> Self {
        let number = pin.number();
        let mut driver =
            Self { pin: Flex::new(pin), number, state: SharedPinState::Off, red_phase: false };
        driver.apply(SharedPinState::Off);
        driver
    }

    fn apply(&mut self, state: SharedPinState) {
        self.state = state;
        // Спершу рівень, потім вмикаємо вихід — щоб не було короткого імпульсу старого рівня.
        match state {
            SharedPinState::Red => self.drive(Level::High), // струм pin -> червоний -> GND
            SharedPinState::Blue => self.drive(Level::Low), // струм 3V3 -> синій -> pin
            SharedPinState::Both => self.pin.set_output_enable(true), // рівень далі чергує tick()
            SharedPinState::Off => self.pin.set_output_enable(false), // Hi-Z: жодного шляху для струму
        }
    }

    fn drive(&mut self, level: Level) {
        self.pin.set_level(level);
        self.pin.set_output_enable(true);
    }
}

impl LedDriver for SharedPinLedDriver {
    fn show(&mut self, frame: Frame) {
        self.apply(frame.into());
    }

    /// Мультиплекс: лише коли кадр вимагає обидва кольори.
    fn tick(&mut self) {
        if self.state == SharedPinState::Both {
            self.red_phase = !self.red_phase;
            self.pin.set_level(self.red_phase.into());
        }
    }
}

impl fmt::Display for SharedPinLedDriver {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        let n = self.number;
        writeln!(f, "Mode : SINGLE GPIO (both LEDs on one pin)")?;
        writeln!(f, "Wiring: GPIO{n} -> [220R] -> RED  -> GND     (lit when pin HIGH)")?;
        write!(f, "        3V3   -> [100R] -> BLUE -> GPIO{n}   (lit when pin LOW)")
    }
}

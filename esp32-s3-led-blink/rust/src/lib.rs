//! Логіка почергового миготіння — без жодного звернення до заліза.
//!
//! Тут лише стан і рішення: який кадр показати, яку подію дала кнопка, що означає клавіша.
//! Час приходить параметром (`now: Instant`), а світлодіоди — через трейт [`LedDriver`],
//! тому вся логіка збирається й для ПК і перевіряється модульними тестами:
//!
//! ```text
//! cargo +stable host-test -p led-blink
//! ```
//!
//! Залізо (GPIO, USB-Serial-JTAG, задачі Embassy) — у `src/main.rs` і `src/drivers.rs`.
//! У C++-версії ці шари перемішані: `BlinkPlayer::update()` сам викликає `millis()`.

#![cfg_attr(not(test), no_std)]

pub mod button;
pub mod command;
pub mod driver;
pub mod frame;
pub mod pattern;
pub mod player;
pub mod shared_pin;

pub use button::{Button, ButtonEvent};
pub use command::Command;
pub use driver::LedDriver;
pub use frame::Frame;
pub use pattern::Pattern;
pub use player::BlinkPlayer;
pub use shared_pin::SharedPinState;

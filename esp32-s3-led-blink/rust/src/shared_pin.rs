//! Режим одного GPIO: який із трьох станів виводу потрібен для кадру.

use crate::Frame;

/// Стан спільного виводу (схема — у `src/drivers.rs`, `SharedPinLedDriver`).
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum SharedPinState {
    /// Hi-Z: обидва вимкнені.
    Off,
    /// HIGH: світить червоний.
    Red,
    /// LOW: світить синій.
    Blue,
    /// Обидва «разом» — швидке чергування HIGH/LOW.
    Both,
}

/// Зелений у цій схемі відсутній, біт `GREEN` ігнорується.
impl From<Frame> for SharedPinState {
    fn from(frame: Frame) -> Self {
        match (frame.contains(Frame::RED), frame.contains(Frame::BLUE)) {
            (true, true) => Self::Both,
            (true, false) => Self::Red,
            (false, true) => Self::Blue,
            (false, false) => Self::Off,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn green_is_ignored() {
        assert_eq!(SharedPinState::from(Frame::GREEN), SharedPinState::Off);
        assert_eq!(SharedPinState::from(Frame::RED | Frame::GREEN), SharedPinState::Red);
        assert_eq!(SharedPinState::from(Frame::RED | Frame::BLUE), SharedPinState::Both);
    }
}

//! Команди програвачу — і від кнопки BOOT, і від клавіш у Serial-моніторі.

use crate::{ButtonEvent, Frame};

/// Що зробити з програвачем. Кнопка й Serial-консоль лише створюють команди,
/// а виконує їх одне місце — головний цикл (у C++ консоль сама смикала `player_`).
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Command {
    NextSpeed,
    NextPattern,
    /// Перевірка монтажу: зупинити патерн і тримати кадр; `label` — для повідомлення `TEST: …`.
    Hold { frame: Frame, label: &'static str },
    Resume,
}

impl Command {
    /// Однобуквені команди Serial-монітора:
    ///
    /// | клавіша     | дія                                                  |
    /// |-------------|------------------------------------------------------|
    /// | `1` `2` `3` | тримати червоний / синій / зелений (перевірка монтажу) |
    /// | `0`         | усі вимкнути                                         |
    /// | `p` / `v`   | наступний патерн / швидкість                         |
    /// | інше        | повернутися до автоматичного миготіння               |
    pub fn from_key(key: u8) -> Option<Self> {
        let hold = |frame, label| Some(Self::Hold { frame, label });
        match key {
            b'1' => hold(Frame::RED, "red on"),
            b'2' => hold(Frame::BLUE, "blue on"),
            b'3' => hold(Frame::GREEN, "green on"),
            b'0' => hold(Frame::empty(), "all off"),
            b'p' => Some(Self::NextPattern),
            b'v' => Some(Self::NextSpeed),
            b'\r' | b'\n' | b' ' => None, // роздільники з монітора — ігноруємо
            _ => Some(Self::Resume),
        }
    }
}

/// Коротке натискання BOOT — наступна швидкість, довге — наступний патерн.
impl From<ButtonEvent> for Command {
    fn from(event: ButtonEvent) -> Self {
        match event {
            ButtonEvent::ShortPress => Self::NextSpeed,
            ButtonEvent::LongPress => Self::NextPattern,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn keys_map_to_commands() {
        assert_eq!(Command::from_key(b'v'), Some(Command::NextSpeed));
        assert_eq!(Command::from_key(b'p'), Some(Command::NextPattern));
        assert_eq!(
            Command::from_key(b'2'),
            Some(Command::Hold { frame: Frame::BLUE, label: "blue on" })
        );
        assert_eq!(Command::from_key(b'\n'), None);
        assert_eq!(Command::from_key(b'x'), Some(Command::Resume));
    }
}

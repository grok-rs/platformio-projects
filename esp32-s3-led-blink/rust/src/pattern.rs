//! Патерни миготіння й пресети швидкості.

use embassy_time::Duration;

use crate::Frame;

/// Патерн — іменована послідовність кадрів, що програється по колу.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct Pattern {
    pub name: &'static str,
    pub frames: &'static [Frame],
}

const R: Frame = Frame::RED;
const G: Frame = Frame::GREEN;
const B: Frame = Frame::BLUE;
const OFF: Frame = Frame::empty();
const RB: Frame = Frame::RED.union(Frame::BLUE); // `|` не є const fn, `union` — є

/// Усі патерни; перший — базова вимога «по черзі».
///
/// Кожен кадр показується один «тік» (тривалість задає швидкість),
/// після останнього кадру програвач повертається до першого.
pub const PATTERNS: &[Pattern] = &[
    Pattern { name: "alternate", frames: &[R, B] }, // ОБОВ'ЯЗКОВА ВИМОГА: по черзі
    Pattern { name: "alternate_gap", frames: &[R, OFF, B, OFF] }, // з темною паузою
    Pattern { name: "police", frames: &[R, OFF, R, OFF, B, OFF, B, OFF] }, // подвійний спалах
    Pattern { name: "three_leds", frames: &[R, G, B] }, // третій світлодіод
    Pattern { name: "chase", frames: &[R, G, B, G] }, // «бігучий вогонь»
    Pattern { name: "mix", frames: &[R, RB, B, RB] }, // два кольори разом
];

/// Пресети тривалості кадру. `Duration` замість `uint16_t` мілісекунд: одиниці — частина типу.
pub const SPEEDS: &[Duration] = &[
    Duration::from_millis(1000),
    Duration::from_millis(500),
    Duration::from_millis(250),
    Duration::from_millis(120),
];

pub const INITIAL_SPEED_INDEX: usize = 1;

// Перевірки під час компіляції — аналог `static_assert` у C++, але й для вмісту таблиць:
// патерн без кадрів дав би ділення на нуль у `% frames.len()`.
const _: () = {
    assert!(INITIAL_SPEED_INDEX < SPEEDS.len(), "initial speed index is out of range");
    let mut i = 0;
    while i < PATTERNS.len() {
        assert!(!PATTERNS[i].frames.is_empty(), "every pattern needs at least one frame");
        i += 1;
    }
};

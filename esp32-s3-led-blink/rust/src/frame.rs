//! Кадр — набір світлодіодів, які світять одночасно.

bitflags::bitflags! {
    /// Кадр: які світлодіоди світять одночасно. Кожен світлодіод — окремий біт.
    ///
    /// У C++ для цього написано клас `Frame` над `uint8_t` (`has()`, `operator|`, `off()`),
    /// щоб не працювати з «голою» бітмаскою. Крейт `bitflags` генерує те саме:
    /// `contains()`, `|`, `Frame::empty()`, `==`, `Debug` — і все типобезпечне.
    #[derive(Debug, Clone, Copy, PartialEq, Eq, Default)]
    pub struct Frame: u8 {
        const RED   = 1 << 0;
        const GREEN = 1 << 1;
        const BLUE  = 1 << 2;
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn empty_frame_is_off() {
        assert!(Frame::empty().is_empty());
        assert_eq!(Frame::default(), Frame::empty());
    }

    #[test]
    fn union_contains_both_leds() {
        let mix = Frame::RED | Frame::BLUE;
        assert!(mix.contains(Frame::RED));
        assert!(mix.contains(Frame::BLUE));
        assert!(!mix.contains(Frame::GREEN));
    }
}

//! Модуль 2, урок 28, міні-проєкт «Світлофор» за ПДР України — те саме, що cpp/src/main.c, але Rust поверх ESP-IDF.
//! Цикл: зелений → зелений миготливий → жовтий → червоний → червоний + жовтий → зелений.
//! Кнопка перемикає на жовтий миготливий (нерегульоване перехрестя) і назад.
//! Машина станів у суперциклі: кожні 10 мс дивимося на час і кнопку, затримки для відліку немає.

use esp_idf_svc::hal::{
    delay::FreeRtos,
    gpio::{PinDriver, Pull},
    peripherals::Peripherals,
};
use esp_idf_svc::sys::EspError;
use esp_idf_svc::timer::EspTaskTimerService;

const GREEN_MS: u128 = 10_000; // зелений: рух дозволено
const GREEN_BLINK_MS: u128 = 3_000; // зелений миготливий: 3 блимання
const YELLOW_MS: u128 = 3_000; // жовтий
const RED_MS: u128 = 10_000; // червоний
const RED_YELLOW_MS: u128 = 2_000; // червоний + жовтий: скоро зелений
const BLINK_MS: u128 = 500; // миготіння 1 Гц: 0,5 с світить, 0,5 с ні

#[derive(Clone, Copy, PartialEq)]
enum State {
    GreenOn,
    GreenBlink,
    YellowOn,
    RedOn,
    RedYellow,
    YellowBlink,
}

impl State {
    fn name(self) -> &'static str {
        match self {
            State::GreenOn => "зелений",
            State::GreenBlink => "зелений миготливий",
            State::YellowOn => "жовтий",
            State::RedOn => "червоний",
            State::RedYellow => "червоний + жовтий",
            State::YellowBlink => "жовтий миготливий (нерегульоване перехрестя)",
        }
    }
}

fn main() -> Result<(), EspError> {
    esp_idf_svc::sys::link_patches();
    let p = Peripherals::take()?;
    let mut red = PinDriver::output(p.pins.gpio15)?; // червоний LED через 220 Ом на GND
    let mut yellow = PinDriver::output(p.pins.gpio16)?; // жовтий
    let mut green = PinDriver::output(p.pins.gpio17)?; // зелений
    let button = PinDriver::input(p.pins.gpio21, Pull::Up)?; // кнопка на GND, внутрішня підтяжка

    FreeRtos::delay_ms(2000); // монітор порту встигає під'єднатися після прошивки
    println!("Світлофор за ПДР України. Кнопка: жовтий миготливий ↔ звичайний режим");
    let clock = EspTaskTimerService::new()?; // час від старту, як esp_timer_get_time() у C
    let now_ms = || clock.now().as_millis();
    let mut state = State::GreenOn;
    let mut since = now_ms(); // коли почався поточний стан, мс
    println!("[{since} мс] {}", state.name());

    let mut was_down = false;
    loop {
        let mut next = None;

        // Кнопка: опитування кожні 10 мс, реагуємо на натискання. Брязкіт коротший за крок опитування (ДЗ 2.6)
        let down = button.is_low();
        if down && !was_down {
            // з миготливого — спершу всім стоп
            next = Some(if state == State::YellowBlink { State::RedOn } else { State::YellowBlink });
        }
        was_down = down;

        // Час поточного стану вийшов — переходимо до наступного, і вже потім вмикаємо LED (без проміжного кадру)
        let t = now_ms() - since; // скільки триває поточний стан
        if next.is_none() {
            next = match state {
                State::GreenOn if t >= GREEN_MS => Some(State::GreenBlink),
                State::GreenBlink if t >= GREEN_BLINK_MS => Some(State::YellowOn),
                State::YellowOn if t >= YELLOW_MS => Some(State::RedOn),
                State::RedOn if t >= RED_MS => Some(State::RedYellow),
                State::RedYellow if t >= RED_YELLOW_MS => Some(State::GreenOn),
                _ => None,
            };
        }
        if let Some(n) = next {
            state = n;
            since = now_ms();
            println!("[{since} мс] {}", state.name());
        }

        let blink = ((now_ms() - since) / BLINK_MS) % 2 == 1; // false, true, false, true … кожні 0,5 с
        let (r, y, g) = match state {
            State::GreenOn => (false, false, true),
            State::GreenBlink => (false, false, blink), // одразу гасне, потім світить: 3 блимання за 3 с
            State::YellowOn => (false, true, false),
            State::RedOn => (true, false, false),
            State::RedYellow => (true, true, false),
            State::YellowBlink => (false, !blink, false), // миготить, доки знову не натиснуть кнопку
        };
        red.set_level(r.into())?;
        yellow.set_level(y.into())?;
        green.set_level(g.into())?;

        FreeRtos::delay_ms(10);
    }
}

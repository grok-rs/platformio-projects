//! Модуль 1.4 — два світлодіоди, зовнішня кнопка та BOOT (ESP32-S3-DevKitC-1).
//!
//!   Режим 1 (за замовчуванням) — усі LED синхронно, 200 мс;       вмикає зовнішня кнопка.
//!   Режим 2                    — LED по черзі («переїзд»), 1000 мс; вмикає кнопка BOOT.
//!
//! Вибраний режим зберігається в `Blinker` і не змінюється, доки не натиснуто іншу кнопку.
//! Схема та пояснення — у README.md.
//!
//! На відміну від C++ (`loop()` опитує кнопки кожну 1 мс), тут програма чекає одночасно
//! на спадаючий фронт будь-якої кнопки (переривання GPIO) і на час наступного кроку.
//! Між подіями процесор спить.

#![no_std]
#![no_main]

use embassy_executor::Spawner;
use embassy_futures::select::{Either, select, select_array};
use embassy_time::{Instant, Timer};
use esp_backtrace as _;
use esp_hal::{
    clock::CpuClock,
    gpio::{Input, InputConfig, InputPin, Level, Output, OutputConfig, OutputPin, Pull},
    timer::timg::TimerGroup,
};
use esp_println::{print, println};
use two_buttons::{Blinker, Mode};

esp_bootloader_esp_idf::esp_app_desc!();

/// Кнопка встановлює конкретний режим. Обидві замикають вивід на GND (натиснута = LOW).
struct ModeButton {
    name: &'static str,
    gpio: u8,
    input: Input<'static>,
    mode: Mode,
}

impl ModeButton {
    fn new(name: &'static str, pin: impl InputPin + 'static, pull: Pull, mode: Mode) -> Self {
        let gpio = pin.number();
        Self { name, gpio, input: Input::new(pin, InputConfig::default().with_pull(pull)), mode }
    }
}

fn led(pin: impl OutputPin + 'static) -> (u8, Output<'static>) {
    (pin.number(), Output::new(pin, Level::Low, OutputConfig::default()))
}

#[esp_rtos::main]
async fn main(_spawner: Spawner) -> ! {
    let peripherals = esp_hal::init(esp_hal::Config::default().with_cpu_clock(CpuClock::max()));
    let timg0 = TimerGroup::new(peripherals.TIMG0);
    esp_rtos::start(timg0.timer0, peripherals.FROM_CPU_INTR0);

    // --- Світлодіоди ---------------------------------------------------------
    // Як у завданні: LED — GPIO15/16 (один гребінець).
    // Не strapping-піни (0, 3, 45, 46), не USB (19, 20), не флеш/PSRAM (26…37).
    let (led_gpios, mut leds) = {
        let [(g0, o0), (g1, o1)] = [led(peripherals.GPIO15), led(peripherals.GPIO16)];
        ([g0, g1], [o0, o1])
    };

    // --- Кнопки --------------------------------------------------------------
    // Порядок у масиві = пріоритет: якщо фронти прийшли одночасно, перемагає перша.
    let mut buttons = [
        // внутрішній резистор ~45 кОм до 3.3 В
        ModeButton::new("external", peripherals.GPIO21, Pull::Up, Mode::Sync),
        // підтяжка 10 кОм вже є на платі
        ModeButton::new("BOOT", peripherals.GPIO0, Pull::None, Mode::Alternate),
    ];

    let mut blinker = Blinker::<2>::default();
    print_banner(&led_gpios, &buttons, blinker.mode());
    render(&mut leds, &blinker);
    let mut step_started = Instant::now();

    loop {
        let next_step = step_started + blinker.mode().step_duration();
        // Усі futures `wait_for_falling_edge()` мають один тип, тож їх можна чекати масивом.
        let edges = select_array(buttons.each_mut().map(|b| b.input.wait_for_falling_edge()));
        match select(edges, Timer::at(next_step)).await {
            // Кнопка іншого режиму — почати його з першого кроку одразу, без очікування
            // залишку старої затримки. Брязкіт дає кілька фронтів, але режим той самий — ігнор.
            Either::First(((), index)) => {
                let button = &buttons[index];
                if blinker.set_mode(button.mode) {
                    render(&mut leds, &blinker);
                    step_started = Instant::now();
                    println!("Mode -> {}", blinker.mode().name());
                }
            }
            // Неблокуюче миготіння: настав час наступного кроку.
            Either::Second(()) => {
                blinker.advance();
                render(&mut leds, &blinker);
                step_started = Instant::now();
            }
        }
    }
}

/// Вивести на LED поточний крок поточного режиму.
fn render<const N: usize>(leds: &mut [Output<'static>; N], blinker: &Blinker<N>) {
    for (led, on) in leds.iter_mut().zip(blinker.levels()) {
        led.set_level(on.into());
    }
}

fn print_banner(led_gpios: &[u8], buttons: &[ModeButton], start: Mode) {
    println!();
    println!("=== ESP32-S3: LEDs, external button + BOOT ===");
    print!("LEDs:");
    for gpio in led_gpios {
        print!(" GPIO{gpio}");
    }
    println!();
    for b in buttons {
        println!("Button {:<8} GPIO{:<2} -> mode {}", b.name, b.gpio, b.mode.name());
    }
    println!("Start mode: {}", start.name());
}

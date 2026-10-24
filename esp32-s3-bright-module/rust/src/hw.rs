//! Залізо: кнопка на перериванні, ШІМ (LEDC або програмний), Serial і час (те саме, що
//! `cpp/lib/board`), плюс спільний для `levels` і `softpwm` superloop (C++: `src/levels_app.h`).
//! Лише для ESP32-S3: у `lib.rs` модуль підключений під `cfg(target_arch = "xtensa")`.

use core::{
    cell::RefCell,
    fmt::{self, Write as _},
    sync::atomic::{AtomicBool, Ordering},
};

use critical_section::Mutex;
use embedded_hal::pwm::SetDutyCycle;
use esp_hal::{
    gpio::{
        DriveMode, Event, Input, InputConfig, InputPin, Io, Level, Output, OutputConfig, OutputPin, Pin, Pull,
        interconnect::PeripheralOutput,
    },
    handler,
    ledc::{
        LSGlobalClkSource, Ledc, LowSpeed,
        channel::{self, ChannelIFace},
        timer::{self, TimerIFace},
    },
    peripherals::{IO_MUX, LEDC},
    ram,
    time::{Instant, Rate},
};
use esp_println::println;

use crate::{Brightness, PressDetector, SoftPwm, config, duty_percent, ledc_duty};

// --- Кнопка (ВП-3, ВП-4) ----------------------------------------------------------------------

/// Прапорець «був зростаючий фронт». У C++ — `volatile bool`.
///
/// У Rust volatile-змінних немає: для даних, спільних з перериванням, — атоміки. Вони теж не
/// дають компілятору «закешувати» значення, а `swap(false)` ще й читає та скидає однією
/// неподільною операцією — тож критична секція, як у C++ `takeEdge()`, не потрібна.
static EDGE: AtomicBool = AtomicBool::new(false);

/// Вхід потрібен обробнику, щоб скинути прапорець переривання GPIO: у esp-hal це робить
/// сам обробник (у C++ — диспетчер переривань ядра Arduino).
static BUTTON: Mutex<RefCell<Option<Input<'static>>>> = Mutex::new(RefCell::new(None));

/// Обробник переривання — мінімальний: скинути прапорець апаратури й підняти свій (ВП-4).
/// `#[ram]` — аналог `IRAM_ATTR`, `#[handler]` дає функції ABI обробника переривань.
#[handler]
#[ram]
fn on_rising_edge() {
    // Обробник один на всі GPIO: прапорець лише тоді, коли спрацював саме вхід кнопки.
    let ours = critical_section::with(|cs| {
        BUTTON.borrow_ref_mut(cs).as_mut().is_some_and(|button| {
            let set = button.is_interrupt_set();
            button.clear_interrupt(); // інакше обробник викликатиметься без кінця
            set
        })
    });
    if ours {
        EDGE.store(true, Ordering::Release);
    }
}

/// Кнопка 3V3 → GPIO6 з підтяжкою до GND: відпущена = LOW, натиснута = HIGH.
///
/// Обробник переривання в esp-hal не приймає аргументів, тож прапорець і вхід — `static`
/// (у C++ `attachInterruptArg` передає `this`). Друга кнопка їх би переписала — тому `new`
/// забирає `IO_MUX`: ця периферія існує в одному екземплярі, і другу `Button` компілятор
/// створити не дасть.
#[derive(Debug)]
pub struct Button {
    _private: (),
}

impl Button {
    pub fn new(pin: impl InputPin + 'static, io_mux: IO_MUX<'static>) -> Self {
        let mut input = Input::new(pin, InputConfig::default().with_pull(Pull::Down));
        let mut io = Io::new(io_mux);
        io.set_interrupt_handler(on_rising_edge);
        critical_section::with(|cs| {
            input.listen(Event::RisingEdge);
            BUTTON.borrow_ref_mut(cs).replace(input);
        });
        Self { _private: () }
    }

    /// Чи був фронт з попереднього виклику; прапорець скидається.
    /// `#[must_use]`: проігнорувати результат — означає загубити фронт.
    #[must_use]
    pub fn take_edge(&self) -> bool {
        // Швидкий шлях, як у C++: майже на кожному проході фронту не було — лише читання.
        EDGE.load(Ordering::Relaxed) && EDGE.swap(false, Ordering::Acquire)
    }

    pub fn is_pressed(&self) -> bool {
        critical_section::with(|cs| BUTTON.borrow_ref(cs).as_ref().is_some_and(Input::is_high))
    }
}

/// Перевірити, що взятий пін — саме той, що в `config` (ВП-8). Константа і тип піна живуть окремо,
/// і без цієї перевірки зміна лише одного з них мовчки розійшлася б із написом у Serial.
pub fn checked_pin<P: Pin>(pin: P, expected: u8) -> P {
    assert_eq!(pin.number(), expected, "GPIO does not match config");
    pin
}

// --- Виходи ШІМ -----------------------------------------------------------------------------------

/// Те, що вміє показувати заповнення 0…255: LEDC або програмний ШІМ.
/// У C++ — вимога до параметра шаблону `LevelsApp<Output>`; тут — трейт, і перевіряє її компілятор.
pub trait DutyOutput {
    fn write(&mut self, duty: u8);
    /// Викликається на кожному проході циклу. Апаратному ШІМ тут робити нічого.
    fn update(&mut self, _now_ms: u32) {}
    /// Рядок для банера в Serial.
    fn describe(&self);
}

/// Блок LEDC з повільним (low-speed) тактуванням від APB — як у C++ `ledcSetup`.
pub fn ledc(instance: LEDC<'static>) -> Ledc<'static> {
    let mut ledc = Ledc::new(instance);
    ledc.set_global_slow_clock(LSGlobalClkSource::APBClk);
    ledc
}

/// Таймер LEDC: 5 кГц, 8 біт (ВП-1). Канал LEDC позичає таймер, тому таймер живе в `main`,
/// а не всередині `LedcOutput`.
pub fn ledc_timer<'d>(ledc: &Ledc<'d>) -> timer::Timer<'d, LowSpeed> {
    let mut timer = ledc.timer::<LowSpeed>(timer::Number::Timer0);
    timer
        .configure(timer::config::Config {
            duty: timer::config::Duty::Duty8Bit,
            clock_source: timer::LSClockSource::APBClk,
            frequency: Rate::from_hz(config::pwm::FREQUENCY_HZ),
        })
        // Частота й розрядність — константи, перевірені ще під час компіляції (config).
        .expect("5 kHz x 8 bit fits the 80 MHz APB clock");
    timer
}

/// Апаратний ШІМ (ВП-1): після налаштування сигнал генерує периферія сама.
pub struct LedcOutput<'a> {
    channel: channel::Channel<'a, LowSpeed>,
}

/// `Channel` з esp-hal не реалізує `Debug`, тож вручну (лінт `missing_debug_implementations`).
impl fmt::Debug for LedcOutput<'_> {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.debug_struct("LedcOutput").finish_non_exhaustive()
    }
}

impl<'a> LedcOutput<'a> {
    pub fn new(ledc: &Ledc<'a>, timer: &'a timer::Timer<'a, LowSpeed>, pin: impl PeripheralOutput<'a>) -> Self {
        let mut channel = ledc.channel(channel::Number::Channel0, pin);
        channel
            .configure(channel::config::Config { timer, duty_pct: 0, drive_mode: DriveMode::PushPull })
            .expect("channel 0 uses a configured timer");
        Self { channel }
    }
}

impl DutyOutput for LedcOutput<'_> {
    fn write(&mut self, duty: u8) {
        // `SetDutyCycle` з embedded-hal: той самий виклик працює з будь-яким ШІМ (STM32, RP2040…).
        self.channel.set_duty_cycle(ledc_duty(duty)).expect("LEDC duty update cannot fail");
    }

    fn describe(&self) {
        println!(
            "PWM GPIO{}: LEDC {} Hz, {} bit",
            config::pwm::PIN,
            config::pwm::FREQUENCY_HZ,
            config::pwm::RESOLUTION_BITS
        );
    }
}

/// Програмний ШІМ на мілісекундах (рівень «+»): `update()` на кожному проході циклу вирішує,
/// HIGH чи LOW зараз. Будь-яка затримка циклу одразу видна як тремтіння фронтів.
#[derive(Debug)]
pub struct SoftPwmOutput<'d> {
    pin: Output<'d>,
    pwm: SoftPwm, // тик = 1 мс
    duty: u8,
}

impl<'d> SoftPwmOutput<'d> {
    pub fn new(pin: impl OutputPin + 'd) -> Self {
        Self {
            pin: Output::new(pin, Level::Low, OutputConfig::default()),
            pwm: SoftPwm::new(config::soft_pwm::PERIOD_MS),
            duty: 0,
        }
    }
}

impl DutyOutput for SoftPwmOutput<'_> {
    fn write(&mut self, duty: u8) {
        self.duty = duty;
    }

    fn update(&mut self, now_ms: u32) {
        // Писати в GPIO лише тоді, коли рівень справді змінюється.
        let level = Level::from(self.pwm.level(now_ms, self.duty));
        if self.pin.output_level() != level {
            self.pin.set_level(level);
        }
    }

    fn describe(&self) {
        println!("PWM GPIO{}: software, period {} ms (millis)", config::pwm::PIN, self.pwm.period_ticks());
    }
}

// --- Застосунок «чотири рівні» (ВП-1…ВП-7) -------------------------------------------------------

/// Superloop прошивок `levels` і `softpwm` — відрізняється лише вихід. Ніколи не повертається.
///
/// Стан — локальні змінні: функція не повертається, тож їм не треба бути глобальними.
/// Глобальні лише прапорець і вхід, які бачить обробник переривання.
pub fn run_levels(mut output: impl DutyOutput, button: &Button) -> ! {
    println!();
    println!("=== Bright module (TZ-A): PWM levels + button ===");
    output.describe();
    println!(
        "Button GPIO{} (INPUT_PULLDOWN, RISING), debounce {} ms",
        config::button::PIN,
        config::button::DEBOUNCE_MS
    );

    let mut presses = PressDetector::new(config::button::DEBOUNCE_MS);
    let mut level = Brightness::Off;
    let mut press_count: u32 = 0;
    output.write(level.duty());
    print_line(format_args!("Level: {level} (duty {}, {}%)", level.duty(), duty_percent(level.duty())));

    // Одна ітерація = один прохід. Нічого не чекає: кожен крок перевіряє «чи пора?» і йде далі.
    loop {
        let now_ms = millis(); // один момент часу на весь прохід

        // ВП-5: прапорець ISR + рівень входу → автомат `PressDetector`: одне натискання — одна
        // подія, навіть коротке; брязкіт відпускання й утримання — жодної.
        if presses.update(button.take_edge(), button.is_pressed(), now_ms) {
            press_count += 1;
            level = level.next(); // ВП-6
            output.write(level.duty());
            // ВП-7
            print_line(format_args!(
                "Press #{press_count} -> {level} (duty {}, {}%)",
                level.duty(),
                duty_percent(level.duty())
            ));
        }

        output.update(now_ms);
    }
}

// --- Serial і час ------------------------------------------------------------------------------------

/// Найдовший рядок, разом із `\n` (як `kMaxLineLength` у C++ `tryPrintf`).
const MAX_LINE_LENGTH: usize = 64;

/// Надрукувати рядок одним записом; повертає `false`, якщо рядок задовгий і пропущений.
///
/// `println!` з esp-println віддає кожен шматок формату окремим USB-пакетом і на кожному чекає
/// хоста. Тут рядок форматується в `heapless::String` на стеку (без купи) і йде одним пакетом.
pub fn print_line(args: fmt::Arguments<'_>) -> bool {
    let mut line = heapless::String::<MAX_LINE_LENGTH>::new();
    if writeln!(line, "{args}").is_err() {
        return false;
    }
    esp_println::Printer::write_bytes(line.as_bytes());
    true
}

/// Мілісекунди від старту, обрізані до 32 біт, — як `millis()` в Arduino (переповнення
/// кожні ~49.7 доби логіка в `lib.rs` переживає завдяки `wrapping_sub`).
#[allow(clippy::cast_possible_truncation, reason = "свідомо: семантика millis()")]
pub fn millis() -> u32 {
    Instant::now().duration_since_epoch().as_millis() as u32
}

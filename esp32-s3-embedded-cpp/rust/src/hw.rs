//! Залізо: світлодіод, кнопка на перериванні й лічильники часу (те саме, що `cpp/lib/board`).
//! Лише для ESP32-S3: у `lib.rs` модуль підключений під `cfg(target_arch = "xtensa")`.

use core::{
    cell::RefCell,
    fmt::{self, Write as _},
    sync::atomic::{AtomicBool, Ordering},
};

use critical_section::Mutex;
use esp_hal::{
    gpio::{Event, Input, InputConfig, InputPin, Io, Level, Output, OutputConfig, OutputPin, Pull},
    handler,
    peripherals::IO_MUX,
    ram,
    time::Instant,
};

use crate::LedState;

/// Світлодіод на одному GPIO (завдання 1).
///
/// У C++ — клас `Led` з `init()` і `set()`: конструктор лише запам'ятовує пін, бо глобальний
/// об'єкт створюється ще до старту ядра Arduino. У Rust глобального об'єкта немає, тож окремий
/// `init()` не потрібен: `Led::new` налаштовує вивід, і LED з «ненастроєним» піном просто не
/// буває. Копіювати теж не можна — `Output` не реалізує `Clone` (у C++ — `= delete`).
#[derive(Debug)]
pub struct Led<'d> {
    pin: Output<'d>,
    state: LedState,
}

impl<'d> Led<'d> {
    pub fn new(pin: impl OutputPin + 'd) -> Self {
        Self { pin: Output::new(pin, Level::Low, OutputConfig::default()), state: LedState::Off }
    }

    /// Писати в GPIO лише тоді, коли стан справді змінюється.
    pub fn set(&mut self, state: LedState) {
        if state != self.state {
            self.pin.set_level(state.into());
            self.state = state;
        }
    }

    pub const fn state(&self) -> LedState {
        self.state
    }
}

/// `LedState` → рівень виводу; завдяки цьому `Led::set` пише просто `state.into()`.
impl From<LedState> for Level {
    fn from(state: LedState) -> Self {
        match state {
            LedState::On => Self::High,
            LedState::Off => Self::Low,
        }
    }
}

/// Прапорець «був спадаючий фронт». У C++ — `volatile bool`.
///
/// У Rust volatile-змінних немає: для даних, спільних з перериванням, — атоміки. Вони теж не
/// дають компілятору «закешувати» значення, а `swap(false)` ще й читає та скидає однією
/// неподільною операцією — тож критична секція, як у C++ `takeEdge()`, не потрібна.
static EDGE: AtomicBool = AtomicBool::new(false);

/// Вхід потрібен обробнику, щоб скинути прапорець переривання GPIO: у esp-hal це робить
/// сам обробник (у C++ — диспетчер переривань ядра Arduino).
static BUTTON: Mutex<RefCell<Option<Input<'static>>>> = Mutex::new(RefCell::new(None));

/// Обробник переривання — мінімальний: скинути прапорець апаратури й підняти свій.
/// `#[ram]` — аналог `IRAM_ATTR`, `#[handler]` дає функції ABI обробника переривань.
#[handler]
#[ram]
fn on_falling_edge() {
    critical_section::with(|cs| {
        if let Some(button) = BUTTON.borrow_ref_mut(cs).as_mut() {
            button.clear_interrupt(); // інакше обробник викликатиметься без кінця
        }
    });
    EDGE.store(true, Ordering::Release);
}

/// Кнопка на перериванні (завдання 4). Підтяжка вгору: відпущена = HIGH, натиснута = LOW.
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
        let mut input = Input::new(pin, InputConfig::default().with_pull(Pull::Up));
        let mut io = Io::new(io_mux);
        io.set_interrupt_handler(on_falling_edge);
        critical_section::with(|cs| {
            input.listen(Event::FallingEdge);
            BUTTON.borrow_ref_mut(cs).replace(input);
        });
        Self { _private: () }
    }

    /// Чи був фронт з попереднього виклику; прапорець скидається.
    /// `#[must_use]`: проігнорувати результат — означає загубити фронт.
    #[must_use]
    pub fn take_edge(&self) -> bool {
        EDGE.swap(false, Ordering::Acquire)
    }

    pub fn is_pressed(&self) -> bool {
        critical_section::with(|cs| BUTTON.borrow_ref(cs).as_ref().is_some_and(Input::is_low))
    }
}

/// Найдовший рядок, разом із `\n` (як `kMaxLineLength` у C++ `tryPrintf`).
const MAX_LINE_LENGTH: usize = 64;

/// Надрукувати рядок одним записом; повертає `false`, якщо рядок задовгий і пропущений.
///
/// `println!` з esp-println віддає кожен шматок формату («Mode: », «BLINK», «\n») окремим
/// USB-пакетом і на кожному чекає хоста, а якщо не дочекався — пропускає шматок. Тут рядок
/// форматується в `heapless::String` на стеку (без купи) і йде одним пакетом. Ще один бонус:
/// ніщо не надрукується наполовину.
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

/// Лічильник тактів CPU (регістр CCOUNT), як `ESP.getCycleCount()`: на 240 МГц один такт ≈ 4 нс.
pub fn cycles() -> u32 {
    esp_hal::xtensa_lx::timer::get_cycle_count()
}

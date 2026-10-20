//! Урок: брязкіт кнопки — що бачить ESP32-S3 і що бачить логічний аналізатор.
//!
//! ```text
//! GPIO21 ── кнопка ── GND        (pull-up: відпущена = HIGH, натиснута = LOW)
//! GPIO21 ── CH1 логічного аналізатора, GND аналізатора ── GND плати
//! GPIO40 ── CH2 «BOUNCE»: HIGH від другого фронту події до її кінця — тригер лише на брязкіт
//! GPIO41 ── CH3 «LABEL»: UART 115200, текст події (Async Serial у Logic 2 покаже його на шкалі)
//! ```
//!
//! Переривання на обидва фронти спрацьовує на КОЖНОМУ фронті й записує його час у мікросекундах.
//! Головний цикл чекає, доки на кнопці 50 мс тиша, і друкує звіт про подію (натискання або
//! відпускання): скільки фронтів, скільки тривав брязкіт, найкоротший імпульс.
//! Ту саму подію знайдіть в аналізаторі й порівняйте кількість фронтів. Схема — у README.md.

#![no_std]
#![no_main]

use core::{cell::RefCell, fmt::Write as _};

use bounce_test::{Classifier, EdgeLog, QUIET_US};
use critical_section::Mutex;
use embassy_executor::Spawner;
use embassy_time::Timer;
use esp_backtrace as _;
use esp_hal::{
    clock::CpuClock,
    gpio::{Event, Input, InputConfig, Io, Level, Output, OutputConfig, Pull},
    handler, ram,
    time::Instant,
    timer::timg::TimerGroup,
    uart::{self, UartTx},
};
use esp_println::println;

esp_bootloader_esp_idf::esp_app_desc!();

const BUTTON_PIN: u8 = 21;
const BOUNCE_PIN: u8 = 40; // маркер для аналізатора (CH2)
const LABEL_TX_PIN: u8 = 41; // підписи подій для аналізатора (CH3), лише TX
const LABEL_BAUD: u32 = 115_200;

/// Усе, чого торкається обробник переривання.
///
/// У C++ це `volatile` глобальні змінні, а `loop()` обгортає читання в
/// `noInterrupts()`/`interrupts()`. Тут дані лежать у `critical_section::Mutex`: дістати їх
/// можна лише всередині `critical_section::with(|cs| …)`, тож компілятор сам стежить, щоб
/// ISR і головний цикл не змінювали журнал одночасно. `volatile` не потрібен: критична
/// секція — це й бар'єр для компілятора.
struct Shared {
    button: Input<'static>,
    bounce_marker: Output<'static>,
    log: EdgeLog,
}

static SHARED: Mutex<RefCell<Option<Shared>>> = Mutex::new(RefCell::new(None));

/// Мікросекунди від старту, обрізані до 32 біт, — як `micros()` в Arduino.
fn micros() -> u32 {
    Instant::now().duration_since_epoch().as_micros() as u32
}

/// Обробник переривання: якомога коротший. Лише записати час — друкує головний цикл.
///
/// `#[ram]` — аналог `IRAM_ATTR`: код лежить у внутрішній RAM і не залежить від кешу флешу.
/// `#[handler]` робить зі звичайної функції обробник переривання з потрібним ABI.
#[handler]
#[ram]
fn on_button_edge() {
    let now = micros();
    critical_section::with(|cs| {
        let mut shared = SHARED.borrow_ref_mut(cs);
        let Some(s) = shared.as_mut() else { return };
        s.button.clear_interrupt(); // інакше обробник викликатиметься без кінця
        if s.log.record(now) == 2 {
            s.bounce_marker.set_high(); // другий фронт = брязкіт; гасить головний цикл
        }
    });
}

#[allow(
    clippy::large_stack_frames,
    reason = "журнал подій (64 моменти фронтів) живе в стеку main весь час роботи — це свідомо"
)]
#[esp_rtos::main]
async fn main(_spawner: Spawner) -> ! {
    let peripherals = esp_hal::init(esp_hal::Config::default().with_cpu_clock(CpuClock::max()));
    let timg0 = TimerGroup::new(peripherals.TIMG0);
    esp_rtos::start(timg0.timer0, peripherals.FROM_CPU_INTR0);

    // Внутрішній резистор ~45 кОм до 3.3 В.
    let mut button = Input::new(peripherals.GPIO21, InputConfig::default().with_pull(Pull::Up));
    let mut classifier = Classifier::new(button.is_low());
    let bounce_marker = Output::new(peripherals.GPIO40, Level::Low, OutputConfig::default());
    // Лише TX: RX не потрібен.
    let mut label = UartTx::new(peripherals.UART1, uart::Config::default().with_baudrate(LABEL_BAUD))
        .expect("valid UART config")
        .with_tx(peripherals.GPIO41);

    let mut io = Io::new(peripherals.IO_MUX);
    io.set_interrupt_handler(on_button_edge);
    critical_section::with(|cs| {
        button.listen(Event::AnyEdge); // CHANGE
        SHARED
            .borrow_ref_mut(cs)
            .replace(Shared { button, bounce_marker, log: EdgeLog::new() });
    });

    println!();
    println!("=== ESP32-S3: button bounce test ===");
    println!(
        "Button GPIO{BUTTON_PIN}, interrupt CHANGE, event ends after {} ms of quiet",
        QUIET_US / 1000
    );
    println!(
        "Analyzer: CH1=GPIO{BUTTON_PIN} button, CH2=GPIO{BOUNCE_PIN} BOUNCE marker, \
         CH3=GPIO{LABEL_TX_PIN} LABEL (UART {LABEL_BAUD})"
    );
    println!("Press the button: one line per press and per release.");

    loop {
        // Подія закінчилася, коли були фронти і після останнього минуло QUIET_US.
        // Забрати журнал атомарно: у критичній секції взяти його й залишити порожній.
        let finished = critical_section::with(|cs| {
            let mut shared = SHARED.borrow_ref_mut(cs);
            let s = shared.as_mut()?;
            if !s.log.is_finished(micros()) {
                return None;
            }
            s.bounce_marker.set_low(); // подія закінчилася
            Some((core::mem::take(&mut s.log), s.button.is_low()))
        });

        if let Some((log, low)) = finished {
            let report = classifier.classify(log, low);
            println!("{report}");
            // Помилку UART тут нема куди повідомити; підпис — лише підказка для аналізатора.
            let _ = write!(label, "{}", report.label());
        }
        Timer::after_millis(1).await;
    }
}

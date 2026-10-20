//! Модуль 1.5 — лабораторія брязкоту: що бачить ESP32-S3 через переривання
//! (`cargo run --release`, bin `bounce-lab`).
//!
//! ```text
//! GPIO16 ── кнопка ── GND      (pull-up: відпущена = HIGH, натиснута = LOW)
//! GPIO16 ── канал D0 логічного аналізатора
//! GPIO17 ── канал D1: «маркер ISR» — HIGH, поки виконується обробник переривання
//! ```
//!
//! Код з умови рахує лише фронти FALLING. Тут переривання на обидва фронти: обробник записує
//! КОЖЕН фронт із часом у мікросекундах у кільцевий буфер, а головний цикл групує фронти в
//! «події» (`button_bounce::Analyzer`). Подія закінчується, коли 50 мс немає нових фронтів.
//! Для кожної події друкується рядок, який можна прямо порівняти з логічним аналізатором
//! (той самий звіт будує tools/vcd_bounce.py із запису VCD).
//!
//! Команди в Serial Monitor: s — підсумок, r — скинути, h — довідка. Пояснення — у README.md.

#![no_std]
#![no_main]

use core::{
    cell::RefCell,
    sync::atomic::{AtomicU32, Ordering},
};

use button_bounce::{Analyzer, Edge, QUIET_US};
use critical_section::Mutex;
use embassy_executor::Spawner;
use embassy_futures::select::{Either, select};
use embassy_time::Timer;
use embedded_io_async::Read;
use esp_backtrace as _;
use esp_hal::{
    clock::CpuClock,
    gpio::{Event, Input, InputConfig, Io, Level, Output, OutputConfig, Pull},
    handler, ram,
    time::Instant,
    timer::timg::TimerGroup,
    usb::usb_serial_jtag::UsbSerialJtag,
};
use esp_println::{Printer, println};
use heapless::spsc::{Producer, Queue};
use static_cell::ConstStaticCell;

esp_bootloader_esp_idf::esp_app_desc!();

// --- Виводи ----------------------------------------------------------------------
const BUTTON_PIN: u8 = 16; // як в умові завдання
const ISR_MARKER_PIN: u8 = 17; // сусідній пін: зручно взяти другим каналом аналізатора

// --- Кільцевий буфер фронтів (ISR пише, головний цикл читає) -----------------------
//
// У C++ це масив + `volatile` лічильники `gHead`/`gTail`, і правильність тримається на
// домовленості: ISR пише лише `head`, `loop()` — лише `tail`, запис публікується після
// заповнення. `heapless::spsc::Queue` — та сама lock-free черга «один пише, один читає»,
// але домовленість перевіряє компілятор: `split()` дає рівно один `Producer` (його забирає
// ISR) і один `Consumer` (лишається в main), а порядок пам'яті забезпечують атомарні індекси.
// Головний цикл читає фронти без критичної секції — переривання не вимикаються ні на мить.
const RING_SIZE: usize = 512;
static RING: ConstStaticCell<Queue<Edge, { RING_SIZE + 1 }>> = ConstStaticCell::new(Queue::new()); // місткість N − 1
static DROPPED: AtomicU32 = AtomicU32::new(0); // скільки фронтів не влізло в буфер

/// Усе, чим користується обробник переривання. Доступ — лише в критичній секції.
struct Isr {
    button: Input<'static>,
    marker: Output<'static>,
    ring: Producer<'static, Edge>,
}

static ISR: Mutex<RefCell<Option<Isr>>> = Mutex::new(RefCell::new(None));

/// Мікросекунди від старту, обрізані до 32 біт, — як `(uint32_t)esp_timer_get_time()`.
fn micros() -> u32 {
    Instant::now().duration_since_epoch().as_micros() as u32
}

/// Обробник переривання. Він має бути коротким і лежати у внутрішній RAM: `#[ram]` — аналог
/// `IRAM_ATTR` (переривання може прийти, коли кеш флеш-пам'яті вимкнений). Тут немає друку:
/// лише час, рівень піна і запис у чергу. `Output::set_high()` — запис у регістр W1TS,
/// як `REG_WRITE(GPIO_OUT_W1TS_REG, …)` у C++, тож маркер не повільніший.
#[handler]
#[ram]
fn on_button_edge() {
    critical_section::with(|cs| {
        let mut isr = ISR.borrow_ref_mut(cs);
        let Some(isr) = isr.as_mut() else { return };
        isr.marker.set_high(); // маркер ISR: HIGH

        let edge = Edge { t_us: micros(), high: isr.button.is_high() };
        isr.button.clear_interrupt();
        if isr.ring.enqueue(edge).is_err() {
            DROPPED.fetch_add(1, Ordering::Relaxed);
        }

        isr.marker.set_low(); // маркер ISR: LOW
    });
}

fn print_help() {
    println!();
    println!("=== ESP32-S3: button bounce lab (module 1.5) ===");
    println!("Button: GPIO{BUTTON_PIN} -> GND, INPUT_PULLUP, interrupt CHANGE");
    println!(
        "ISR marker: GPIO{ISR_MARKER_PIN} is HIGH while the ISR runs (logic analyzer channel 2)"
    );
    println!(
        "An event ends after {} ms without edges. Keys: s = summary, r = reset, h = help",
        QUIET_US / 1000
    );
}

#[esp_rtos::main]
async fn main(_spawner: Spawner) -> ! {
    let peripherals = esp_hal::init(esp_hal::Config::default().with_cpu_clock(CpuClock::max()));
    let timg0 = TimerGroup::new(peripherals.TIMG0);
    esp_rtos::start(timg0.timer0, peripherals.FROM_CPU_INTR0);

    let mut button = Input::new(peripherals.GPIO16, InputConfig::default().with_pull(Pull::Up));
    let marker = Output::new(peripherals.GPIO17, Level::Low, OutputConfig::default());
    let mut analyzer = Analyzer::new(button.is_high());
    let (mut serial_rx, _serial_tx) =
        UsbSerialJtag::new(peripherals.USB_DEVICE).into_async().split();
    let (producer, mut ring) = RING.take().split();

    print_help();

    let mut io = Io::new(peripherals.IO_MUX);
    io.set_interrupt_handler(on_button_edge);
    critical_section::with(|cs| {
        button.listen(Event::AnyEdge); // CHANGE
        ISR.borrow_ref_mut(cs).replace(Isr { button, marker, ring: producer });
    });

    // `Printer` — той самий вихід, що й println!; помилок він не повертає, тож `let _ =`.
    let mut out = Printer;
    let mut keys = [0u8; 16];
    loop {
        // Забрати всі нові фронти з буфера. Те, що ISR допише тим часом, заберемо наступного разу.
        while let Some(edge) = ring.dequeue() {
            analyzer.add_edge(edge);
        }
        // Подія закінчилась, якщо QUIET_US немає нових фронтів.
        let _ = analyzer.poll(micros(), DROPPED.load(Ordering::Relaxed), &mut out);

        // Чекати клавішу, але не довше 1 мс — щоб вчасно помітити кінець події.
        let Either::First(read) = select(serial_rx.read(&mut keys), Timer::after_millis(1)).await
        else {
            continue;
        };
        let Ok(len) = read; // помилка USB-Serial-JTAG має тип `Infallible`
        for &key in &keys[..len] {
            match key {
                b's' => {
                    let _ = analyzer.print_summary(DROPPED.load(Ordering::Relaxed), &mut out);
                }
                b'r' => {
                    // Відкинути непрочитані фронти й почати з поточного рівня кнопки.
                    while ring.dequeue().is_some() {}
                    DROPPED.store(0, Ordering::Relaxed);
                    let high = critical_section::with(|cs| {
                        ISR.borrow_ref(cs).as_ref().is_none_or(|isr| isr.button.is_high())
                    });
                    analyzer.reset(high);
                    println!("--- reset ---");
                }
                b'h' => print_help(),
                _ => {}
            }
        }
    }
}

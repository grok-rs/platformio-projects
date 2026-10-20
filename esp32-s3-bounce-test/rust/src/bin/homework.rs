//! ДЗ модуля 1.5 — код з умови без змін у логіці (`cargo run --release --bin homework`).
//! Єдина відмінність: кнопка на GPIO21 замість GPIO16 — так зібрано стенд з уроку.
//! Рахує спрацювання переривання FALLING; порівняйте цей лічильник з кількістю спадаючих
//! фронтів на CH1 логічного аналізатора.

#![no_std]
#![no_main]

use core::{
    cell::RefCell,
    sync::atomic::{AtomicU32, Ordering},
};

use critical_section::Mutex;
use embassy_executor::Spawner;
use embassy_time::Timer;
use esp_backtrace as _;
use esp_hal::{
    clock::CpuClock,
    gpio::{Event, Input, InputConfig, Io, Pull},
    handler, ram,
    timer::timg::TimerGroup,
};
use esp_println::println;

esp_bootloader_esp_idf::esp_app_desc!();

// Кнопка підключена до GPIO 21 (в умові — GPIO 16): `peripherals.GPIO21` нижче.

/// Лічильник, який змінює переривання. У C++ — `volatile uint32_t`; але `volatile` лише
/// забороняє кешувати значення, а `button_counter++` — це все одно три кроки (прочитати,
/// додати, записати). `AtomicU32::fetch_add` — одна неподільна операція, і `unsafe` не треба.
static BUTTON_COUNTER: AtomicU32 = AtomicU32::new(0);

/// Вивід потрібен обробнику, щоб скинути прапорець переривання.
static BUTTON: Mutex<RefCell<Option<Input<'static>>>> = Mutex::new(RefCell::new(None));

/// Швидка функція обробки переривань (ISR), яка розміщується в оперативній пам'яті:
/// `#[ram]` — те саме, що `IRAM_ATTR`.
#[handler]
#[ram]
fn button_isr() {
    critical_section::with(|cs| {
        if let Some(button) = BUTTON.borrow_ref_mut(cs).as_mut() {
            button.clear_interrupt();
        }
    });
    BUTTON_COUNTER.fetch_add(1, Ordering::Relaxed);
}

#[esp_rtos::main]
async fn main(_spawner: Spawner) -> ! {
    let peripherals = esp_hal::init(esp_hal::Config::default().with_cpu_clock(CpuClock::max()));
    let timg0 = TimerGroup::new(peripherals.TIMG0);
    esp_rtos::start(timg0.timer0, peripherals.FROM_CPU_INTR0);

    let mut button = Input::new(peripherals.GPIO21, InputConfig::default().with_pull(Pull::Up));

    // Прив'язка переривання. FALLING означає спрацьовування при натисканні (перехід з 1 в 0).
    let mut io = Io::new(peripherals.IO_MUX);
    io.set_interrupt_handler(button_isr);
    critical_section::with(|cs| {
        button.listen(Event::FallingEdge);
        BUTTON.borrow_ref_mut(cs).replace(button);
    });

    let mut last_count = 0; // Змінна для відслідковування змін у головному циклі
    loop {
        let count = BUTTON_COUNTER.load(Ordering::Relaxed);
        if count != last_count {
            last_count = count;
            println!("Button Pressed! Count: {last_count}");
        }
        Timer::after_millis(10).await;
    }
}

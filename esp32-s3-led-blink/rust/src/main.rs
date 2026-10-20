//! Точка входу. Тут лише «збирання» програми з компонентів:
//!   `LedDriver`    — як кадри потрапляють на виводи (залежить від схеми);
//!   `BlinkPlayer`  — перемикання кадрів патерну за часом;
//!   `button_task`  — кнопка BOOT (окрема задача Embassy);
//!   `console_task` — клавіші з Serial-монітора (окрема задача Embassy).
//!
//! Обидві задачі лише надсилають [`Command`] у канал; виконує їх головний цикл, який єдиний
//! володіє програвачем. Тому спільного змінюваного стану між задачами немає зовсім.
//!
//! Вибір схеми — єдине місце з умовною компіляцією: feature `single-gpio` у Cargo.toml
//! (аналог `-DSINGLE_GPIO_MODE=1` у platformio.ini).

#![no_std]
#![no_main]

#[cfg(not(feature = "single-gpio"))]
mod gpio_led_driver;
#[cfg(feature = "single-gpio")]
mod shared_pin_led_driver;

use embassy_executor::Spawner;
use embassy_futures::select::{Either, select};
use embassy_sync::{blocking_mutex::raw::CriticalSectionRawMutex, channel::Channel};
use embassy_time::{Duration, Instant, Ticker, Timer};
use embedded_io_async::Read;
use esp_backtrace as _;
use esp_hal::{
    Async,
    clock::CpuClock,
    gpio::{Input, InputConfig, Pull},
    timer::timg::TimerGroup,
    usb::usb_serial_jtag::{UsbSerialJtag, UsbSerialJtagRx},
};
use esp_println::{print, println};
use led_blink::{
    BlinkPlayer, Button, Command, Frame, LedDriver,
    pattern::{INITIAL_SPEED_INDEX, PATTERNS, SPEEDS},
};

esp_bootloader_esp_idf::esp_app_desc!();

/// Усі часові константи проєкту — в одному місці (виводи вибираються в `main`).
mod config {
    use embassy_time::Duration;

    // --- Кнопка BOOT (GPIO0, активний рівень LOW) ------------------------------
    pub const DEBOUNCE: Duration = Duration::from_millis(30); // ігнорувати брязкіт контактів
    pub const LONG_PRESS: Duration = Duration::from_millis(600); // довше — «довге» натискання

    // --- Самотест після старту ---------------------------------------------------
    pub const SELF_TEST_STEP: Duration = Duration::from_millis(400);

    // --- Головний цикл -------------------------------------------------------------
    // Період опитування та мультиплексу в режимі одного GPIO: 1 мс -> ~500 Гц на кожен LED.
    pub const TICK: Duration = Duration::from_millis(1);
}

/// Черга команд від кнопки й консолі до головного циклу.
/// `static` без `mut` і без `unsafe`: канал сам синхронізує доступ (критична секція).
static COMMANDS: Channel<CriticalSectionRawMutex, Command, 8> = Channel::new();

#[esp_rtos::main]
async fn main(spawner: Spawner) -> ! {
    let peripherals = esp_hal::init(esp_hal::Config::default().with_cpu_clock(CpuClock::max()));
    let timg0 = TimerGroup::new(peripherals.TIMG0);
    esp_rtos::start(timg0.timer0, peripherals.FROM_CPU_INTR0);

    // --- Виводи YD-ESP32-S3 (клон ESP32-S3-DevKitC-1) ---------------------------
    // GPIO4…7 обрано свідомо: не strapping-піни (0, 3, 45, 46), не USB (19, 20),
    // не зайняті флеш/PSRAM (26…37). Кожен вивід — окремий тип і «переміщується» в драйвер:
    // використати GPIO4 ще десь — помилка компіляції, а не два драйвери на одному піні.
    #[cfg(not(feature = "single-gpio"))]
    let mut driver = gpio_led_driver::GpioLedDriver::new(
        peripherals.GPIO4, // червоний
        peripherals.GPIO6, // зелений (необов'язковий)
        peripherals.GPIO5, // синій
    );
    #[cfg(feature = "single-gpio")]
    let mut driver = shared_pin_led_driver::SharedPinLedDriver::new(peripherals.GPIO7);

    // Кнопка BOOT на платі; зовнішня підтяжка 10 кОм уже є, внутрішня не завадить.
    let boot = Input::new(peripherals.GPIO0, InputConfig::default().with_pull(Pull::Up));
    let (serial_rx, _serial_tx) = UsbSerialJtag::new(peripherals.USB_DEVICE).into_async().split();

    print_banner(&driver);
    run_self_test(&mut driver, config::SELF_TEST_STEP).await;

    let mut player = BlinkPlayer::new(driver, PATTERNS, SPEEDS, INITIAL_SPEED_INDEX);
    player.start(Instant::now());
    print_state(&player);

    spawner.spawn(button_task(boot).expect("button task is spawned once"));
    spawner.spawn(console_task(serial_rx).expect("console task is spawned once"));

    // Головний цикл: виконати команду, щойно вона прийде, або зробити черговий тік.
    let mut ticker = Ticker::every(config::TICK);
    loop {
        match select(COMMANDS.receive(), ticker.next()).await {
            Either::First(command) => execute(&mut player, command),
            Either::Second(()) => {
                player.update(Instant::now());
                player.driver_mut().tick();
            }
        }
    }
}

/// Опитувати кнопку кожну мілісекунду; події перетворювати на команди.
#[embassy_executor::task]
async fn button_task(pin: Input<'static>) {
    let mut button = Button::new(config::DEBOUNCE, config::LONG_PRESS);
    let mut ticker = Ticker::every(config::TICK);
    loop {
        if let Some(event) = button.poll(pin.is_low(), Instant::now()) {
            COMMANDS.send(event.into()).await;
        }
        ticker.next().await;
    }
}

/// Чекати байти з Serial-монітора (без опитування — задача спить до переривання USB).
#[embassy_executor::task]
async fn console_task(mut rx: UsbSerialJtagRx<'static, Async>) {
    let mut buf = [0u8; 16];
    loop {
        // Помилка читання USB-Serial-JTAG має тип `Infallible`, тож `Ok(..)` — єдиний варіант.
        let Ok(len) = rx.read(&mut buf).await;
        for command in buf[..len].iter().copied().filter_map(Command::from_key) {
            COMMANDS.send(command).await;
        }
    }
}

fn execute<D: LedDriver>(player: &mut BlinkPlayer<D>, command: Command) {
    match command {
        Command::NextSpeed => {
            player.next_speed();
            print_state(player);
        }
        Command::NextPattern => {
            player.next_pattern(Instant::now());
            print_state(player);
        }
        Command::Hold { frame, label } => {
            player.hold(frame);
            println!("TEST: {label}");
        }
        Command::Resume if player.is_held() => {
            player.resume(Instant::now());
            print!("Pattern resumed. ");
            print_state(player);
        }
        Command::Resume => {}
    }
}

fn print_banner(driver: &impl LedDriver) {
    println!();
    println!("=== ESP32-S3 LED blink ===");
    println!("{driver}");
    println!("BOOT button: short press = next speed, long press = next pattern");
    println!("Serial keys: 1/2/3 = hold red/blue/green, 0 = all off, p = pattern, v = speed,");
    println!("             any other key = resume pattern");
}

fn print_state<D: LedDriver>(player: &BlinkPlayer<D>) {
    println!(
        "Pattern: {:<14}  Speed: {:>4} ms/frame",
        player.pattern().name,
        player.frame_duration().as_millis()
    );
}

/// Один прогін усіх світлодіодів після старту. `Timer::after(..).await` не блокує процесор,
/// як `delay()`: поки світлодіод горить, виконавець може запускати інші задачі.
async fn run_self_test(driver: &mut impl LedDriver, step: Duration) {
    println!("Self-test: red -> blue -> green");
    for frame in [Frame::RED, Frame::BLUE, Frame::GREEN, Frame::empty()] {
        driver.show(frame);
        Timer::after(step).await;
    }
}

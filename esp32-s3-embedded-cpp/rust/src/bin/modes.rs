//! ДЗ модуля 2.1, завдання 1–4: superloop з трьома режимами LED, кнопка на перериванні,
//! заміри тривалості ітерації (`cargo run --release`).
//!
//!   GPIO15 → резистор 220 Ω → анод LED → катод → GND
//!   GPIO21 → кнопка → GND, підтяжка вгору (натиснута = LOW), переривання на спадаючий фронт
//!
//! Кожне натискання: BLINK → STEADY_ON → STEADY_OFF → BLINK…
//! Кожні 1000 ітерацій — середня, мінімальна й максимальна тривалість ітерації.

#![no_std]
#![no_main]

use embedded_cpp::{
    Blinker, EdgeDebouncer, LedMode, LedState, LoopStats, config, cycles_to_ns,
    hw::{Button, Led, cycles, millis, print_line},
};
use esp_backtrace as _;
use esp_hal::{
    clock::{self, CpuClock},
    main,
};
use esp_println::println;

esp_bootloader_esp_idf::esp_app_desc!();

#[main]
fn main() -> ! {
    let peripherals = esp_hal::init(esp_hal::Config::default().with_cpu_clock(CpuClock::max()));
    // Частоту для перерахунку тактів у нс беремо з HAL, а не дублюємо константою (C++: getCpuFreqMHz()).
    let cpu_mhz = clock::cpu_clock().as_mhz();
    let mut led = Led::new(peripherals.GPIO15); // config::led::PIN
    let button = Button::new(peripherals.GPIO21, peripherals.IO_MUX); // config::button::PIN

    println!();
    println!("=== ESP32-S3: LED modes, superloop + ISR ===");
    println!("LED GPIO{}, blink {} ms", config::led::PIN, config::led::BLINK_INTERVAL_MS);
    println!(
        "Button GPIO{} (FALLING), debounce {} ms",
        config::button::PIN,
        config::button::DEBOUNCE_MS
    );
    println!("Loop stats every {} iterations", config::profiler::WINDOW_ITERATIONS);

    // Стан superloop — локальні змінні `main`: вона ніколи не повертається, тож їм не треба
    // бути глобальними. Глобальні лише прапорець і вхід, які бачить обробник (див. `hw`).
    let mut blinker = Blinker::new(config::led::BLINK_INTERVAL_MS);
    let mut debouncer = EdgeDebouncer::new(config::button::DEBOUNCE_MS);
    let mut stats = LoopStats::new(config::profiler::WINDOW_ITERATIONS);
    let mut mode = LedMode::Blink;
    let mut press_count: u32 = 0;

    blinker.restart(millis());
    print_line(format_args!("Mode: {mode}"));
    let mut last_pass_cycles = cycles();

    // Одна ітерація = один прохід. Нічого не чекає: кожен крок перевіряє «чи пора?» і йде далі.
    loop {
        let now_ms = millis(); // один момент часу на весь прохід

        // Кнопка. Рівень читаємо лише тоді, коли фронти стихли: LOW — натискання,
        // HIGH — брязкіт відпускання.
        if debouncer.settled(button.take_edge(), now_ms) && button.is_pressed() {
            press_count += 1;
            mode = mode.next();
            if mode == LedMode::Blink {
                blinker.restart(now_ms); // почати блимання з «увімкнено»
            }
            print_line(format_args!("Press #{press_count} -> mode {mode}"));
        }

        // LED.
        led.set(match mode {
            LedMode::Blink => blinker.update(now_ms),
            LedMode::SteadyOn => LedState::On,
            LedMode::SteadyOff => LedState::Off,
        });

        // Заміри: тривалість ітерації = час між двома послідовними проходами цієї точки.
        let now_cycles = cycles();
        let full = stats.add(now_cycles.wrapping_sub(last_pass_cycles));
        last_pass_cycles = now_cycles;
        if full {
            let ns = |c| cycles_to_ns(c, cpu_mhz);
            print_line(format_args!(
                "Loop x{}: avg {} ns, min {} ns, max {} ns",
                stats.count(),
                ns(stats.average()),
                ns(stats.min()),
                ns(stats.max())
            ));
            stats.reset();
            last_pass_cycles = cycles(); // сам звіт (Serial) не рахувати в наступне вікно
        }
    }
}

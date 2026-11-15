//! Модуль 2.5, ДЗ «Таймери» — те саме, що cpp/src/main.c, але Rust поверх ESP-IDF (esp-idf-hal):
//! витяжний вентилятор щогодини вмикається на 15 хвилин. Цикл веде апаратний таймер (gptimer):
//! перемикає вентилятор сам обробник, main лише друкує стан і годує сторожа.

use std::sync::atomic::{AtomicBool, AtomicU32, Ordering::Relaxed};
use std::time::Duration;

use esp_idf_svc::hal::{
    delay::FreeRtos,
    gpio::{InterruptType, Level, PinDriver, Pull},
    peripherals::Peripherals,
    reset::ResetReason,
    task::watchdog::{TWDTConfig, TWDTDriver},
    timer::{
        TimerDriver,
        config::{AlarmConfig, TimerConfig},
    },
};
use esp_idf_svc::sys::EspError;
use esp_idf_svc::timer::EspTaskTimerService;

const PERIOD_S: u32 = 3600; // довжина циклу: 1 година
const ON_S: u32 = 900; // з них вентилятор працює: 15 хвилин
const SPEEDUP: u64 = 300; // налагодження: 300 = година за 12 с і 15 хв за 3 с; у роботі поставте 1
const WDT_S: u64 = 5; // сторож: стільки секунд без тіків таймера — і перезавантаження

static SECOND: AtomicU32 = AtomicU32::new(0); // де ми в циклі, 0 … PERIOD_S − 1
static TICKS: AtomicU32 = AtomicU32::new(0); // скільки разів спрацював таймер: доказ, що він живий
static FAN_ON: AtomicBool = AtomicBool::new(true); // у C це gpio_get_level(FAN)

/// Захист від повторного запуску: поки вентилятор працює, кнопка нічого не робить
/// (15 хвилин не подовжуються, брязкіт теж безпечний). Якщо чекає — наступний тік почне цикл спочатку.
fn on_button() {
    if SECOND.load(Relaxed) >= ON_S {
        SECOND.store(PERIOD_S - 1, Relaxed);
    }
}

fn main() -> Result<(), EspError> {
    esp_idf_svc::sys::link_patches();
    let p = Peripherals::take()?;

    let mut fan = PinDriver::output(p.pins.gpio2)?; // GPIO2 → 10 кОм → BC547B → IN модуля реле; 1 = працює
    let mut run = PinDriver::output(p.pins.gpio15)?; // червоний: вентилятор працює
    let mut wait = PinDriver::output(p.pins.gpio16)?; // зелений: вентилятор чекає
    fan.set_high()?; // цикл починається з роботи: SECOND = 0 < ON_S
    run.set_high()?;

    // Кнопка на GND: «увімкнути зараз»
    let mut button = PinDriver::input(p.pins.gpio21, Pull::Up)?;
    button.set_interrupt_type(InterruptType::NegEdge)?;
    // SAFETY: обробник лише читає й пише атомарні змінні, а це дозволено в перериванні
    unsafe { button.subscribe(on_button)? };
    button.enable_interrupt()?;

    // Весь цикл вентилятора — у цьому замиканні: раз на секунду циклу, незалежно від того, що робить main
    let mut timer = TimerDriver::new(&TimerConfig::default())?; // 1 МГц: 1 тік = 1 мкс
    timer.subscribe(move |_| {
        TICKS.fetch_add(1, Relaxed);
        let mut second = SECOND.load(Relaxed) + 1;
        if second >= PERIOD_S {
            second = 0;
        }
        SECOND.store(second, Relaxed);
        let on = second < ON_S;
        FAN_ON.store(on, Relaxed);
        let _ = fan.set_level(Level::from(on)); // gpio_set_level можна викликати з переривання
        let _ = run.set_level(Level::from(on));
        let _ = wait.set_level(Level::from(!on));
    })?;
    timer.set_alarm_action(Some(&AlarmConfig {
        alarm_count: 1_000_000 / SPEEDUP, // раз на секунду циклу
        auto_reload_on_alarm: true,       // повтор робить залізо: похибка не накопичується
        ..Default::default()
    }))?;
    timer.enable()?;
    timer.start()?;

    // Не погодували — перезавантаження. Стежимо лише за main, idle-задачі не підписуємо
    let mut twdt = TWDTDriver::new(
        p.twdt,
        &TWDTConfig {
            duration: Duration::from_secs(WDT_S),
            panic_on_trigger: true,
            subscribed_idle_tasks: Default::default(),
        },
    )?;
    let mut watch = twdt.watch_current_task()?;

    FreeRtos::delay_ms(2000); // монітор порту встигає під'єднатися після прошивки
    let after_wdt = ResetReason::get() == ResetReason::TaskWatchdog;
    println!(
        "Вентилятор: цикл {PERIOD_S} с, робота {ON_S} с, прискорення ×{SPEEDUP}, старт: {}",
        if after_wdt { "після сторожа" } else { "звичайний" }
    );

    let clock = EspTaskTimerService::new()?; // час від старту, як esp_timer_get_time() у C
    let mut shown = false; // що вже надруковано
    let mut seen = 0; // останній побачений тік
    loop {
        // Годуємо, лише якщо таймер живий: стереже і цей цикл, і таймер
        let ticks = TICKS.load(Relaxed);
        if ticks != seen {
            seen = ticks;
            watch.feed()?;
        }

        let on = FAN_ON.load(Relaxed);
        if on != shown {
            shown = on;
            println!(
                "[{} мс] {}, секунда циклу {}",
                clock.now().as_millis(),
                if on { "ПРАЦЮЄ" } else { "чекає" },
                SECOND.load(Relaxed)
            );
        }

        // esp-idf-hal вимикає переривання кнопки після кожного спрацювання, вмикати знову треба не з ISR
        button.enable_interrupt()?;
        FreeRtos::delay_ms(1); // 1 мс: віддаємо процесор іншим задачам
    }
}

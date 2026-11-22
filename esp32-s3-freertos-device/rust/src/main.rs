//! Модуль 6, урок 6.1, ДЗ — те саме, що cpp/src/main.c, але Rust поверх ESP-IDF.
//! Фінальний проєкт 2.3 «Мультизадачний пристрій», але задачами FreeRTOS.
//! Кожна справа — свій потік (у ESP-IDF це задача FreeRTOS) зі своїм циклом; ніхто не чекає на інших.

use std::sync::atomic::{AtomicBool, AtomicU8, Ordering};
use std::thread;
use std::time::{Duration, Instant};

use esp_idf_svc::hal::{
    cpu::Core,
    delay::{Ets, FreeRtos},
    gpio::{Input, PinDriver, Pull},
    peripherals::Peripherals,
    task::thread::ThreadSpawnConfiguration,
};
use esp_idf_svc::sys::EspError;

const SPEEDS: [u64; 3] = [1000, 500, 200]; // період LED2 по колу, мс
static SPEED: AtomicU8 = AtomicU8::new(0); // пише кнопкова задача, читає LED2
static PAUSED: AtomicBool = AtomicBool::new(false); // пише кнопкова задача, читають LED-задачі

/// Кнопка: рівень, інший за прийнятий, 4 опитування поспіль (40 мс) — нове натискання
struct Button<'d> {
    pin: PinDriver<'d, Input>,
    down: bool,
    same: u8,
}

impl Button<'_> {
    fn pressed(&mut self) -> bool {
        let now = self.pin.is_low(); // кнопка на GND, внутрішня підтяжка: натиснута = 0
        if now == self.down {
            self.same = 0;
            return false;
        }
        self.same += 1;
        if self.same < 4 {
            return false; // брязкіт або ще не встоялося
        }
        self.down = now;
        self.same = 0;
        now // подія лише на натискання, не на відпускання
    }
}

/// Задача FreeRTOS: ім'я, пріоритет і ядро задаємо перед spawn, як аргументи xTaskCreatePinnedToCore()
fn spawn(name: &'static core::ffi::CStr, priority: u8, f: impl FnOnce() + Send + 'static) -> Result<(), EspError> {
    ThreadSpawnConfiguration { name: Some(name), priority, pin_to_core: Some(Core::Core1), ..Default::default() }
        .set()?;
    thread::Builder::new().stack_size(4096).spawn(f).unwrap(); // Rust std їсть більше стека, ніж C
    Ok(())
}

fn main() -> Result<(), EspError> {
    esp_idf_svc::sys::link_patches();
    let p = Peripherals::take()?;
    let mut led1 = PinDriver::output(p.pins.gpio15)?; // червоний: світиться в паузі
    let mut led2 = PinDriver::output(p.pins.gpio16)?; // жовтий: період задає BTN1
    let mut led3 = PinDriver::output(p.pins.gpio17)?; // зелений: завжди 1000 мс
    let mut b1 = Button { pin: PinDriver::input(p.pins.gpio21, Pull::Up)?, down: false, same: 0 };
    let mut b2 = Button { pin: PinDriver::input(p.pins.gpio18, Pull::Up)?, down: false, same: 0 };

    FreeRtos::delay_ms(2000); // монітор порту встигає під'єднатися після прошивки
    println!("Мультизадачний пристрій на FreeRTOS: BTN1 — швидкість LED2, BTN2 — пауза");

    // Обидві кнопки: опитування кожні 10 мс, вищий пріоритет за LED
    spawn(c"buttons", 3, move || {
        let mut wake = Instant::now();
        loop {
            wake += Duration::from_millis(10); // тримаємо сітку, як xTaskDelayUntil()
            thread::sleep(wake.saturating_duration_since(Instant::now()));
            let (p1, p2) = (b1.pressed(), b2.pressed()); // опитуємо обидві завжди, навіть у паузі
            if p2 {
                let paused = !PAUSED.load(Ordering::Relaxed);
                PAUSED.store(paused, Ordering::Relaxed);
                led1.set_level(paused.into()).unwrap();
                println!("{}", if paused { "ПАУЗА вкл" } else { "ПАУЗА викл" });
            }
            if p1 && !PAUSED.load(Ordering::Relaxed) {
                let speed = (SPEED.load(Ordering::Relaxed) + 1) % 3;
                SPEED.store(speed, Ordering::Relaxed);
                println!("BTN1 -> LED2 = {} мс", SPEEDS[speed as usize]);
            }
        }
    })?;

    // LED2: період міняється на ходу, тож рахуємо паузу від кожного перемикання
    spawn(c"led2", 2, move || loop {
        if !PAUSED.load(Ordering::Relaxed) {
            led2.toggle().unwrap();
        }
        thread::sleep(Duration::from_millis(SPEEDS[SPEED.load(Ordering::Relaxed) as usize]));
    })?;

    // LED3: рівний період 1000 мс; сітка від старту, як xTaskDelayUntil()
    spawn(c"led3", 2, move || {
        let mut wake = Instant::now();
        loop {
            wake += Duration::from_millis(1000);
            thread::sleep(wake.saturating_duration_since(Instant::now()));
            if !PAUSED.load(Ordering::Relaxed) {
                led3.toggle().unwrap(); // у паузі завмирає в поточному стані
            }
        }
    })?;

    // Дослід із ДЗ: «важка» задача раз на 300 мс 80 мс крутиться в активному очікуванні.
    // Розкоментуйте й поміряйте LED3 і BTN1 з пріоритетом 1, потім 4.
    // spawn(c"heavy", 1, || loop {
    //     Ets::delay_us(80_000); // 80 мс не віддає процесор, як delayMicroseconds(80000) в Arduino
    //     FreeRtos::delay_ms(300);
    // })?;
    let _ = Ets::delay_us; // поки дослід вимкнено, щоб не було попередження про невикористаний імпорт

    // У C app_main повертається, і задача main зникає. Тут main просто спить: задачі живуть далі.
    loop {
        FreeRtos::delay_ms(60_000);
    }
}

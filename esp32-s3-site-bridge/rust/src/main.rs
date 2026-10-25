//! «Мій стенд» — міст між платою і сайтом курсу (сторінка `docs/live/`, Web Serial).
//!
//! ```text
//! 3V3 ── LDR ──┬── 10 кОм ── GND        (esp32-s3-ldr-adc)
//!              └── GPIO4 (ADC1_CH3)
//! GPIO21 ── кнопка ── GND               (esp32-s3-bounce-test, pull-up: натиснута = LOW)
//! ```
//!
//! Плата пише в USB Serial рядки JSON: `hello` на старті й раз на 5 с, `adc` кожні 100 мс і
//! `btn` після кожної події кнопки (моменти фронтів з переривання на обидва фронти).
//! Текст рядків — у `src/lib.rs`, той самий, що й у C++-версії.

#![no_std]
#![no_main]

use core::cell::RefCell;

use critical_section::Mutex;
use embassy_executor::Spawner;
use embassy_time::{Duration, Instant, Timer};
use esp_backtrace as _;
use esp_hal::{
    analog::adc::{Adc, AdcCalBasic, AdcCalCurve, AdcCalScheme, AdcConfig, Attenuation},
    clock::CpuClock,
    gpio::{Event, Input, InputConfig, Io, Pull},
    handler,
    peripherals::ADC1,
    ram,
    timer::timg::TimerGroup,
};
use esp_println::println;
use site_bridge::{ADC_PERIOD_MS, AdcLine, Classifier, EdgeLog, HELLO_PERIOD_MS, Hello};

esp_bootloader_esp_idf::esp_app_desc!();

/// Усе, чого торкається обробник переривання (у C++ — `volatile` глобальні змінні).
struct Shared {
    button: Input<'static>,
    log: EdgeLog,
}

static SHARED: Mutex<RefCell<Option<Shared>>> = Mutex::new(RefCell::new(None));

/// Мікросекунди від старту, обрізані до 32 біт, — як `micros()` в Arduino.
fn micros() -> u32 {
    esp_hal::time::Instant::now().duration_since_epoch().as_micros() as u32
}

/// Обробник переривання: лише записати час. Друкує головний цикл.
#[handler]
#[ram]
fn on_button_edge() {
    let now = micros();
    critical_section::with(|cs| {
        let mut shared = SHARED.borrow_ref_mut(cs);
        let Some(s) = shared.as_mut() else { return };
        s.button.clear_interrupt();
        s.log.record(now);
    });
}

#[allow(
    clippy::large_stack_frames,
    reason = "журнал подій (64 моменти фронтів) переходить через стек main — це свідомо"
)]
#[esp_rtos::main]
async fn main(_spawner: Spawner) -> ! {
    let peripherals = esp_hal::init(esp_hal::Config::default().with_cpu_clock(CpuClock::max()));
    let timg0 = TimerGroup::new(peripherals.TIMG0);
    esp_rtos::start(timg0.timer0, peripherals.FROM_CPU_INTR0);

    // --- АЦП: GPIO4, 11 дБ, як у esp32-s3-ldr-adc ---------------------------------
    let mut adc_config = AdcConfig::new();
    let mut ldr =
        adc_config.enable_pin_with_cal::<_, AdcCalBasic<ADC1>>(peripherals.GPIO4, Attenuation::_11dB);
    let mut adc = Adc::new(peripherals.ADC1, adc_config);
    let curve = AdcCalCurve::<ADC1>::new_cal(Attenuation::_11dB);

    // --- Кнопка: GPIO21, внутрішній pull-up, переривання на обидва фронти ---------
    let mut button = Input::new(peripherals.GPIO21, InputConfig::default().with_pull(Pull::Up));
    let mut classifier = Classifier::new(button.is_low());
    let mut io = Io::new(peripherals.IO_MUX);
    io.set_interrupt_handler(on_button_edge);
    critical_section::with(|cs| {
        button.listen(Event::AnyEdge); // CHANGE
        SHARED.borrow_ref_mut(cs).replace(Shared { button, log: EdgeLog::new() });
    });

    println!("{}", Hello { pressed: classifier.pressed(), up_ms: Instant::now().as_millis() });

    let adc_period = Duration::from_millis(ADC_PERIOD_MS);
    let hello_period = Duration::from_millis(HELLO_PERIOD_MS);
    let mut next_adc = Instant::now() + adc_period;
    let mut next_hello = Instant::now() + hello_period;

    loop {
        let now = Instant::now();
        if now >= next_adc {
            next_adc += adc_period; // крок не «повзе», як `lastAdcAt += period` у C++
            let raw = adc.read_blocking(&mut ldr);
            // Окреме перетворення з кривою калібрування з eFuse — як analogReadMilliVolts().
            let mv = u32::from(curve.adc_val(adc.read_blocking(&mut ldr)));
            println!("{}", AdcLine { ms: now.as_millis(), raw, mv });
        }
        if now >= next_hello {
            next_hello += hello_period;
            println!("{}", Hello { pressed: classifier.pressed(), up_ms: now.as_millis() });
        }

        // Подія кнопки закінчилася, коли були фронти і після останнього минуло 50 мс тиші.
        let finished = critical_section::with(|cs| {
            let mut shared = SHARED.borrow_ref_mut(cs);
            let s = shared.as_mut()?;
            if !s.log.is_finished(micros()) {
                return None;
            }
            Some((core::mem::take(&mut s.log), s.button.is_low()))
        });
        if let Some((log, low)) = finished {
            println!("{}", classifier.classify(log, low));
        }
        Timer::after_millis(1).await;
    }
}

//! Модуль 2.2, ДЗ 2, експеримент — те саме, що cpp/src/uart_pwm.cpp: UART як джерело ШІМ.
//! Кадр 8N1 = старт (0) + 8 біт даних молодшим уперед + стоп (1): частка HIGH = (одиниці + 1) / 10.

#![no_std]
#![no_main]

use esp_backtrace as _;
use esp_hal::{
    clock::CpuClock,
    main,
    time::{Duration, Instant},
    uart::{Config, UartTx},
};
use esp_println::{print, println};

esp_bootloader_esp_idf::esp_app_desc!();

const BAUD: u32 = 9600; // кадр 10 біт → 960 кадрів/с: «ШІМ» 960 Гц
const SHOW: Duration = Duration::from_millis(3000); // кожен байт — 3 с
const BYTES: [u8; 4] = [0x00, 0x0F, 0x55, 0xFF];

fn show(b: u8) {
    print!("0x{b:02X}  кадр: 0 "); // старт-біт
    for i in 0..8 {
        print!("{}", (b >> i) & 1); // біти даних, молодший першим
    }
    println!(" 1  HIGH {} %", (b.count_ones() + 1) * 10); // стоп-біт
}

#[main]
fn main() -> ! {
    let p = esp_hal::init(esp_hal::Config::default().with_cpu_clock(CpuClock::max()));
    // TX UART1 → GPIO6: той самий ключ 2N2222 з мотором, що й у motor; сюди ж CH1 аналізатора.
    // Лише передавач (RX не потрібен); 8N1 — типові налаштування; у спокої TX = HIGH.
    let mut uart = UartTx::new(p.UART1, Config::default().with_baudrate(BAUD)).unwrap().with_tx(p.GPIO6);
    println!("UART як ШІМ: TX UART1 на GPIO6, 9600 бод, 8N1");

    let mut current = 0;
    show(BYTES[current]);
    let mut last_switch = Instant::now();
    loop {
        if last_switch.elapsed() >= SHOW {
            last_switch = Instant::now();
            current = (current + 1) % BYTES.len();
            show(BYTES[current]);
        }
        // FIFO повний — write чекає, тож кадри йдуть один за одним без пауз
        uart.write(&BYTES[current..=current]).unwrap();
    }
}

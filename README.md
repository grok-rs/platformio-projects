# platformio-projects

Embedded projects for the ESP32-S3, kept short and in the course teacher's style (one small `.cpp` per
firmware: `#define` pins, globals, `setup()`/`loop()`), each written twice so the two can be compared side by side:

* `cpp/` — C++ on the Arduino core, built with [PlatformIO](https://platformio.org/) (own `platformio.ini`);
* `rust/` — Rust on [esp-hal](https://github.com/esp-rs/esp-hal), a member of
  the Cargo workspace in the repository root (see [Rust](#rust)).

Both variants print the same text to Serial and run on the same breadboard wiring.
Hardware notes, wiring and docs live once, at the project level:

```
esp32-s3-<project>/
├── README.md        lesson notes, wiring, C++ ↔ Rust comparison for this project
├── docs/            schematics, breadboard renders
├── cpp/             platformio.ini, src/
└── rust/            Cargo.toml, src/main.rs or src/bin/<stage>.rs — one file per C++ file
```

| Project | Code | Board | Summary |
|---|---|---|---|
| [`esp32-s3-led-blink`](esp32-s3-led-blink/) | [C++](esp32-s3-led-blink/cpp/) · [Rust](esp32-s3-led-blink/rust/) | ESP32-S3-DevKitC-1 (N16R8) | Red/blue LEDs blinking alternately on two GPIOs (GPIO4/5); env `single-gpio` — both LEDs on **one** GPIO7 via HIGH / LOW / INPUT (Hi-Z) |
| [`esp32-s3-led-button`](esp32-s3-led-button/) | [C++](esp32-s3-led-button/cpp/) · [Rust](esp32-s3-led-button/rust/) | ESP32-S3-DevKitC-1 (N16R8) | Lesson: one LED (GPIO15, 220 Ω) and one button (GPIO21, `INPUT_PULLUP`); env `hold` — LED follows the button, env `toggle` — each press toggles the LED with a 30 ms software debounce; schematic and breadboard include an FX2 logic analyzer probing both signals |
| [`esp32-s3-led-pwm`](esp32-s3-led-pwm/) | [C++](esp32-s3-led-pwm/cpp/) · [Rust](esp32-s3-led-pwm/rust/) | ESP32-S3-DevKitC-1 (N16R8) | Lesson (teacher's `Blink_Correct`): LED brightness via PWM — `ledcSetup(0, 5000, 8)`, `ledcAttachPin(15, 0)`, `ledcWrite(0, 64)` = 25 % duty; logic analyzer on GPIO15 |
| [`esp32-s3-bounce-test`](esp32-s3-bounce-test/) | [C++](esp32-s3-bounce-test/cpp/) · [Rust](esp32-s3-bounce-test/rust/) | ESP32-S3-DevKitC-1 (N16R8) | Lesson: button bounce on GPIO21 — env `lab`: a `CHANGE` interrupt timestamps every edge and prints a per-press/release report (edges, bounce, shortest pulse, gaps) to compare with a logic analyzer; env `homework` — the module 1.5 homework code; [study page](https://grok-rs.github.io/platformio-projects/bounce-bench/) |
| [`esp32-s3-two-buttons`](esp32-s3-two-buttons/) | [C++](esp32-s3-two-buttons/cpp/) · [Rust](esp32-s3-two-buttons/rust/) | ESP32-S3-DevKitC-1 (N16R8) | Module 1.4: two LEDs, an external button (`INPUT_PULLUP`) and the on-board BOOT button (`INPUT`) select a sticky blink mode — synchronous 200 ms or alternating 1000 ms |
| [`esp32-s3-button-bounce`](esp32-s3-button-bounce/) | [C++](esp32-s3-button-bounce/cpp/) · [Rust](esp32-s3-button-bounce/rust/) | ESP32-S3-DevKitC-1 (N16R8) | Module 1.5: contact bounce on GPIO16 — env `homework-base`: the homework's `FALLING` counter; env `bounce-lab`: a `CHANGE` ISR timestamps every edge (ISR marker on GPIO17) and prints one table row per event; `tools/vcd_bounce.py` builds the same table from a logic-analyzer VCD |
| [`esp32-s3-ldr-adc`](esp32-s3-ldr-adc/) | [C++](esp32-s3-ldr-adc/cpp/) · [Rust](esp32-s3-ldr-adc/rust/) | ESP32-S3-DevKitC-1 (N16R8) | Module 1.6: photoresistor + 10 kΩ divider on GPIO4 (ADC1); every 100 ms prints `analogRead()` RAW, the voltage computed from it (`RAW / 4095 · 3100 mV`), calibrated `analogReadMilliVolts()` and the relative error |
| [`esp32-s3-twilight-relay`](esp32-s3-twilight-relay/) | [C++](esp32-s3-twilight-relay/cpp/) · [Rust](esp32-s3-twilight-relay/rust/) | ESP32-S3-DevKitC-1 (N16R8) | Mini-project 1 (lesson 18): twilight switch — LDR + 10 kΩ divider on GPIO4, two ADC thresholds with hysteresis, GPIO2 → BC547B level shifter (10 kΩ pull-up to 5 V) → active-LOW 5 V relay module → LED load; built-in USB-JTAG debugging configured; [study page](https://grok-rs.github.io/platformio-projects/twilight-relay/) |
| [`esp32-s3-embedded-cpp`](esp32-s3-embedded-cpp/) | [C++](esp32-s3-embedded-cpp/cpp/) · [Rust](esp32-s3-embedded-cpp/rust/) | ESP32-S3-DevKitC-1 (N16R8) | Module 2.1 homework, Embedded C++: Blink without `delay()` (`enum class LedState`, `class Led` with `init()`/`set()`, a `static constexpr` config struct, no globals); env `modes` adds superloop timing every 1000 passes and a button on a `FALLING` interrupt (`volatile` flag, debounce in `loop()`) cycling Blink → On → Off |
| [`esp32-s3-bright-module`](esp32-s3-bright-module/) | [C++](esp32-s3-bright-module/cpp/) · [Rust](esp32-s3-bright-module/rust/) | ESP32-S3-DevKitC-1 (N16R8) | Module 2.2 task ТЗ-A «Яскравий модуль»: GPIO5 → 1 kΩ → 2N2222 low-side switch, LED + 220 Ω powered from an MB-102 5 V module (common GND); LEDC 5 kHz / 8 bit, four levels (0/40/128/255) stepped by a button on GPIO6 (`INPUT_PULLDOWN`, `RISING` ISR flag, 50 ms debounce); one short firmware per stage (`switch`, `sweep`, `levels`, `softpwm`); [spec sheet](docs/power-loads/tz-a-spec.png) |
| [`esp32-s3-three-rhythms`](esp32-s3-three-rhythms/) | [C++](esp32-s3-three-rhythms/cpp/) · [Rust](esp32-s3-three-rhythms/rust/) | ESP32-S3-DevKitC-1 (N16R8) | Project A «Три ритми»: three LEDs (GPIO6/5/4, 220 Ω each) toggle every 200/500/1000 ms at the same time — three `millis()` timers in one short `loop()`, no `delay()`; loop passes per second printed to Serial |
| [`esp32-s3-multitask-device`](esp32-s3-multitask-device/) | [C++](esp32-s3-multitask-device/cpp/) · [Rust](esp32-s3-multitask-device/rust/) | ESP32-S3-DevKitC-1 (N16R8) | Final project «Мультизадачний пристрій»: LEDs on GPIO15/16/17 — LED3 every 1000 ms, LED2 speed cycled by BTN1 (GPIO21) 1000 → 500 → 200 ms, BTN2 (GPIO18) pauses with LED1 as indicator; buttons 3V3 → input (`INPUT_PULLDOWN`) with a 40 ms non-blocking edge debounce; events and loop passes per second on Serial; no `delay()` |
| [`esp32-s3-site-bridge`](esp32-s3-site-bridge/) | [C++](esp32-s3-site-bridge/cpp/) · [Rust](esp32-s3-site-bridge/rust/) | ESP32-S3-DevKitC-1 (N16R8) | Study site «Мій стенд»: streams JSON lines over USB CDC (LDR divider on GPIO4 via ADC1, button edges on GPIO21 with `micros()` timestamps) so the browser page can plot the real board next to the model (Web Serial) |

## Interactive study pages

Served by GitHub Pages from [`docs/`](docs/): **https://grok-rs.github.io/platformio-projects/**

| Page | What it shows |
|---|---|
| [Підтяжка входу](https://grok-rs.github.io/platformio-projects/pull-resistors/) | Module 1.4 theory, animated: floating input and 50 Hz pickup, pull-up vs pull-down, R·C edge speed and frequency, Schmitt trigger hysteresis, contact bounce, a frequency scale and a self-check quiz |
| [Осцилограф і кнопка](https://grok-rs.github.io/platformio-projects/scope-signals/) | Module 1.5 theory: a virtual oscilloscope and generator (V/div, time/div, trigger, cursors, measurements), edges and rise time, period/frequency/duty, probe bandwidth, contact bounce, logic analyzer and sample rate, DIY scopes, notes on the five lesson videos, discussion questions, quiz |
| [Лабораторія брязкоту](https://grok-rs.github.io/platformio-projects/bounce-lab/) | Module 1.5 homework animated: a capture of 10 presses in a logic-analyzer viewer, what the ESP32 interrupt actually sees, both firmwares, the 10-press results table, debounce strategies |
| [Брязкіт на стенді](https://grok-rs.github.io/platformio-projects/bounce-bench/) | Module 1.5 lecture notes on the real bench (GPIO21): 190 real button events recorded by the ESP32 in a virtual logic-analyzer viewer, an animated bouncing contact, a model of why the ISR loses edges, bounce statistics with a debounce-window slider, BOUNCE/LABEL markers for Logic 2, homework table and answers |
| [АЦП і світло](https://grok-rs.github.io/platformio-projects/adc-light/) | Module 1.6 theory for beginners: analog vs digital, sampling and quantization, ADC as a 4096-step ruler, LDR and the voltage divider, ADC1/ADC2 pin map, attenuation ranges, noise and averaging, common mistakes, quiz |
| [Люксметр на ESP32-S3](https://grok-rs.github.io/platformio-projects/ldr-lab/) | Module 1.6 homework animated: breadboard bench with a light source, schematic, SAR conversion step by step, code + flowchart stepping, Serial table, live plot, where the error comes from |
| [Сутінковий перемикач](https://grok-rs.github.io/platformio-projects/twilight-relay/) | Mini-project 1 (lesson 18): LDR divider → ADC → hysteresis → BC547B level shifter → 5 V relay module (active LOW) → LED load; live breadboard with a Type-C breadboard power module and schematic with animated electron flow, what-if faults (GPIO straight to IN, no common GND, no hysteresis, lamp on the LDR, no flyback diode), parts recap from earlier modules, drawing/wiring rules, BOM and wiring table, built-in USB-JTAG debugger, quiz |
| [Потужне навантаження](https://grok-rs.github.io/platformio-projects/power-loads/) | Module 2.2 theory + homework, verified against datasheets: active vs passive sorter, GPIO current budget on a log scale, a live NPN/MOSFET low-side switch simulator with animated current, base-resistor calculator with fading worked examples, switch picker (BC547B, 2N2222A, TIP120, AO3400A, ULN2003A…), collector oscilloscope with/without flyback diode, motor start and brownout, common-ground loop, spot-the-fault schematic, pre-power checklist, relay operate/release timing diagram, software PWM / UART-as-PWM / LEDC visualiser, quiz, glossary, teacher mode with the lesson plan, and a list of corrections to the LMS text with numbered sources |
| [Стенд ESP32-S3](https://grok-rs.github.io/platformio-projects/lab/) | Step-through model of all three firmwares: live circuit levels and current, executing code lines, variables, logic analyzer, Serial monitor, slow motion, what-if experiments (blocking `delay()`, no pull-up, no debounce) |

The pages are plain HTML files; to open them locally: `python3 -m http.server -d docs` → http://localhost:8000.
Every page follows the system light/dark theme; the switch at the end of the navigation strip ([`docs/site-theme.js`](docs/site-theme.js)) forces Light or Dark and remembers the choice.

## Working with the repository

```bash
git clone https://github.com/grok-rs/platformio-projects.git
cd platformio-projects/esp32-s3-led-blink/cpp
pio run -t upload && pio device monitor          # C++
cd ../rust && cargo run --release                # Rust (after the one-time setup below)
```

`platformio-projects.code-workspace` adds every `cpp/` folder as a workspace folder, so the PlatformIO
sidebar lists all of them at once, plus the repository root for rust-analyzer:
**File → Open Workspace from File…**

## Rust

### One-time setup

The ESP32-S3 has Xtensa cores, which upstream Rust does not ship, so the toolchain comes from
[espup](https://github.com/esp-rs/espup); flashing uses [espflash](https://github.com/esp-rs/espflash).

```bash
cargo install espup espflash --locked
espup install --targets esp32s3       # installs the `esp` toolchain + Xtensa GCC linker
source ~/export-esp.sh                # every new terminal (or add it to your shell rc)
```

`rust-toolchain.toml` selects the `esp` toolchain for the whole repository.

### Commands

| | C++ (in `<project>/cpp`) | Rust (in `<project>/rust`) |
|---|---|---|
| Build | `pio run [-e env]` | `cargo build --release [--bin name]` |
| Flash + monitor | `pio run -t upload && pio device monitor` | `cargo run --release [--bin name]` (runner: `espflash flash --monitor`) |
| Variants | `[env:…]` in `platformio.ini`, one `.cpp` each | `src/bin/<name>.rs`, one per C++ file |
| Lint | — | `cargo clippy --release -p <package>` |

From the repository root, `cargo build --release` builds every Rust firmware.

### Layout

```
Cargo.toml            workspace: members = esp32-s3-*/rust, shared dependency versions, lints, profiles
rust-toolchain.toml   channel = "esp"
.cargo/config.toml    target xtensa-esp32s3-none-elf, linker script, espflash runner, build-std
target/               one build directory for all firmwares (esp-hal is compiled once)
```

Each Rust firmware mirrors its C++ file line by line: a blocking `loop {}` with
`esp_hal::time::Instant` instead of `millis()`, `esp_hal::delay::Delay` instead of `delay()`,
`Output`/`Input` instead of `pinMode`/`digitalWrite`/`digitalRead`.
(`esp32-s3-site-bridge` is the exception: it keeps its library and Embassy tasks, because the study
site depends on its exact protocol.)

### Crates

| Crate | Role | Arduino / C++ counterpart |
|---|---|---|
| [`esp-hal`](https://docs.espressif.com/projects/rust/esp-hal/) 1.x | Official bare-metal HAL from Espressif: GPIO, interrupts, ADC, LEDC, time, delay | Arduino core (`pinMode`, `analogRead`, `ledc*`, `attachInterrupt`, `millis`) |
| `esp-println` | `println!` to the USB-Serial-JTAG port | `Serial.printf` (`ARDUINO_USB_MODE=1`) |
| `esp-backtrace` | panic handler that prints a backtrace | `esp32_exception_decoder` monitor filter |
| `esp-bootloader-esp-idf` | app descriptor required by the ESP-IDF 2nd-stage bootloader | built into the Arduino core |
| `critical-section` | `Mutex<RefCell<T>>` shared between an interrupt handler and `main` | `volatile` + `noInterrupts()` |
| `embedded-hal` | `SetDutyCycle` for LEDC | `ledcWrite` |

### What the comparison shows

* **Ownership of pins.** Each `peripherals.GPIOn` is a value *moved* into its driver; using the same
  pin twice is a compile error.
* **No `volatile`.** Data shared with an interrupt goes through `critical_section::Mutex` or atomics;
  the compiler rejects unsynchronized access.
* **Time with units.** `Instant`/`Duration` are 64-bit and typed — no 49-day `millis()` wraparound.

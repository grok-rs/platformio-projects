# platformio-projects

Embedded projects for the ESP32-S3, each written twice so the two can be compared side by side:

* `cpp/` — C++ on the Arduino core, built with [PlatformIO](https://platformio.org/) (own `platformio.ini`);
* `rust/` — Rust on [esp-hal](https://github.com/esp-rs/esp-hal) + [Embassy](https://embassy.dev), a member of
  the Cargo workspace in the repository root (see [Rust](#rust)).

Both variants print the same text to Serial and run against the same Wokwi diagram and scenarios.
Hardware, wiring, docs and simulation files live once, at the project level:

```
esp32-s3-<project>/
├── README.md        lesson notes, wiring, C++ ↔ Rust comparison for this project
├── diagram.json     Wokwi breadboard (shared; cpp/ and rust/ link to it)
├── docs/  wokwi/    schematics, breadboard renders, Wokwi scenarios
├── cpp/             platformio.ini, src/, wokwi.toml
└── rust/            Cargo.toml, src/lib.rs (logic, host-tested), src/main.rs or src/bin/*, wokwi.toml
```

| Project | Code | Board | Summary | Simulate |
|---|---|---|---|---|
| [`esp32-s3-led-blink`](esp32-s3-led-blink/) | [C++](esp32-s3-led-blink/cpp/) · [Rust](esp32-s3-led-blink/rust/) | ESP32-S3-DevKitC-1 (N16R8) | Red/blue LEDs blinking alternately on two GPIOs; extras: patterns, third LED, speed control, and both LEDs driven from a **single** GPIO via tri-state output | [Wokwi](https://wokwi.com/projects/476610317583371265) · [Wokwi, single GPIO](https://wokwi.com/projects/476610461509906433) |
| [`esp32-s3-led-button`](esp32-s3-led-button/) | [C++](esp32-s3-led-button/cpp/) · [Rust](esp32-s3-led-button/rust/) | ESP32-S3-DevKitC-1 (N16R8) | Lesson: one LED (GPIO15, 220 Ω) and one button (GPIO21, `INPUT_PULLUP`); env `hold` — LED follows the button, env `toggle` — each press toggles the LED with a 30 ms software debounce; schematic and breadboard include an FX2 logic analyzer probing both signals | VS Code / `wokwi-cli` |
| [`esp32-s3-led-pwm`](esp32-s3-led-pwm/) | [C++](esp32-s3-led-pwm/cpp/) · [Rust](esp32-s3-led-pwm/rust/) | ESP32-S3-DevKitC-1 (N16R8) | Lesson (teacher's `Blink_Correct`): LED brightness via PWM — `ledcSetup(0, 5000, 8)`, `ledcAttachPin(15, 0)`, `ledcWrite(0, 64)` = 25 % duty; logic analyzer on GPIO15 | VS Code / `wokwi-cli` |
| [`esp32-s3-bounce-test`](esp32-s3-bounce-test/) | [C++](esp32-s3-bounce-test/cpp/) · [Rust](esp32-s3-bounce-test/rust/) | ESP32-S3-DevKitC-1 (N16R8) | Lesson: button bounce on GPIO21 — a `CHANGE` interrupt timestamps every edge and prints a per-press/release report (edges, bounce duration, shortest pulse, gaps) to compare with a logic analyzer on the same wire (Logic 2 / PulseView); env `homework` — the module 1.5 homework code on GPIO21; [study page](https://grok-rs.github.io/platformio-projects/bounce-bench/) | VS Code / `wokwi-cli` |
| [`esp32-s3-two-buttons`](esp32-s3-two-buttons/) | [C++](esp32-s3-two-buttons/cpp/) · [Rust](esp32-s3-two-buttons/rust/) | ESP32-S3-DevKitC-1 (N16R8) | Module 1.4: two LEDs, an external button (`INPUT_PULLUP`) and the on-board BOOT button (`INPUT`) select a sticky blink mode — synchronous 200 ms or alternating 1000 ms | [Wokwi](https://wokwi.com/projects/476609614353588225) |
| [`esp32-s3-button-bounce`](esp32-s3-button-bounce/) | [C++](esp32-s3-button-bounce/cpp/) · [Rust](esp32-s3-button-bounce/rust/) | ESP32-S3-DevKitC-1 (N16R8) | Module 1.5: contact bounce on GPIO16 — the homework's `FALLING` counter and a lab firmware that timestamps every edge in a `CHANGE` ISR (ring buffer, per-press report, ISR marker on GPIO17); `tools/vcd_bounce.py` builds the same report from a logic-analyzer VCD | VS Code / `wokwi-cli` (bouncing button + logic analyzer) |
| [`esp32-s3-ldr-adc`](esp32-s3-ldr-adc/) | [C++](esp32-s3-ldr-adc/cpp/) · [Rust](esp32-s3-ldr-adc/rust/) | ESP32-S3-DevKitC-1 (N16R8) | Module 1.6: photoresistor + 10 kΩ divider on GPIO4 (ADC1); every 100 ms prints `analogRead()` RAW, the voltage computed from it (`RAW / 4095 · 3100 mV`), calibrated `analogReadMilliVolts()` and the relative error | VS Code / `wokwi-cli` (custom LDR-divider chip) |
| [`esp32-s3-twilight-relay`](esp32-s3-twilight-relay/) | [C++](esp32-s3-twilight-relay/cpp/) · [Rust](esp32-s3-twilight-relay/rust/) | ESP32-S3-DevKitC-1 (N16R8) | Mini-project 1 (lesson 18): twilight switch — LDR + 10 kΩ divider on GPIO4, two ADC thresholds with hysteresis, GPIO2 → BC547B level shifter (10 kΩ pull-up to 5 V) → active-LOW 5 V relay module → LED load; built-in USB-JTAG debugging configured | [Study page](https://grok-rs.github.io/platformio-projects/twilight-relay/) (no Wokwi: it has no transistors) |
| [`esp32-s3-embedded-cpp`](esp32-s3-embedded-cpp/) | [C++](esp32-s3-embedded-cpp/cpp/) · [Rust](esp32-s3-embedded-cpp/rust/) | ESP32-S3-DevKitC-1 (N16R8) | Module 2.1 homework, Embedded C++: the classic Blink rewritten without `delay()` (`enum class LedState`, `class Led` with `init()`/`set()`, a `static constexpr` config struct, no globals, no heap); superloop iteration timing every 1000 passes via the CPU cycle counter; a button on a `FALLING` interrupt (`volatile` flag, debounce in `loop()`) cycles Blink → On → Off; logic unit-tested on the PC with `pio test -e native`; same LED/button bench as `esp32-s3-led-button` | VS Code / `wokwi-cli` |
| [`esp32-s3-bright-module`](esp32-s3-bright-module/) | [C++](esp32-s3-bright-module/cpp/) · [Rust](esp32-s3-bright-module/rust/) | ESP32-S3-DevKitC-1 (N16R8) | Module 2.2 task ТЗ-A «Яскравий модуль»: GPIO5 → 1 kΩ → 2N2222 low-side switch, LED + 220 Ω powered from an MB-102 5 V module (common GND); LEDC PWM 5 kHz / 8 bit with four levels (0/40/128/255) stepped by a button on GPIO6 (`INPUT_PULLDOWN`, `RISING` ISR flag, 50 ms debounce state machine); one firmware per acceptance stage (`switch`, `sweep`, `levels`, `softpwm` — software PWM on `millis()` measured against LEDC); schematic, breadboard layout and [spec sheet](docs/power-loads/tz-a-spec.png) | VS Code / `wokwi-cli` (button on GPIO7 in simulation — Wokwi holds ESP32-S3 GPIO6 high) |

## Interactive study pages

Served by GitHub Pages from [`docs/`](docs/): **https://grok-rs.github.io/platformio-projects/**

| Page | What it shows |
|---|---|
| [Підтяжка входу](https://grok-rs.github.io/platformio-projects/pull-resistors/) | Module 1.4 theory, animated: floating input and 50 Hz pickup, pull-up vs pull-down, R·C edge speed and frequency, Schmitt trigger hysteresis, contact bounce, a frequency scale and a self-check quiz |
| [Осцилограф і кнопка](https://grok-rs.github.io/platformio-projects/scope-signals/) | Module 1.5 theory: a virtual oscilloscope and generator (V/div, time/div, trigger, cursors, measurements), edges and rise time, period/frequency/duty, probe bandwidth, contact bounce, logic analyzer and sample rate, DIY scopes, notes on the five lesson videos, discussion questions, quiz |
| [Лабораторія брязкоту](https://grok-rs.github.io/platformio-projects/bounce-lab/) | Module 1.5 homework animated: a real Wokwi capture of 10 presses in a logic-analyzer viewer, what the ESP32 interrupt actually sees, both firmwares, the 10-press results table, debounce strategies |
| [Брязкіт на стенді](https://grok-rs.github.io/platformio-projects/bounce-bench/) | Module 1.5 lecture notes on the real bench (GPIO21): 190 real button events recorded by the ESP32 in a virtual logic-analyzer viewer, an animated bouncing contact, a model of why the ISR loses edges, bounce statistics with a debounce-window slider, BOUNCE/LABEL markers for Logic 2, homework table and answers |
| [АЦП і світло](https://grok-rs.github.io/platformio-projects/adc-light/) | Module 1.6 theory for beginners: analog vs digital, sampling and quantization, ADC as a 4096-step ruler, LDR and the voltage divider, ADC1/ADC2 pin map, attenuation ranges, noise and averaging, common mistakes, quiz |
| [Люксметр на ESP32-S3](https://grok-rs.github.io/platformio-projects/ldr-lab/) | Module 1.6 homework animated: breadboard bench with a light source, schematic, SAR conversion step by step, code + flowchart stepping, Serial table, live plot, where the error comes from (real chip vs Wokwi) |
| [Сутінковий перемикач](https://grok-rs.github.io/platformio-projects/twilight-relay/) | Mini-project 1 (lesson 18): LDR divider → ADC → hysteresis → BC547B level shifter → 5 V relay module (active LOW) → LED load; live breadboard with a Type-C breadboard power module and schematic with animated electron flow, what-if faults (GPIO straight to IN, no common GND, no hysteresis, lamp on the LDR, no flyback diode), parts recap from earlier modules, drawing/wiring rules, BOM and wiring table, built-in USB-JTAG debugger, quiz |
| [Потужне навантаження](https://grok-rs.github.io/platformio-projects/power-loads/) | Module 2.2 theory + homework, verified against datasheets: active vs passive sorter, GPIO current budget on a log scale, a live NPN/MOSFET low-side switch simulator with animated current, base-resistor calculator with fading worked examples, switch picker (BC547B, 2N2222A, TIP120, AO3400A, ULN2003A…), collector oscilloscope with/without flyback diode, motor start and brownout, common-ground loop, spot-the-fault schematic, pre-power checklist, relay operate/release timing diagram, software PWM / UART-as-PWM / LEDC visualiser, quiz, glossary, teacher mode with the lesson plan, and a list of corrections to the LMS text with numbered sources |
| [Стенд ESP32-S3](https://grok-rs.github.io/platformio-projects/lab/) | Step-through model of all three firmwares: live circuit levels and current, executing code lines, variables, logic analyzer, Serial monitor, slow motion, what-if experiments (blocking `delay()`, no pull-up, no debounce) |

The pages are plain HTML files; to open them locally: `python3 -m http.server -d docs` → http://localhost:8000.
Every page follows the system light/dark theme; the switch at the end of the navigation strip ([`docs/site-theme.js`](docs/site-theme.js)) forces Light or Dark and remembers the choice.

## Simulation in Wokwi

Every project has a Wokwi breadboard layout (`diagram.json`), a `wokwi.toml` in both `cpp/` and `rust/`,
and automated test scenarios in `wokwi/` that both firmwares must pass. Three ways to run it:

1. **In the browser** — the *Wokwi* links in the table above: same code, same breadboard, nothing to install.
2. **VS Code** — install the *Wokwi Simulator* extension, build with `pio run` (in `cpp/`) or
   `cargo build --release` (in `rust/`), then **F1 → Wokwi: Start Simulator**.
3. **CLI / CI** — [`wokwi-cli`](https://docs.wokwi.com/wokwi-ci/cli-installation) with a token from the
   [Wokwi CI dashboard](https://wokwi.com/dashboard/ci) in `.envrc` (git-ignored):

   ```bash
   echo 'export WOKWI_CLI_TOKEN=…' > .envrc && direnv allow   # or: source .envrc
   cd esp32-s3-two-buttons
   pio run -d cpp && wokwi-cli cpp --scenario ../wokwi/scenarios/mode-switch.yaml --timeout 20000
   (cd rust && cargo build --release) && wokwi-cli rust --scenario ../wokwi/scenarios/mode-switch.yaml --timeout 20000
   ```

   `esp32-s3-ldr-adc` uses a custom Wokwi chip for the LDR divider; its compiled `.chip.wasm` is committed,
   rebuild it with `wokwi-cli chip compile` after editing the `.c` file.

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
| Build | `pio run [-e env]` | `cargo build --release [--bin name] [--features …]` |
| Flash + monitor | `pio run -t upload && pio device monitor` | `cargo run --release [--bin name]` (runner: `espflash flash --monitor`) |
| Variants | `[env:…]` in `platformio.ini` | `src/bin/<name>.rs` bins, or Cargo features |
| Unit tests | `pio test -e native` (where a project has it) | `cargo +stable host-test -p <package>` (logic only, runs on the PC) |
| Lint | — | `cargo clippy --release -p <package>` |
| Wokwi | `wokwi-cli cpp --scenario ../wokwi/scenarios/….yaml` | `wokwi-cli rust --scenario ../wokwi/scenarios/….yaml` |

From the repository root, `cargo build --release` builds every Rust firmware and
`cargo +stable host-test` runs every project's unit tests.

### Layout and conventions

```
Cargo.toml            workspace: members = esp32-s3-*/rust, shared dependency versions, lints, profiles
rust-toolchain.toml   channel = "esp"
.cargo/config.toml    target xtensa-esp32s3-none-elf, linker script, espflash runner, build-std, host-test alias
.clippy.toml          stack-frame size threshold
target/               one build directory for all firmwares (esp-hal is compiled once)
```

Every Rust project is split the same way:

* **`src/lib.rs` — the logic, no hardware.** `#![no_std]`, depends only on portable crates
  (`embassy-time`, `heapless`, `bitflags`), takes time and pin levels as parameters. Because the
  hardware crates are declared under `[target.'cfg(target_arch = "xtensa")'.dependencies]`, the library
  also compiles for the PC, where `#[cfg(test)]` unit tests run with the normal test harness.
* **`src/main.rs` / `src/bin/*.rs` — the hardware shell.** Peripherals, interrupt handlers, Embassy
  tasks and the Serial text. It turns pin levels and timestamps into calls to the library.

### Crates

| Crate | Role | Arduino / C++ counterpart |
|---|---|---|
| [`esp-hal`](https://docs.espressif.com/projects/rust/esp-hal/) 1.x | Official bare-metal HAL from Espressif: GPIO, interrupts, UART, USB-Serial-JTAG, ADC, LEDC. `unstable` feature for ADC/LEDC/`Io` | Arduino core (`pinMode`, `analogRead`, `ledc*`, `attachInterrupt`) |
| [`esp-rtos`](https://crates.io/crates/esp-rtos) | Scheduler and time driver that runs the Embassy executor on the ESP32 | FreeRTOS underneath `setup()`/`loop()` |
| [`embassy-executor`](https://embassy.dev), `embassy-time`, `embassy-sync`, `embassy-futures` | `async` tasks, `Timer`/`Ticker`/`Instant`/`Duration`, `Channel`, `select` | `loop()` + `millis()` + `delay()` |
| `esp-println` | `println!` to the USB-Serial-JTAG port | `Serial.printf` (`ARDUINO_USB_MODE=1`) |
| `esp-backtrace` | panic handler that prints a backtrace | `esp32_exception_decoder` monitor filter |
| `esp-bootloader-esp-idf` | app descriptor required by the ESP-IDF 2nd-stage bootloader | built into the Arduino core |
| `critical-section` | `Mutex<RefCell<T>>` shared between ISR and main code | `volatile` + `noInterrupts()` |
| `heapless` | fixed-capacity `Vec`, `String`, lock-free `spsc::Queue` — no heap | hand-written arrays and ring buffers |
| `bitflags` | type-safe bit sets | hand-written `Frame` class over `uint8_t` |
| `embedded-hal`, `embedded-io-async` | portable driver traits (`SetDutyCycle`, async `Read`) | — |
| `static_cell` | safe `&'static mut` for buffers handed to tasks/ISRs | global variables |

No heap allocator is used: every buffer has a size known at compile time.

### What the comparison shows

* **Ownership of pins.** Each `peripherals.GPIOn` is a value that is *moved* into its driver; using the
  same pin twice is a compile error, not two drivers fighting over one wire.
* **No `volatile`.** Data shared with an interrupt goes through `critical_section::Mutex`, atomics or a
  lock-free SPSC queue; the compiler rejects unsynchronized access.
* **Time with units.** `Instant`/`Duration` are 64-bit and typed — no `uint32_t` milliseconds and no
  49-day `millis()` wraparound to reason about.
* **`async` instead of polling.** Waiting for a button edge, a byte on Serial or the next tick puts
  the CPU to sleep instead of spinning in `loop()`.
* **Logic tested off-target.** Debouncers, hysteresis, bounce statistics and pattern players have
  unit tests that run on the PC in milliseconds; Wokwi scenarios cover the hardware side for both languages.

# platformio-projects

Embedded projects built with [PlatformIO](https://platformio.org/). Each project lives in its own
folder with its own `platformio.ini`; open the folder (or the workspace file below) in VS Code
with the PlatformIO extension.

| Project | Board | Summary | Simulate |
|---|---|---|---|
| [`esp32-s3-led-blink`](esp32-s3-led-blink/) | ESP32-S3-DevKitC-1 (N16R8) | Red/blue LEDs blinking alternately on two GPIOs; extras: patterns, third LED, speed control, and both LEDs driven from a **single** GPIO via tri-state output | [Wokwi](https://wokwi.com/projects/476610317583371265) · [Wokwi, single GPIO](https://wokwi.com/projects/476610461509906433) |
| [`esp32-s3-led-button`](esp32-s3-led-button/) | ESP32-S3-DevKitC-1 (N16R8) | Lesson: one LED (GPIO15, 220 Ω) and one button (GPIO21, `INPUT_PULLUP`); env `hold` — LED follows the button, env `toggle` — each press toggles the LED with a 30 ms software debounce; schematic and breadboard include an FX2 logic analyzer probing both signals | VS Code / `wokwi-cli` |
| [`esp32-s3-led-pwm`](esp32-s3-led-pwm/) | ESP32-S3-DevKitC-1 (N16R8) | Lesson (teacher's `Blink_Correct`): LED brightness via PWM — `ledcSetup(0, 5000, 8)`, `ledcAttachPin(15, 0)`, `ledcWrite(0, 64)` = 25 % duty; logic analyzer on GPIO15 | VS Code / `wokwi-cli` |
| [`esp32-s3-bounce-test`](esp32-s3-bounce-test/) | ESP32-S3-DevKitC-1 (N16R8) | Lesson: button bounce on GPIO21 — a `CHANGE` interrupt timestamps every edge and prints a per-press/release report (edges, bounce duration, shortest pulse, gaps) to compare with a logic analyzer on the same wire (Logic 2 / PulseView); env `homework` — the module 1.5 homework code on GPIO21; [study page](https://grok-rs.github.io/platformio-projects/bounce-bench/) | VS Code / `wokwi-cli` |
| [`esp32-s3-two-buttons`](esp32-s3-two-buttons/) | ESP32-S3-DevKitC-1 (N16R8) | Module 1.4: two LEDs, an external button (`INPUT_PULLUP`) and the on-board BOOT button (`INPUT`) select a sticky blink mode — synchronous 200 ms or alternating 1000 ms | [Wokwi](https://wokwi.com/projects/476609614353588225) |
| [`esp32-s3-button-bounce`](esp32-s3-button-bounce/) | ESP32-S3-DevKitC-1 (N16R8) | Module 1.5: contact bounce on GPIO16 — the homework's `FALLING` counter and a lab firmware that timestamps every edge in a `CHANGE` ISR (ring buffer, per-press report, ISR marker on GPIO17); `tools/vcd_bounce.py` builds the same report from a logic-analyzer VCD | VS Code / `wokwi-cli` (bouncing button + logic analyzer) |
| [`esp32-s3-ldr-adc`](esp32-s3-ldr-adc/) | ESP32-S3-DevKitC-1 (N16R8) | Module 1.6: photoresistor + 10 kΩ divider on GPIO4 (ADC1); every 100 ms prints `analogRead()` RAW, the voltage computed from it (`RAW / 4095 · 3100 mV`), calibrated `analogReadMilliVolts()` and the relative error | VS Code / `wokwi-cli` (custom LDR-divider chip) |
| [`esp32-s3-twilight-relay`](esp32-s3-twilight-relay/) | ESP32-S3-DevKitC-1 (N16R8) | Mini-project 1 (lesson 18): twilight switch — LDR + 10 kΩ divider on GPIO4, two ADC thresholds with hysteresis, GPIO2 → BC547B level shifter (10 kΩ pull-up to 5 V) → active-LOW 5 V relay module → LED load; built-in USB-JTAG debugging configured | [Study page](https://grok-rs.github.io/platformio-projects/twilight-relay/) (no Wokwi: it has no transistors) |

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
| [Стенд ESP32-S3](https://grok-rs.github.io/platformio-projects/lab/) | Step-through model of all three firmwares: live circuit levels and current, executing code lines, variables, logic analyzer, Serial monitor, slow motion, what-if experiments (blocking `delay()`, no pull-up, no debounce) |

The pages are plain HTML files; to open them locally: `python3 -m http.server -d docs` → http://localhost:8000.

## Simulation in Wokwi

Every project has a Wokwi breadboard layout next to its code (`diagram.json`, `wokwi.toml`) and automated
test scenarios in `wokwi/`. Three ways to run it:

1. **In the browser** — the *Wokwi* links in the table above: same code, same breadboard, nothing to install.
2. **VS Code** — install the *Wokwi Simulator* extension, build with `pio run`, then **F1 → Wokwi: Start Simulator**.
3. **CLI / CI** — [`wokwi-cli`](https://docs.wokwi.com/wokwi-ci/cli-installation) with a token from the
   [Wokwi CI dashboard](https://wokwi.com/dashboard/ci) in `.envrc` (git-ignored):

   ```bash
   echo 'export WOKWI_CLI_TOKEN=…' > .envrc && direnv allow   # or: source .envrc
   cd esp32-s3-two-buttons && pio run
   wokwi-cli . --scenario wokwi/scenarios/mode-switch.yaml --timeout 20000
   ```

   `esp32-s3-ldr-adc` uses a custom Wokwi chip for the LDR divider; its compiled `.chip.wasm` is committed,
   rebuild it with `wokwi-cli chip compile` after editing the `.c` file.

## Working with the repository

```bash
git clone https://github.com/grok-rs/platformio-projects.git
cd platformio-projects/esp32-s3-led-blink
pio run -t upload && pio device monitor
```

`platformio-projects.code-workspace` adds every project as a workspace folder, so the PlatformIO
sidebar lists all of them at once: **File → Open Workspace from File…**

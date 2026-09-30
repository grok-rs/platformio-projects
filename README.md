# platformio-projects

Embedded projects built with [PlatformIO](https://platformio.org/). Each project lives in its own
folder with its own `platformio.ini`; open the folder (or the workspace file below) in VS Code
with the PlatformIO extension.

| Project | Board | Summary | Simulate |
|---|---|---|---|
| [`esp32-s3-led-blink`](esp32-s3-led-blink/) | ESP32-S3-DevKitC-1 (N16R8) | Red/blue LEDs blinking alternately on two GPIOs; extras: patterns, third LED, speed control, and both LEDs driven from a **single** GPIO via tri-state output | [Wokwi](https://wokwi.com/projects/476610317583371265) · [Wokwi, single GPIO](https://wokwi.com/projects/476610461509906433) |
| [`esp32-s3-two-buttons`](esp32-s3-two-buttons/) | ESP32-S3-DevKitC-1 (N16R8) | Module 1.4: two LEDs, an external button (`INPUT_PULLUP`) and the on-board BOOT button (`INPUT`) select a sticky blink mode — synchronous 200 ms or alternating 1000 ms | [Wokwi](https://wokwi.com/projects/476609614353588225) |

## Interactive study pages

Served by GitHub Pages from [`docs/`](docs/): **https://grok-rs.github.io/platformio-projects/**

| Page | What it shows |
|---|---|
| [Підтяжка входу](https://grok-rs.github.io/platformio-projects/pull-resistors/) | Module 1.4 theory, animated: floating input and 50 Hz pickup, pull-up vs pull-down, R·C edge speed and frequency, Schmitt trigger hysteresis, contact bounce, a frequency scale and a self-check quiz |
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

## Working with the repository

```bash
git clone https://github.com/grok-rs/platformio-projects.git
cd platformio-projects/esp32-s3-led-blink
pio run -t upload && pio device monitor
```

`platformio-projects.code-workspace` adds every project as a workspace folder, so the PlatformIO
sidebar lists all of them at once: **File → Open Workspace from File…**

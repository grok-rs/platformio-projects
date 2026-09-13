# platformio-projects

Embedded projects built with [PlatformIO](https://platformio.org/). Each project lives in its own
folder with its own `platformio.ini`; open the folder (or the workspace file below) in VS Code
with the PlatformIO extension.

| Project | Board | Summary |
|---|---|---|
| [`esp32-s3-led-blink`](esp32-s3-led-blink/) | ESP32-S3-DevKitC-1 (N16R8) | Red/blue LEDs blinking alternately on two GPIOs; extras: patterns, third LED, speed control, and both LEDs driven from a **single** GPIO via tri-state output |

## Working with the repository

```bash
git clone https://github.com/grok-rs/platformio-projects.git
cd platformio-projects/esp32-s3-led-blink
pio run -t upload && pio device monitor
```

`platformio-projects.code-workspace` adds every project as a workspace folder, so the PlatformIO
sidebar lists all of them at once: **File → Open Workspace from File…**

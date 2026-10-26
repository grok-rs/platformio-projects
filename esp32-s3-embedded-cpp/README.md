# ESP32-S3: Embedded C++ — ДЗ модуля 2.1

Класичний Arduino Blink, переписаний за правилами вбудованого C++: без `delay()`, без магічних чисел,
без глобальних змінних. Далі — заміри superloop і кнопка на перериванні, що перемикає режими LED
`BLINK → STEADY_ON → STEADY_OFF → BLINK…`.

Стенд той самий, що в [`esp32-s3-led-button`](../esp32-s3-led-button/): **LED на GPIO15** (через 220 Ом),
**кнопка на GPIO21** → GND.

| Етап | Середовище / бінарник | Завдання |
|------|-----------------------|----------|
| blink | [`cpp/src/blink.cpp`](cpp/src/blink.cpp) · [`rust/src/bin/blink.rs`](rust/src/bin/blink.rs) | 1–2 |
| modes (за замовч.) | [`cpp/src/modes.cpp`](cpp/src/modes.cpp) · [`rust/src/bin/modes.rs`](rust/src/bin/modes.rs) | 1–4 |

```bash
cd esp32-s3-embedded-cpp/cpp && pio run -e blink -t upload && pio device monitor   # завдання 1–2
cd esp32-s3-embedded-cpp/cpp && pio run -e modes -t upload && pio device monitor   # завдання 1–4
cd esp32-s3-embedded-cpp/rust && cargo run --release --bin blink                   # Rust, 1–2
cd esp32-s3-embedded-cpp/rust && cargo run --release                               # Rust, 1–4
```

## Вимоги → де в коді

| Вимога | Де (`modes.cpp`, у `blink.cpp` так само) |
|---|---|
| 1. `enum class` для стану LED | `enum class LedState : uint8_t { Off, On }` (і `enum class Mode`) |
| 1. `constexpr` пін та інтервал | `Config::LED_PIN`, `Config::BLINK_MS` |
| 1. Без глобальних змінних | весь стан — члени `class App`, один `static App app`; прапорець ISR — член `Button` |
| 1. Без `delay()`, `millis()` у superloop | `App::update()`: `if (now - lastBlink_ >= Config::BLINK_MS)` |
| 1. Клас `Led` з `init()` і `set()` | `class Led` — конструктор лише запам'ятовує пін, `init()` викликається з `setup()` |
| 2. Структура зі `static constexpr` замість магічних чисел | `struct Config` (тому C++17 у `platformio.ini`) |
| 3. Час ітерації `loop()`, звіт кожні 1000 ітерацій | `App::measure()`, `Config::REPORT_EVERY` |
| 4. Кнопка на `attachInterrupt`, `volatile bool`, мінімальний ISR | `class Button`: `attachInterruptArg(…, FALLING)`, `volatile bool edge_`, ISR `onFall` |
| 4. Режими й антибрязкіт — у `loop()` | `App::update()` + `App::nextMode()` |

## Схема

Та сама, що в [`esp32-s3-led-button`](../esp32-s3-led-button/) (там же монтаж на макетній платі):

![Принципова схема](../esp32-s3-led-button/docs/schematic.png)

```
GPIO15 ── 220 Ом ── LED (довга ніжка) ── GND
GPIO21 ── кнопка ── GND        (INPUT_PULLUP: відпущена = HIGH, натиснута = LOW)
```

## Як це працює

Кожен прохід `loop()` нічого не чекає: кожна задача перевіряє «чи пора?» і йде далі.

```cpp
// ISR — лише прапорець: без Serial, delay, millis
static void IRAM_ATTR onFall(void* self) { static_cast<Button*>(self)->edge_ = true; }

// loop(): після фронту чекаємо 30 мс тиші, потім дивимося рівень
if (button_.takeEdge()) { lastEdge_ = now; pending_ = true; }
if (pending_ && now - lastEdge_ >= Config::DEBOUNCE_MS) {
  pending_ = false;
  if (button_.isPressed()) nextMode(now);   // LOW — натиснули; HIGH — брязкіт відпускання
}
```

Одне натискання дає пачку фронтів (і відпускання теж дає спадаючі фронти), тому ISR лише каже «був
фронт», а рішення приймає `loop()`.

**`volatile`.** `edge_` змінює ISR, а читає `loop()`. Без `volatile` компілятор має право прочитати
змінну один раз і тримати в регістрі. Атомарності `volatile` не дає: фронт між «прочитати» і «скинути»
загубиться, але це той самий брязкіт, тож тут не шкодить. У Rust замість `volatile` — `AtomicBool::swap`.

**`static constexpr`.** Константа часу компіляції з типом і областю видимості (`Config::BLINK_MS`, а не
`BLINK`), RAM не займає. Без окремого визначення в `.cpp` такі члени працюють з C++17, тому в
`platformio.ini` — `-std=gnu++17`.

**Без глобальних змінних.** Arduino ділить програму на `setup()`/`loop()`, тож стан, який переживає
виклики `loop()`, мусить лежати поза ними — в одному об'єкті `app`, видимому лише в цьому файлі.
У Rust `main` ніколи не повертається, тож стан — її локальні змінні; глобальні лише прапорець і вхід,
які бачить обробник переривання (він в esp-hal без аргументів).

## Що друкує прошивка (`modes`)

```
=== ESP32-S3: LED modes, superloop + ISR ===
Mode: BLINK
Loop x1000: avg 1.52 us, min 1 us, max 12 us
Press #1 -> mode STEADY_ON
Press #2 -> mode STEADY_OFF
Press #3 -> mode BLINK
```

(числа — лише приклад формату). Тривалість ітерації = `micros()` між двома проходами точки виміру:
`avg` — середнє за 1000 ітерацій, `min` — «чистий» прохід, `max` — прохід, перерваний перериванням
або тіком FreeRTOS. Після звіту відлік починається заново, щоб сам `printf` не потрапив у наступне вікно.
Чим швидша ітерація, тим частіше звіт — для спокійнішого монітора збільште `Config::REPORT_EVERY`.

Логічним аналізатором на GPIO15/GPIO21 можна побачити брязкіт і затримку 30 мс:
[`tools/vcd_plot.py`](tools/vcd_plot.py) будує з VCD часову діаграму й звіт по натисканнях.
У [`results/`](results/) — заміри попередньої, багатофайлової версії (тести, розмір, символи купи).

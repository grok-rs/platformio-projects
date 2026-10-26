# ESP32-S3: брязкіт кнопки — логічний аналізатор проти переривань

Модуль 1.5, домашнє завдання. Кнопка на GPIO16 замикає вивід на GND. Логічний аналізатор записує на
тому самому піні **усі** перемикання (це «правда»), ESP32-S3 рахує те, що встигло помітити переривання.
Порівнюємо обидві картини: коли МК пропускає імпульси, коли рахує зайве і який debounce потрібен.

| Середовище / bin | Файл | Що робить |
|---|---|---|
| `homework-base` | `cpp/src/homework_base.cpp`, `rust/src/bin/homework-base.rs` | код з умови: `FALLING`, друкує `Button Pressed! Count: N` |
| `bounce-lab` (типове) | `cpp/src/main.cpp`, `rust/src/bin/bounce-lab.rs` | `CHANGE`: кожен фронт із часом, рядок на подію, підсумок на 10 натискань, маркер ISR на GPIO17 |

```bash
cd esp32-s3-button-bounce/cpp && pio run -t upload && pio device monitor                    # bounce-lab
cd esp32-s3-button-bounce/cpp && pio run -e homework-base -t upload && pio device monitor   # код з умови
cd esp32-s3-button-bounce/rust && cargo run --release                        # Rust: bounce-lab
cd esp32-s3-button-bounce/rust && cargo run --release --bin homework-base    # Rust: код з умови
python3 tools/vcd_bounce.py capture.vcd --button D0 --isr D1   # така сама таблиця із запису аналізатора
```

Інтерактивні сторінки: [Осцилограф і кнопка](https://grok-rs.github.io/platformio-projects/scope-signals/),
[Лабораторія брязкоту](https://grok-rs.github.io/platformio-projects/bounce-lab/).

## Схема

![Принципова схема](docs/schematic.png)

```
GPIO16 ── кнопка ── GND      INPUT_PULLUP: відпущена = HIGH, натиснута = LOW
GPIO16 ── D0 аналізатора
GPIO17 ── D1 аналізатора     маркер ISR: HIGH, поки працює обробник
GND ───── GND аналізатора    без спільної землі аналізатор бачить сміття
```

## Як це працює

Обробник `CHANGE` лише записує час і рівень фронту в масив (друк триває мілісекунди, а брязкіт —
мікросекунди), а маркер на GPIO17 показує на аналізаторі, *коли* і *скільки разів* він спрацював:

```cpp
void IRAM_ATTR onEdge() {
  digitalWrite(ISR_MARKER, HIGH);
  uint32_t now = micros();
  if (edgeCount < MAX_EDGES) { edgeUs[edgeCount] = now; edgeLevel[edgeCount] = digitalRead(BUTTON); }
  edgeCount = edgeCount + 1;
  lastEdgeUs = now;
  digitalWrite(ISR_MARKER, LOW);
}
```

`loop()` чекає 50 мс тиші (довше за брязкіт, коротше за натискання людини), забирає масив і друкує рядок.
Рівень став LOW — `PRESS`, став HIGH — `release`, не змінився — `glitch`:

```
  #  event    edges  fall  rise  bounce,us  min gap,us  edges, us from the first (v = LOW, ^ = HIGH)
---  -------  -----  ----  ----  ---------  ----------  ----------------------------------------------
  1  PRESS        7     4     3        812           4  v0 ^210 v214 ^365 v374 ^754 v812
  1  release      2     0     2        131         131  ^0 ^131
```

`v214` — через 214 мкс після першого фронту ISR прочитав LOW. Два однакові символи підряд (`^0 ^131`) —
між ними був фронт, якого обробник не побачив окремо. Після кожного 10-го відпускання — підсумок:
найдовший брязкіт, скільки фронтів прочитано як LOW (≈ лічильник `FALLING` з умови) і `debounce >= N ms`
(найгірший брязкіт × 1.5).

## Відповіді на питання

1. **Чи збігаються імпульси на аналізаторі й у лічильнику?** Ні: аналізатор бачить кожен перехід,
   лічильник — лише те, що встигло помітити переривання.
2. **Коли МК пропускає, а коли перераховує?** *Пропускає*, коли імпульс коротший за затримку обробника:
   прапорець переривання — один біт, фронти до старту ISR зливаються. *Перераховує*: `FALLING` додає 1 на
   кожен фронт униз у брязкоті — і при натисканні, і при **відпусканні**.
3. **Середня тривалість брязкоту?** З таблиці або `vcd_bounce.py`. Ganssle (16 перемикачів):
   у середньому 1.6 мс, максимум 6.2 мс.
4. **Мінімальний debounce?** Найдовший брязкіт × 1.5 (рядок `debounce >= N ms`); на практиці 10–20 мс.

## PulseView

Драйвер **fx2lafw**, 4–24 МГц, ≥ 10 M вибірок, тригер на D0 falling. Імпульси брязкоту бувають коротші
за 1 мкс: на 1 МГц аналізатор покаже *менше* фронтів. File → Export → VCD → `tools/vcd_bounce.py`
(та сама таблиця, плюс затримка й тривалість ISR із каналу D1).

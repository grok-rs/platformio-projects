# ESP32-S3: світлодіод і кнопка

Урок у два кроки: один LED (через 220 Ом на GPIO15) і одна кнопка (GPIO21 → GND).

| Крок | Середовище / бінарник | Що робить |
|------|-----------------------|-----------|
| 1 | `hold` — [`cpp/src/hold.cpp`](cpp/src/hold.cpp) · [`rust/src/bin/hold.rs`](rust/src/bin/hold.rs) | LED світить, **поки** кнопку тримають |
| 2 | `toggle` — [`cpp/src/toggle.cpp`](cpp/src/toggle.cpp) · [`rust/src/bin/toggle.rs`](rust/src/bin/toggle.rs) | кожне **натискання** перемикає LED (антибрязкіт 30 мс) |

```bash
cd esp32-s3-led-button/cpp && pio run -e hold -t upload && pio device monitor     # крок 1
cd esp32-s3-led-button/cpp && pio run -e toggle -t upload && pio device monitor   # крок 2
cd esp32-s3-led-button/rust && cargo run --release --bin hold                     # Rust, крок 1
cd esp32-s3-led-button/rust && cargo run --release                                # Rust, крок 2
```

## Схема

![Принципова схема](docs/schematic.png)

![Монтаж на макетній платі](docs/breadboard.png)

```
GPIO15 ── 220 Ом ── LED (довга ніжка) ── GND
GPIO21 ── кнопка ── GND        (INPUT_PULLUP: відпущена = HIGH, натиснута = LOW)
```

Кнопку ставте над центральним каналом і беріть **діагональні** ніжки — пари ніжок з'єднані постійно.
Струм LED: `(3.3 − 2.0) В / 220 Ом ≈ 6 мА`.

## Як це працює

**Крок 1** просто копіює рівень кнопки на LED і друкує лише зміни (`Button pressed -> LED ON`):

```cpp
bool pressed = digitalRead(BTN) == LOW;
digitalWrite(LED, pressed);
```

**Крок 2.** Тепер важливий *момент* натискання. Але механічний контакт кілька мілісекунд брязкотить
(`LOW HIGH LOW…`), і кожен відскок став би окремим натисканням. Тому новий рівень приймаємо, лише коли
він не змінювався 30 мс; будь-який відскок перезапускає відлік:

```cpp
int r = digitalRead(BTN);
if (r != lastRead) { lastRead = r; lastChange = millis(); }   // відскок — відлік заново
if (millis() - lastChange >= DEBOUNCE_MS && r != stable) {
  stable = r;
  if (stable == LOW) { ledOn = !ledOn; digitalWrite(LED, ledOn); ... }   // натиснули
}
```

У моніторі: `Press #1 -> LED ON`, `Press #2 -> LED OFF`… — номер росте рівно на 1.
Експеримент: `DEBOUNCE_MS 0` — номери «стрибають» на 2–3 (див. також
[`esp32-s3-button-bounce`](../esp32-s3-button-bounce/)). Логічним аналізатором (CH1 — LED, CH2 —
кнопка, тригер по спаду CH2) видно, що LED перемикається через ~30 мс після останнього відскоку.

## Контрольні питання

1. **Навіщо резистор?** Обмежує струм: 220 Ом → ~6 мА, 330 Ом → ~4 мА. Без нього LED і вивід можуть вигоріти.
2. **Чому натиснута = `LOW`?** `INPUT_PULLUP` тягне вхід до 3.3 В, кнопка замикає його на GND.
   З `INPUT_PULLDOWN` (кнопка до 3.3 В) було б навпаки.
3. **«Натиснута» vs «натиснули»?** Перше — стан (крок 1), друге — подія, перехід `HIGH → LOW` (крок 2).
4. **Чому брязкіт заважає лише кроку 2?** У кроці 1 LED мерехтить кілька мс — оку не видно; у кроці 2
   кожен відскок — зайве перемикання.
5. **Переповнення `millis()`?** `millis() - lastChange` — беззнакова різниця, вона правильна й після
   переходу через 0.

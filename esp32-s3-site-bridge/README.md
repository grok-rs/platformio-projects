# ESP32-S3: «Мій стенд» — міст між платою і сайтом курсу

Прошивка, яка перетворює ваш стенд на джерело живих даних для сайту курсу. Плата надсилає
в USB Serial рядки JSON, а сторінка [**Мій стенд**](https://grok-rs.github.io/platformio-projects/live/)
читає їх просто в браузері через Web Serial і малює поруч із моделлю курсу. Ті самі дані
можна під’єднати до лабораторій уроків [1.5](https://grok-rs.github.io/platformio-projects/lessons/1-5/#bench)
і [1.6](https://grok-rs.github.io/platformio-projects/lessons/1-6/#bench) кнопкою «Під’єднати мою плату».

| Що надсилає плата | Звідки | Як часто |
|---|---|---|
| `analogRead()` і калібровані мілівольти фоторезистора | GPIO4 (ADC1), подільник з уроку 1.6 | кожні 100 мс |
| моменти всіх фронтів кнопки в мікросекундах | GPIO21, переривання `CHANGE`, як у `esp32-s3-bounce-test` | після кожного натискання й відпускання |
| хто це: плата, прошивка, версія, піни | — | на старті й раз на 5 с |

Плата — **YD-ESP32-S3** (VCC-GND Studio, клон ESP32-S3-DevKitC-1, N16R8).

---

## 1. Стенд: нічого не перебираємо

Схема та сама, що в уроках 1.5 і 1.6. Можна зібрати лише одну половину: інша просто мовчатиме.

```
 3V3 ──[ LDR ]──┬──[ 10 кОм ]── GND        (esp32-s3-ldr-adc)
                │
              GPIO4  (ADC1_CH3)

 GPIO21 ──[ кнопка ]── GND                 (esp32-s3-bounce-test, INPUT_PULLUP: натиснута = LOW)
```

* Верх подільника — лише **3V3**, ніколи 5V.
* Зовнішній резистор підтяжки 10 кОм від GPIO21 до 3V3 (як на схемі уроку 1.5) можна залишити:
  прошивка вмикає ще й внутрішню підтяжку, разом вони не заважають.
* Маркери аналізатора GPIO40/GPIO41 з `esp32-s3-bounce-test` ця прошивка не використовує.

## 2. Прошити

Кабель — у роз’єм **USB** (не **COM**): Serial іде через нативний USB ESP32-S3.

### C++ (PlatformIO)

```bash
cd esp32-s3-site-bridge/cpp
pio run -t upload          # зібрати та прошити
pio device monitor         # (необов'язково) подивитися рядки самому; закрийте монітор перед сайтом!
```

У VS Code: відкрийте теку `esp32-s3-site-bridge/cpp`, на панелі PlatformIO — **Upload**.

### Rust (esp-hal + Embassy)

```bash
source ~/export-esp.sh                 # один раз у кожному новому терміналі
cd esp32-s3-site-bridge/rust
cargo run --release                    # зібрати, прошити й відкрити монітор (espflash)
```

Обидві версії надсилають однакові рядки; відрізняються лише полем `"lang"` (`"cpp"` / `"rust"`).

Якщо прошивка не заливається: затисніть **BOOT**, натисніть і відпустіть **RST**, відпустіть
**BOOT** — і повторіть команду.

## 3. Під’єднати до сайту

1. Закрийте `pio device monitor` (або `espflash monitor`): порт може читати лише одна програма.
2. Відкрийте [**Мій стенд**](https://grok-rs.github.io/platformio-projects/live/) у **Chrome** або **Edge**
   на комп’ютері. Firefox, Safari і телефони Web Serial не підтримують — там є лише демо.
3. Натисніть «Під’єднати плату» і виберіть порт **USB JTAG/serial debug unit** (Espressif, VID 0x303A).
4. Наступного разу сторінка (і лабораторії уроків) під’єднається без списку.

Під час під’єднання браузер може один раз перезапустити плату — це нормально: вона знову
надішле `hello`, і дані підуть далі.

Локально: `python3 -m http.server -d docs` → http://localhost:8000/live/ (Web Serial працює на
`localhost` і на `https://`, але не на `file://`).

## 4. Протокол

Швидкість 115 200 бод, один об’єкт JSON у рядку, поле `"t"` — тип рядка.

```json
{"t":"hello","fw":"site-bridge","ver":"1.0.0","lang":"cpp","board":"YD-ESP32-S3 N16R8","ldr_pin":4,"btn_pin":21,"adc_ms":100,"bits":12,"uref_mv":3100,"quiet_ms":50,"max_edges":64,"pressed":false,"up_ms":5000}
{"t":"adc","ms":12300,"raw":2861,"mv":2190}
{"t":"btn","kind":"press","n":3,"us":81234567,"edges":5,"bounce_us":830,"missed":false,"at":[0,12,52,610,830]}
```

| Поле | Значення |
|---|---|
| `adc.ms` | `millis()` плати в момент виміру — сайт будує графік за часом плати, а не за часом приходу рядка |
| `adc.raw` | `analogRead(4)`, 0…4095 (12 біт, ослаблення 11 дБ) |
| `adc.mv` | `analogReadMilliVolts(4)` — окреме перетворення з калібруванням з eFuse |
| `btn.kind` | `press` (рівень став LOW), `release` (став HIGH), `glitch` (фронти були, а рівень той самий) |
| `btn.n` | номер події цього виду від старту |
| `btn.us` | `micros()` першого фронту події |
| `btn.edges` | скільки фронтів було всього (може бути більше за довжину `at`) |
| `btn.at` | моменти перших 64 фронтів у мкс від першого |
| `btn.bounce_us` | від першого до останнього записаного фронту |
| `btn.missed` | парність фронтів не збігається зі зміною рівня: імпульс був коротший за реакцію ISR |

Подія кнопки закінчується після **50 мс тиші** — так само, як у `esp32-s3-bounce-test`.
Рядки, які не є JSON (повідомлення ядра про помилку, panic), сайт пропускає, але показує в журналі.
Тому в `platformio.ini` рівень журналу ядра знижено до помилок (`CORE_DEBUG_LEVEL=1`).

## 5. Як влаштовано

| | C++ (`cpp/src/main.cpp`) | Rust (`rust/src/`) |
|---|---|---|
| Рядки JSON | `snprintf` у буфер, один `Serial.write` на рядок | `Display` для `Hello`, `AdcLine`, `ButtonLine` у `lib.rs`, `println!` |
| Дані ISR | `volatile` масив + `noInterrupts()` | `EdgeLog` у `critical_section::Mutex` |
| Таймери | `millis()` + `lastAt += period` | `Instant` + `next += period` |
| Тести | — | `cargo +stable host-test -p site-bridge` (текст рядків, класифікація, переповнення, `micros()` через 0) |

Сторінка сайту — `docs/live/index.html`, з’єднання — `docs/assets/serial.js`
(`BoardSerial.link()`: `connect`, `reconnect`, `disconnect`, події `hello` / `adc` / `btn` / `line`).

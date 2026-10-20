# ESP32-S3 — почергове миготіння світлодіодів

Лабораторна робота на YD-ESP32-S3 (VCC-GND Studio, клон ESP32-S3-DevKitC-1): червоний і синій світлодіоди блимають по черзі.
Обов'язкова частина — два GPIO; додатково реалізовано складніші патерни, третій світлодіод,
зміну швидкості та режим, у якому обидва світлодіоди керуються **одним** GPIO.

Та сама прошивка є у двох варіантах: [`cpp/`](cpp/) — C++ / Arduino / PlatformIO і [`rust/`](rust/) —
Rust / esp-hal / Embassy (див. [Rust-версія](#rust-версія)). Поведінка й текст у Serial однакові,
тож обидві проходять ті самі сценарії Wokwi.

![Принципова схема](docs/schematic.png)

## Швидкий старт

```bash
cd cpp
pio run -t upload          # режим двох GPIO (за замовчуванням)
pio device monitor         # 115200; плата скидається при підключенні, банер видно завжди
```

| Середовище             | Схема                                      | Команда                                     |
|------------------------|--------------------------------------------|---------------------------------------------|
| `esp32-s3-devkitc-1`   | GPIO4 червоний, GPIO5 синій, GPIO6 зелений | `pio run -t upload`                         |
| `esp32-s3-single-gpio` | обидва світлодіоди на GPIO7                | `pio run -e esp32-s3-single-gpio -t upload` |

## Симуляція

| Де | Два GPIO | Один GPIO |
|----|----------|-----------|
| Wokwi у браузері | [**відкрити**](https://wokwi.com/projects/476610317583371265) | [**відкрити**](https://wokwi.com/projects/476610461509906433) |
| VS Code (*Wokwi Simulator*) | тека `cpp/`: `pio run`, F1 → *Wokwi: Start Simulator* | `pio run -e esp32-s3-single-gpio`, F1 → *Wokwi: Select Config File* → `wokwi/single-gpio/wokwi.toml` |
| CLI / автотест | `wokwi-cli cpp --scenario ../wokwi/scenarios/blink-controls.yaml --timeout 20000` | `wokwi-cli wokwi/single-gpio --scenario self-test.yaml --timeout 10000` |
| [Інтерактивний стенд](https://grok-rs.github.io/platformio-projects/lab/) | [вкладка «Миготіння LED»](https://grok-rs.github.io/platformio-projects/lab/#led-blink) | [вкладка «Один GPIO»](https://grok-rs.github.io/platformio-projects/lab/#single-gpio) |

У Wokwi: BOOT — кнопка на самій платі (клавіша `B`), команди `1/2/3/0/p/v` — у Serial-моніторі.
Кнопка в симуляторі має брязкіт, тож видно, як працює антидребезг. Схеми на макетці генерує
`wokwi/gen_diagram.py`. Плата стоїть у рядах 1–22, світлодіоди — вертикально, резистори — від ряду 26.
Літери рядів у Wokwi дзеркальні (`a` зверху). Сценарії перевіряють справжню прошивку: самотест, патерн,
коротке й довге натискання BOOT, команди Serial і що аноди світлодіодів отримують рівень через макетку.
Для онлайн-версії «Один GPIO» прапорець `SINGLE_GPIO_MODE` визначено на початку `main.cpp`, бо
онлайн-збірка не читає `platformio.ini`. Команди `wokwi-cli` виконуються з теки проєкту; шлях до сценарію —
відносно теки, переданої першим аргументом.

## Монтаж

Кожен світлодіод: `GPIO → резистор → анод (довга ніжка) → катод → GND`.
Червоний і зелений — 220 Ω, синій — 100 Ω (у синього вище пряме падіння, з 220 Ω він тьмяний).
Живлення всієї схеми — USB-кабель ESP32 (роз'єм **USB** — нативний USB ESP32-S3, правий, якщо плата антеною вгору; не **COM**, бо Serial
виводиться саме в нативний USB); шини живлення макетки не потрібні.

Піни лівого гребінця YD-ESP32-S3 від антени: `3V3, 3V3, RST, 4, 5, 6, 7, 15, 16, …, 14, 5V, G` —
**G (GND) — останній пін, біля USB-C, поруч із 5V**.

![Макетка, два GPIO](docs/breadboard.png)

### Один GPIO

Червоний між GPIO7 і GND, синій між 3V3 і GPIO7 — світлодіоди «дивляться» у різні боки
відносно виводу. `HIGH` → світить червоний, `LOW` → синій (вивід втягує струм), `INPUT` (Hi-Z) →
обидва вимкнені, бо двом світлодіодам послідовно треба ≈4.8 В, а є лише 3.3 В.

![Макетка, один GPIO](docs/breadboard_single_gpio.png)

## Керування

| Дія                       | Результат                                               |
|---------------------------|---------------------------------------------------------|
| BOOT — коротке натискання | наступна швидкість (1000 → 500 → 250 → 120 мс)          |
| BOOT — довге (> 0.6 с)    | наступний патерн                                        |
| Serial `1` / `2` / `3`    | тримати червоний / синій / зелений (перевірка монтажу)  |
| Serial `0`                | усі вимкнути                                            |
| Serial `p` / `v`          | наступний патерн / швидкість                            |
| Serial інша клавіша       | повернутися до автоматичного миготіння                  |

Патерни: `alternate` (базова вимога), `alternate_gap`, `police`, `three_leds`, `chase`, `mix`.
Після скидання виконується самотест — кожен світлодіод по черзі на 0.4 с.

## Якщо не світиться

1. У моніторі набрати `1` — червоний має горіти постійно.
2. Мультиметр, чорний щуп на пін **G** ESP32 (останній пін лівого гребінця, біля USB-C): пін `4` = 3.3 В, довга ніжка LED ≈ 1.9 В, коротка = 0 В.
   - 3.3 В на довгій ніжці → світлодіод перевернутий;
   - від'ємна напруга → чорний щуп не на GND (найчастіше на сусідньому 5V);
   - 0 В на піні → плата не вставлена в макетку до кінця.
3. Мінімальна схема для перевірки — `docs/breadboard_step1.png`: один світлодіод, без шин живлення.

## Структура коду

```
diagram.json                 схема Wokwi (два GPIO) — спільна для cpp/ і rust/
cpp/
  platformio.ini             два середовища: esp32-s3-devkitc-1, esp32-s3-single-gpio
  wokwi.toml, diagram.json   симуляція (diagram.json — посилання на ../diagram.json); прошивка — з .pio/build
  include/
    config.hpp               усі піни та часові константи
    frame.hpp                Led (один світлодіод) та Frame (набір увімкнених LED)
    pattern.hpp              Pattern + доступ до таблиць патернів і швидкостей
    span.hpp                 мінімальний std::span для незмінних масивів
    led_driver.hpp           інтерфейс LedDriver — єдиний шар, що знає про схему
    gpio_led_driver.hpp      реалізація: окремий вивід на кожен LED
    shared_pin_led_driver.hpp  реалізація: обидва LED на одному виводі (HIGH/LOW/Hi-Z)
    blink_player.hpp         неблокуючий програвач патернів (без delay())
    button.hpp               кнопка з антидребезгом, коротке/довге натискання
    serial_console.hpp       команди та стан через Serial-монітор
  src/
    main.cpp                 збирання компонентів, setup()/loop()
    patterns.cpp             таблиці кадрів і пресети швидкості
rust/                        див. «Rust-версія»
wokwi/
  gen_diagram.py             генератор обох diagram.json;  breadboard.py — геометрія макетки та плати
  scenarios/                 автотести wokwi-cli (два GPIO)
  single-gpio/               diagram.json, wokwi.toml (C++) і автотест для режиму одного GPIO
docs/
  *.png, *.svg               схема та розкладки на макетці
  tools/                     генератори діаграм (python3 + headless Chrome): tools/render.sh;
                             yd_board.py — спільне малювання макетки та плати YD-ESP32-S3
```

Вибір схеми підключення — єдине місце з умовною компіляцією (`SINGLE_GPIO_MODE` у `main.cpp`);
решта коду працює з абстрактним `LedDriver` і не знає, скільки виводів задіяно.

## Rust-версія

Тека [`rust/`](rust/) — та сама програма на Rust: [esp-hal](https://github.com/esp-rs/esp-hal) (офіційний HAL
Espressif, без ESP-IDF і без Arduino), [Embassy](https://embassy.dev) (async/await замість `loop()` з `millis()`),
`esp-println` замість `Serial`. Це пакет `led-blink` у спільному Cargo-workspace репозиторію
(загальні налаштування — у [README в корені](../README.md#rust)).

```bash
source ~/export-esp.sh                          # тулчейн Xtensa від espup (один раз на термінал)
cd rust
cargo run --release                             # два GPIO: зібрати, прошити, відкрити монітор
cargo run --release --features single-gpio      # один GPIO (аналог -e esp32-s3-single-gpio)
cargo +stable host-test -p led-blink            # модульні тести логіки — на ПК, без плати
```

| Wokwi | Два GPIO | Один GPIO |
|-------|----------|-----------|
| VS Code | тека `rust/`: `cargo build --release`, F1 → *Wokwi: Start Simulator* | `cargo build --release --features single-gpio`, F1 → *Wokwi: Select Config File* → `rust/single-gpio/wokwi.toml` |
| CLI | `wokwi-cli rust --scenario ../wokwi/scenarios/blink-controls.yaml --timeout 20000` | `wokwi-cli rust/single-gpio --scenario ../../wokwi/single-gpio/self-test.yaml --timeout 10000` |

Обидва варіанти збираються в той самий файл `target/…/release/led-blink`, тож у симуляторі
працює той, що зібраний останнім.

```
rust/
  Cargo.toml                 пакет led-blink; feature single-gpio
  wokwi.toml, diagram.json   симуляція (diagram.json — посилання на ../diagram.json)
  single-gpio/               wokwi.toml для режиму одного GPIO
  src/
    lib.rs                   логіка без заліза (no_std) — збирається й тестується на ПК
      frame.rs               Frame — бітові прапорці (крейт bitflags)
      pattern.rs             таблиці патернів і швидкостей + перевірки під час компіляції
      driver.rs              трейт LedDriver
      player.rs              BlinkPlayer<D: LedDriver> + тести з драйвером-шпигуном
      button.rs              антибрязкіт, коротке/довге натискання + тести
      command.rs             Command: клавіша Serial / подія кнопки → дія
      shared_pin.rs          який стан виводу потрібен для кадру (режим одного GPIO)
    main.rs                  залізо: ініціалізація, задачі Embassy, головний цикл
    gpio_led_driver.rs       реалізація LedDriver: окремий вивід на кожен LED
    shared_pin_led_driver.rs реалізація LedDriver: обидва LED на одному виводі (Flex: HIGH/LOW/Hi-Z)
```

### C++ ↔ Rust

| Що | C++ (Arduino) | Rust (esp-hal + Embassy) |
|----|---------------|--------------------------|
| Головний цикл | `loop()` крутиться без пауз, кожен компонент сам питає `millis()` | `select(COMMANDS.receive(), ticker.next()).await` — процесор спить до команди або тіку 1 мс |
| Кнопка й Serial | опитуються в тому самому `loop()` | окремі задачі `button_task` і `console_task`; Serial-клавіші приходять за перериванням USB |
| Зв'язок між частинами | `SerialConsole` тримає посилання `BlinkPlayer&` і змінює його | задачі надсилають `Command` у `Channel`; програвачем володіє лише головний цикл |
| Абстракція драйвера | `virtual`-інтерфейс `LedDriver`, виклики через vtable | трейт `LedDriver`, `BlinkPlayer<D>` — мономорфізація, жодних віртуальних викликів |
| Опис схеми | `describe(Print&)` | `impl Display` → `println!("{driver}")` |
| `begin()` | треба не забути викликати | немає: виводи налаштовує конструктор, неналаштований драйвер створити неможливо |
| Час | `uint32_t millis()`, переповнення через 49 діб (беззнакова різниця рятує) | `Instant`/`Duration` на 64 бітах: одиниці в типі, переповнення практично немає |
| Кадр | клас `Frame` над `uint8_t` + `operator|` | `bitflags!` — те саме з крейту, `const` і з `Debug` |
| Таблиці | `static_assert` лише для індексу | `const _: () = { … }` перевіряє й вміст: патерн без кадрів не скомпілюється |
| `delay()` у самотесті | блокує все | `Timer::after(step).await` — інші задачі працюють |
| Один пін на два LED | `pinMode()` на ходу | `Flex` — вивід, що перемикається вихід ↔ Hi-Z; власник лише драйвер |
| Тести | лише Wokwi | `cargo +stable host-test` (логіка на ПК) **і** ті самі сценарії Wokwi |

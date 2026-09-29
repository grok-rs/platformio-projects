// Модуль 1.4 — два світлодіоди, зовнішня кнопка та BOOT (ESP32-S3-DevKitC-1).
//
//   Режим 1 (за замовчуванням) — обидва LED синхронно, 200 мс;   вмикає зовнішня кнопка.
//   Режим 2                    — LED по черзі («переїзд»), 1000 мс; вмикає кнопка BOOT.
//
// Вибраний режим зберігається у змінній `mode` і не змінюється, доки не натиснуто
// іншу кнопку. Схема та пояснення — у README.md.

#include <Arduino.h>

namespace {

// --- Виводи --------------------------------------------------------------
// Як у завданні: LED — GPIO15/16 (один гребінець), кнопка — GPIO21 (протилежний гребінець).
// Не strapping-піни (0, 3, 45, 46), не USB (19, 20), не флеш/PSRAM (26…37).
constexpr uint8_t kLed1Pin       = 15;
constexpr uint8_t kLed2Pin       = 16;
constexpr uint8_t kExtButtonPin  = 21;   // зовнішня кнопка -> GND, підтяжка всередині чипа
constexpr uint8_t kBootButtonPin = 0;    // кнопка BOOT на платі, підтяжка 10 кОм на платі

// --- Затримки ------------------------------------------------------------
constexpr uint32_t kFastDelayMs = 200;    // режим 1
constexpr uint32_t kSlowDelayMs = 1000;   // режим 2

constexpr uint32_t kSerialBaud   = 115200;
constexpr uint32_t kSerialWaitMs = 2000;  // чекати USB CDC, щоб не втратити банер

enum class Mode : uint8_t {
  Sync      = 1,   // швидкий / синхронний
  Alternate = 2,   // повільний / по черзі
};

// «Пам'ять» програми: поточний режим. При старті — режим 1.
Mode mode = Mode::Sync;

// Обидві кнопки замикають вивід на GND, тому натиснута = LOW.
bool isPressed(uint8_t pin) {
  return digitalRead(pin) == LOW;
}

const char* modeName(Mode m) {
  return m == Mode::Sync ? "1 (sync, 200 ms)" : "2 (alternate, 1000 ms)";
}

// Опитати кнопки та за потреби змінити режим. Повертає true, якщо режим змінився.
// Якщо натиснуті обидві — пріоритет у зовнішньої кнопки.
bool pollButtons() {
  Mode requested = mode;
  if (isPressed(kExtButtonPin)) {
    requested = Mode::Sync;
  } else if (isPressed(kBootButtonPin)) {
    requested = Mode::Alternate;
  }

  if (requested == mode) return false;
  mode = requested;
  Serial.printf("Mode -> %s\n", modeName(mode));
  return true;
}

// Той самий delay(ms), але кожну мілісекунду опитуються кнопки.
// Повертає false, якщо режим змінився під час очікування — поточне миготіння треба перервати,
// щоб новий режим почався одразу, а не після залишку старої затримки.
bool waitMs(uint32_t ms) {
  const uint32_t start = millis();
  while (millis() - start < ms) {
    if (pollButtons()) return false;
    delay(1);
  }
  return true;
}

void setLeds(bool led1On, bool led2On) {
  digitalWrite(kLed1Pin, led1On ? HIGH : LOW);
  digitalWrite(kLed2Pin, led2On ? HIGH : LOW);
}

// Режим 1: обидва разом увімкнулися — обидва разом вимкнулися.
void blinkSync() {
  setLeds(true, true);
  if (!waitMs(kFastDelayMs)) return;
  setLeds(false, false);
  waitMs(kFastDelayMs);
}

// Режим 2: перший горить — другий згашений, і навпаки.
void blinkAlternate() {
  setLeds(true, false);
  if (!waitMs(kSlowDelayMs)) return;
  setLeds(false, true);
  waitMs(kSlowDelayMs);
}

void waitForSerial(uint32_t timeoutMs) {
  const uint32_t start = millis();
  while (!Serial && millis() - start < timeoutMs) {
  }
}

}  // namespace

void setup() {
  Serial.begin(kSerialBaud);
  waitForSerial(kSerialWaitMs);

  pinMode(kLed1Pin, OUTPUT);
  pinMode(kLed2Pin, OUTPUT);
  setLeds(false, false);

  pinMode(kExtButtonPin, INPUT_PULLUP);   // внутрішній резистор ~45 кОм до 3.3 В
  pinMode(kBootButtonPin, INPUT);         // підтяжка вже є на платі

  Serial.println();
  Serial.println("=== ESP32-S3: two LEDs, external button + BOOT ===");
  Serial.printf("LEDs: GPIO%u, GPIO%u | external button: GPIO%u | BOOT: GPIO%u\n",
                kLed1Pin, kLed2Pin, kExtButtonPin, kBootButtonPin);
  Serial.printf("Start mode: %s\n", modeName(mode));
}

void loop() {
  pollButtons();
  switch (mode) {
    case Mode::Sync:      blinkSync();      break;
    case Mode::Alternate: blinkAlternate(); break;
  }
}

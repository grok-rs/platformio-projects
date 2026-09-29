// Модуль 1.4 — два світлодіоди, зовнішня кнопка та BOOT (ESP32-S3-DevKitC-1).
//
//   Режим 1 (за замовчуванням) — усі LED синхронно, 200 мс;       вмикає зовнішня кнопка.
//   Режим 2                    — LED по черзі («переїзд»), 1000 мс; вмикає кнопка BOOT.
//
// Вибраний режим зберігається у змінній `mode` і не змінюється, доки не натиснуто
// іншу кнопку. Схема та пояснення — у README.md.
//
// Уся «конфігурація» зібрана в трьох таблицях — kLedPins, kPatterns, kButtons.
// Щоб додати світлодіод, режим або кнопку, досить дописати рядок у відповідну таблицю;
// логіку нижче змінювати не треба (принцип відкритості/закритості).

#include <Arduino.h>

namespace {

template <typename T, size_t N>
constexpr size_t countOf(const T (&)[N]) { return N; }

// --- Світлодіоди ---------------------------------------------------------
// Як у завданні: LED — GPIO15/16 (один гребінець).
// Не strapping-піни (0, 3, 45, 46), не USB (19, 20), не флеш/PSRAM (26…37).
constexpr uint8_t kLedPins[] = {15, 16};
constexpr size_t  kLedCount  = countOf(kLedPins);

// --- Режими (шаблони миготіння) -----------------------------------------
// Режим — це послідовність кроків однакової тривалості. На кожному кроці isOn(step, led)
// каже, чи горить світлодіод `led`. Шаблони описані через індекси, а не через конкретні
// виводи, тому автоматично масштабуються на будь-яку кількість LED.
struct Pattern {
  const char* name;
  uint32_t    stepMs;
  size_t      stepCount;
  bool (*isOn)(size_t step, size_t led);
};

// Режим 1: усі разом увімкнулися — усі разом вимкнулися.
bool syncIsOn(size_t step, size_t /*led*/) { return step == 0; }

// Режим 2: горить рівно один LED, «вогник» переїжджає по колу.
// Для двох LED це саме «перший горить — другий згашений, і навпаки».
bool chaseIsOn(size_t step, size_t led) { return step == led; }

constexpr Pattern kPatterns[] = {
    {"1 (sync, 200 ms)",       200,  2,         syncIsOn},
    {"2 (alternate, 1000 ms)", 1000, kLedCount, chaseIsOn},
};

enum PatternId : size_t { kSync = 0, kAlternate = 1 };
static_assert(countOf(kPatterns) == 2, "update PatternId together with kPatterns");

// --- Кнопки --------------------------------------------------------------
// Кожна кнопка встановлює конкретний режим. Обидві замикають вивід на GND (натиснута = LOW).
// Порядок у таблиці = пріоритет: якщо натиснуто кілька, перемагає перша.
struct Button {
  const char* name;
  uint8_t     pin;
  uint8_t     inputMode;
  PatternId   pattern;
};

constexpr Button kButtons[] = {
    {"external", 21, INPUT_PULLUP, kSync},       // внутрішній резистор ~45 кОм до 3.3 В
    {"BOOT",     0,  INPUT,        kAlternate},  // підтяжка 10 кОм вже є на платі
};

constexpr uint32_t kSerialBaud   = 115200;
constexpr uint32_t kSerialWaitMs = 2000;  // чекати USB CDC, щоб не втратити банер

// --- Стан програми -------------------------------------------------------
// «Пам'ять» програми: поточний режим. При старті — режим 1.
PatternId mode        = kSync;
size_t    step        = 0;
uint32_t  stepStarted = 0;

bool isPressed(const Button& b) { return digitalRead(b.pin) == LOW; }

// Вивести на LED поточний крок поточного режиму.
void render() {
  const Pattern& p = kPatterns[mode];
  for (size_t led = 0; led < kLedCount; ++led) {
    digitalWrite(kLedPins[led], p.isOn(step, led) ? HIGH : LOW);
  }
  stepStarted = millis();
}

// Почати режим з першого кроку — одразу, без очікування залишку старої затримки.
void setMode(PatternId next) {
  mode = next;
  step = 0;
  render();
  Serial.printf("Mode -> %s\n", kPatterns[mode].name);
}

// Опитати кнопки; змінити режим, якщо натиснута кнопка іншого режиму.
void pollButtons() {
  for (const Button& b : kButtons) {
    if (isPressed(b)) {
      if (b.pattern != mode) setMode(b.pattern);
      return;
    }
  }
}

// Неблокуюче миготіння: перейти до наступного кроку, коли минув його час.
// `millis() - stepStarted` — беззнакова різниця, коректна й після переповнення millis().
void updateLeds() {
  const Pattern& p = kPatterns[mode];
  if (millis() - stepStarted < p.stepMs) return;
  step = (step + 1) % p.stepCount;
  render();
}

void waitForSerial(uint32_t timeoutMs) {
  const uint32_t start = millis();
  while (!Serial && millis() - start < timeoutMs) {
  }
}

void printBanner() {
  Serial.println();
  Serial.println("=== ESP32-S3: LEDs, external button + BOOT ===");
  Serial.print("LEDs:");
  for (uint8_t pin : kLedPins) Serial.printf(" GPIO%u", pin);
  Serial.println();
  for (const Button& b : kButtons) {
    Serial.printf("Button %-8s GPIO%-2u -> mode %s\n", b.name, b.pin, kPatterns[b.pattern].name);
  }
  Serial.printf("Start mode: %s\n", kPatterns[mode].name);
}

}  // namespace

void setup() {
  Serial.begin(kSerialBaud);
  waitForSerial(kSerialWaitMs);

  for (uint8_t pin : kLedPins) pinMode(pin, OUTPUT);
  for (const Button& b : kButtons) pinMode(b.pin, b.inputMode);

  printBanner();
  render();
}

void loop() {
  pollButtons();
  updateLeds();
  delay(1);
}

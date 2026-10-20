// ДЗ модуля 2.1, завдання 1–4: superloop з трьома режимами LED, кнопка на перериванні,
// заміри тривалості ітерації loop().
//
//   GPIO15 → резистор 220 Ω → анод LED → катод → GND
//   GPIO21 → кнопка → GND, вхід INPUT_PULLUP (натиснута = LOW), переривання FALLING
//
// Кожне натискання: BLINK → STEADY_ON → STEADY_OFF → BLINK…
// Кожні 1000 ітерацій loop() — середня, мінімальна й максимальна тривалість ітерації.

#include <Arduino.h>

#include <cinttypes>

#include "blinker.h"
#include "button.h"
#include "config.h"
#include "console.h"
#include "debouncer.h"
#include "led.h"
#include "led_state.h"
#include "loop_stats.h"

namespace {

class ModesApp {
 public:
  void init() {
    beginConsole(Config::Console::kBaud, Config::Console::kWaitMs);
    led_.init();
    button_.init();

    Serial.println();
    Serial.println("=== ESP32-S3: LED modes, superloop + ISR ===");
    Serial.printf("LED GPIO%u, blink %" PRIu32 " ms\n", Config::Led::kPin,
                  Config::Led::kBlinkIntervalMs);
    Serial.printf("Button GPIO%u (FALLING), debounce %" PRIu32 " ms\n", Config::Button::kPin,
                  Config::Button::kDebounceMs);
    Serial.printf("Loop stats every %" PRIu32 " iterations\n",
                  Config::Profiler::kWindowIterations);

    enterMode(LedMode::Blink, millis());
    Serial.printf("Mode: %s\n", modeName(mode_));
    lastPassCycles_ = ESP.getCycleCount();
  }

  // Одна ітерація superloop. Нічого не чекає: кожен крок перевіряє «чи пора?» і повертається.
  void update() {
    const uint32_t nowMs = millis();  // один момент часу на весь прохід
    handleButton(nowMs);
    updateLed(nowMs);
    profile();
  }

 private:
  void handleButton(uint32_t nowMs) {
    // Рівень читаємо лише тоді, коли фронти стихли: LOW — натискання, HIGH — брязкіт відпускання.
    if (!debouncer_.settled(button_.takeEdge(), nowMs) || !button_.isPressed()) return;

    ++pressCount_;
    enterMode(nextMode(mode_), nowMs);
    tryPrintf("Press #%" PRIu32 " -> mode %s\n", pressCount_, modeName(mode_));
  }

  void enterMode(LedMode mode, uint32_t nowMs) {
    mode_ = mode;
    if (mode_ == LedMode::Blink) blinker_.restart(nowMs);  // почати блимання з «увімкнено»
  }

  void updateLed(uint32_t nowMs) {
    switch (mode_) {
      case LedMode::Blink:     led_.set(blinker_.update(nowMs)); break;
      case LedMode::SteadyOn:  led_.set(LedState::On); break;
      case LedMode::SteadyOff: led_.set(LedState::Off); break;
    }
  }

  // Тривалість ітерації = час між двома послідовними викликами profile(). Сюди входить і те,
  // що ядро Arduino робить між викликами loop(). Лічильник тактів CPU (240 МГц) — роздільність
  // ~4 нс, тоді як micros() дає лише 1 мкс; переповнюється кожні ~17.9 с, але беззнакова
  // різниця коректна для будь-якої ітерації, коротшої за це.
  void profile() {
    const uint32_t nowCycles = ESP.getCycleCount();
    const bool     full      = stats_.add(nowCycles - lastPassCycles_);
    lastPassCycles_          = nowCycles;
    if (!full) return;

    tryPrintf("Loop x%" PRIu32 ": avg %" PRIu64 " ns, min %" PRIu64 " ns, max %" PRIu64 " ns\n",
              stats_.count(), ns(stats_.average()), ns(stats_.min()), ns(stats_.max()));
    stats_.reset();
    lastPassCycles_ = ESP.getCycleCount();  // сам звіт не рахувати в наступне вікно
  }

  static uint64_t ns(uint32_t cycles) { return cyclesToNs(cycles, ESP.getCpuFreqMHz()); }

  Led           led_{Config::Led::kPin};
  Button        button_{Config::Button::kPin};
  Blinker       blinker_{Config::Led::kBlinkIntervalMs};
  EdgeDebouncer debouncer_{Config::Button::kDebounceMs};
  LoopStats     stats_{Config::Profiler::kWindowIterations};
  LedMode       mode_           = LedMode::Blink;
  uint32_t      pressCount_     = 0;
  uint32_t      lastPassCycles_ = 0;
};

// Arduino ділить програму на setup() і loop(), тож стан, який живе між викликами loop(),
// мусить лежати поза ними. Замість десятка глобальних змінних — один об'єкт, видимий лише
// в цьому файлі. Навіть прапорець ISR — член Button усередині нього, а не глобальна змінна.
// Об'єкт статичний, розмір відомий під час компіляції: жодного new / malloc.
ModesApp app;

}  // namespace

void setup() { app.init(); }

void loop() { app.update(); }

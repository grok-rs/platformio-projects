// ДЗ модуля 2.1, завдання 1–2: «класичний Arduino blink», переписаний на Embedded C++.
//
//   Класичний blink                       Тут
//   #define LED 15, delay(500)            Config::Led::kPin, kBlinkIntervalMs — constexpr
//   digitalWrite(LED, HIGH / LOW)         enum class LedState + клас Led
//   delay(500) — процесор стоїть          Blinker + millis(): loop() ніколи не чекає
//
//   GPIO15 → резистор 220 Ω → анод LED → катод → GND

#include <Arduino.h>

#include <cinttypes>

#include "blinker.h"
#include "config.h"
#include "console.h"
#include "led.h"

namespace {

class BlinkApp {
 public:
  void init() {
    beginConsole(Config::Console::kBaud, Config::Console::kWaitMs);
    led_.init();

    Serial.println();
    Serial.println("=== ESP32-S3: non-blocking blink ===");
    Serial.printf("LED GPIO%u, interval %" PRIu32 " ms\n", Config::Led::kPin,
                  Config::Led::kBlinkIntervalMs);

    blinker_.restart(millis());
    led_.set(blinker_.state());
  }

  // Один прохід superloop: порівняти час і, якщо пора, перемкнути LED. Без очікування.
  void update() { led_.set(blinker_.update(millis())); }

 private:
  Led     led_{Config::Led::kPin};
  Blinker blinker_{Config::Led::kBlinkIntervalMs};
};

// Arduino ділить програму на setup() і loop(), тож стан, який живе між викликами loop(),
// мусить лежати поза ними. Замість кількох глобальних змінних — один об'єкт, видимий лише
// в цьому файлі (анонімний простір імен = внутрішнє зв'язування).
BlinkApp app;

}  // namespace

void setup() { app.init(); }

void loop() { app.update(); }

#include <Arduino.h>

// ДЗ 2.1, завдання 1–2: класичний blink без delay(), без магічних чисел і без глобальних змінних

// завдання 2: усі числа — в одній структурі, static constexpr (відомі під час компіляції, RAM не займають)
struct Config {
  static constexpr uint8_t  LED_PIN  = 15;      // GPIO15 → 220 Ом → LED → GND
  static constexpr uint32_t BLINK_MS = 500;     // пів періоду: 1 Гц
  static constexpr uint32_t BAUD     = 115200;
};

// стан LED — enum class, а не bool чи HIGH/LOW: не переплутати з числом
enum class LedState : uint8_t { Off, On };

class Led {
 public:
  explicit Led(uint8_t pin) : pin_(pin) {}  // конструктор лише запам'ятовує пін
  void init() { pinMode(pin_, OUTPUT); set(LedState::Off); }  // залізо — у setup()
  void set(LedState s) { state_ = s; digitalWrite(pin_, s == LedState::On ? HIGH : LOW); }
  LedState state() const { return state_; }

 private:
  uint8_t pin_;
  LedState state_ = LedState::Off;
};

// стан, що живе між викликами loop(), — в одному об'єкті, а не в глобальних змінних
class App {
 public:
  void init() {
    Serial.begin(Config::BAUD);
    led_.init();
    Serial.println("=== ESP32-S3: non-blocking blink ===");
  }

  // один прохід superloop: «чи пора?» — і далі, без очікування
  void update() {
    uint32_t now = millis();
    if (now - last_ >= Config::BLINK_MS) {
      last_ = now;
      led_.set(led_.state() == LedState::On ? LedState::Off : LedState::On);
    }
  }

 private:
  Led led_{Config::LED_PIN};
  uint32_t last_ = 0;
};

static App app;  // єдиний об'єкт, видимий лише в цьому файлі

void setup() { app.init(); }
void loop() { app.update(); }

#include <Arduino.h>

// ДЗ 2.1, завдання 1–4: blink без delay(), заміри loop(), кнопка на перериванні перемикає режими
//   BLINK → STEADY_ON → STEADY_OFF → BLINK…

// завдання 2: усі числа — в одній структурі, static constexpr (відомі під час компіляції, RAM не займають)
struct Config {
  static constexpr uint8_t  LED_PIN      = 15;    // GPIO15 → 220 Ом → LED → GND
  static constexpr uint8_t  BUTTON_PIN   = 21;    // GPIO21 → кнопка → GND, INPUT_PULLUP
  static constexpr uint32_t BLINK_MS     = 500;   // пів періоду: 1 Гц
  static constexpr uint32_t DEBOUNCE_MS  = 30;    // тиша після останнього фронту
  static constexpr uint32_t REPORT_EVERY = 1000;  // звіт кожні N ітерацій loop()
  static constexpr uint32_t BAUD         = 115200;
};

enum class LedState : uint8_t { Off, On };
enum class Mode : uint8_t { Blink, SteadyOn, SteadyOff };

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

// завдання 4: кнопка на перериванні; ISR лише піднімає volatile-прапорець
class Button {
 public:
  explicit Button(uint8_t pin) : pin_(pin) {}
  void init() {
    pinMode(pin_, INPUT_PULLUP);  // відпущена = HIGH, натиснута = LOW
    attachInterruptArg(digitalPinToInterrupt(pin_), onFall, this, FALLING);
  }
  // прочитати й скинути прапорець (фронт, що влучить між цими рядками, — той самий брязкіт)
  bool takeEdge() { bool e = edge_; edge_ = false; return e; }
  bool isPressed() const { return digitalRead(pin_) == LOW; }

 private:
  static void IRAM_ATTR onFall(void* self) { static_cast<Button*>(self)->edge_ = true; }  // без Serial/delay
  uint8_t pin_;
  volatile bool edge_ = false;  // пише ISR, читає loop() — volatile: читати пам'ять щоразу
};

const char* modeName(Mode m) {
  switch (m) {
    case Mode::Blink:    return "BLINK";
    case Mode::SteadyOn: return "STEADY_ON";
    default:             return "STEADY_OFF";
  }
}

// стан, що живе між викликами loop(), — в одному об'єкті, а не в глобальних змінних
class App {
 public:
  void init() {
    Serial.begin(Config::BAUD);
    led_.init();
    button_.init();
    Serial.println("=== ESP32-S3: LED modes, superloop + ISR ===");
    Serial.println("Mode: BLINK");
    lastUs_ = micros();
  }

  void update() {
    uint32_t now = millis();  // один «знімок часу» на весь прохід

    // кнопка: після фронту чекаємо 30 мс тиші, тоді рівень LOW = натиснули, HIGH = брязкіт відпускання
    if (button_.takeEdge()) { lastEdge_ = now; pending_ = true; }
    if (pending_ && now - lastEdge_ >= Config::DEBOUNCE_MS) {
      pending_ = false;
      if (button_.isPressed()) nextMode(now);
    }

    // LED за режимом
    if (mode_ == Mode::Blink) {
      if (now - lastBlink_ >= Config::BLINK_MS) {
        lastBlink_ = now;
        led_.set(led_.state() == LedState::On ? LedState::Off : LedState::On);
      }
    } else {
      led_.set(mode_ == Mode::SteadyOn ? LedState::On : LedState::Off);
    }

    measure();
  }

 private:
  void nextMode(uint32_t now) {
    switch (mode_) {
      case Mode::Blink:    mode_ = Mode::SteadyOn; break;
      case Mode::SteadyOn: mode_ = Mode::SteadyOff; break;
      default:             mode_ = Mode::Blink; lastBlink_ = now; led_.set(LedState::On); break;
    }
    Serial.printf("Press #%lu -> mode %s\n", ++presses_, modeName(mode_));
  }

  // завдання 3: тривалість ітерації = час між двома проходами цієї точки
  void measure() {
    unsigned long nowUs = micros(), dt = nowUs - lastUs_;
    lastUs_ = nowUs;
    sumUs_ += dt;
    if (dt < minUs_) minUs_ = dt;
    if (dt > maxUs_) maxUs_ = dt;
    if (++loops_ < Config::REPORT_EVERY) return;

    Serial.printf("Loop x%lu: avg %.2f us, min %lu us, max %lu us\n", loops_, (float)sumUs_ / loops_, minUs_, maxUs_);
    loops_ = sumUs_ = maxUs_ = 0;
    minUs_ = ULONG_MAX;
    lastUs_ = micros();  // сам звіт не рахувати в наступне вікно
  }

  Led led_{Config::LED_PIN};
  Button button_{Config::BUTTON_PIN};
  Mode mode_ = Mode::Blink;
  uint32_t lastBlink_ = 0, lastEdge_ = 0;
  bool pending_ = false;
  unsigned long presses_ = 0;
  unsigned long loops_ = 0, lastUs_ = 0, sumUs_ = 0, minUs_ = ULONG_MAX, maxUs_ = 0;
};

static App app;  // єдиний об'єкт, видимий лише в цьому файлі

void setup() { app.init(); }
void loop() { app.update(); }

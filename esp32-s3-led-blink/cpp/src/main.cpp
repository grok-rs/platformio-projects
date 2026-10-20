// Точка входу. Тут лише «збирання» програми з компонентів:
//   LedDriver      — як кадри потрапляють на виводи (залежить від схеми);
//   BlinkPlayer    — перемикання кадрів патерну за таймером;
//   Button         — кнопка BOOT;
//   SerialConsole  — команди та стан через Serial-монітор.
//
// Вибір схеми підключення — єдине місце з умовною компіляцією.
// SINGLE_GPIO_MODE задається у platformio.ini (середовище esp32-s3-single-gpio).

#include <Arduino.h>

#include <initializer_list>

#include "blink_player.hpp"
#include "button.hpp"
#include "config.hpp"
#include "pattern.hpp"
#include "serial_console.hpp"

#if SINGLE_GPIO_MODE
#include "shared_pin_led_driver.hpp"
#else
#include "gpio_led_driver.hpp"
#endif

namespace {

#if SINGLE_GPIO_MODE
SharedPinLedDriver ledDriver(config::kSharedPin, config::kMultiplexPeriodUs);
#else
GpioLedDriver ledDriver({ config::kRedPin, config::kGreenPin, config::kBluePin });
#endif

BlinkPlayer   player(ledDriver, patterns::all(), patterns::speedsMs(), patterns::kInitialSpeedIndex);
Button        button(config::kButtonPin, config::kDebounceMs, config::kLongPressMs);
SerialConsole console(Serial, player, ledDriver);

// USB CDC з'являється не миттєво; чекаємо обмежений час, щоб не втратити банер.
void waitForSerial(uint32_t timeoutMs) {
  const uint32_t start = millis();
  while (!Serial && millis() - start < timeoutMs) {
  }
}

// Один прогін усіх світлодіодів після старту. Єдине місце з delay():
// loop() ще не почався, тому блокування тут безпечне.
void runSelfTest(LedDriver& driver, uint32_t stepMs) {
  Serial.println("Self-test: red -> blue -> green");
  for (Frame frame : { Frame{Led::Red}, Frame{Led::Blue}, Frame{Led::Green}, Frame::off() }) {
    driver.show(frame);
    delay(stepMs);
  }
}

}  // namespace

void setup() {
  Serial.begin(config::kSerialBaud);
  waitForSerial(config::kSerialWaitMs);

  ledDriver.begin();
  button.begin();

  console.printBanner();
  runSelfTest(ledDriver, config::kSelfTestStepMs);

  player.begin();
  console.printState();
}

void loop() {
  switch (button.poll()) {
    case Button::Event::ShortPress: player.nextSpeed();   console.printState(); break;
    case Button::Event::LongPress:  player.nextPattern(); console.printState(); break;
    case Button::Event::None:       break;
  }
  console.update();
  player.update();
  ledDriver.update();
}

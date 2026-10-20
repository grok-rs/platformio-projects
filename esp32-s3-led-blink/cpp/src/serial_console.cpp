#include "serial_console.hpp"

SerialConsole::SerialConsole(Stream& io, BlinkPlayer& player, const LedDriver& driver)
    : io_(io), player_(player), driver_(driver) {}

void SerialConsole::printBanner() const {
  io_.println();
  io_.println("=== ESP32-S3 LED blink ===");
  driver_.describe(io_);
  io_.println("BOOT button: short press = next speed, long press = next pattern");
  io_.println("Serial keys: 1/2/3 = hold red/blue/green, 0 = all off, p = pattern, v = speed,");
  io_.println("             any other key = resume pattern");
}

void SerialConsole::printState() const {
  io_.printf("Pattern: %-14s  Speed: %4u ms/frame\n",
             player_.pattern().name, player_.frameDurationMs());
}

void SerialConsole::update() {
  while (io_.available() > 0) {
    handleKey(static_cast<char>(io_.read()));
  }
}

void SerialConsole::holdForTest(Frame frame, const char* what) {
  player_.hold(frame);
  io_.print("TEST: ");
  io_.println(what);
}

void SerialConsole::handleKey(char key) {
  switch (key) {
    case '1': holdForTest(Frame{Led::Red},   "red on");   break;
    case '2': holdForTest(Frame{Led::Blue},  "blue on");  break;
    case '3': holdForTest(Frame{Led::Green}, "green on"); break;
    case '0': holdForTest(Frame::off(),      "all off");  break;
    case 'p':
      player_.nextPattern();
      printState();
      break;
    case 'v':
      player_.nextSpeed();
      printState();
      break;
    case '\r':
    case '\n':
    case ' ':
      break;   // роздільники з монітора — ігноруємо
    default:
      if (player_.isHeld()) {
        player_.resume();
        io_.print("Pattern resumed. ");
        printState();
      }
      break;
  }
}

#include <Arduino.h>

// Крок 1: світлодіод світить, поки кнопку тримають
#define LED 15  // GPIO15 → 220 Ом → LED → GND
#define BTN 21  // GPIO21 → кнопка → GND (натиснута = LOW)

bool wasPressed = false;

void setup() {
  Serial.begin(115200);
  pinMode(LED, OUTPUT);
  pinMode(BTN, INPUT_PULLUP);  // внутрішній резистор ~45 кОм до 3.3 В
  Serial.println("=== ESP32-S3: LED follows button (hold) ===");
}

void loop() {
  bool pressed = digitalRead(BTN) == LOW;
  digitalWrite(LED, pressed);  // просто копіюємо стан кнопки на LED

  // друкуємо лише зміни, інакше монітор заллє тисячами рядків
  if (pressed != wasPressed) {
    wasPressed = pressed;
    Serial.println(pressed ? "Button pressed  -> LED ON" : "Button released -> LED OFF");
  }
  delay(1);
}

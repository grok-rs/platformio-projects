#include <Arduino.h>

// ТЗ-A, етап 2: GPIO5 — звичайний цифровий вихід, без ШІМ. HIGH і LOW по 3 с.
// Поки HIGH: LED світить, мультиметр між базою й емітером — U(БЕ) ≈ 0,6–0,8 В.
#define KEY_PIN 5  // → 1 кОм → база 2N2222
#define HALF_MS 3000

void setup() {
  Serial.begin(115200);
  pinMode(KEY_PIN, OUTPUT);
  Serial.println("Етап 2: GPIO5 HIGH/LOW по 3 с — міряйте U(БЕ), поки HIGH");
}

void loop() {
  digitalWrite(KEY_PIN, HIGH);
  Serial.println("GPIO5 HIGH: LED on");
  delay(HALF_MS);

  digitalWrite(KEY_PIN, LOW);
  Serial.println("GPIO5 LOW: LED off");
  delay(HALF_MS);
}

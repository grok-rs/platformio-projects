#include <Arduino.h>

// Обидва світлодіоди на ОДНОМУ GPIO — у виводу три стани:
//   GPIO7 ── 220 Ом ── червоний ── GND    світить при HIGH (вивід віддає струм)
//   3V3   ── 100 Ом ── синій ──── GPIO7   світить при LOW  (вивід втягує струм)
//   INPUT (Hi-Z): обидва згаслі — двом LED послідовно треба ≈4.8 В, а є лише 3.3 В
#define LED_PIN 7

const uint32_t STEP = 500;  // мс на кожен стан

void setup() {
  Serial.begin(115200);
  Serial.println("LED blink: обидва LED на GPIO7 (HIGH / LOW / Hi-Z)");
}

void loop() {
  pinMode(LED_PIN, OUTPUT);
  digitalWrite(LED_PIN, HIGH);  // червоний
  delay(STEP);
  digitalWrite(LED_PIN, LOW);   // синій
  delay(STEP);
  pinMode(LED_PIN, INPUT);      // Hi-Z: обидва вимкнені
  delay(STEP);
}

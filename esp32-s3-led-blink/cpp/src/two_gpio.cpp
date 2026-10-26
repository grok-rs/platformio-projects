#include <Arduino.h>

// Червоний і синій світлодіоди блимають по черзі — кожен на своєму GPIO
#define LED_RED  4  // 220 Ом
#define LED_BLUE 5  // 100 Ом: у синього більше пряме падіння, з 220 Ом він тьмяний

const uint32_t STEP = 500;  // скільки мс світить кожен

void setup() {
  Serial.begin(115200);
  pinMode(LED_RED, OUTPUT);
  pinMode(LED_BLUE, OUTPUT);
  Serial.println("LED blink: червоний GPIO4 / синій GPIO5 по черзі");
}

void loop() {
  digitalWrite(LED_RED, HIGH); digitalWrite(LED_BLUE, LOW);   // світить червоний
  delay(STEP);
  digitalWrite(LED_RED, LOW);  digitalWrite(LED_BLUE, HIGH);  // світить синій
  delay(STEP);
}

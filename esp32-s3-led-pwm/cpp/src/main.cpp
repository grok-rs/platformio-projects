#include <Arduino.h>

// Урок (Blink_Correct): яскравість LED через ШІМ — апаратний блок LEDC
#define LED_OUT 15
const int ledChannel = 0;  // канал ШІМ, який керує світлодіодом

void setup() {
  Serial.begin(115200);
  // 1. Налаштовуємо канал ШІМ: (номер_каналу, частота, розрядність)
  ledcSetup(ledChannel, 5000, 8);  // 8 біт → значення 0…255 (256 рівнів)
  // 2. Прив'язуємо фізичний пін до цього каналу: (номер_піна, номер_каналу)
  ledcAttachPin(LED_OUT, ledChannel);
  // 3. Заповнення: 64 / 256 = 25 % часу HIGH → світлодіод світить слабше
  ledcWrite(ledChannel, 64);
  Serial.println("LED PWM: GPIO15, 5000 Гц, 8 біт, duty 64/256 = 25 %");
}

void loop() {
  // порожньо: сигнал генерує LEDC сам, процесор вільний
}

#include <Arduino.h>

// Сутінковий перемикач: LDR → АЦП → гістерезис → GPIO2 → BC547B → модуль реле
#define LDR_PIN   4  // ADC1_CH3: середня точка LDR (до 3V3) + 10 кОм (до GND)
#define RELAY_PIN 2  // → 10 кОм → база BC547B

// LDR зверху: темніше → менша напруга → менше число АЦП.
// Пороги підібрані за Serial на моїй макетці: кімната ≈ 690, LDR під долонею ≈ 350.
// Проміжок 100 більший за шум АЦП (±20), тож реле не клацає.
#define DARK      500  // нижче — темно: вмикаємо
#define LIGHT     600  // вище — світло: вимикаємо
#define PERIOD_MS 100

bool relayOn = false;
uint32_t last = 0;

void setup() {
  Serial.begin(115200);
  analogReadResolution(12);                    // 0…4095
  analogSetPinAttenuation(LDR_PIN, ADC_11db);  // до ≈3,1 В
  pinMode(RELAY_PIN, OUTPUT);
  digitalWrite(RELAY_PIN, LOW);  // VT1 закритий → IN = 5 В → реле вимкнене
}

void loop() {
  if (millis() - last < PERIOD_MS) return;
  last += PERIOD_MS;  // крок не «повзе», навіть якщо цикл запізнився

  // 1. Зчитати АЦП
  int adc = analogRead(LDR_PIN);

  // 2. Порівняти з порогами (гістерезис)
  if (adc < DARK) {
    relayOn = true;   // темно
  } else if (adc > LIGHT) {
    relayOn = false;  // світло
  }                   // між порогами — нічого не міняємо

  // 3. HIGH → VT1 відкритий → IN ≈ 0 В → реле вмикається
  digitalWrite(RELAY_PIN, relayOn);
  Serial.printf("adc=%4d relay=%s\n", adc, relayOn ? "ON" : "OFF");
}

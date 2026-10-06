// Сутінковий перемикач: LDR → АЦП → гістерезис → GPIO2 → BC547B → модуль реле.
#include <Arduino.h>

constexpr uint8_t  kLdrPin   = 4;   // GPIO In:  ADC1_CH3, середня точка R1 (LDR) + R2
constexpr uint8_t  kRelayPin = 2;   // GPIO Out: через R3 10 кОм на базу VT1

// LDR зверху (до 3V3): темніше → менша напруга → менше число АЦП.
constexpr uint16_t kThresholdDark  = 1000;  // нижче — темно: вмикаємо
constexpr uint16_t kThresholdLight = 1500;  // вище — світло: вимикаємо
constexpr uint32_t kPeriodMs       = 100;

bool     relayOn    = false;
uint32_t lastReadAt = 0;

void setup() {
  Serial.begin(115200);
  analogReadResolution(12);                    // 0…4095
  analogSetPinAttenuation(kLdrPin, ADC_11db);  // до ≈3,1 В
  pinMode(kRelayPin, OUTPUT);
  digitalWrite(kRelayPin, LOW);  // VT1 закритий → IN = 5 В → реле вимкнене
  lastReadAt = millis();
}

void loop() {
  if (millis() - lastReadAt < kPeriodMs) return;
  lastReadAt += kPeriodMs;

  // 1. Зчитати АЦП
  const uint16_t adc = analogRead(kLdrPin);

  // 2. Порівняти з порогами (гістерезис)
  if (adc < kThresholdDark) {
    relayOn = true;                 // темно
  } else if (adc > kThresholdLight) {
    relayOn = false;                // світло
  }                                 // між порогами — нічого не міняємо

  // 3. HIGH → VT1 відкритий → IN ≈ 0 В → реле вмикається
  digitalWrite(kRelayPin, relayOn ? HIGH : LOW);
  Serial.printf("adc=%4d relay=%s\n", adc, relayOn ? "ON" : "OFF");
}

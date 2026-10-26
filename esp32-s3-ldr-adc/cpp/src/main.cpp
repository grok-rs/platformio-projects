#include <Arduino.h>

// Модуль 1.6: фоторезистор + 10 кОм, АЦП. Кожні 100 мс: RAW, мВ за формулою, калібровані мВ і похибка.
//   3V3 ── LDR ──┬── 10 кОм ── GND     більше світла → вища напруга → більше RAW
//                └── GPIO4 (ADC1)
#define LDR_PIN 4        // ADC1 (GPIO1…10) працює і з увімкненим Wi-Fi
#define ADC_MAX 4095.0   // 12 біт: 0…4095
#define UREF_MV 3100.0   // ослаблення 11 дБ на ESP32-S3: 0…3100 мВ, а не 3300

uint32_t lastSample = 0;

void setup() {
  Serial.begin(115200);
  analogReadResolution(12);
  analogSetPinAttenuation(LDR_PIN, ADC_11db);  // і так типове, пишемо явно
  Serial.println("LDR на GPIO4: U_calc = RAW / 4095 * 3100 мВ, error = (U_calc - U_meas) / U_meas * 100 %");
}

void loop() {
  uint32_t now = millis();
  if (now - lastSample < 100) return;
  lastSample = now;

  int raw = analogRead(LDR_PIN);                  // «сире» число АЦП
  uint32_t measMv = analogReadMilliVolts(LDR_PIN);  // калібровані мВ (eFuse) — окреме перетворення
  float calcMv = raw / ADC_MAX * UREF_MV;         // формула з умови

  Serial.printf("RAW: %4d  U_calc: %6.1f mV  U_meas: %4u mV  error: ", raw, calcMv, measMv);
  if (measMv > 0) Serial.printf("%+.2f %%\n", (calcMv - measMv) / measMv * 100);
  else Serial.println("n/a");  // ділити на нуль не можна
}

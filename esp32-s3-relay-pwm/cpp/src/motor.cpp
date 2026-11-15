#include <Arduino.h>

// Модуль 2.2, ДЗ 2: швидкість мотора від потенціометра, ШІМ формує сам процесор (без LEDC).
// Потенціометр 10 кОм: кінці на 3V3 і GND, повзунок → GPIO4 (ADC1).
// GPIO6 → 220 Ом → база 2N2222; мотор між +5 В (MB-102) і колектором, діод 1N4007 паралельно мотору.
#define POT       4
#define MOTOR     6
#define PERIOD_US 1000  // період ШІМ 1000 мкс = 1 кГц
#define PRINT_MS  500

unsigned long lastPrint = 0;

void setup() {
  Serial.begin(115200);
  pinMode(MOTOR, OUTPUT);
  analogReadResolution(12);                // 0…4095
  analogSetPinAttenuation(POT, ADC_11db);  // до ≈3,1 В
  Serial.println("Мотор: програмний ШІМ 1 кГц на GPIO6, потенціометр на GPIO4");
}

void loop() {
  // 1. АЦП → тривалість HIGH і LOW в одному періоді
  int raw = analogRead(POT);
  unsigned long highUs = raw * PERIOD_US / 4095;
  unsigned long lowUs = PERIOD_US - highUs;

  // 2. Один період ШІМ: HIGH — ключ відкритий, мотор під струмом; LOW — крутиться за інерцією
  if (highUs > 0) { digitalWrite(MOTOR, HIGH); delayMicroseconds(highUs); }
  if (lowUs > 0)  { digitalWrite(MOTOR, LOW);  delayMicroseconds(lowUs); }

  // 3. Двічі на секунду — що бачить програма
  if (millis() - lastPrint >= PRINT_MS) {
    lastPrint = millis();
    Serial.printf("ADC %4d  HIGH %4lu мкс  LOW %4lu мкс  duty %3lu %%\n",
                  raw, highUs, lowUs, highUs * 100 / PERIOD_US);
  }
}

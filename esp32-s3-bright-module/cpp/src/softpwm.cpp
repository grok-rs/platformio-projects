#include <Arduino.h>

// ТЗ-A, рівень «+»: те саме, що levels.cpp, але ШІМ формує сам процесор на millis(), без LEDC.
// Період 10 мс (100 Гц): «увімкнено» лише 0…10 цілих мс, тож LOW = 40 → 1 мс = 10 % замість 15,7 %.
#define PWM_PIN     5   // → 1 кОм → база 2N2222
#define PERIOD_MS   10  // період програмного ШІМ
#define BUTTON      6   // 3V3 → кнопка → GPIO6
#define DEBOUNCE_MS 50

const uint8_t LEVELS[] = {0, 40, 128, 255};
const char* NAMES[] = {"OFF", "LOW", "MID", "HIGH"};
int level = 0;
uint32_t presses = 0;

volatile bool edge = false;  // ISR лише ставить прапорець
bool waiting = false;
uint32_t edgeAt = 0;

void IRAM_ATTR onButton() { edge = true; }

void setLevel(int l) {
  level = l;
  Serial.printf("%s (duty %u, %u%%)\n", NAMES[level], LEVELS[level], (LEVELS[level] * 100 + 127) / 255);
}

void setup() {
  Serial.begin(115200);
  pinMode(PWM_PIN, OUTPUT);
  pinMode(BUTTON, INPUT_PULLDOWN);
  attachInterrupt(digitalPinToInterrupt(BUTTON), onButton, RISING);
  Serial.println("Яскравий модуль: програмний ШІМ, період 10 мс (millis)");
  Serial.print("Level: ");
  setLevel(0);
}

void loop() {
  uint32_t now = millis();

  // кнопка — як у levels.cpp
  if (edge && !waiting) { waiting = true; edgeAt = now; }
  if (waiting && now - edgeAt >= DEBOUNCE_MS) {
    waiting = false;
    edge = false;
    if (digitalRead(BUTTON) == HIGH) {
      presses++;
      Serial.printf("Press #%lu -> ", (unsigned long)presses);
      setLevel((level + 1) % 4);
    }
  }

  // ШІМ: на початку кожного періоду HIGH, поки не мине частка duty/255 періоду
  uint32_t onMs = LEVELS[level] * PERIOD_MS / 255;
  digitalWrite(PWM_PIN, now % PERIOD_MS < onMs ? HIGH : LOW);
}

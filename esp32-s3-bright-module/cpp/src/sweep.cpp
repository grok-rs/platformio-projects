#include <Arduino.h>

// ТЗ-A, етап 3: заповнення LEDC плавно 0 → 255, пауза 3 с, 255 → 0, пауза 3 с.
// На паузі 255 мультиметр (DC) між колектором і GND показує ≈ 0,1–0,2 В (ключ у насиченні).
#define PWM_PIN  5     // → 1 кОм → база 2N2222
#define PWM_CH   0     // канал LEDC
#define PWM_FREQ 5000  // 5 кГц
#define PWM_BITS 8     // заповнення 0…255
#define STEP_MS  12    // 255 кроків × 12 мс ≈ 3 с на розгін
#define HOLD_MS  3000

// фаза: 0 розгін, 1 пауза на 255, 2 спад, 3 пауза на 0
const char* PHASES[] = {"ramp up", "hold duty 255, measure U(CE) ~0.2 V", "ramp down", "hold duty 0"};
int phase = 0;
int duty = 0;
uint32_t last = 0;

void setup() {
  Serial.begin(115200);
  ledcSetup(PWM_CH, PWM_FREQ, PWM_BITS);
  ledcAttachPin(PWM_PIN, PWM_CH);
  ledcWrite(PWM_CH, 0);
  Serial.println("Етап 3: ШІМ 0 → 255 → 0, паузи по 3 с");
  Serial.printf("Sweep: %s\n", PHASES[phase]);
}

void loop() {
  uint32_t now = millis();

  if (phase == 0 || phase == 2) {  // розгін або спад: крок кожні 12 мс
    if (now - last >= STEP_MS) {
      last = now;
      duty += (phase == 0) ? 1 : -1;
      ledcWrite(PWM_CH, duty);  // 255 ядро саме робить 100 %
      if (duty == 255 || duty == 0) {
        phase++;
        Serial.printf("Sweep: %s\n", PHASES[phase]);
      }
    }
  } else if (now - last >= HOLD_MS) {  // пауза скінчилась
    last = now;
    phase = (phase + 1) % 4;
    Serial.printf("Sweep: %s\n", PHASES[phase]);
  }
}

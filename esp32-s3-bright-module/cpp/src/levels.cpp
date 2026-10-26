#include <Arduino.h>

// ТЗ-A, етап 4: кнопка перемикає яскравість LED по колу OFF → LOW → MID → HIGH → OFF.
// ВП-8: піни й рівні — константи на початку файлу.
#define PWM_PIN     5     // → 1 кОм → база 2N2222
#define PWM_CH      0     // канал LEDC
#define PWM_FREQ    5000  // ВП-1: 5 кГц
#define PWM_BITS    8     // ВП-1: заповнення 0…255
#define BUTTON      6     // 3V3 → кнопка → GPIO6
#define DEBOUNCE_MS 50

const uint8_t LEVELS[] = {0, 40, 128, 255};  // ВП-2
const char* NAMES[] = {"OFF", "LOW", "MID", "HIGH"};
int level = 0;
uint32_t presses = 0;

volatile bool edge = false;  // ВП-4: ISR лише ставить прапорець
bool waiting = false;        // фронт був — чекаємо, поки стихне брязкіт
uint32_t edgeAt = 0;

void IRAM_ATTR onButton() { edge = true; }

void setLevel(int l) {
  level = l;
  ledcWrite(PWM_CH, LEVELS[level]);
  Serial.printf("%s (duty %u, %u%%)\n", NAMES[level], LEVELS[level], (LEVELS[level] * 100 + 127) / 255);
}

void setup() {
  Serial.begin(115200);
  ledcSetup(PWM_CH, PWM_FREQ, PWM_BITS);
  ledcAttachPin(PWM_PIN, PWM_CH);
  pinMode(BUTTON, INPUT_PULLDOWN);                                 // ВП-3: відпущена = LOW
  attachInterrupt(digitalPinToInterrupt(BUTTON), onButton, RISING);  // натиснута = фронт
  Serial.println("Яскравий модуль: LEDC 5 кГц, 8 біт; кнопка GPIO6");
  Serial.print("Level: ");
  setLevel(0);
}

void loop() {
  uint32_t now = millis();

  // ВП-5: перший фронт запускає 50 мс тиші; після неї кнопка ще натиснута — це натискання.
  // Відскоки за ці 50 мс забуваємо; брязкіт при відпусканні відсіюється, бо тоді вхід уже LOW.
  if (edge && !waiting) { waiting = true; edgeAt = now; }
  if (waiting && now - edgeAt >= DEBOUNCE_MS) {
    waiting = false;
    edge = false;
    if (digitalRead(BUTTON) == HIGH) {
      presses++;
      Serial.printf("Press #%lu -> ", (unsigned long)presses);  // ВП-7
      setLevel((level + 1) % 4);                                 // ВП-6
    }
  }
}

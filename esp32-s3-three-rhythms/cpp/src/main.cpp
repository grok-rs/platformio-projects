#include <Arduino.h>

// Проєкт A «Три ритми»: три LED блимають у різних ритмах одночасно — лише millis(), без delay()
#define LED1 6  // червоний
#define LED2 5  // жовтий
#define LED3 4  // зелений

// у кожного LED — свій таймер (період + останній момент + стан)
const uint32_t P1 = 200, P2 = 500, P3 = 1000;  // різні періоди, мс (T1…T3 в ESP32-S3 зайняті: це touch-піни)
uint32_t last1 = 0, last2 = 0, last3 = 0;
bool s1 = false, s2 = false, s3 = false;

// лічильник проходів loop() — раз на секунду в Serial
uint32_t loops = 0, lastReport = 0;

void setup() {
  Serial.begin(115200);
  pinMode(LED1, OUTPUT); pinMode(LED2, OUTPUT); pinMode(LED3, OUTPUT);
  Serial.println("Три ритми: 200 / 500 / 1000 мс");
}

void loop() {
  uint32_t now = millis();  // один «знімок часу» на весь прохід
  loops++;

  if (now - last1 >= P1) { last1 = now; s1 = !s1; digitalWrite(LED1, s1); /* delay(100); ← експеримент */ }
  if (now - last2 >= P2) { last2 = now; s2 = !s2; digitalWrite(LED2, s2); }
  if (now - last3 >= P3) { last3 = now; s3 = !s3; digitalWrite(LED3, s3); }

  if (now - lastReport >= 1000) {
    lastReport = now;
    Serial.printf("Loops/s: %lu\n", (unsigned long)loops);
    loops = 0;
  }
}

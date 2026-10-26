#include <Arduino.h>

// Крок 2: кожне натискання перемикає світлодіод (з антибрязкотом)
#define LED 15  // GPIO15 → 220 Ом → LED → GND
#define BTN 21  // GPIO21 → кнопка → GND (натиснута = LOW)
#define DEBOUNCE_MS 30  // брязкіт звичайної кнопки — до ~10 мс

bool ledOn = false;
int stable = HIGH;     // підтверджений рівень кнопки (відпущена = HIGH)
int lastRead = HIGH;   // останнє «сире» читання, може брязкотіти
uint32_t lastChange = 0;
uint32_t presses = 0;

void setup() {
  Serial.begin(115200);
  pinMode(LED, OUTPUT);
  pinMode(BTN, INPUT_PULLUP);
  Serial.println("=== ESP32-S3: button toggles LED ===");
}

void loop() {
  int r = digitalRead(BTN);
  if (r != lastRead) { lastRead = r; lastChange = millis(); }  // відскок — відлік заново

  // рівень тримається 30 мс і він новий — приймаємо
  if (millis() - lastChange >= DEBOUNCE_MS && r != stable) {
    stable = r;
    if (stable == LOW) {  // подія: натиснули (а не відпустили)
      ledOn = !ledOn;
      digitalWrite(LED, ledOn);
      Serial.printf("Press #%lu -> LED %s\n", (unsigned long)++presses, ledOn ? "ON" : "OFF");
    }
  }
  delay(1);
}

#include <Arduino.h>

// Модуль 1.4: два LED, зовнішня кнопка і BOOT вибирають режим миготіння
//   режим 1 (старт) — обидва LED разом, 200 мс;  вмикає зовнішня кнопка
//   режим 2         — LED по черзі, 1000 мс;     вмикає BOOT
#define LED1 15  // GPIO15 → 220 Ом → LED → GND
#define LED2 16  // GPIO16 → 220 Ом → LED → GND
#define BTN  21  // зовнішня кнопка → GND, INPUT_PULLUP
#define BOOT 0   // кнопка BOOT на платі, підтяжка 10 кОм вже є

int mode = 1;          // «пам'ять» програми: змінюється лише кнопкою
bool phase = true;     // перша чи друга половина такту
uint32_t last = 0;     // коли почалася поточна половина

// вивести поточну половину такту на LED
void show() {
  digitalWrite(LED1, phase);
  digitalWrite(LED2, mode == 1 ? phase : !phase);  // режим 2: LED2 — навпаки
}

// новий режим починається одразу, з першої половини
void setMode(int m) {
  if (m == mode) return;  // та сама кнопка ще раз — нічого не змінюємо
  mode = m;
  phase = true;
  last = millis();
  show();
  Serial.println(mode == 1 ? "Mode -> 1 (sync, 200 ms)" : "Mode -> 2 (alternate, 1000 ms)");
}

void setup() {
  Serial.begin(115200);
  pinMode(LED1, OUTPUT); pinMode(LED2, OUTPUT);
  pinMode(BTN, INPUT_PULLUP);
  pinMode(BOOT, INPUT);
  Serial.println("=== ESP32-S3: LEDs, external button + BOOT ===");
  Serial.println("Start mode: 1 (sync, 200 ms)");
  show();
}

void loop() {
  // кнопки опитуються щопроходу — без delay() натискання не губиться
  if (digitalRead(BTN) == LOW) setMode(1);
  else if (digitalRead(BOOT) == LOW) setMode(2);

  uint32_t period = (mode == 1) ? 200 : 1000;
  if (millis() - last >= period) {
    last = millis();
    phase = !phase;
    show();
  }
}

// ДЗ модуля 1.5 — код з умови без змін у логіці (pio run -e homework).
// Єдина відмінність: кнопка на GPIO21 замість GPIO16 — так зібрано стенд з уроку
// (esp32-s3-bounce-test). Рахує спрацювання переривання FALLING; порівняйте цей лічильник
// з кількістю спадаючих фронтів на CH1 логічного аналізатора.

#include <Arduino.h>

#define BUTTON_IN 21  // Кнопка підключена до GPIO 21 (в умові — GPIO 16)

volatile uint32_t button_counter = 0;  // volatile обов'язковий для змінних, які змінюються всередині ISR

uint32_t last_count = 0;  // Змінна для відслідковування змін у головному циклі

// Швидка функція обробки переривань (ISR), яка розміщується в оперативній пам'яті (IRAM)
void IRAM_ATTR button_isr() {
  button_counter++;
}

void setup() {
  pinMode(BUTTON_IN, INPUT_PULLUP);
  Serial.begin(115200);

  // Прив'язка переривання. FALLING означає спрацьовування при натисканні (перехід з 1 в 0)
  attachInterrupt(digitalPinToInterrupt(BUTTON_IN), button_isr, FALLING);
}

void loop() {
  if (button_counter != last_count) {
    last_count = button_counter;
    Serial.print("Button Pressed! Count: ");
    Serial.println(last_count);
  }

  delay(10);
}

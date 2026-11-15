#include <Arduino.h>

// Модуль 2.2, ДЗ 2, експеримент: UART як джерело ШІМ. TX UART1 шле той самий байт без пауз.
// Кадр 8N1 = старт (0) + 8 біт даних молодшим уперед + стоп (1): частка HIGH = (одиниці + 1) / 10.
#define UART_TX 6     // TX UART1 → той самий ключ 2N2222 з мотором, що й у motor.cpp; сюди ж CH1 аналізатора
#define BAUD    9600  // кадр 10 біт → 960 кадрів/с: «ШІМ» 960 Гц
#define SHOW_MS 3000  // кожен байт — 3 с

const uint8_t BYTES[] = {0x00, 0x0F, 0x55, 0xFF};
int current = 0;
unsigned long lastSwitch = 0;

void show(uint8_t b) {
  Serial.printf("0x%02X  кадр: 0 ", b);                     // старт-біт
  for (int i = 0; i < 8; i++) Serial.print((b >> i) & 1);  // біти даних, молодший першим
  Serial.printf(" 1  HIGH %d %%\n", (__builtin_popcount(b) + 1) * 10);  // стоп-біт
}

void setup() {
  Serial.begin(115200);
  Serial1.begin(BAUD, SERIAL_8N1, -1, UART_TX);  // RX не потрібен (-1); у спокої TX = HIGH
  Serial.println("UART як ШІМ: TX UART1 на GPIO6, 9600 бод, 8N1");
  show(BYTES[current]);
}

void loop() {
  if (millis() - lastSwitch >= SHOW_MS) {
    lastSwitch = millis();
    current = (current + 1) % 4;
    show(BYTES[current]);
  }
  Serial1.write(BYTES[current]);  // FIFO повний — write чекає, тож кадри йдуть один за одним без пауз
}

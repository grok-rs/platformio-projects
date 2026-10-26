#include <Arduino.h>

// Брязкіт кнопки: переривання CHANGE записує час кожного фронту, loop() друкує звіт про подію.
// Ту саму подію знайдіть у логічному аналізаторі (CH1 на GPIO21) і порівняйте кількість фронтів.
#define BUTTON    21  // кнопка на GND, INPUT_PULLUP: відпущена = HIGH
#define BOUNCE    40  // CH2 аналізатора: HIGH від другого фронту події до її кінця
#define LABEL_TX  41  // CH3 аналізатора: UART 115200 з підписом події
#define QUIET_US  50000  // 50 мс без фронтів = подія закінчилась
#define MAX_EDGES 64

// спільні з перериванням — тому volatile
volatile uint32_t edgeTimes[MAX_EDGES];
volatile uint32_t edgeCount = 0;   // усі фронти події, навіть ті, що не влізли в масив
volatile uint32_t lastEdgeUs = 0;

int stableLevel = HIGH;  // рівень після попередньої події
uint32_t presses = 0, releases = 0, glitches = 0;

// обробник: лише записати час, друкує loop()
void IRAM_ATTR onEdge() {
  uint32_t now = micros();
  if (edgeCount < MAX_EDGES) edgeTimes[edgeCount] = now;
  edgeCount = edgeCount + 1;
  lastEdgeUs = now;
  if (edgeCount == 2) digitalWrite(BOUNCE, HIGH);  // другий фронт = брязкіт
}

void setup() {
  Serial.begin(115200);
  pinMode(BUTTON, INPUT_PULLUP);
  pinMode(BOUNCE, OUTPUT);
  stableLevel = digitalRead(BUTTON);
  Serial1.begin(115200, SERIAL_8N1, -1, LABEL_TX);  // лише TX
  attachInterrupt(digitalPinToInterrupt(BUTTON), onEdge, CHANGE);
  Serial.println("=== ESP32-S3: button bounce test ===");
  Serial.println("Button GPIO21, interrupt CHANGE, event ends after 50 ms of quiet");
}

void loop() {
  if (edgeCount == 0 || micros() - lastEdgeUs < QUIET_US) return;  // подія ще триває

  // забрати дані: на мить вимкнути переривання
  uint32_t t[MAX_EDGES];
  noInterrupts();
  uint32_t count = edgeCount;
  uint32_t n = min(count, (uint32_t)MAX_EDGES);
  for (uint32_t i = 0; i < n; i++) t[i] = edgeTimes[i];
  edgeCount = 0;
  interrupts();
  digitalWrite(BOUNCE, LOW);

  // рівень став LOW — натиснули, HIGH — відпустили, не змінився — короткий імпульс
  int level = digitalRead(BUTTON);
  bool changed = level != stableLevel;
  stableLevel = level;
  const char *kind = !changed ? "GLITCH" : level == LOW ? "PRESS" : "RELEASE";
  uint32_t index = !changed ? ++glitches : level == LOW ? ++presses : ++releases;
  // зміна рівня = непарна кількість фронтів; інша парність — ISR загубила фронт
  bool missed = (count % 2 == 1) != changed;

  uint32_t bounce = t[n - 1] - t[0];
  uint32_t shortest = UINT32_MAX;
  for (uint32_t i = 1; i < n; i++) shortest = min(shortest, t[i] - t[i - 1]);

  Serial.printf("%-7s #%-3u edges=%-3u bounce=%6u us", kind, index, count, bounce);
  if (n > 1) Serial.printf("  shortest=%u us", shortest);
  if (count == 1) Serial.print("  (clean, no bounce)");
  if (missed) Serial.print("  [ISR missed >=1 edge - see analyzer]");
  Serial.println();
  if (n > 1) {  // інтервали між фронтами — як курсори в аналізаторі (перші 10)
    Serial.print("        gaps us:");
    for (uint32_t i = 1; i < n && i <= 10; i++) Serial.printf(" %u", t[i] - t[i - 1]);
    if (n > 11) Serial.print(" ...");
    Serial.println();
  }
  Serial1.printf("%s#%u e=%u %uus%s\n", kind, index, count, bounce, missed ? " MISSED" : "");
}

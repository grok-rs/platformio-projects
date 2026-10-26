#include <Arduino.h>

// Модуль 1.5 — лабораторія брязкоту: переривання CHANGE записує час і рівень кожного фронту,
// loop() після 50 мс тиші друкує рядок про подію — порівняйте з логічним аналізатором (D0).
#define BUTTON     16     // кнопка на GND, INPUT_PULLUP: відпущена = HIGH
#define ISR_MARKER 17     // D1 аналізатора: HIGH, поки працює обробник
#define QUIET_US   50000  // 50 мс без фронтів = подія закінчилась
#define MAX_EDGES  64
#define SHOW_EDGES 12     // скільки фронтів розписати в рядку

// спільні з перериванням — тому volatile
volatile uint32_t edgeUs[MAX_EDGES];
volatile uint8_t edgeLevel[MAX_EDGES];
volatile uint32_t edgeCount = 0;   // усі фронти події, навіть ті, що не влізли в масив
volatile uint32_t lastEdgeUs = 0;

int stableLevel = HIGH;  // рівень після попередньої події
uint32_t presses = 0, releases = 0, fallTotal = 0, pressMaxUs = 0, releaseMaxUs = 0;

// обробник: лише записати час і рівень, друкує loop()
void IRAM_ATTR onEdge() {
  digitalWrite(ISR_MARKER, HIGH);
  uint32_t now = micros();
  if (edgeCount < MAX_EDGES) {
    edgeUs[edgeCount] = now;
    edgeLevel[edgeCount] = digitalRead(BUTTON);
  }
  edgeCount = edgeCount + 1;
  lastEdgeUs = now;
  digitalWrite(ISR_MARKER, LOW);
}

void printHeader() {
  Serial.println("  #  event    edges  fall  rise  bounce,us  min gap,us  edges, us from the first (v = LOW, ^ = HIGH)");
  Serial.println("---  -------  -----  ----  ----  ---------  ----------  ----------------------------------------------");
}

void printSummary() {
  uint32_t worst = max(pressMaxUs, releaseMaxUs);
  uint32_t debounceMs = (worst * 3 / 2 + 999) / 1000;  // запас ×1.5, вгору до мс
  if (debounceMs == 0) debounceMs = 1;
  Serial.printf("\n=== summary: %u presses, %u releases ===\n", presses, releases);
  Serial.printf("max bounce: press %u us, release %u us\n", pressMaxUs, releaseMaxUs);
  Serial.printf("edges read as LOW (~ homework FALLING counter): %u for %u presses\n", fallTotal, presses);
  Serial.printf("debounce >= %u ms (worst bounce %u us x 1.5)\n\n", debounceMs, worst);
  printHeader();
}

void setup() {
  Serial.begin(115200);
  pinMode(BUTTON, INPUT_PULLUP);
  pinMode(ISR_MARKER, OUTPUT);
  stableLevel = digitalRead(BUTTON);
  attachInterrupt(digitalPinToInterrupt(BUTTON), onEdge, CHANGE);
  Serial.println("=== ESP32-S3: button bounce lab (module 1.5) ===");
  Serial.println("Button GPIO16, interrupt CHANGE, ISR marker GPIO17, event ends after 50 ms of quiet");
  printHeader();
}

void loop() {
  if (edgeCount == 0 || micros() - lastEdgeUs < QUIET_US) return;  // подія ще триває

  // забрати дані: на мить вимкнути переривання
  uint32_t t[MAX_EDGES];
  uint8_t lv[MAX_EDGES];
  noInterrupts();
  uint32_t count = edgeCount;
  uint32_t n = min(count, (uint32_t)MAX_EDGES);
  for (uint32_t i = 0; i < n; i++) { t[i] = edgeUs[i]; lv[i] = edgeLevel[i]; }
  edgeCount = 0;
  interrupts();

  // став LOW — натиснули, став HIGH — відпустили, не змінився — завада (glitch)
  int level = digitalRead(BUTTON);
  bool press = level == LOW && stableLevel == HIGH;
  bool release = level == HIGH && stableLevel == LOW;
  stableLevel = level;

  uint32_t bounce = t[n - 1] - t[0];
  uint32_t minGap = UINT32_MAX, fall = 0;
  for (uint32_t i = 0; i < n; i++) {
    if (lv[i] == LOW) fall++;
    if (i > 0) minGap = min(minGap, t[i] - t[i - 1]);
  }
  fallTotal += fall;
  if (press) { presses++; pressMaxUs = max(pressMaxUs, bounce); }
  if (release) { releases++; releaseMaxUs = max(releaseMaxUs, bounce); }

  Serial.printf("%3u  %-7s  %5u  %4u  %4u  %9u  ", press ? presses : release ? releases : 0,
                press ? "PRESS" : release ? "release" : "glitch", count, fall, n - fall, bounce);
  if (n > 1) Serial.printf("%10u  ", minGap); else Serial.printf("%10s  ", "-");
  for (uint32_t i = 0; i < n && i < SHOW_EDGES; i++) Serial.printf("%c%u ", lv[i] ? '^' : 'v', t[i] - t[0]);
  if (count > SHOW_EDGES) Serial.printf("... +%u", count - SHOW_EDGES);
  Serial.println();

  if (release && releases % 10 == 0) printSummary();  // підсумок на кожні 10 натискань
}

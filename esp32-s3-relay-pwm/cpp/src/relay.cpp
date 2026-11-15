#include <Arduino.h>

// Модуль 2.2, ДЗ 1: час спрацювання (увімкнення) і відпускання (вимкнення) реле.
// Команда: GPIO2 → 10 кОм → BC547B → IN модуля реле; HIGH = реле ON (як у «Сутінковому перемикачі»).
// Контакт: COM → GND, NO → GPIO5 з INPUT_PULLUP: розімкнений = HIGH, замкнений = LOW.
#define RELAY    2
#define CONTACT  5
#define CYCLES   10    // циклів «увімкнути — вимкнути»
#define WAIT_MS  50    // після команди: реле перемкнеться (≤ 10 мс за даташитом) і брязкіт стихне
#define PAUSE_MS 1000  // між перемиканнями: SRD-05 — до 30 перемикань на хвилину

// ISR пише, loop() читає — тому volatile
volatile unsigned long firstEdge = 0;  // micros() першого фронту — момент спрацювання
volatile unsigned long lastEdge = 0;   // micros() останнього фронту — кінець брязкоту
volatile unsigned long edges = 0;      // скільки фронтів побачило переривання

// Брязкіт дає кілька фронтів на одне перемикання. Час беремо лише з першого,
// наступні тільки зсувають lastEdge — так видно, скільки тривав брязкіт.
void IRAM_ATTR onContact() {
  unsigned long t = micros();
  if (edges == 0) firstEdge = t;
  lastEdge = t;
  edges++;
}

int cycle = 0;
unsigned long onUs[CYCLES], offUs[CYCLES];  // результати, мкс; 0 — фронту не було

// Перемикає реле, друкує рядок і повертає час від команди до першого фронту контакту, мкс
unsigned long measure(bool on) {
  edges = 0;  // контакт після паузи стоїть, ISR зараз не спрацює
  unsigned long t0 = micros();
  digitalWrite(RELAY, on ? HIGH : LOW);
  delay(WAIT_MS);  // тим часом ISR ловить фронти

  Serial.printf("#%-2d %s ", cycle + 1, on ? "увімк" : "вимк ");
  if (edges == 0) {
    Serial.println("фронту немає: COM → GND? NO → GPIO5? реле клацає?");
    return 0;
  }
  Serial.printf("%5lu мкс  брязкіт %4lu мкс  фронтів %lu\n",
                firstEdge - t0, lastEdge - firstEdge, edges);
  return firstEdge - t0;
}

void summary(const char* name, const unsigned long* us) {
  unsigned long sum = 0, n = 0, lo = ULONG_MAX, hi = 0;
  for (int i = 0; i < CYCLES; i++) {
    if (us[i] == 0) continue;  // вимірювання без фронту не рахуємо
    sum += us[i];
    n++;
    lo = min(lo, us[i]);
    hi = max(hi, us[i]);
  }
  if (n == 0) Serial.printf("%s: жодного вимірювання\n", name);
  else Serial.printf("%s: середнє %lu мкс, мін %lu, макс %lu (%lu з %d)\n", name, sum / n, lo, hi, n, CYCLES);
}

void setup() {
  Serial.begin(115200);
  pinMode(RELAY, OUTPUT);
  digitalWrite(RELAY, LOW);  // реле вимкнене
  pinMode(CONTACT, INPUT_PULLUP);
  attachInterrupt(digitalPinToInterrupt(CONTACT), onContact, CHANGE);  // брязкіт — фронти в обидва боки
  delay(2000);  // монітор порту встигає під'єднатися після прошивки
  Serial.println("Реле: час від команди (GPIO2) до першого фронту контакту NO (GPIO5), 10 циклів");
}

void loop() {
  if (cycle == CYCLES) return;  // серію виміряно; нова серія — кнопка RST

  onUs[cycle] = measure(true);
  delay(PAUSE_MS);
  offUs[cycle] = measure(false);
  delay(PAUSE_MS);

  if (++cycle == CYCLES) {
    summary("Увімкнення", onUs);
    summary("Вимкнення", offUs);
  }
}

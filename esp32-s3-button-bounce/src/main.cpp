// Модуль 1.5 — лабораторія брязкоту: що бачить ESP32-S3 через переривання (pio run -e bounce-lab).
//
//   GPIO16 ── кнопка ── GND      (INPUT_PULLUP: відпущена = HIGH, натиснута = LOW)
//   GPIO16 ── канал D0 логічного аналізатора
//   GPIO17 ── канал D1: «маркер ISR» — HIGH, поки виконується обробник переривання
//
// Код з умови рахує лише фронти FALLING. Тут переривання CHANGE: обробник записує КОЖЕН фронт
// із часом у мікросекундах у кільцевий буфер, а loop() групує фронти в «події».
// Подія — це натискання або відпускання разом з усім брязкотом. Вона закінчується, коли
// 50 мс немає нових фронтів. Для кожної події друкується рядок, який можна прямо порівняти
// з логічним аналізатором (той самий звіт будує tools/vcd_bounce.py із запису VCD).
//
// Команди в Serial Monitor: s — підсумок, r — скинути, h — довідка. Пояснення — у README.md.

#include <Arduino.h>
#include <soc/gpio_reg.h>

namespace {

// --- Виводи --------------------------------------------------------------
constexpr uint8_t kButtonPin    = 16;  // як в умові завдання
constexpr uint8_t kIsrMarkerPin = 17;  // сусідній пін: зручно взяти другим каналом аналізатора
static_assert(kButtonPin < 32 && kIsrMarkerPin < 32, "GPIO_IN_REG / GPIO_OUT_W1TS_REG cover GPIO0..31");

// --- Групування фронтів -----------------------------------------------------
// Скільки тиші вважати «кінцем брязкоту». Більше, ніж найдовший брязкіт (Ganssle: до ~6 мс у
// більшості кнопок), і менше, ніж найкоротше натискання людини (~50…100 мс).
constexpr uint32_t kQuietUs     = 50000;
constexpr uint8_t  kShowEdges   = 12;   // скільки перших фронтів розписати в рядку події
constexpr uint8_t  kSummaryEvery = 10;  // підсумок після кожних 10 натискань-відпускань (як у завданні)

constexpr uint32_t kSerialBaud   = 115200;
constexpr uint32_t kSerialWaitMs = 2000;

// --- Кільцевий буфер фронтів (ISR пише, loop читає) ------------------------
struct Edge {
  uint32_t tUs;    // момент переривання, мкс від старту (esp_timer)
  uint8_t  level;  // рівень на піні, прочитаний у самому обробнику: 0 = LOW, 1 = HIGH
};

constexpr uint32_t kRingSize = 512;  // степінь двійки: індекс = лічильник & (kRingSize - 1)
static_assert((kRingSize & (kRingSize - 1)) == 0, "kRingSize must be a power of two");

Edge              gRing[kRingSize];
volatile uint32_t gHead    = 0;  // скільки фронтів записав ISR (лише зростає)
volatile uint32_t gDropped = 0;  // скільки не влізло в буфер
volatile uint32_t gTail    = 0;  // скільки фронтів уже прочитав loop()

// Обробник переривання. Він має бути коротким і лежати в IRAM (IRAM_ATTR): переривання може
// прийти, коли кеш флеш-пам'яті вимкнений. Тому тут немає Serial, digitalRead() і digitalWrite():
// лише прямий доступ до регістрів GPIO, а це кілька тактів.
void IRAM_ATTR onButtonEdge() {
  REG_WRITE(GPIO_OUT_W1TS_REG, 1UL << kIsrMarkerPin);  // маркер ISR: HIGH

  const uint32_t t     = static_cast<uint32_t>(esp_timer_get_time());
  const uint8_t  level = (REG_READ(GPIO_IN_REG) >> kButtonPin) & 1U;

  const uint32_t head = gHead;
  if (head - gTail < kRingSize) {
    gRing[head & (kRingSize - 1)] = {t, level};
    gHead = head + 1;  // публікуємо запис лише після того, як він повністю заповнений
  } else {
    gDropped = gDropped + 1;
  }

  REG_WRITE(GPIO_OUT_W1TC_REG, 1UL << kIsrMarkerPin);  // маркер ISR: LOW
}

// --- Подія: натискання або відпускання разом із брязкотом ------------------------
struct Event {
  uint32_t firstUs   = 0;
  uint32_t lastUs    = 0;
  uint32_t edges     = 0;
  uint32_t falling   = 0;      // фронти, після яких ISR прочитав LOW
  uint32_t rising    = 0;      // фронти, після яких ISR прочитав HIGH
  uint32_t minGapUs  = UINT32_MAX;  // найкоротший проміжок між сусідніми фронтами
  uint8_t  lastLevel = 1;
  uint32_t shownUs[kShowEdges];
  uint8_t  shownLevel[kShowEdges];
};

struct Stats {
  uint32_t presses = 0, releases = 0;
  uint32_t pressEdges = 0, releaseEdges = 0;
  uint32_t pressBounceSumUs = 0, releaseBounceSumUs = 0;
  uint32_t pressBounceMaxUs = 0, releaseBounceMaxUs = 0;
  uint32_t fallingTotal = 0;  // фронти з рівнем LOW — приблизно стільки нарахував би код з умови
  uint32_t minGapUs = UINT32_MAX;
};

bool     gInEvent = false;
Event    gEvent;
Stats    gStats;
uint8_t  gStableLevel = 1;  // рівень після останньої завершеної події (старт: відпущена)
uint32_t gRowsPrinted = 0;

void printHeader() {
  Serial.println();
  Serial.println("  #  event    edges  fall  rise  bounce,us  min gap,us  edges, us from the first (v = LOW, ^ = HIGH)");
  Serial.println("---  -------  -----  ----  ----  ---------  ----------  ----------------------------------------------");
}

void startEvent(const Edge& e) {
  gEvent   = Event{};
  gEvent.firstUs = e.tUs;
  gInEvent = true;
}

void addEdge(const Edge& e) {
  if (!gInEvent) startEvent(e);
  if (gEvent.edges > 0) {
    const uint32_t gap = e.tUs - gEvent.lastUs;
    if (gap < gEvent.minGapUs) gEvent.minGapUs = gap;
  }
  if (gEvent.edges < kShowEdges) {
    gEvent.shownUs[gEvent.edges]    = e.tUs - gEvent.firstUs;
    gEvent.shownLevel[gEvent.edges] = e.level;
  }
  ++gEvent.edges;
  (e.level ? gEvent.rising : gEvent.falling)++;
  gEvent.lastUs    = e.tUs;
  gEvent.lastLevel = e.level;
}

void printSummary() {
  const Stats& s = gStats;
  Serial.println();
  Serial.printf("=== summary: %lu presses, %lu releases ===\n",
                static_cast<unsigned long>(s.presses), static_cast<unsigned long>(s.releases));
  if (s.presses) {
    Serial.printf("press:   edges avg %.1f, bounce avg %lu us, max %lu us\n",
                  static_cast<float>(s.pressEdges) / s.presses,
                  static_cast<unsigned long>(s.pressBounceSumUs / s.presses),
                  static_cast<unsigned long>(s.pressBounceMaxUs));
  }
  if (s.releases) {
    Serial.printf("release: edges avg %.1f, bounce avg %lu us, max %lu us\n",
                  static_cast<float>(s.releaseEdges) / s.releases,
                  static_cast<unsigned long>(s.releaseBounceSumUs / s.releases),
                  static_cast<unsigned long>(s.releaseBounceMaxUs));
  }
  // Код з умови (FALLING) додає 1 на кожен фронт униз, який встиг помітити, — і на натисканні,
  // і в брязкоті відпускання. Тут це наближення: фронти, після яких ISR прочитав LOW.
  Serial.printf("edges read as LOW (~ homework FALLING counter): %lu for %lu presses\n",
                static_cast<unsigned long>(s.fallingTotal), static_cast<unsigned long>(s.presses));
  if (s.minGapUs != UINT32_MAX) {
    Serial.printf("shortest gap between edges: %lu us\n", static_cast<unsigned long>(s.minGapUs));
  }
  const uint32_t worstUs = max(s.pressBounceMaxUs, s.releaseBounceMaxUs);
  // Запас ×1.5 і округлення вгору до цілої мілісекунди.
  const uint32_t debounceMs = (worstUs * 3 / 2 + 999) / 1000;
  Serial.printf("debounce >= %lu ms (worst bounce %lu us x 1.5)\n",
                static_cast<unsigned long>(debounceMs ? debounceMs : 1), static_cast<unsigned long>(worstUs));
  if (gDropped) Serial.printf("WARNING: %lu edges dropped (ring buffer full)\n", static_cast<unsigned long>(gDropped));
  Serial.println();
  gRowsPrinted = 0;  // після підсумку — знову шапка
}

void finishEvent() {
  gInEvent = false;
  // Тип події — за рівнем, на якому все заспокоїлось. Якщо рівень не змінився (наприклад, лише
  // голка-завада), це «glitch»: фронти були, а стан кнопки — той самий.
  const bool  press   = gEvent.lastLevel == 0 && gStableLevel == 1;
  const bool  release = gEvent.lastLevel == 1 && gStableLevel == 0;
  const char* name    = press ? "PRESS" : release ? "release" : "glitch";
  const uint32_t bounceUs = gEvent.lastUs - gEvent.firstUs;
  gStableLevel = gEvent.lastLevel;

  if (press) {
    ++gStats.presses;
    gStats.pressEdges += gEvent.edges;
    gStats.pressBounceSumUs += bounceUs;
    if (bounceUs > gStats.pressBounceMaxUs) gStats.pressBounceMaxUs = bounceUs;
  } else if (release) {
    ++gStats.releases;
    gStats.releaseEdges += gEvent.edges;
    gStats.releaseBounceSumUs += bounceUs;
    if (bounceUs > gStats.releaseBounceMaxUs) gStats.releaseBounceMaxUs = bounceUs;
  }
  gStats.fallingTotal += gEvent.falling;
  if (gEvent.minGapUs < gStats.minGapUs) gStats.minGapUs = gEvent.minGapUs;

  if (gRowsPrinted % 20 == 0) printHeader();
  ++gRowsPrinted;

  char gap[12];
  if (gEvent.edges > 1) {
    snprintf(gap, sizeof gap, "%10lu", static_cast<unsigned long>(gEvent.minGapUs));
  } else {
    snprintf(gap, sizeof gap, "%10s", "-");
  }
  Serial.printf("%3lu  %-7s  %5lu  %4lu  %4lu  %9lu  %s  ",
                static_cast<unsigned long>(press ? gStats.presses : release ? gStats.releases : 0), name,
                static_cast<unsigned long>(gEvent.edges), static_cast<unsigned long>(gEvent.falling),
                static_cast<unsigned long>(gEvent.rising), static_cast<unsigned long>(bounceUs), gap);
  const uint8_t shown = gEvent.edges < kShowEdges ? gEvent.edges : kShowEdges;
  for (uint8_t i = 0; i < shown; ++i) {
    Serial.printf("%c%lu ", gEvent.shownLevel[i] ? '^' : 'v', static_cast<unsigned long>(gEvent.shownUs[i]));
  }
  if (gEvent.edges > kShowEdges) Serial.printf("... +%lu", static_cast<unsigned long>(gEvent.edges - kShowEdges));
  Serial.println();

  if (release && gStats.releases % kSummaryEvery == 0) {
    printSummary();  // з loop(), коли подія вже завершена, тож жоден фронт не губиться
  }
}

void resetStats() {
  noInterrupts();
  gTail    = gHead;
  gDropped = 0;
  interrupts();
  gStats       = Stats{};
  gInEvent     = false;
  gStableLevel = (REG_READ(GPIO_IN_REG) >> kButtonPin) & 1U;
  gRowsPrinted = 0;
  Serial.println("--- reset ---");
}

void printHelp() {
  Serial.println();
  Serial.println("=== ESP32-S3: button bounce lab (module 1.5) ===");
  Serial.printf("Button: GPIO%u -> GND, INPUT_PULLUP, interrupt CHANGE\n", kButtonPin);
  Serial.printf("ISR marker: GPIO%u is HIGH while the ISR runs (logic analyzer channel 2)\n", kIsrMarkerPin);
  Serial.printf("An event ends after %lu ms without edges. Keys: s = summary, r = reset, h = help\n",
                static_cast<unsigned long>(kQuietUs / 1000));
}

void handleSerial() {
  while (Serial.available()) {
    switch (Serial.read()) {
      case 's': printSummary(); break;
      case 'r': resetStats(); break;
      case 'h': printHelp(); break;
      default: break;
    }
  }
}

void waitForSerial(uint32_t timeoutMs) {
  const uint32_t start = millis();
  while (!Serial && millis() - start < timeoutMs) {
  }
}

}  // namespace

void setup() {
  Serial.begin(kSerialBaud);
  waitForSerial(kSerialWaitMs);

  pinMode(kButtonPin, INPUT_PULLUP);
  pinMode(kIsrMarkerPin, OUTPUT);
  digitalWrite(kIsrMarkerPin, LOW);
  gStableLevel = digitalRead(kButtonPin);

  printHelp();
  attachInterrupt(digitalPinToInterrupt(kButtonPin), onButtonEdge, CHANGE);
}

void loop() {
  // Забрати всі нові фронти з буфера. gHead читаємо один раз: ISR може дописувати далі,
  // ці фронти заберемо на наступному проході.
  const uint32_t head = gHead;
  while (gTail != head) {
    addEdge(gRing[gTail & (kRingSize - 1)]);
    ++gTail;
  }

  // Подія закінчилась, якщо kQuietUs немає нових фронтів.
  if (gInEvent && static_cast<uint32_t>(esp_timer_get_time()) - gEvent.lastUs >= kQuietUs) {
    finishEvent();
  }

  handleSerial();
}

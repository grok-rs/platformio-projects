// Урок 2.1 · міні-лаба «Фрагментація купи». Arduino-ESP32 2.0.17 (espressif32@^7.1.0).
#include <Arduino.h>
#include <esp_heap_caps.h>

constexpr size_t   kBlockSize = 2000;          // блок, яким займаємо купу
constexpr size_t   kMaxBlocks = 200;
constexpr uint32_t kReserve   = 40 * 1024;     // лишаємо запас для USB, Serial і ядра
constexpr size_t   kBig       = 64 * 1024;     // набагато менше за free після кроку 3
// Лише внутрішня RAM: звичайний malloc() на платі з PSRAM запити > 4096 Б
// віддав би в PSRAM, і фрагментацію внутрішньої купи ми б не побачили.
constexpr uint32_t kCaps      = MALLOC_CAP_INTERNAL | MALLOC_CAP_8BIT;

void*  blocks[kMaxBlocks];                     // .bss: 200 вказівників по 4 Б
size_t count = 0;

void report(const char* step) {
  Serial.printf("%-16s free=%6u max=%6u\n", step,
                (unsigned)ESP.getFreeHeap(), (unsigned)ESP.getMaxAllocHeap());
}

void tryBig() {
  void* p = heap_caps_malloc(kBig, kCaps);
  Serial.printf("  malloc(%u) -> %s\n", (unsigned)kBig, p ? "OK" : "NULL");
  heap_caps_free(p);                           // free(nullptr) безпечний
}

void setup() {
  Serial.begin(115200);
  delay(3000);                                 // час відкрити монітор; у setup() це нормально
  report("1 start");

  while (count < kMaxBlocks && ESP.getFreeHeap() > kReserve) {
    void* p = heap_caps_malloc(kBlockSize, kCaps);
    if (p == nullptr) break;
    blocks[count++] = p;
  }
  Serial.printf("blocks: %u\n", (unsigned)count);
  report("2 filled");

  for (size_t i = 0; i < count; i += 2) { heap_caps_free(blocks[i]); blocks[i] = nullptr; }
  report("3 half freed");
  tryBig();                                    // вільно багато, але суцільного шматка немає

  for (size_t i = 1; i < count; i += 2) { heap_caps_free(blocks[i]); blocks[i] = nullptr; }
  report("4 all freed");
  tryBig();                                    // ті самі байти, але тепер одним шматком
}

void loop() {}

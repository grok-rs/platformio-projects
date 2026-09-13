#pragma once

#include <cstdint>

// Усі апаратні та часові константи проєкту — в одному місці.
namespace config {

// --- Виводи ESP32-S3-DevKitC-1 ------------------------------------------
// GPIO4…7 обрано свідомо: не strapping-піни (0, 3, 45, 46), не USB (19, 20),
// не зайняті флеш/PSRAM (26…37). На гребінці стоять поруч, одразу під RST.
constexpr uint8_t kRedPin    = 4;
constexpr uint8_t kBluePin   = 5;
constexpr uint8_t kGreenPin  = 6;   // третій світлодіод (необов'язковий)
constexpr uint8_t kSharedPin = 7;   // режим одного GPIO: обидва світлодіоди тут
constexpr uint8_t kButtonPin = 0;   // кнопка BOOT на платі, активний рівень LOW

// --- Кнопка --------------------------------------------------------------
constexpr uint32_t kDebounceMs  = 30;    // ігнорувати «дребезг» контактів
constexpr uint32_t kLongPressMs = 600;   // довше — «довге» натискання

// --- Serial --------------------------------------------------------------
constexpr uint32_t kSerialBaud   = 115200;
constexpr uint32_t kSerialWaitMs = 2000;   // чекати USB CDC, щоб не втратити банер

// --- Самотест після старту ----------------------------------------------
constexpr uint32_t kSelfTestStepMs = 400;

// --- Режим одного GPIO ---------------------------------------------------
// Період перемикання HIGH/LOW, коли кадр вимагає обидва світлодіоди разом.
constexpr uint32_t kMultiplexPeriodUs = 1000;   // 1 мс -> ~500 Гц на кожен LED

}  // namespace config

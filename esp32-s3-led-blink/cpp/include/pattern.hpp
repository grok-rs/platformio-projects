#pragma once

#include <cstdint>

#include "frame.hpp"
#include "span.hpp"

// Патерн миготіння — іменована послідовність кадрів, що програється по колу.
struct Pattern {
  const char*       name;
  Span<const Frame> frames;
};

// Таблиці, з яких працює програвач (визначені у patterns.cpp).
namespace patterns {

Span<const Pattern>  all();          // усі патерни; перший — базова вимога «по черзі»
Span<const uint16_t> speedsMs();     // пресети тривалості кадру, мс
constexpr size_t     kInitialSpeedIndex = 1;

}  // namespace patterns

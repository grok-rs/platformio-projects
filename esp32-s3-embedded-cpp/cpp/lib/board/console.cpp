#include "console.h"

#include <cstdarg>
#include <cstdio>

namespace {

constexpr size_t kMaxLineLength = 64;  // найдовший рядок, разом із '\n'

}  // namespace

bool tryPrintf(const char* format, ...) {
  char line[kMaxLineLength + 1];  // + '\0' від vsnprintf
  va_list args;
  va_start(args, format);
  const int length = vsnprintf(line, sizeof(line), format, args);
  va_end(args);

  // Довший рядок vsnprintf обрізав би — краще не друкувати пів рядка без '\n'.
  if (length < 0 || static_cast<size_t>(length) > kMaxLineLength) return false;
  const auto size = static_cast<size_t>(length);
  if (Serial.availableForWrite() < length) return false;
  return Serial.write(reinterpret_cast<const uint8_t*>(line), size) == size;
}

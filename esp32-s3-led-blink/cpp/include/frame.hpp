#pragma once

#include <cstdint>

// Один світлодіод. Значення — окремий біт у масці кадру.
enum class Led : uint8_t {
  Red   = 1u << 0,
  Green = 1u << 1,
  Blue  = 1u << 2,
};

// Кадр: набір світлодіодів, які мають світити одночасно.
// Типобезпечна обгортка над бітмаскою — замість «голого» uint8_t.
class Frame {
 public:
  constexpr Frame() = default;
  constexpr explicit Frame(Led led) : bits_(static_cast<uint8_t>(led)) {}

  static constexpr Frame off() { return Frame{}; }

  constexpr bool has(Led led) const { return (bits_ & static_cast<uint8_t>(led)) != 0; }
  constexpr bool isOff() const { return bits_ == 0; }

  constexpr Frame operator|(Frame other) const { return Frame{static_cast<uint8_t>(bits_ | other.bits_)}; }
  constexpr bool  operator==(Frame other) const { return bits_ == other.bits_; }
  constexpr bool  operator!=(Frame other) const { return bits_ != other.bits_; }

 private:
  constexpr explicit Frame(uint8_t bits) : bits_(bits) {}
  uint8_t bits_ = 0;
};

constexpr Frame operator|(Led a, Led b) { return Frame{a} | Frame{b}; }

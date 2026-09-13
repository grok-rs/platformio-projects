#include "pattern.hpp"

namespace {

constexpr Frame R   = Frame{Led::Red};
constexpr Frame G   = Frame{Led::Green};
constexpr Frame B   = Frame{Led::Blue};
constexpr Frame OFF = Frame::off();

// Кожен кадр показується один «тік» (тривалість задає швидкість),
// після останнього кадру програвач повертається до першого.
constexpr Frame kAlternate[]    = { R, B };                            // ОБОВ'ЯЗКОВА ВИМОГА: по черзі
constexpr Frame kAlternateGap[] = { R, OFF, B, OFF };                  // з темною паузою
constexpr Frame kPolice[]       = { R, OFF, R, OFF, B, OFF, B, OFF };  // подвійний спалах
constexpr Frame kThreeLeds[]    = { R, G, B };                         // третій світлодіод
constexpr Frame kChase[]        = { R, G, B, G };                      // «бігучий вогонь»
constexpr Frame kMix[]          = { R, R | B, B, R | B };              // два кольори разом

constexpr Pattern kPatterns[] = {
  { "alternate",     kAlternate    },
  { "alternate_gap", kAlternateGap },
  { "police",        kPolice       },
  { "three_leds",    kThreeLeds    },
  { "chase",         kChase        },
  { "mix",           kMix          },
};

constexpr uint16_t kSpeedsMs[] = { 1000, 500, 250, 120 };

static_assert(patterns::kInitialSpeedIndex < sizeof(kSpeedsMs) / sizeof(kSpeedsMs[0]),
              "initial speed index is out of range");

}  // namespace

namespace patterns {

Span<const Pattern>  all()      { return kPatterns; }
Span<const uint16_t> speedsMs() { return kSpeedsMs; }

}  // namespace patterns

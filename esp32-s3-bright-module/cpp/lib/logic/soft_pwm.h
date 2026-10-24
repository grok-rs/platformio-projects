// Програмний ШІМ (рівень «+»): рівень виводу як функція часу, без таймера й переривань.
//
// Період ділиться на «увімкнено» і «вимкнено» пропорційно заповненню 0…255. Час — у тиках
// будь-якого годинника; прошивка softpwm подає millis(), тож тик = 1 мс. Звідси головне
// обмеження порівняно з LEDC: за період 10 мс є лише 11 різних заповнень (0, 1, …, 10 мс
// увімкнено), а частота — 100 Гц замість 5 кГц.

#pragma once

#include <cstdint>

class SoftPwm {
 public:
  explicit constexpr SoftPwm(uint32_t periodTicks) : periodTicks_(periodTicks) {}

  constexpr uint32_t periodTicks() const { return periodTicks_; }

  // Скільки тиків із періоду вихід увімкнений: округлення вниз, 255 — увесь період.
  constexpr uint32_t onTicks(uint8_t duty) const { return duty * periodTicks_ / 255U; }

  // Рівень виводу в момент nowTicks (true = HIGH). Ніколи не чекає. Фаза — остача від ділення
  // на період: на переповненні millis() (раз на ~49.7 доби) один період вийде коротшим.
  [[nodiscard]] constexpr bool level(uint32_t nowTicks, uint8_t duty) const {
    return nowTicks % periodTicks_ < onTicks(duty);
  }

 private:
  uint32_t periodTicks_;
};

static_assert(SoftPwm(10).onTicks(255) == 10 && SoftPwm(10).onTicks(0) == 0);

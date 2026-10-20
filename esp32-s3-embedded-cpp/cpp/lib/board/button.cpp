#include "button.h"

void Button::init() {
  pinMode(pin_, INPUT_PULLUP);  // внутрішній резистор ~45 кОм до 3.3 В
  // attachInterruptArg передає в ISR `this`: прапорець — член об'єкта, а не глобальна змінна.
  attachInterruptArg(digitalPinToInterrupt(pin_), onFallingEdge, this, FALLING);
}

bool Button::takeEdge() {
  // Прочитати й скинути — два окремі доступи. Якщо ISR спрацює між ними, його фронт
  // загубиться: volatile не робить пару операцій атомарною. Тому — коротка критична секція.
  // Переривання GPIO зареєстроване на ядрі, де викликали init() (ядро 1, те саме, що loop()),
  // тож вимкнути переривання на цьому ядрі достатньо.
  noInterrupts();
  const bool edge = edge_;
  edge_           = false;
  interrupts();
  return edge;
}

// IRAM_ATTR: код ISR лежить у внутрішній RAM і працює, навіть коли кеш флешу вимкнений
// (наприклад, під час запису у флеш). Жодних Serial, delay(), millis() — один запис у пам'ять.
void IRAM_ATTR Button::onFallingEdge(void* self) {
  static_cast<Button*>(self)->edge_ = true;
}

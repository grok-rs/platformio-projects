#include "button.h"

void Button::init() {
  pinMode(pin_, INPUT_PULLUP);  // внутрішній резистор ~45 кОм до 3.3 В
  // attachInterruptArg передає в ISR `this`: прапорець — член об'єкта, а не глобальна змінна.
  attachInterruptArg(digitalPinToInterrupt(pin_), onFallingEdge, this, FALLING);
}

bool Button::takeEdge() {
  // Швидкий шлях: майже на кожному проході фронту не було — одне volatile-читання, і все.
  if (!edge_) return false;

  // Прочитати й скинути — два окремі доступи. Якщо ISR спрацює між ними, його фронт
  // загубиться: volatile не робить пару операцій атомарною. Тому — коротка критична секція.
  // portENTER_CRITICAL, а не noInterrupts(): вона зберігає й відновлює попередній рівень
  // переривань (вкладені секції безпечні) і бере спінлок проти другого ядра. ISR тут на тому
  // ж ядрі 1, що й loop() (там викликано init()), тож на ньому достатньо простого запису.
  portENTER_CRITICAL(&mux_);
  const bool edge = edge_;
  edge_           = false;
  portEXIT_CRITICAL(&mux_);
  return edge;
}

// IRAM_ATTR: код ISR лежить у внутрішній RAM — без промахів кешу флешу, тож затримка
// стабільна. Під час запису у флеш він працюватиме лише з CONFIG_ARDUINO_ISR_IRAM (переривання
// з ESP_INTR_FLAG_IRAM); у цій збірці ядра Arduino ця опція вимкнена і переривання тоді чекає.
// Жодних Serial, delay(), millis() — один запис у пам'ять.
void IRAM_ATTR Button::onFallingEdge(void* self) {
  static_cast<Button*>(self)->edge_ = true;
}

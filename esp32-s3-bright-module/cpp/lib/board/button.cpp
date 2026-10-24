#include "button.h"

void Button::init() {
  pinMode(pin_, INPUT_PULLDOWN);  // внутрішній резистор ~45 кОм до GND
  // attachInterruptArg передає в ISR `this`: прапорець — член об'єкта, а не глобальна змінна.
  attachInterruptArg(digitalPinToInterrupt(pin_), onRisingEdge, this, RISING);
}

bool Button::takeEdge() {
  // Швидкий шлях: майже на кожному проході фронту не було — одне volatile-читання, і все.
  if (!edge_) return false;

  // Прочитати й скинути — два окремі доступи. Якщо ISR спрацює між ними, його фронт
  // загубиться: volatile не робить пару операцій атомарною. Тому — коротка критична секція.
  // Секція маскує переривання на цьому ядрі — а ISR зареєстровано саме тут (init() викликано
  // з setup() на ядрі 1), тож між читанням і скиданням він не втрутиться. portENTER_CRITICAL, а не
  // noInterrupts(): вона зберігає й відновлює попередній рівень переривань (вкладені секції
  // безпечні). Спінлок mux_ ISR не бере — від другого ядра він тут нічого не захищає.
  portENTER_CRITICAL(&mux_);
  const bool edge = edge_;
  edge_           = false;
  portEXIT_CRITICAL(&mux_);
  return edge;
}

// IRAM_ATTR кладе наш обробник у внутрішню RAM. Але затримку це не стабілізує: у цій збірці ядра
// CONFIG_ARDUINO_ISR_IRAM вимкнено, тож диспетчер переривань ядра, що викликає обробник, сам
// працює з флешу. Атрибут — звичка, яка знадобиться з ISR, зареєстрованим у IRAM.
// Жодних Serial, delay(), millis() — один запис у пам'ять (ВП-4).
void IRAM_ATTR Button::onRisingEdge(void* self) {
  static_cast<Button*>(self)->edge_ = true;
}

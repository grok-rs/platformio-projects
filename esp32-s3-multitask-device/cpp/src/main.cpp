#include <Arduino.h>

// Фінальний проєкт «Мультизадачний пристрій»: LED живуть у своїх ритмах, кнопки керують ними
// миттєво — у жодному місці програма не стоїть і не чекає (лише millis(), без delay і while).
#define LED1 15  // червоний — індикатор паузи
#define LED2 16  // жовтий — швидкість від BTN1
#define LED3 17  // зелений — завжди 1000 мс
#define BTN1 21  // швидкість LED2: 3V3 → кнопка → GPIO21, INPUT_PULLDOWN
#define BTN2 18  // пауза:          3V3 → кнопка → GPIO18, INPUT_PULLDOWN

const uint32_t LED3_INTERVAL = 1000;
const uint32_t SPEEDS[] = {1000, 500, 200};  // період LED2 по колу
const uint32_t DEBOUNCE = 40;                 // мс стабільного рівня = справжнє натискання

// швидкість і пауза — у змінних стану, а не в затримках
uint8_t speed = 0;  // індекс у SPEEDS
bool paused = false;
uint32_t last2 = 0, last3 = 0;
bool s2 = false, s3 = false;

// кнопка: прийнятий рівень + останній «сирий» рівень і момент, коли він змінився
struct Button { uint8_t pin; bool stable, raw; uint32_t changedAt; };
Button btn1 = {BTN1, LOW, LOW, 0};
Button btn2 = {BTN2, LOW, LOW, 0};

// true рівно один раз на натискання: рівень змінився й протримався DEBOUNCE мс (неблокуючий дебаунс)
bool pressed(Button& b, uint32_t now) {
  bool level = digitalRead(b.pin);
  if (level != b.raw) { b.raw = level; b.changedAt = now; }  // брязкіт — відлік заново
  if (now - b.changedAt >= DEBOUNCE && b.raw != b.stable) {
    b.stable = b.raw;
    return b.stable == HIGH;  // фронт натискання; відпускання й утримання подій не дають
  }
  return false;
}

uint32_t loops = 0, lastReport = 0;

void setup() {
  Serial.begin(115200);
  pinMode(LED1, OUTPUT); pinMode(LED2, OUTPUT); pinMode(LED3, OUTPUT);
  pinMode(BTN1, INPUT_PULLDOWN); pinMode(BTN2, INPUT_PULLDOWN);
  // стартовий рівень — «прийнятий»: GPIO21 після старту ~50 мс тримає HIGH, і без цього
  // дебаунс зарахував би його як натискання
  btn1.stable = btn1.raw = digitalRead(BTN1);
  btn2.stable = btn2.raw = digitalRead(BTN2);
  Serial.println("Мультизадачний пристрій: BTN1 — швидкість LED2, BTN2 — пауза");
}

void loop() {
  uint32_t now = millis();  // один «знімок часу» на весь прохід
  loops++;

  // кнопки опитуємо щопроходу, навіть у паузі — інакше дебаунс «загубить» фронт
  bool b1 = pressed(btn1, now);
  bool b2 = pressed(btn2, now);

  if (b2) {
    paused = !paused;
    digitalWrite(LED1, paused);
    if (!paused) { last2 = now; last3 = now; }  // після паузи — повний інтервал, а не миттєве перемикання
    Serial.println(paused ? "ПАУЗА вкл" : "ПАУЗА викл");
  }
  if (b1 && !paused) {  // у паузі BTN1 нічого не змінює
    speed = (speed + 1) % 3;
    Serial.printf("BTN1 -> LED2 = %lu мс\n", (unsigned long)SPEEDS[speed]);
  }

  if (!paused) {  // у паузі LED2 і LED3 завмирають у поточному стані
    if (now - last2 >= SPEEDS[speed]) { last2 = now; s2 = !s2; digitalWrite(LED2, s2); }
    if (now - last3 >= LED3_INTERVAL) { last3 = now; s3 = !s3; digitalWrite(LED3, s3); }
  }

  if (now - lastReport >= 1000) {
    lastReport = now;
    Serial.printf("Loops/s: %lu\n", (unsigned long)loops);
    loops = 0;
  }
}

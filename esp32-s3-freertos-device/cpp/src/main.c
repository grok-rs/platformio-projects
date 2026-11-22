#include <stdbool.h>
#include <stdio.h>
#include "driver/gpio.h"
#include "esp_rom_sys.h"
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"

// Модуль 6, урок 6.1, ДЗ: фінальний проєкт 2.3 «Мультизадачний пристрій», але задачами FreeRTOS.
// Кожна справа — своя задача зі своїм циклом; ніхто не чекає на інших.
#define LED1 GPIO_NUM_15  // червоний: світиться в паузі
#define LED2 GPIO_NUM_16  // жовтий: період задає BTN1
#define LED3 GPIO_NUM_17  // зелений: завжди 1000 мс
#define BTN1 GPIO_NUM_21  // кнопка на GND, внутрішня підтяжка: натиснута = 0
#define BTN2 GPIO_NUM_18

static const uint32_t SPEEDS[] = {1000, 500, 200};  // період LED2 по колу, мс
static volatile uint8_t speed = 0;                   // пише buttons_task, читає led2_task
static volatile bool paused = false;                 // пише buttons_task, читають LED-задачі

// LED3: рівний період 1000 мс; xTaskDelayUntil тримає сітку
static void led3_task(void* arg) {
    bool on = false;
    TickType_t wake = xTaskGetTickCount();
    while (1) {
        xTaskDelayUntil(&wake, pdMS_TO_TICKS(1000));
        if (paused) continue;  // у паузі завмирає в поточному стані
        on = !on;
        gpio_set_level(LED3, on);
    }
}

// LED2: період міняється на ходу, тож рахуємо паузу від кожного перемикання
static void led2_task(void* arg) {
    bool on = false;
    while (1) {
        if (!paused) {
            on = !on;
            gpio_set_level(LED2, on);
        }
        vTaskDelay(pdMS_TO_TICKS(SPEEDS[speed]));
    }
}

// Кнопка: рівень, інший за прийнятий, 4 опитування поспіль (40 мс) — нове натискання
typedef struct {
    gpio_num_t pin;
    bool down;
    uint8_t same;
} button_t;

static bool pressed(button_t* b) {
    bool now = gpio_get_level(b->pin) == 0;
    if (now == b->down) {
        b->same = 0;
        return false;
    }
    if (++b->same < 4) return false;  // брязкіт або ще не встоялося
    b->down = now;
    b->same = 0;
    return now;  // подія лише на натискання, не на відпускання
}

// Обидві кнопки: опитування кожні 10 мс, вищий пріоритет за LED
static void buttons_task(void* arg) {
    button_t b1 = {BTN1, false, 0}, b2 = {BTN2, false, 0};
    TickType_t wake = xTaskGetTickCount();
    while (1) {
        xTaskDelayUntil(&wake, pdMS_TO_TICKS(10));
        bool p1 = pressed(&b1), p2 = pressed(&b2);  // опитуємо обидві завжди, навіть у паузі
        if (p2) {
            paused = !paused;
            gpio_set_level(LED1, paused);
            printf(paused ? "ПАУЗА вкл\n" : "ПАУЗА викл\n");
        }
        if (p1 && !paused) {
            speed = (speed + 1) % 3;
            printf("BTN1 -> LED2 = %lu мс\n", (unsigned long)SPEEDS[speed]);
        }
    }
}

// Дослід із ДЗ: «важка» задача раз на 300 мс 80 мс крутиться в активному очікуванні.
// Розкоментуйте її xTaskCreatePinnedToCore() в app_main і поміряйте LED3 і BTN1 з пріоритетом 1, потім 4.
static void heavy_task(void* arg) {
    while (1) {
        esp_rom_delay_us(80000);  // 80 мс не віддає процесор, як delayMicroseconds(80000) в Arduino
        vTaskDelay(pdMS_TO_TICKS(300));
    }
}

void app_main(void) {
    gpio_config_t leds = {.pin_bit_mask = (1ULL << LED1) | (1ULL << LED2) | (1ULL << LED3),
                          .mode = GPIO_MODE_OUTPUT};
    gpio_config(&leds);
    gpio_config_t btns = {.pin_bit_mask = (1ULL << BTN1) | (1ULL << BTN2),
                          .mode = GPIO_MODE_INPUT, .pull_up_en = GPIO_PULLUP_ENABLE};
    gpio_config(&btns);

    vTaskDelay(pdMS_TO_TICKS(2000));  // монітор порту встигає під'єднатися після прошивки
    printf("Мультизадачний пристрій на FreeRTOS: BTN1 — швидкість LED2, BTN2 — пауза\n");

    //                      функція       ім'я       стек, Б  параметр пріоритет хендл ядро
    xTaskCreatePinnedToCore(buttons_task, "buttons", 3072,    NULL,    3,        NULL, 1);
    xTaskCreatePinnedToCore(led2_task,    "led2",    2048,    NULL,    2,        NULL, 1);
    xTaskCreatePinnedToCore(led3_task,    "led3",    2048,    NULL,    2,        NULL, 1);
    // xTaskCreatePinnedToCore(heavy_task, "heavy",  2048,    NULL,    1,        NULL, 1);  // дослід: 1, потім 4
    (void)heavy_task;  // поки дослід вимкнено, щоб компілятор не скаржився на невикористану функцію
    // app_main повертається: задача main видаляє себе, а наші живуть далі
}

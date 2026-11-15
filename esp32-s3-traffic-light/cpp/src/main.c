#include <stdbool.h>
#include <stdio.h>
#include "driver/gpio.h"
#include "esp_timer.h"
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"

// Модуль 2, урок 28, міні-проєкт «Світлофор» за ПДР України. ESP-IDF.
// Цикл: зелений → зелений миготливий → жовтий → червоний → червоний + жовтий → зелений.
// Кнопка перемикає на жовтий миготливий (нерегульоване перехрестя) і назад.
// Машина станів у суперциклі: кожні 10 мс дивимося на час і кнопку, delay() для відліку немає.
#define RED    GPIO_NUM_15  // червоний LED через 220 Ом на GND
#define YELLOW GPIO_NUM_16  // жовтий
#define GREEN  GPIO_NUM_17  // зелений
#define BUTTON GPIO_NUM_21  // кнопка на GND, внутрішня підтяжка

#define GREEN_MS       10000  // зелений: рух дозволено
#define GREEN_BLINK_MS 3000   // зелений миготливий: 3 блимання
#define YELLOW_MS      3000   // жовтий
#define RED_MS         10000  // червоний
#define RED_YELLOW_MS  2000   // червоний + жовтий: скоро зелений
#define BLINK_MS       500    // миготіння 1 Гц: 0,5 с світить, 0,5 с ні

typedef enum { GREEN_ON, GREEN_BLINK, YELLOW_ON, RED_ON, RED_YELLOW, YELLOW_BLINK } state_t;
// Скільки триває кожен стан (0 — доки не натиснуть кнопку) і який іде за ним
static const int64_t DURATION[] = {GREEN_MS, GREEN_BLINK_MS, YELLOW_MS, RED_MS, RED_YELLOW_MS, 0};
static const state_t NEXT[] = {GREEN_BLINK, YELLOW_ON, RED_ON, RED_YELLOW, GREEN_ON, YELLOW_BLINK};
static const char* NAMES[] = {"зелений", "зелений миготливий", "жовтий", "червоний", "червоний + жовтий",
                              "жовтий миготливий (нерегульоване перехрестя)"};

static state_t state;
static int64_t since;  // коли почався поточний стан, мс

static int64_t now_ms(void) {
    return esp_timer_get_time() / 1000;
}

static void go(state_t next) {
    state = next;
    since = now_ms();
    printf("[%lld мс] %s\n", since, NAMES[state]);
}

static void lights(bool r, bool y, bool g) {
    gpio_set_level(RED, r);
    gpio_set_level(YELLOW, y);
    gpio_set_level(GREEN, g);
}

void app_main(void) {
    gpio_config_t leds = {.pin_bit_mask = (1ULL << RED) | (1ULL << YELLOW) | (1ULL << GREEN), .mode = GPIO_MODE_OUTPUT};
    gpio_config(&leds);
    gpio_config_t button = {.pin_bit_mask = 1ULL << BUTTON, .mode = GPIO_MODE_INPUT, .pull_up_en = GPIO_PULLUP_ENABLE};
    gpio_config(&button);

    vTaskDelay(pdMS_TO_TICKS(2000));  // монітор порту встигає під'єднатися після прошивки
    printf("Світлофор за ПДР України. Кнопка: жовтий миготливий ↔ звичайний режим\n");
    go(GREEN_ON);

    bool was_down = false;
    while (1) {
        // Кнопка: опитування кожні 10 мс, реагуємо на натискання. Брязкіт коротший за крок опитування (ДЗ 2.6)
        bool down = gpio_get_level(BUTTON) == 0;
        if (down && !was_down) go(state == YELLOW_BLINK ? RED_ON : YELLOW_BLINK);  // з миготливого — спершу всім стоп
        was_down = down;

        // Час поточного стану вийшов — переходимо до наступного, і вже потім вмикаємо LED (без проміжного кадру)
        int64_t t = now_ms() - since;  // скільки триває поточний стан
        if (DURATION[state] && t >= DURATION[state]) {
            go(NEXT[state]);
            t = 0;
        }

        bool blink = (t / BLINK_MS) % 2;  // 0, 1, 0, 1 … кожні 0,5 с
        switch (state) {
            case GREEN_ON:     lights(0, 0, 1); break;
            case GREEN_BLINK:  lights(0, 0, blink); break;   // одразу гасне, потім світить: 3 блимання за 3 с
            case YELLOW_ON:    lights(0, 1, 0); break;
            case RED_ON:       lights(1, 0, 0); break;
            case RED_YELLOW:   lights(1, 1, 0); break;
            case YELLOW_BLINK: lights(0, !blink, 0); break;  // миготить, доки знову не натиснуть кнопку
        }
        vTaskDelay(pdMS_TO_TICKS(10));
    }
}

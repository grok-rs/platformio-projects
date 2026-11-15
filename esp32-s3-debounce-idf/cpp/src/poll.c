#include <stdio.h>
#include "driver/gpio.h"
#include "esp_timer.h"
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"

// Завдання 4: без переривань. Кожні POLL_MS читаємо кнопку, debounce — машина станів
// IDLE → PRESSED → HELD → RELEASE → IDLE. Рівень мусить протриматися STABLE_US.
// Очікуємо: найстабільніша поведінка, реакція трохи більша (STABLE_US + період опитування).
#define BUTTON    GPIO_NUM_7   // кнопка на GND, підтяжка 10 кОм до 3V3
#define LED       GPIO_NUM_15  // LED через 220 Ом: перемикається на кожне прийняте натискання
#define POLL_MS   10
#define STABLE_US 50000
#define LONG_US   2000000      // довше — довге натискання

typedef enum { IDLE, PRESSED, HELD, RELEASE } state_t;

void app_main(void) {
    gpio_config_t button = {.pin_bit_mask = 1ULL << BUTTON, .mode = GPIO_MODE_INPUT};  // без intr_type
    gpio_config(&button);
    gpio_config_t led = {.pin_bit_mask = 1ULL << LED, .mode = GPIO_MODE_OUTPUT};
    gpio_config(&led);

    printf("Завдання 4: опитування кожні %d мс + машина станів\n", POLL_MS);
    state_t state = IDLE;
    int64_t since = 0, pressed_at = 0;
    uint32_t presses = 0, bounces = 0;
    TickType_t wake = xTaskGetTickCount();
    while (1) {
        vTaskDelayUntil(&wake, pdMS_TO_TICKS(POLL_MS));  // рівно кожні POLL_MS, скільки б не тривав код нижче
        bool down = gpio_get_level(BUTTON) == 0;
        int64_t now = esp_timer_get_time();

        switch (state) {
            case IDLE:
                if (down) { state = PRESSED; since = now; }
                break;
            case PRESSED:
                if (!down) { state = IDLE; bounces++; }  // відскочило: це ще брязкіт
                else if (now - since >= STABLE_US) {
                    state = HELD;
                    pressed_at = since;
                    presses++;
                    gpio_set_level(LED, presses & 1);
                    printf("натискань: %lu, відскоків: %lu, реакція: %ld мкс\n", presses, bounces, (long)(now - since));
                }
                break;
            case HELD:
                if (!down) { state = RELEASE; since = now; }
                break;
            case RELEASE:
                if (down) { state = HELD; bounces++; }  // брязкіт відпускання
                else if (now - since >= STABLE_US) {
                    state = IDLE;
                    printf("%s натискання\n", since - pressed_at < LONG_US ? "коротке" : "довге");
                }
                break;
        }
    }
}

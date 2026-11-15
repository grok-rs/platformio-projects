#include <stdio.h>
#include "driver/gpio.h"
#include "esp_attr.h"
#include "esp_timer.h"
#include "freertos/FreeRTOS.h"
#include "freertos/queue.h"
#include "freertos/task.h"

// Завдання 2: debounce за часом. ISR лише кладе час переривання в чергу, а рішення приймає задача:
// менше ніж DEBOUNCE_US від попереднього переривання — ігноруємо.
// Очікуємо: хибних менше, але брязкіт відпускання все ще може дати зайве натискання.
#define BUTTON      GPIO_NUM_7   // кнопка на GND, підтяжка 10 кОм до 3V3
#define LED         GPIO_NUM_15  // LED через 220 Ом: перемикається на кожне прийняте натискання
#define DEBOUNCE_US 50000
#define QUIET_MS    200          // друкуємо підсумок, коли стало тихо

static QueueHandle_t edges;

static void IRAM_ATTR on_fall(void* arg) {
    int64_t t = esp_timer_get_time();
    BaseType_t woken = pdFALSE;
    xQueueSendFromISR(edges, &t, &woken);
    if (woken) portYIELD_FROM_ISR();
}

void app_main(void) {
    edges = xQueueCreate(64, sizeof(int64_t));
    gpio_config_t button = {.pin_bit_mask = 1ULL << BUTTON, .mode = GPIO_MODE_INPUT, .intr_type = GPIO_INTR_NEGEDGE};
    gpio_config(&button);
    gpio_config_t led = {.pin_bit_mask = 1ULL << LED, .mode = GPIO_MODE_OUTPUT};
    gpio_config(&led);
    gpio_install_isr_service(0);
    gpio_isr_handler_add(BUTTON, on_fall, NULL);

    printf("Завдання 2: debounce за часом, %d мс\n", DEBOUNCE_US / 1000);
    int64_t last = -DEBOUNCE_US, reaction = 0;
    uint32_t accepted = 0, ignored = 0;
    bool fresh = false;
    while (1) {
        int64_t t;
        if (xQueueReceive(edges, &t, pdMS_TO_TICKS(QUIET_MS)) != pdTRUE) {
            if (fresh) printf("прийнято: %lu, відкинуто: %lu, реакція: %ld мкс\n", accepted, ignored, (long)reaction);
            fresh = false;
            continue;
        }
        fresh = true;
        bool ok = t - last >= DEBOUNCE_US;
        last = t;  // рахуємо від попереднього переривання, не від прийнятого
        if (!ok) {
            ignored++;
            continue;
        }
        accepted++;
        gpio_set_level(LED, accepted & 1);
        reaction = esp_timer_get_time() - t;
    }
}

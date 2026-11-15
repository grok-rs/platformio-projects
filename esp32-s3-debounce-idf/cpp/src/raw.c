#include <stdio.h>
#include "driver/gpio.h"
#include "esp_attr.h"
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"

// Завдання 1: переривання на FALLING лише рахує, debounce немає.
// Очікуємо: одне натискання дає кілька переривань, і при відпусканні вони теж бувають.
#define BUTTON GPIO_NUM_7   // кнопка на GND, підтяжка 10 кОм до 3V3
#define LED    GPIO_NUM_15  // LED через 220 Ом: перемикається на кожне переривання

static volatile uint32_t count = 0;  // пише ISR, читає app_main

static void IRAM_ATTR on_fall(void* arg) {
    count++;
}

void app_main(void) {
    gpio_config_t button = {.pin_bit_mask = 1ULL << BUTTON, .mode = GPIO_MODE_INPUT, .intr_type = GPIO_INTR_NEGEDGE};
    gpio_config(&button);
    gpio_config_t led = {.pin_bit_mask = 1ULL << LED, .mode = GPIO_MODE_OUTPUT};
    gpio_config(&led);
    gpio_install_isr_service(0);
    gpio_isr_handler_add(BUTTON, on_fall, NULL);

    printf("Завдання 1: лише переривання\n");
    uint32_t shown = 0;
    while (1) {
        if (count != shown) {
            shown = count;
            gpio_set_level(LED, shown & 1);
            printf("переривань: %lu\n", shown);
        }
        vTaskDelay(pdMS_TO_TICKS(10));
    }
}

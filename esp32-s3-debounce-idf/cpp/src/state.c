#include <stdio.h>
#include "driver/gpio.h"
#include "esp_attr.h"
#include "esp_timer.h"
#include "freertos/FreeRTOS.h"
#include "freertos/semphr.h"
#include "freertos/task.h"

// Завдання 3: debounce за рівнем. ISR лише сигналізує «подія», а задача чекає, поки брязкіт затихне,
// і приймає подію, тільки якщо кнопка досі натиснута. Відпускання нічого не робить.
// Очікуємо: рівно 1 реакція на 1 натискання.
#define BUTTON      GPIO_NUM_7   // кнопка на GND, підтяжка 10 кОм до 3V3
#define LED         GPIO_NUM_15  // LED через 220 Ом: перемикається на кожне прийняте натискання
#define DEBOUNCE_MS 50

static SemaphoreHandle_t event;
static volatile uint32_t edges = 0;  // скільки переривань було насправді

static void IRAM_ATTR on_fall(void* arg) {
    edges++;
    BaseType_t woken = pdFALSE;
    xSemaphoreGiveFromISR(event, &woken);
    if (woken) portYIELD_FROM_ISR();
}

void app_main(void) {
    event = xSemaphoreCreateBinary();
    gpio_config_t button = {.pin_bit_mask = 1ULL << BUTTON, .mode = GPIO_MODE_INPUT, .intr_type = GPIO_INTR_NEGEDGE};
    gpio_config(&button);
    gpio_config_t led = {.pin_bit_mask = 1ULL << LED, .mode = GPIO_MODE_OUTPUT};
    gpio_config(&led);
    gpio_install_isr_service(0);
    gpio_isr_handler_add(BUTTON, on_fall, NULL);

    printf("Завдання 3: debounce за рівнем, %d мс\n", DEBOUNCE_MS);
    uint32_t presses = 0, ignored = 0;
    while (1) {
        xSemaphoreTake(event, portMAX_DELAY);
        int64_t t0 = esp_timer_get_time();
        vTaskDelay(pdMS_TO_TICKS(DEBOUNCE_MS));  // чекає лише ця задача, не весь чип

        if (gpio_get_level(BUTTON) != 0) {  // уже HIGH: це був брязкіт відпускання або завада
            ignored++;
            continue;
        }

        presses++;
        gpio_set_level(LED, presses & 1);
        long reaction = esp_timer_get_time() - t0;
        printf("натискань: %lu, відкинуто подій: %lu, переривань: %lu, реакція: %ld мкс\n",
               presses, ignored, edges, reaction);

        while (gpio_get_level(BUTTON) == 0) vTaskDelay(pdMS_TO_TICKS(10));  // довге утримання — одна реакція
        vTaskDelay(pdMS_TO_TICKS(DEBOUNCE_MS));                             // брязкіт відпускання затихає
        xSemaphoreTake(event, 0);                                           // і його подію теж прибираємо
    }
}

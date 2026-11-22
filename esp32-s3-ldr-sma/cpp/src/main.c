#include <stdbool.h>
#include <stdio.h>
#include "driver/gpio.h"
#include "esp_adc/adc_oneshot.h"
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"

// Модуль 3, урок 3.1, ДЗ: LDR-подільник на GPIO4 (ADC1_CH3), LED на GPIO15 через 220 Ом.
// Oneshot кожні 20 мс → ковзне середнє (SMA) з 16 відліків → два пороги (гістерезис), щоб LED не мерехтів.
#define LDR_CH    ADC_CHANNEL_3  // GPIO4 = ADC1_CH3: номер каналу, не GPIO!
#define LED       GPIO_NUM_15
#define N         16             // вікно SMA: 16 × 20 мс = 320 мс
#define PERIOD_MS 20
#define DARK      1400           // середнє нижче — темно: LED вмикаємо
#define LIGHT     1700           // середнє вище — світло: LED вимикаємо

void app_main(void) {
    adc_oneshot_unit_handle_t adc;
    adc_oneshot_unit_init_cfg_t unit = {.unit_id = ADC_UNIT_1};
    ESP_ERROR_CHECK(adc_oneshot_new_unit(&unit, &adc));
    adc_oneshot_chan_cfg_t ch = {.atten = ADC_ATTEN_DB_12, .bitwidth = ADC_BITWIDTH_12};  // вхід до ≈3,1 В
    ESP_ERROR_CHECK(adc_oneshot_config_channel(adc, LDR_CH, &ch));

    gpio_config_t led = {.pin_bit_mask = 1ULL << LED, .mode = GPIO_MODE_OUTPUT};
    gpio_config(&led);

    vTaskDelay(pdMS_TO_TICKS(2000));  // монітор порту встигає під'єднатися після прошивки
    printf("ДЗ 3.1: LDR, SMA з %d відліків, пороги DARK %d / LIGHT %d\n", N, DARK, LIGHT);

    int buf[N] = {0};  // кільцевий буфер останніх N відліків
    int sum = 0;       // їхня сума: до 16 × 4095 = 65 520
    int i = 0, filled = 0;
    bool on = false;
    TickType_t wake = xTaskGetTickCount();
    while (1) {
        vTaskDelayUntil(&wake, pdMS_TO_TICKS(PERIOD_MS));  // рівно кожні 20 мс
        int raw;
        ESP_ERROR_CHECK(adc_oneshot_read(adc, LDR_CH, &raw));
        sum = sum - buf[i] + raw;  // найстаріше виходить, нове входить
        buf[i] = raw;
        i = (i + 1) % N;
        if (filled < N) {  // поки вікно не повне, не вирішуємо
            filled++;
            continue;
        }

        int sma = sum / N;
        if (!on && sma < DARK)  { on = true;  gpio_set_level(LED, 1); }
        if (on  && sma > LIGHT) { on = false; gpio_set_level(LED, 0); }
        if (i == 0) printf("raw: %4d  sma: %4d  led: %s\n", raw, sma, on ? "ON" : "OFF");  // раз на вікно, 320 мс
    }
}

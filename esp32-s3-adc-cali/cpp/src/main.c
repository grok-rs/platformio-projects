#include <stdio.h>
#include "esp_adc/adc_cali.h"
#include "esp_adc/adc_cali_scheme.h"
#include "esp_adc/adc_oneshot.h"
#include "esp_err.h"
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"

// Модуль 3, урок 3.2, ДЗ: потенціометр на GPIO4 (ADC1, канал 3). Кожні 100 мс друкуємо
// сире число, напругу за формулою, калібровану напругу і похибку формули.
#define POT_CH  ADC_CHANNEL_3    // GPIO4 = ADC1_CH3
#define ATTEN   ADC_ATTEN_DB_12  // вхід до ≈3,1 В; старе ім'я ADC_ATTEN_DB_11
#define V_FULL  3300.0f          // «повна шкала» для формули, мВ: перевірте й 3100

void app_main(void) {
    adc_oneshot_unit_handle_t adc;
    adc_oneshot_unit_init_cfg_t unit = {.unit_id = ADC_UNIT_1};
    ESP_ERROR_CHECK(adc_oneshot_new_unit(&unit, &adc));
    adc_oneshot_chan_cfg_t chan = {.atten = ATTEN, .bitwidth = ADC_BITWIDTH_12};
    ESP_ERROR_CHECK(adc_oneshot_config_channel(adc, POT_CH, &chan));

    // Калібрування з eFuse. Ослаблення має бути те саме, що в каналу.
    adc_cali_handle_t cali = NULL;
    adc_cali_curve_fitting_config_t cfg = {
        .unit_id = ADC_UNIT_1, .chan = POT_CH, .atten = ATTEN, .bitwidth = ADC_BITWIDTH_12};
    if (adc_cali_create_scheme_curve_fitting(&cfg, &cali) != ESP_OK) {
        printf("Калібрування недоступне: на чипі немає даних eFuse\n");
        cali = NULL;
    }

    vTaskDelay(pdMS_TO_TICKS(2000));  // монітор порту встигає під'єднатися після прошивки
    printf("ATTEN 12 дБ, 12 біт, curve fitting, V_FULL = %.0f мВ\n", V_FULL);
    printf(" RAW  U_manual(mV)  U_cali(mV)  Error(%%)\n");
    while (1) {
        int raw = 0, mv = 0;
        ESP_ERROR_CHECK(adc_oneshot_read(adc, POT_CH, &raw));
        float manual = raw * V_FULL / 4095.0f;  // формула: 4095 — найбільше число 12-бітного АЦП
        if (cali && adc_cali_raw_to_voltage(cali, raw, &mv) == ESP_OK && mv > 0) {
            float err = (manual - mv) * 100.0f / mv;
            printf("%4d  %12.1f  %10d  %8.2f\n", raw, manual, mv, err);
        } else {
            printf("%4d  %12.1f  %10s  %8s\n", raw, manual, "-", "-");  // біля нуля ділити на mv не можна
        }
        vTaskDelay(pdMS_TO_TICKS(100));
    }
}

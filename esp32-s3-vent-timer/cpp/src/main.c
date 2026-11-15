#include <stdio.h>
#include "driver/gpio.h"
#include "driver/gptimer.h"
#include "esp_attr.h"
#include "esp_system.h"
#include "esp_task_wdt.h"
#include "esp_timer.h"
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"

// Модуль 2.5, ДЗ «Таймери»: витяжний вентилятор щогодини вмикається на 15 хвилин. ESP-IDF.
// Цикл веде апаратний таймер (gptimer): перемикає вентилятор сам обробник, app_main лише друкує стан і годує сторожа.
#define FAN      GPIO_NUM_2   // GPIO2 → 10 кОм → BC547B → IN модуля реле; 1 = вентилятор працює
#define LED_RUN  GPIO_NUM_15  // червоний: вентилятор працює
#define LED_WAIT GPIO_NUM_16  // зелений: вентилятор чекає
#define BUTTON   GPIO_NUM_21  // кнопка на GND: «увімкнути зараз»

#define PERIOD_S 3600  // довжина циклу: 1 година
#define ON_S     900   // з них вентилятор працює: 15 хвилин
#define SPEEDUP  300   // налагодження: 300 = година за 12 с і 15 хв за 3 с; у роботі поставте 1
#define WDT_S    5     // сторож: стільки секунд без тіків таймера — і перезавантаження

static volatile uint32_t second = 0;  // де ми в циклі, 0 … PERIOD_S − 1
static volatile uint32_t ticks = 0;   // скільки разів спрацював таймер: доказ, що він живий

// Весь цикл вентилятора — тут: раз на секунду циклу, незалежно від того, що робить app_main
static bool IRAM_ATTR on_tick(gptimer_handle_t timer, const gptimer_alarm_event_data_t* event, void* arg) {
    ticks++;
    if (++second >= PERIOD_S) second = 0;
    bool on = second < ON_S;
    gpio_set_level(FAN, on);
    gpio_set_level(LED_RUN, on);
    gpio_set_level(LED_WAIT, !on);
    return false;  // жодну задачу будити не треба
}

// Захист від повторного запуску: поки вентилятор працює, кнопка нічого не робить
// (15 хвилин не подовжуються, брязкіт теж безпечний). Якщо чекає — наступний тік почне цикл спочатку.
static void IRAM_ATTR on_button(void* arg) {
    if (second >= ON_S) second = PERIOD_S - 1;
}

void app_main(void) {
    // FAN як INPUT_OUTPUT: тоді gpio_get_level() читає справжній стан виходу
    gpio_config_t fan = {.pin_bit_mask = 1ULL << FAN, .mode = GPIO_MODE_INPUT_OUTPUT};
    gpio_config(&fan);
    gpio_config_t leds = {.pin_bit_mask = (1ULL << LED_RUN) | (1ULL << LED_WAIT), .mode = GPIO_MODE_OUTPUT};
    gpio_config(&leds);
    gpio_set_level(FAN, 1);  // цикл починається з роботи: second = 0 < ON_S
    gpio_set_level(LED_RUN, 1);

    gpio_config_t button = {.pin_bit_mask = 1ULL << BUTTON, .mode = GPIO_MODE_INPUT,
                            .pull_up_en = GPIO_PULLUP_ENABLE, .intr_type = GPIO_INTR_NEGEDGE};
    gpio_config(&button);
    gpio_install_isr_service(0);
    gpio_isr_handler_add(BUTTON, on_button, NULL);

    gptimer_handle_t timer;
    gptimer_config_t config = {.clk_src = GPTIMER_CLK_SRC_DEFAULT, .direction = GPTIMER_COUNT_UP,
                               .resolution_hz = 1000000};  // 1 тік за 1 мкс
    gptimer_new_timer(&config, &timer);
    gptimer_event_callbacks_t callbacks = {.on_alarm = on_tick};
    gptimer_register_event_callbacks(timer, &callbacks, NULL);
    gptimer_alarm_config_t alarm = {.alarm_count = 1000000 / SPEEDUP,  // раз на секунду циклу
                                    .flags.auto_reload_on_alarm = true};  // повтор робить залізо: похибка не накопичується
    gptimer_set_alarm_action(timer, &alarm);
    gptimer_enable(timer);
    gptimer_start(timer);

    esp_task_wdt_config_t wdt = {.timeout_ms = WDT_S * 1000, .trigger_panic = true};  // не погодували — перезавантаження
    esp_task_wdt_reconfigure(&wdt);  // сторож уже запущений ESP-IDF, міняємо час і реакцію
    esp_task_wdt_add(NULL);          // стежимо за app_main

    vTaskDelay(pdMS_TO_TICKS(2000));  // монітор порту встигає під'єднатися після прошивки
    printf("Вентилятор: цикл %d с, робота %d с, прискорення ×%d, старт: %s\n", PERIOD_S, ON_S, SPEEDUP,
           esp_reset_reason() == ESP_RST_TASK_WDT ? "після сторожа" : "звичайний");

    bool shown = false;  // що вже надруковано
    uint32_t seen = 0;   // останній побачений тік
    while (1) {
        if (ticks != seen) {  // годуємо, лише якщо таймер живий: стереже і app_main, і таймер
            seen = ticks;
            esp_task_wdt_reset();
        }

        bool on = gpio_get_level(FAN);
        if (on != shown) {
            shown = on;
            printf("[%lld мс] %s, секунда циклу %lu\n", esp_timer_get_time() / 1000, on ? "ПРАЦЮЄ" : "чекає", second);
        }
        vTaskDelay(1);  // 1 мс: віддаємо процесор іншим задачам
    }
}

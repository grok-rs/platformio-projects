#pragma once
#include <stdint.h>
#include <stdbool.h>
#include <stddef.h>
#define IRAM_ATTR
#define GPIO_NUM_7 7
#define GPIO_NUM_15 15
typedef int gpio_num_t;
enum { GPIO_MODE_INPUT = 1, GPIO_MODE_OUTPUT = 2 };
enum { GPIO_INTR_DISABLE = 0, GPIO_INTR_NEGEDGE = 2 };
typedef struct { uint64_t pin_bit_mask; int mode; int pull_up_en; int pull_down_en; int intr_type; } gpio_config_t;
int gpio_config(const gpio_config_t *c);
int gpio_install_isr_service(int f);
int gpio_isr_handler_add(gpio_num_t p, void (*f)(void *), void *a);
int gpio_get_level(gpio_num_t p);
int gpio_set_level(gpio_num_t p, uint32_t l);
int64_t esp_timer_get_time(void);
typedef int BaseType_t; typedef uint32_t TickType_t;
#define pdTRUE 1
#define pdFALSE 0
#define portMAX_DELAY 0xffffffffu
#define pdMS_TO_TICKS(ms) ((TickType_t)(ms))
#define portYIELD_FROM_ISR(...) do {} while (0)
typedef void *QueueHandle_t; typedef void *SemaphoreHandle_t;
QueueHandle_t xQueueCreate(int n, int sz);
BaseType_t xQueueSendFromISR(QueueHandle_t q, const void *v, BaseType_t *w);
BaseType_t xQueueReceive(QueueHandle_t q, void *v, TickType_t t);
SemaphoreHandle_t xSemaphoreCreateBinary(void);
BaseType_t xSemaphoreGiveFromISR(SemaphoreHandle_t s, BaseType_t *w);
BaseType_t xSemaphoreTake(SemaphoreHandle_t s, TickType_t t);
void vTaskDelay(TickType_t t);
void vTaskDelayUntil(TickType_t *w, TickType_t t);
TickType_t xTaskGetTickCount(void);

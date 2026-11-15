#pragma once
#include "stub.h"
typedef struct gptimer_t *gptimer_handle_t;
typedef enum { GPTIMER_CLK_SRC_DEFAULT } gptimer_clock_source_t;
typedef enum { GPTIMER_COUNT_DOWN, GPTIMER_COUNT_UP } gptimer_count_direction_t;
typedef struct { gptimer_clock_source_t clk_src; gptimer_count_direction_t direction; uint32_t resolution_hz; } gptimer_config_t;
typedef struct { uint64_t count_value; uint64_t alarm_value; } gptimer_alarm_event_data_t;
typedef bool (*gptimer_alarm_cb_t)(gptimer_handle_t timer, const gptimer_alarm_event_data_t *event, void *arg);
typedef struct { gptimer_alarm_cb_t on_alarm; } gptimer_event_callbacks_t;
typedef struct { uint64_t alarm_count; uint64_t reload_count; struct { uint32_t auto_reload_on_alarm : 1; } flags; } gptimer_alarm_config_t;
esp_err_t gptimer_new_timer(const gptimer_config_t *config, gptimer_handle_t *timer);
esp_err_t gptimer_register_event_callbacks(gptimer_handle_t timer, const gptimer_event_callbacks_t *cbs, void *arg);
esp_err_t gptimer_set_alarm_action(gptimer_handle_t timer, const gptimer_alarm_config_t *config);
esp_err_t gptimer_enable(gptimer_handle_t timer);
esp_err_t gptimer_start(gptimer_handle_t timer);

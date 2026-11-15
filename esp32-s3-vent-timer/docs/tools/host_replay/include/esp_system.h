#pragma once
#include "stub.h"
typedef enum { ESP_RST_POWERON = 1, ESP_RST_TASK_WDT = 6 } esp_reset_reason_t;
esp_reset_reason_t esp_reset_reason(void);

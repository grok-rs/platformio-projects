#pragma once
#include "stub.h"
typedef uint32_t TickType_t;
#define pdMS_TO_TICKS(ms) ((TickType_t)(ms))  // CONFIG_FREERTOS_HZ=1000: 1 тік = 1 мс

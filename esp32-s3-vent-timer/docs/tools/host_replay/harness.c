// PC simulation of cpp/src/main.c: runs app_main() against a model clock; vTaskDelay() advances it and fires events.
// Argument: scenario. normal — two cycles; button — S1 while waiting and while running; hang — timer stops at 7 s.
// A watchdog reset re-executes this program with "reboot <µs>", so main.c starts again with fresh statics.
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <unistd.h>
#include "driver/gpio.h"
#include "driver/gptimer.h"
#include "esp_system.h"
#include "esp_task_wdt.h"
#include "esp_timer.h"
#include "freertos/task.h"

void app_main(void);
static char *self;
static long long now, boot, end_us, stop_timer_at = -1, next_tick, period, wdt_us, wdt_at;
static bool timer_on, wdt_armed;
static gptimer_alarm_cb_t on_alarm;
static gpio_isr_t on_button;
static int pins[64], reason = ESP_RST_POWERON;
static long long press[8];
static int npress, ip;

static void events(long long t) {
    while (timer_on && next_tick <= t && (stop_timer_at < 0 || next_tick < stop_timer_at)) {
        now = next_tick;
        on_alarm(NULL, NULL, NULL);
        next_tick += period;
    }
    while (ip < npress && press[ip] <= t) { now = press[ip++]; if (on_button) on_button(NULL); }
    now = t;
    if (wdt_armed && now >= wdt_at) {
        printf("[%lld мс] СТОРОЖ: %lld с без годування, перезавантаження\n", now / 1000, wdt_us / 1000000);
        fflush(stdout);
        char at[32];
        snprintf(at, sizeof at, "%lld", now);
        execl(self, self, "reboot", at, (char *)NULL);
        exit(1);
    }
    if (now >= end_us) exit(0);
}

int64_t esp_timer_get_time(void) { return now - boot; }  // як на платі: від старту, після сторожа знову з 0
esp_reset_reason_t esp_reset_reason(void) { return reason; }
void vTaskDelay(TickType_t ticks) { events(now + ticks * 1000LL); }
esp_err_t gpio_config(const gpio_config_t *c) { return 0; }
esp_err_t gpio_set_level(gpio_num_t p, uint32_t v) { pins[p] = v; return 0; }
int gpio_get_level(gpio_num_t p) { return pins[p]; }
esp_err_t gpio_install_isr_service(int f) { return 0; }
esp_err_t gpio_isr_handler_add(gpio_num_t p, gpio_isr_t h, void *a) { on_button = h; return 0; }
esp_err_t gptimer_new_timer(const gptimer_config_t *c, gptimer_handle_t *t) { *t = NULL; return 0; }
esp_err_t gptimer_register_event_callbacks(gptimer_handle_t t, const gptimer_event_callbacks_t *c, void *a) { on_alarm = c->on_alarm; return 0; }
esp_err_t gptimer_set_alarm_action(gptimer_handle_t t, const gptimer_alarm_config_t *c) { period = c->alarm_count; return 0; }
esp_err_t gptimer_enable(gptimer_handle_t t) { return 0; }
esp_err_t gptimer_start(gptimer_handle_t t) { timer_on = true; next_tick = now + period; return 0; }
esp_err_t esp_task_wdt_reconfigure(const esp_task_wdt_config_t *c) { wdt_us = c->timeout_ms * 1000LL; return 0; }
esp_err_t esp_task_wdt_add(void *t) { wdt_armed = true; wdt_at = now + wdt_us; return 0; }
esp_err_t esp_task_wdt_reset(void) { wdt_at = now + wdt_us; return 0; }

int main(int argc, char **argv) {
    self = argv[0];
    end_us = 26000000;
    if (!strcmp(argv[1], "button")) { press[0] = 5000000; press[1] = 12500000; press[2] = 13000000; npress = 3; }
    if (!strcmp(argv[1], "hang")) stop_timer_at = 7000000;
    if (!strcmp(argv[1], "reboot")) { reason = ESP_RST_TASK_WDT; now = boot = atoll(argv[2]); end_us = now + 6000000; }
    app_main();
    return 0;
}

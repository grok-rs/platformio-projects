// Runs a real firmware stage on the host: simulated µs clock, GPIO7 follows a list of edges from a file.
#include "sim.h"
#include <setjmp.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
extern void app_main(void);
typedef struct { long long t; int lvl; } Edge;
static Edge *E; static int N, I; static long long now, endt; static int level = 1;
static void (*isr)(void *); static void *isra; static jmp_buf done; static uint32_t led_changes; static int led;
#define QN 4096
static int64_t qbuf[QN]; static int qh, qt, qdrop; static int sem; static int use_queue, use_sem;
static void step_to(long long t) {           // advance the clock, firing the ISR on every falling edge on the way
    while (I < N && E[I].t <= t) {
        now = E[I].t; int was = level; level = E[I].lvl; I++;
        if (isr && was == 1 && level == 0) isr(isra);
    }
    now = t;
    if (now >= endt) longjmp(done, 1);
}
int gpio_config(const gpio_config_t *c) { return 0; }
int gpio_install_isr_service(int f) { return 0; }
int gpio_isr_handler_add(gpio_num_t p, void (*f)(void *), void *a) { isr = f; isra = a; return 0; }
int gpio_get_level(gpio_num_t p) { return level; }
int gpio_set_level(gpio_num_t p, uint32_t l) { if ((int)l != led) led_changes++; led = l; return 0; }
int64_t esp_timer_get_time(void) { return now; }
QueueHandle_t xQueueCreate(int n, int sz) { use_queue = 1; return (void *)1; }
BaseType_t xQueueSendFromISR(QueueHandle_t q, const void *v, BaseType_t *w) {
    if (((qt + 1) % 64) == (qh % 64) && qt - qh >= 63) { qdrop++; return pdFALSE; }
    qbuf[qt++ % QN] = *(const int64_t *)v; return pdTRUE;
}
BaseType_t xQueueReceive(QueueHandle_t q, void *v, TickType_t t) {
    long long dl = t == portMAX_DELAY ? endt : now + (long long)t * 1000;
    for (;;) {
        if (qh != qt) { *(int64_t *)v = qbuf[qh++ % QN]; return pdTRUE; }
        if (now >= dl) return pdFALSE;
        long long nx = I < N && E[I].t < dl ? E[I].t : dl; step_to(nx);
    }
}
SemaphoreHandle_t xSemaphoreCreateBinary(void) { use_sem = 1; return (void *)1; }
BaseType_t xSemaphoreGiveFromISR(SemaphoreHandle_t s, BaseType_t *w) { sem = 1; return pdTRUE; }
BaseType_t xSemaphoreTake(SemaphoreHandle_t s, TickType_t t) {
    long long dl = t == portMAX_DELAY ? endt : now + (long long)t * 1000;
    for (;;) {
        if (sem) { sem = 0; return pdTRUE; }
        if (now >= dl) return pdFALSE;
        long long nx = I < N && E[I].t < dl ? E[I].t : dl; step_to(nx);
    }
}
void vTaskDelay(TickType_t t) { step_to(now + (long long)t * 1000); }
void vTaskDelayUntil(TickType_t *w, TickType_t t) { *w += t; step_to((long long)*w * 1000); }
TickType_t xTaskGetTickCount(void) { return now / 1000; }
int main(int c, char **v) {
    FILE *f = fopen(v[1], "r"); long long t; int l; int cap = 1 << 16; E = malloc(cap * sizeof(Edge));
    while (fscanf(f, "%lld %d", &t, &l) == 2) { E[N].t = t; E[N].lvl = l; N++; }
    endt = E[N - 1].t + 3000000;
    if (setjmp(done) == 0) app_main();
    printf("@@ led_changes=%u qdrop=%d\n", led_changes, qdrop);
    return 0;
}

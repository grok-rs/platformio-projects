// Wokwi custom chip: the module 1.6 voltage divider, 3V3 ── LDR ── OUT ── 10 kΩ ── GND.
//
// Wokwi has no bare LDR, and its photoresistor module is wired the other way round
// (LDR on the GND side, 5 V supply). This chip computes the homework circuit instead:
//   R_ldr = rl10 · (10 / lux)^gamma            (GL5528-like: rl10 ≈ 15 kΩ, gamma ≈ 0.7)
//   U_out = 3.3 V · R2 / (R_ldr + R2),  R2 = 10 kΩ
// The "light" slider is log10(lux), so one slider covers 0.1 lx … 100 000 lx.
//
// Wokwi's virtual ADC reads 0…5 V as 0…4095 for every MCU, while the real ESP32-S3 at 11 dB reads
// about 0…3.1 V. The chip therefore writes U_out · 5 / 3.1, so analogRead() returns the RAW value
// a real ESP32-S3 would: RAW = U_out / 3.1 V · 4095, saturating at 4095 above 3.1 V.
//
// Build: wokwi-cli chip compile wokwi/chip/ldr-divider.chip.c -o wokwi/chip/ldr-divider.chip.wasm
#include "wokwi-api.h"
#include <math.h>
#include <stdio.h>
#include <stdlib.h>

#define VCC_V       3.3f
#define ADC_FS_V    3.1f   // ESP32-S3, ADC_11db
#define WOKWI_FS_V  5.0f   // Wokwi virtual ADC full scale

typedef struct {
  pin_t    out;
  uint32_t light, rl10, gamma, r2;
  float    last_light;
} chip_state_t;

static void update(void *user_data) {
  chip_state_t *chip = (chip_state_t *)user_data;
  const float light = attr_read_float(chip->light);
  const float lux   = powf(10.0f, light);
  const float r_ldr = attr_read_float(chip->rl10) * powf(10.0f / lux, attr_read_float(chip->gamma));
  const float r2    = attr_read_float(chip->r2);
  const float u_out = VCC_V * r2 / (r_ldr + r2);
  float u_wokwi = u_out * WOKWI_FS_V / ADC_FS_V;
  if (u_wokwi > WOKWI_FS_V) u_wokwi = WOKWI_FS_V;
  pin_dac_write(chip->out, u_wokwi);
  if (light != chip->last_light) {
    chip->last_light = light;
    printf("light %.3g lx: R_ldr = %.0f Ohm, U_out = %.0f mV\n", lux, r_ldr, u_out * 1000.0f);
  }
}

void chip_init(void) {
  chip_state_t *chip = malloc(sizeof(chip_state_t));
  chip->out        = pin_init("OUT", ANALOG);
  chip->light      = attr_init_float("light", 1.5f);     // ≈ 32 lx, dim room
  chip->rl10       = attr_init_float("rl10", 15000.0f);  // LDR resistance at 10 lx, Ω
  chip->gamma      = attr_init_float("gamma", 0.7f);
  chip->r2         = attr_init_float("r2", 10000.0f);    // fixed resistor to GND, Ω
  chip->last_light = NAN;

  const timer_config_t cfg = {.callback = update, .user_data = chip};
  const timer_t timer = timer_init(&cfg);
  update(chip);
  timer_start(timer, 1000, true);  // every 1 ms of simulated time: follow the slider
}

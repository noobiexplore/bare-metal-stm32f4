#include "core/system.h"
#include <libopencm3/cm3/systick.h>
#include <libopencm3/cm3/vector.h>
#include <libopencm3/stm32/rcc.h>

// Volatile: tells compiler to not optimize this var
// and always update to the latest value
static volatile uint64_t ticks = 0;
// Systick Interrupt handler
void sys_tick_handler(void){
  ticks++;
}

// Private functions(Static) - bound within this file
// Set up the internal clock oscillator
static void rcc_setup(void){
  rcc_clock_setup_pll(&rcc_hsi_configs[RCC_CLOCK_3V3_84MHZ]);
}

static void systick_setup(void){
  systick_set_frequency(SYSTICK_FREQ, CPU_FREQ);
  systick_counter_enable();
  systick_interrupt_enable();
}

// Public functions
uint64_t system_get_ticks(void){
  return ticks;
}

void system_setup(void){
  rcc_setup();
  systick_setup();
}

void system_teardown(void) {
  systick_interrupt_disable();
  systick_counter_disable();
  systick_clear();
}

void system_delay(uint64_t milliseconds){
  uint64_t end_time = system_get_ticks() + milliseconds;
  while(system_get_ticks() < end_time){
    // Spin
  }
}

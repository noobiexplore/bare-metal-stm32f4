#include "common-defines.h"
#include <libopencm3/stm32/memorymap.h>
#include <libopencm3/cm3/vector.h>
#include <libopencm3/stm32/gpio.h>
#include <libopencm3/stm32/rcc.h>

#include "core/uart.h"
#include "core/system.h"
#include "comms.h"

#define BOOTLOADER_SIZE  (0x8000U)
#define MAIN_APP_START_ADDRESS (FLASH_BASE + BOOTLOADER_SIZE)

#define UART_PORT   GPIOA
#define RX_PIN      GPIO3
#define TX_PIN      GPIO2



static void gpio_setup(void){
  rcc_periph_clock_enable(RCC_GPIOA);
 
  // UART gpio setup
  gpio_mode_setup(UART_PORT, GPIO_MODE_AF, GPIO_PUPD_NONE, RX_PIN | TX_PIN);
  gpio_set_af(UART_PORT, GPIO_AF7, TX_PIN | RX_PIN);
}


/*
static void jump_to_main(void)
{
    // Function pointer definition
    typedef void (*void_fn)(void);

    // Creating a pointer to the reset vector
    // which is the second entry to the vector table thus adding 4U
    // The first entry is the stack pointer
    uint32_t* reset_vector_entry = (uint32_t*)(MAIN_APP_START_ADDRESS + 0x4U);
    // The actual reset vector
    uint32_t* reset_vector = (uint32_t*)(*reset_vector_entry);
    void_fn jump_fn = (void_fn)reset_vector;

    // Call the function which just jumps execution to that address
    jump_fn();
}
*/

static void jump_to_main(void) {
  vector_table_t* main_vector_table = (vector_table_t*)MAIN_APP_START_ADDRESS;
  main_vector_table->reset();
}

int main(void)
{
  system_setup();
  gpio_setup();
  uart_setup();
  comms_setup();

  comms_packet_t packet = {
    .length = 9,
    .data = {1, 2, 3, 4, 5, 6, 7, 8, 9, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff},
    .crc = 0
  };
  packet.crc = comms_compute_crc(&packet);

  while (true) {
    comms_write(&packet);
    system_delay(500);
  }

  // TODO Teardown

  jump_to_main();

  // Never return
  return 0;
}

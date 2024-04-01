#include "common-defines.h"
#include <libopencm3/stm32/memorymap.h>

#define BOOTLOADER_SIZE  (0x8000U)
#define MAIN_APP_START_ADDRESS (FLASH_BASE + BOOTLOADER_SIZE)

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

int main(void)
{
    jump_to_main();

    // Never return
    return 0;
}
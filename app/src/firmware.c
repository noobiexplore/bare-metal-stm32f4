#include <libopencm3/stm32/rcc.h>
#include <libopencm3/stm32/gpio.h>

#include "core/system.h"
#include "core/timer.h"

#define LED_PORT GPIOA
#define LED_PIN GPIO5

// Set up GPIO mode
static void gpio_setup(void)
{
    rcc_periph_clock_enable(RCC_GPIOA);
    gpio_mode_setup(LED_PORT, GPIO_MODE_OUTPUT, GPIO_PUPD_NONE, LED_PIN);
    // PWM ch 1 is mapped to Alternate function 1
    gpio_set_af(LED_PORT, GPIO_AF1, LED_PIN);
}

int main(void)
{
    system_setup();
    gpio_setup();
    timer_setup();

    uint64_t start_time = system_get_ticks();
    float duty_cycle = 0.0f;

    timer_pwm_set_duty_cycle(duty_cycle);

    while(1)
    {
        if (system_get_ticks() - start_time >= 10)
        {
            duty_cycle += 1.0f;
            if (duty_cycle > 100.0f)
            {
                duty_cycle = 0.0f;
            }
            timer_pwm_set_duty_cycle(duty_cycle);

            start_time = system_get_ticks();
        }
    }

    // Never return
    return 0;
}
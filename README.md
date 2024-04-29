# Bare Metal STM32F4 Bootloader: Firmware Updater
This repository is my walkthrough of *Blinky to Bootloader: Bare metal programmng series*
by Low Byte Production.  

## Setup

### Main Setup
- **MCU**: STM32F401RE Nucleo Board  
- **Debugger**: ST-Link
- **Library**: libopencm3  
- **Compiler**: gcc-arm-none-eabi 
- **OS**: Linux (Debian)  

### Firmware updater client setup

Updater client is written in *typescript*.  
Used node serial port library to communicate with stm32.

```bash
npm install -g typescript ts-node nodemon
npm install serialport
npm install --save @types/node
```

*Detailed system setup in System_Setup.md*

## Goal

STM32F401RE flash size is *512 KiBytes*.  
Split the flash size into Bootloader (*32 KiBytes*) and Main Application (*480 KiBytes*)  

Then try to update the firmware from bootloader.  
If timed out, jump to main application

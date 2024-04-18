## Installing Arm GNU Toolchains

Use [getting-started-with-pico.pdf](https://datasheets.raspberrypi.com/pico/getting-started-with-pico.pdf)  
as a guide to install the gcc arm toolchains on Linux deb.
`gcc-arm-none-eabi` is required for Pi Pico C-SDK.

```bash
sudo apt update
sudo apt install cmake gcc-arm-none-eabi libnewlib-arm-none-eabi build-essential
sudo apt install libstdc++-arm-none-eabi-newlib
```

`build-essential` is gnu gcc compiler.

## Installing GDB

Installing `gdb-multiarch` would do. No need to install arm specific debugger.

```bash
sudo apt install gdb-multiarch
```


## Installing stlink

STLink-V2 debugger is attached to the STM32F401RE nucleo board.  
We need to install the STLink tools.  

[Installation guide video](https://youtu.be/5nr_3o7D1To?list=LL)

```bash
git clone https://github.com/stlink-org/stlink.git
cd stlink
cd doc
vim compiling.md
```

Read the doc for required dependencies.
- gcc
- cmake
- libusb-1.0.0

```bash
sudo apt-get install libusb-1.0.0
```

to build
```bash
cd ~/stilink/
make release
```

then to install
```bash
cd buil/Release/
sudo make insall
cd ~
sudo ldconfig
```

Refresh the terminal and and plug in the stm32 nucleo board.  
And run `st-info --probe` and `st-util` to see if it's working  


## Installing libopencm3

go to the project folder and add libopencm3 repo as a submodule

```bash
git init 
git submodule add https://github.com/libopencm3/libopencm3.git
git submodule update
```

then go to libopencm3 folder and build it
```bash
cd libopencm3
make
```

## nodejs and typescript install

typescript is needed to write the script for the firmware updater  
First download the latest LTS nodejs prebuilt binaries from [Official website](https://nodejs.org/en/download/prebuilt-binaries)  

```bash
cd Downloads/
tar -xf node.....
mv node... ~/nodejs
```

Add to path
```bash
vim ~/.bashrc
export PATH=$PATH:/home/user/nodejs/bin
source ~/.bashrc
```

then check version of nodejs and npm
```bash
node -v
npm -v
```

Install typescript
```bash
npm install -g typesript
```

Install ts-node and nodemon
```bash
npm install -g ts-node nodemon
```


## VSCode settings

.vscode config file is provided in the github repo of Low Byte Production  
repo name: [lowbyteproductions/bare-metal-series](https://github.com/lowbyteproductions/bare-metal-series)  









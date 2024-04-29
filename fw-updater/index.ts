import * as fs from 'fs/promises'
import * as path from 'path'
import {SerialPort} from 'serialport';

// Constants for the packet protocol
const PACKET_LENGTH_BYTES   = 1;
const PACKET_DATA_BYTES     = 16;
const PACKET_CRC_BYTES      = 1;
const PACKET_CRC_INDEX      = PACKET_LENGTH_BYTES + PACKET_DATA_BYTES;
const PACKET_LENGTH         = PACKET_LENGTH_BYTES + PACKET_DATA_BYTES + PACKET_CRC_BYTES;

const BOOTLOADER_SIZE = 0x8000;

const PACKET_ACK_DATA0      = 0x15;
const PACKET_RETX_DATA0     = 0x19;

const BL_PACKET_SYNC_OBSERVED_DATA0      = (0x20);
const BL_PACKET_FW_UPDATE_REQ_DATA0      = (0x31);
const BL_PACKET_FW_UPDATE_RES_DATA0      = (0x37);
const BL_PACKET_DEVICE_ID_REQ_DATA0      = (0x3C);
const BL_PACKET_DEVICE_ID_RES_DATA0      = (0x3F);
const BL_PACKET_FW_LENGTH_REQ_DATA0      = (0x42);
const BL_PACKET_FW_LENGTH_RES_DATA0      = (0x45);
const BL_PACKET_READY_FOR_DATA_DATA0     = (0x48);
const BL_PACKET_UPDATE_SUCCESSFUL_DATA0  = (0x54);
const BL_PACKET_NACK_DATA0               = (0x59);

const DeviceID  = (0x42);
const SYNC_SEQ = Buffer.from([0xc4, 0x55, 0x7e, 0x10]);
const DEFAULT_TIMEOUT   = (10000);



// Details about the serial port connection
const serialPath            = "/dev/ttyACM0";
const baudRate              = 115200;

// CRC8 implementation
const crc8 = (data: Buffer | Array<number>) => {
  let crc = 0;

  for (const byte of data) {
    crc = (crc ^ byte) & 0xff;
    for (let i = 0; i < 8; i++) {
      if (crc & 0x80) {
        crc = ((crc << 1) ^ 0x07) & 0xff;
      } else {
        crc = (crc << 1) & 0xff;
      }
    }
  }

  return crc;
};

// Async delay function, which gives the event loop time to process outside input
const delay = (ms: number) => new Promise(r => setTimeout(r, ms));

class Logger {
  static info(message: string) { console.log(`[.] ${message}`); }
  static success(message: string) { console.log(`[$] ${message}`); }
  static error(message: string) { console.log(`[!] ${message}`); }
}

// Class for serialising and deserialising packets
class Packet {
  length: number;
  data: Buffer;
  crc: number;

  static retx = new Packet(1, Buffer.from([PACKET_RETX_DATA0])).toBuffer();
  static ack = new Packet(1, Buffer.from([PACKET_ACK_DATA0])).toBuffer();

  constructor(length: number, data: Buffer, crc?: number) {
    this.length = length;
    this.data = data;

    const bytesToPad = PACKET_DATA_BYTES - this.data.length;
    const padding = Buffer.alloc(bytesToPad).fill(0xff);
    this.data = Buffer.concat([this.data, padding]);

    if (typeof crc === 'undefined') {
      this.crc = this.computeCrc();
    } else {
      this.crc = crc;
    }
  }

  computeCrc() {
    const allData = [this.length, ...this.data];
    return crc8(allData);
  }

  toBuffer() {
    return Buffer.concat([ Buffer.from([this.length]), this.data, Buffer.from([this.crc]) ]);
  }

  isSingleBytePacket(byte: number) {
    if (this.length !== 1) return false;
    if (this.data[0] !== byte) return false;
    for (let i = 1; i < PACKET_DATA_BYTES; i++) {
      if (this.data[i] !== 0xff) return false;
    }
    return true;
  }

  isAck() {
    return this.isSingleBytePacket(PACKET_ACK_DATA0);
  }

  isRetx() {
    return this.isSingleBytePacket(PACKET_RETX_DATA0);
  }

  static createSingleBytePacket(byte: number) {
    return new Packet(1, Buffer.from([byte]));
  }
}

// Serial port instance
const uart = new SerialPort({ path: serialPath, baudRate });

// Packet buffer
let packets: Packet[] = [];

let lastPacket: Buffer = Packet.ack;
const writePacket = (packet: Buffer) => {
  uart.write(packet);
  lastPacket = packet;
};

// Serial data buffer, with a splice-like function for consuming data
let rxBuffer = Buffer.from([]);
const consumeFromBuffer = (n: number) => {
  const consumed = rxBuffer.slice(0, n);
  rxBuffer = rxBuffer.slice(n);
  return consumed;
}

// This function fires whenever data is received over the serial port. The whole
// packet state machine runs here.
uart.on('data', data => {
  // console.log(`Received ${data.length} bytes through uart`);
  // Add the data to the packet
  rxBuffer = Buffer.concat([rxBuffer, data]);

  // Can we build a packet?
  while (rxBuffer.length >= PACKET_LENGTH) {
    // console.log(`Building a packet`);
    const raw = consumeFromBuffer(PACKET_LENGTH);
    const packet = new Packet(raw[0], raw.slice(1, 1+PACKET_DATA_BYTES), raw[PACKET_CRC_INDEX]);
    const computedCrc = packet.computeCrc();

    // Need retransmission?
    if (packet.crc !== computedCrc) {
      // console.log(`CRC failed, computed 0x${computedCrc.toString(16)}, got 0x${packet.crc.toString(16)}`);
      writePacket(Packet.retx);
      continue;
    }

    // Are we being asked to retransmit?
    if (packet.isRetx()) {
      console.log(`Retransmitting last packet`);
      writePacket(lastPacket);
      continue;
    }

    // If this is an ack, move on
    if (packet.isAck()) {
      // console.log(`It was an ack, nothing to do`);
      continue;
    }
    
    // If this is a NAck, exit the program
    if (packet.isSingleBytePacket(BL_PACKET_NACK_DATA0)) {
      Logger.error('Received Nack. Exiting ...');
      process.exit(1);
    }


    // Otherwise write the packet in to the buffer, and send an ack
    // console.log(`Storing packet and ack'ing`);
    packets.push(packet);
    writePacket(Packet.ack);
  }
});

// Function to allow us to await a packet
const waitForPacket = async (timeout = DEFAULT_TIMEOUT) => {
  let timeWaited = 0;
  while (packets.length < 1) {
    await delay(1);
    timeWaited += 1;

    if (timeWaited >= timeout) {
      throw Error('Timed out waiting for packet');
    }
  }
  return packets.splice(0, 1)[0];
}

const waitForSingleBytePacket = (byte: number, timeout = DEFAULT_TIMEOUT) => {
  waitForPacket(timeout)
    .then(packet => {
      if (packet.length !== 1 || packet.data[0] !== byte) {
        throw new Error(`Unexpected packet received. Expected single byte 0x${byte.toString(16)}`);
      }
    })
    .catch((e: Error) => {
      Logger.error(e.message);
      console.log(rxBuffer);
      console.log(packets);
      process.exit(1);
    })
}

const syncWithBootloader = async (syncDelay = 500, timeout = DEFAULT_TIMEOUT) => {
  let timeWaited = 0;
  while (true) {
    uart.write(SYNC_SEQ);
    await delay(syncDelay);
    timeWaited += syncDelay;

    if (packets.length > 0) {
      const packet = packets.splice(0, 1)[0];
      if (packet.isSingleBytePacket(BL_PACKET_SYNC_OBSERVED_DATA0)) {
        return;
      }
      Logger.error('Wrong packet observed during sync sequence');
      process.exit(1);
    }

    if (timeWaited >= timeout) {
      Logger.error('Timed out waiting for sync sequence observed');
      process.exit(1);
    }
  }
}

// Do everything in an async function so we can have loops, awaits etc
const main = async () => {
  Logger.info('Reading firmware image...');
  const fwImage = await fs.readFile(path.join(process.cwd(), 'firmware.bin'))
    .then(bin => bin.slice(BOOTLOADER_SIZE));
  const fwLength = fwImage.length;
  Logger.success(`Read firmware image (${fwLength} bytes)`);

  Logger.info('Attempting to sync with the bootloader');
  await syncWithBootloader();
  Logger.success('Synced');

  Logger.info('Requesting firmware update');
  const fwUpdatePacket = Packet.createSingleBytePacket(BL_PACKET_FW_UPDATE_REQ_DATA0);
  writePacket(fwUpdatePacket.toBuffer());
  await waitForSingleBytePacket(BL_PACKET_FW_UPDATE_RES_DATA0);
  Logger.success('Firmware update request accepted');

  Logger.info('Waiting for device ID request');
  await waitForSingleBytePacket(BL_PACKET_DEVICE_ID_REQ_DATA0);

  const devicIDPacket = new Packet(2, Buffer.from([BL_PACKET_DEVICE_ID_RES_DATA0, DeviceID]));
  writePacket(devicIDPacket.toBuffer());
  Logger.info(`Responding with device ID 0x${DeviceID.toString(16)}`);

  Logger.info('Waiting for firmware length request');
  await waitForSingleBytePacket(BL_PACKET_FW_LENGTH_REQ_DATA0);

  const fwLengthPacketBuffer = Buffer.alloc(5);
  fwLengthPacketBuffer[0] = BL_PACKET_FW_LENGTH_RES_DATA0;
  fwLengthPacketBuffer.writeUint32LE(fwLength, 1);
  const fwLengthPacket = new Packet(5, fwLengthPacketBuffer);
  writePacket(fwLengthPacket.toBuffer());
  Logger.info('Responding with firmware length');

  Logger.info('Waiting for main application to be erased...');
  await delay(1000);
  Logger.info('Waiting for main application to be erased...');
  await delay(1000);
  Logger.info('Waiting for main application to be erased...');
  await delay(1000);

  let bytesWritten = 0;
  while (bytesWritten < fwLength) {
    await waitForSingleBytePacket(BL_PACKET_READY_FOR_DATA_DATA0);
    const dataBytes = fwImage.slice(bytesWritten, bytesWritten + PACKET_DATA_BYTES);
    const dataLength = dataBytes.length;
    // length 1 maps to 0 length in byte representation
    const dataPacket = new Packet(dataLength - 1, dataBytes);
    writePacket(dataPacket.toBuffer());
    bytesWritten += dataLength;

    Logger.info(`Wrote ${dataLength} bytes (${bytesWritten}/${fwLength})`);
  }

  await waitForSingleBytePacket(BL_PACKET_UPDATE_SUCCESSFUL_DATA0);
  Logger.success('Firmware update complete!');
}

main()
  .finally(() => uart.close());

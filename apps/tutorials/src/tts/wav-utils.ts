import fs from "node:fs";

/**
 * WAV Utilities
 *
 * Reads WAV file headers to extract duration without loading the entire file into memory.
 */

/**
 * Calculate WAV file duration in milliseconds from the 44-byte header.
 *
 * Parses: sampleRate (offset 24), bitsPerSample (offset 34),
 * numChannels (offset 22), dataSize (offset 40).
 *
 * @param filePath - Absolute or relative path to a WAV file
 * @returns Duration in milliseconds
 */
export function getWavDurationMs(filePath: string): number {
  const fd = fs.openSync(filePath, "r");
  try {
    const header = Buffer.alloc(44);
    fs.readSync(fd, header, 0, 44, 0);

    const numChannels = header.readUInt16LE(22);
    const sampleRate = header.readUInt32LE(24);
    const bitsPerSample = header.readUInt16LE(34);
    const dataSize = header.readUInt32LE(40);

    const bytesPerSample = numChannels * (bitsPerSample / 8);
    return Math.round((dataSize / bytesPerSample / sampleRate) * 1000);
  } finally {
    fs.closeSync(fd);
  }
}

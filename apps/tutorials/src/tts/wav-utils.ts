import fs from "node:fs";

/**
 * WAV Utilities
 *
 * Reads WAV file headers to extract duration without loading the entire file into memory.
 */

/**
 * Calculate WAV file duration in milliseconds from RIFF chunks.
 *
 * Scans the WAV structure to find the `fmt ` and `data` chunks instead of
 * assuming a fixed 44-byte header, since ffmpeg may insert metadata chunks
 * such as `LIST/INFO` before the audio data.
 *
 * @param filePath - Absolute or relative path to a WAV file
 * @returns Duration in milliseconds
 */
export function getWavDurationMs(filePath: string): number {
  const file = fs.readFileSync(filePath);

  if (file.length < 12) {
    throw new Error(`Invalid WAV file: ${filePath}`);
  }

  if (file.toString("ascii", 0, 4) !== "RIFF" || file.toString("ascii", 8, 12) !== "WAVE") {
    throw new Error(`Not a RIFF/WAVE file: ${filePath}`);
  }

  let offset = 12;
  let numChannels: number | null = null;
  let sampleRate: number | null = null;
  let bitsPerSample: number | null = null;
  let dataSize: number | null = null;

  while (offset + 8 <= file.length) {
    const chunkId = file.toString("ascii", offset, offset + 4);
    const chunkSize = file.readUInt32LE(offset + 4);
    const chunkDataStart = offset + 8;
    const paddedChunkSize = chunkSize + (chunkSize % 2);
    const nextOffset = chunkDataStart + paddedChunkSize;

    if (nextOffset > file.length) {
      break;
    }

    if (chunkId === "fmt ") {
      if (chunkSize < 16) {
        throw new Error(`Invalid fmt chunk in WAV file: ${filePath}`);
      }

      numChannels = file.readUInt16LE(chunkDataStart + 2);
      sampleRate = file.readUInt32LE(chunkDataStart + 4);
      bitsPerSample = file.readUInt16LE(chunkDataStart + 14);
    } else if (chunkId === "data") {
      dataSize = chunkSize;
      break;
    }

    offset = nextOffset;
  }

  if (
    numChannels === null ||
    sampleRate === null ||
    bitsPerSample === null ||
    dataSize === null
  ) {
    throw new Error(`Could not read WAV duration metadata from: ${filePath}`);
  }

  const bytesPerSample = numChannels * (bitsPerSample / 8);
  return Math.round((dataSize / bytesPerSample / sampleRate) * 1000);
}

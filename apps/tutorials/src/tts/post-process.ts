import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

/**
 * Post-Processing Pipeline
 *
 * Applies broadcast-standard loudness normalization (-16 LUFS) and 0.5s trailing silence
 * to TTS-generated WAV files using ffmpeg two-pass loudnorm.
 */

/**
 * Run a command and collect stdout/stderr.
 */
function runCommand(
  cmd: string,
  args: string[]
): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const proc = spawn(cmd, args);
    const stdout: string[] = [];
    const stderr: string[] = [];

    proc.stdout.on("data", (data: Buffer) => stdout.push(data.toString()));
    proc.stderr.on("data", (data: Buffer) => stderr.push(data.toString()));

    proc.on("close", (code) => {
      if (code !== 0) {
        reject(
          new Error(
            `${cmd} exited with code ${code}\nstderr: ${stderr.join("")}`
          )
        );
      } else {
        resolve({ stdout: stdout.join(""), stderr: stderr.join("") });
      }
    });

    proc.on("error", (err) => {
      reject(
        new Error(
          `Failed to spawn ${cmd}: ${err.message}. Install with: brew install ffmpeg`
        )
      );
    });
  });
}

/**
 * Check that ffmpeg is available on the system.
 */
async function checkFfmpeg(): Promise<void> {
  try {
    await runCommand("ffmpeg", ["-version"]);
  } catch {
    throw new Error("ffmpeg not found. Install with: brew install ffmpeg");
  }
}

/**
 * Parse loudnorm JSON output from ffmpeg pass 1 stderr.
 *
 * ffmpeg prints the loudnorm stats as a JSON block in stderr after the filter graph completes.
 */
function parseLoudnormStats(stderr: string): {
  measured_I: string;
  measured_LRA: string;
  measured_TP: string;
  measured_thresh: string;
} {
  // Find the JSON block that loudnorm prints
  const jsonMatch = stderr.match(
    /\{[^}]*"input_i"[^}]*"input_lra"[^}]*"input_tp"[^}]*"input_thresh"[^}]*\}/s
  );
  if (!jsonMatch) {
    throw new Error(
      "Failed to parse loudnorm stats from ffmpeg output. Raw stderr:\n" +
        stderr.slice(-500)
    );
  }

  const stats = JSON.parse(jsonMatch[0]);
  return {
    measured_I: stats.input_i,
    measured_LRA: stats.input_lra,
    measured_TP: stats.input_tp,
    measured_thresh: stats.input_thresh,
  };
}

/**
 * Apply two-pass loudness normalization and trailing silence to an audio file.
 *
 * - Pass 1: Measure loudness statistics
 * - Pass 2: Apply normalization to -16 LUFS, append 0.5s silence, output 24kHz mono
 *
 * If inputPath and outputPath are the same, a temp file is used for the intermediate output.
 */
export async function postProcessAudio(
  inputPath: string,
  outputPath: string
): Promise<void> {
  await checkFfmpeg();

  const sameFile = path.resolve(inputPath) === path.resolve(outputPath);
  const tempPath = sameFile
    ? path.join(os.tmpdir(), `tts-postprocess-${Date.now()}.wav`)
    : outputPath;

  try {
    // Pass 1: Measure loudness
    const { stderr } = await runCommand("ffmpeg", [
      "-i",
      inputPath,
      "-af",
      "loudnorm=I=-16:TP=-1.5:LRA=11:print_format=json",
      "-f",
      "null",
      "-",
    ]);

    const stats = parseLoudnormStats(stderr);

    // Pass 2: Apply normalization + trailing silence
    const filterChain = [
      `loudnorm=I=-16:TP=-1.5:LRA=11`,
      `measured_I=${stats.measured_I}`,
      `measured_LRA=${stats.measured_LRA}`,
      `measured_TP=${stats.measured_TP}`,
      `measured_thresh=${stats.measured_thresh}`,
    ].join(":");

    await runCommand("ffmpeg", [
      "-y",
      "-i",
      inputPath,
      "-af",
      `${filterChain},apad=pad_dur=0.5`,
      "-ar",
      "24000",
      "-ac",
      "1",
      tempPath,
    ]);

    // Move temp file to final destination if same-file processing
    if (sameFile) {
      fs.copyFileSync(tempPath, outputPath);
    }
  } finally {
    // Clean up temp file
    if (sameFile) {
      try {
        fs.unlinkSync(
          path.join(os.tmpdir(), `tts-postprocess-${Date.now()}.wav`)
        );
      } catch {
        // Temp file may already be cleaned up
      }
    }
  }
}

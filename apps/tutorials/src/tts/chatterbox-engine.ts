import { spawn } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";
import type { TTSEngine } from "./engine.js";
import { getWavDurationMs } from "./wav-utils.js";

/**
 * Production TTS engine using Chatterbox-Turbo via Python subprocess.
 *
 * Requires a Python 3.11 venv with chatterbox-tts installed.
 * Run `bash scripts/setup-chatterbox.sh` to set up the environment.
 */
export class ChatterboxEngine implements TTSEngine {
  constructor(private referenceAudioPath: string) {}

  async generate(
    text: string,
    outputPath: string,
    options?: { emotion?: string },
  ): Promise<{ durationMs: number }> {
    const venvPython = path.join(process.cwd(), ".venv", "bin", "python");

    // Fail explicitly if venv is missing -- do NOT silently fall back to Kokoro
    if (!fs.existsSync(venvPython)) {
      throw new Error(
        "Chatterbox venv not found. Run: bash scripts/setup-chatterbox.sh",
      );
    }

    // Fail explicitly if reference audio is missing
    if (!fs.existsSync(this.referenceAudioPath)) {
      throw new Error(
        `Reference audio not found: ${this.referenceAudioPath}\n` +
          "Provide a ~10s WAV clip of the target narrator voice.",
      );
    }

    const args = [
      "scripts/chatterbox-generate.py",
      "--text",
      text,
      "--output",
      outputPath,
      "--reference",
      this.referenceAudioPath,
    ];

    if (options?.emotion) {
      args.push("--emotion", options.emotion);
    }

    await new Promise<void>((resolve, reject) => {
      const proc = spawn(venvPython, args, {
        cwd: process.cwd(),
        stdio: ["ignore", "pipe", "pipe"],
      });

      let stderr = "";
      proc.stderr?.on("data", (d: Buffer) => {
        stderr += d.toString();
      });

      proc.on("close", (code) => {
        if (code !== 0) {
          reject(
            new Error(`Chatterbox failed (exit ${code}): ${stderr}`),
          );
        } else {
          resolve();
        }
      });
    });

    return { durationMs: getWavDurationMs(outputPath) };
  }
}

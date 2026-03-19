import type { TTSEngine } from "./engine.js";
import { getWavDurationMs } from "./wav-utils.js";

/**
 * KokoroEngine - Draft-quality TTS using kokoro-js (ONNX, CPU-only)
 *
 * Lazy-loads the Kokoro model on first generate() call (~160MB download on first run).
 * Produces 24kHz mono WAV files suitable for draft previews and development iteration.
 */

/** Default voice preset -- warm female narrator for brand consistency */
const VOICE_PRESET = "af_heart";

export class KokoroEngine implements TTSEngine {
  private tts: any | null = null;

  /**
   * Ensure the Kokoro model is loaded (downloads on first use).
   */
  private async ensureModel(): Promise<any> {
    if (this.tts) return this.tts;

    console.log("Downloading Kokoro model (~160MB, first run only)...");
    const { KokoroTTS } = await import("kokoro-js");
    this.tts = await KokoroTTS.from_pretrained(
      "onnx-community/Kokoro-82M-v1.0-ONNX",
      { dtype: "q8", device: "cpu" }
    );
    return this.tts;
  }

  /**
   * Generate a WAV file from narration text.
   *
   * Strips any emotion option (Kokoro has no paralinguistic tag support --
   * it would speak "[cheerful]" literally). Emotion hints are only used by Chatterbox.
   */
  async generate(
    text: string,
    outputPath: string,
    _options?: { emotion?: string }
  ): Promise<{ durationMs: number }> {
    const tts = await this.ensureModel();

    const audio = await tts.generate(text, { voice: VOICE_PRESET });
    await audio.save(outputPath);

    const durationMs = getWavDurationMs(outputPath);
    return { durationMs };
  }
}

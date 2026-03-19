/**
 * TTSEngine Interface
 *
 * Contract implemented by both KokoroEngine (draft/CPU) and ChatterboxEngine (production/MPS).
 * Consumers call generate() with narration text and receive a WAV file with duration metadata.
 */

export interface TTSEngine {
  generate(
    text: string,
    outputPath: string,
    options?: {
      emotion?: string;
    }
  ): Promise<{ durationMs: number }>;
}

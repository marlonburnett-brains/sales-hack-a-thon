#!/usr/bin/env python3
"""Generate a single WAV file from text using Chatterbox-Turbo."""

import argparse
import sys


def main():
    parser = argparse.ArgumentParser(
        description="Generate a single WAV file from text using Chatterbox-Turbo."
    )
    parser.add_argument("--text", required=True, help="Text to synthesize")
    parser.add_argument("--output", required=True, help="Output WAV file path")
    parser.add_argument("--reference", required=True, help="Reference voice audio path")
    parser.add_argument("--emotion", default=None, help="Emotion tag to prepend (e.g. cheerful)")
    args = parser.parse_args()

    # Import heavy dependencies inside main to avoid slow module-level import
    import torch
    import torchaudio
    from chatterbox.tts_turbo import ChatterboxTurboTTS

    # Device detection: prefer MPS on Apple Silicon, fall back to CPU
    device = "mps" if torch.backends.mps.is_available() else "cpu"
    print(f"Using device: {device}", file=sys.stderr)

    # CRITICAL: Load model to CPU first to avoid MPS tensor allocation errors
    model = ChatterboxTurboTTS.from_pretrained("cpu")

    # Move model components to target device if not CPU
    if device != "cpu":
        if hasattr(model, "t3"):
            model.t3 = model.t3.to(device)
        if hasattr(model, "s3gen"):
            model.s3gen = model.s3gen.to(device)
        if hasattr(model, "ve"):
            model.ve = model.ve.to(device)

    text = args.text
    if args.emotion:
        text = f"[{args.emotion}] {text}"

    wav = model.generate(text, audio_prompt_path=args.reference)
    torchaudio.save(args.output, wav, model.sr)

    print(f"Generated: {args.output}", file=sys.stderr)


if __name__ == "__main__":
    main()

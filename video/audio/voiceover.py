"""Voiceover for the launch video: Kokoro-82M (Apache-2.0), one clip per line.

    python video/audio/voiceover.py [--voice af_heart] [--speed 0.92]

Writes video/build/vo/line-N.wav (24 kHz mono, silence trimmed) and
video/build/vo/lines.json with each clip's duration and word timings.
"""

import argparse
import json
from pathlib import Path

import numpy as np
import soundfile as sf
from kokoro import KPipeline

LINES = [
    "This is Paper Trail.",
    "Gemma writes your neighbourhood into an eight-page zine.",
    "Print it. Fold it. Leave your phone.",
    "Tick what you find, snap one photo, and it reads your pencil marks.",
    "The walk app that stays home.",
]
SR = 24000
OUT = Path(__file__).resolve().parents[1] / "build" / "vo"


def trim(audio: np.ndarray, floor_db: float = -42.0, pad_s: float = 0.03) -> tuple[np.ndarray, int]:
    """Cut leading and trailing silence; return the clip and how many samples came off the front."""
    win = int(0.01 * SR)
    env = np.sqrt(np.convolve(audio**2, np.ones(win) / win, mode="same"))
    peak = env.max() or 1.0
    loud = np.where(20 * np.log10(env / peak + 1e-12) > floor_db)[0]
    if len(loud) == 0:
        return audio, 0
    pad = int(pad_s * SR)
    a = max(0, loud[0] - pad)
    b = min(len(audio), loud[-1] + pad)
    clip = audio[a:b].copy()
    fade = int(0.008 * SR)
    clip[:fade] *= np.linspace(0, 1, fade)
    clip[-fade:] *= np.linspace(1, 0, fade)
    return clip, a


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--voice", default="af_heart")
    ap.add_argument("--speed", type=float, default=0.92)
    args = ap.parse_args()
    lang = args.voice[0]  # a = American English, b = British English
    pipe = KPipeline(lang_code=lang, repo_id="hexgrad/Kokoro-82M")
    OUT.mkdir(parents=True, exist_ok=True)
    meta = []
    for i, text in enumerate(LINES, start=1):
        parts, words, t0 = [], [], 0.0
        for res in pipe(text, voice=args.voice, speed=args.speed):
            audio = res.audio.numpy() if hasattr(res.audio, "numpy") else np.asarray(res.audio)
            for tok in res.tokens or []:
                if tok.start_ts is None or not tok.text.strip() or not any(c.isalnum() for c in tok.text):
                    continue
                words.append({"w": tok.text, "s": t0 + tok.start_ts, "e": t0 + (tok.end_ts or tok.start_ts)})
            parts.append(audio)
            t0 += len(audio) / SR
        clip, cut = trim(np.concatenate(parts).astype(np.float32))
        off = cut / SR
        for w in words:
            w["s"] = round(max(0.0, w["s"] - off), 3)
            w["e"] = round(max(0.0, w["e"] - off), 3)
        sf.write(OUT / f"line-{i}.wav", clip, SR, subtype="PCM_16")
        meta.append({"line": i, "text": text, "dur": round(len(clip) / SR, 3), "words": words})
        print(f"line {i}: {len(clip) / SR:.2f}s  {text}")
    (OUT / "lines.json").write_text(json.dumps({"voice": args.voice, "speed": args.speed, "lines": meta}, indent=1))


if __name__ == "__main__":
    main()

"""Soundtrack for the launch video: music, sound effects and the final mix, all synthesised here.

    python video/audio/mix.py

Reads video/cues.json and the voiceover clips (video/audio/voiceover.py), writes to video/out/:
  paper-trail-vo.wav         voiceover on the timeline
  paper-trail-music-sfx.wav  music (ducked under the voice) + sound effects
  paper-trail-mix.wav        the master, -16 LUFS integrated
  paper-trail.srt            captions, timed to the voice

Nothing is sampled: every note and noise is made from sines, filtered noise and plucked
strings below, so the whole soundtrack is original and free to use (CC0).
"""

import json
from pathlib import Path

import numpy as np
import pyloudnorm as pyln
import soundfile as sf
from scipy.signal import butter, lfilter, resample_poly, sosfilt

ROOT = Path(__file__).resolve().parents[1]
SR = 48000
CUES = json.loads((ROOT / "cues.json").read_text())
DUR = CUES["duration"]
N = int(DUR * SR)
BEAT = 60 / CUES["bpm"]  # 0.6 s
RNG = np.random.default_rng(20261010)


# ---------------------------------------------------------------- helpers
def t_(n: int) -> np.ndarray:
    return np.arange(n) / SR


def sos(kind: str, f, order: int = 2):
    return butter(order, f, btype=kind, fs=SR, output="sos")


def filt(x: np.ndarray, kind: str, f, order: int = 2) -> np.ndarray:
    return sosfilt(sos(kind, f, order), x)


def env(n: int, a: float, d: float) -> np.ndarray:
    """Linear attack, exponential decay (seconds)."""
    t = t_(n)
    e = np.exp(-t / max(d, 1e-4))
    if a > 0:
        e *= np.clip(t / a, 0, 1)
    return e


def place(bus: np.ndarray, x: np.ndarray, at: float, gain: float = 1.0, pan: float = 0.0) -> None:
    """Add mono x into a stereo bus starting at `at` seconds, equal-power pan (-1..1)."""
    i = int(round(at * SR))
    if i >= len(bus):
        return
    j = min(len(bus), i + len(x))
    x = x[: j - max(i, 0)] if i >= 0 else x[-i : j - i]
    i = max(i, 0)
    l = np.cos((pan + 1) * np.pi / 4)
    r = np.sin((pan + 1) * np.pi / 4)
    bus[i:j, 0] += x * gain * l * np.sqrt(2)
    bus[i:j, 1] += x * gain * r * np.sqrt(2)


def hz(midi: float) -> float:
    return 440.0 * 2 ** ((midi - 69) / 12)


NOTE = {n: i for i, n in enumerate(["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"])}


def m(name: str) -> int:
    """'F#3' -> MIDI number."""
    return 12 * (int(name[-1]) + 1) + NOTE[name[:-1]]


# ---------------------------------------------------------------- instruments
def epiano(f: float, dur: float, vel: float) -> np.ndarray:
    """A soft Rhodes-like FM tone: bell-ish attack, warm sustain."""
    n = int((dur + 1.6) * SR)
    t = t_(n)
    idx = 1.6 * np.exp(-t / 0.22) + 0.35
    body = np.sin(2 * np.pi * f * t + idx * np.sin(2 * np.pi * f * t))
    tine = 0.18 * np.sin(2 * np.pi * f * 7.02 * t) * np.exp(-t / 0.025)
    e = env(n, 0.004, 1.1)
    release = np.clip(1 - (t - dur) / 0.35, 0, 1)
    x = (body + tine) * e * release * vel
    return filt(x, "low", 3200)


def pluck(f: float, dur: float, vel: float) -> np.ndarray:
    """Nylon-string guitar: Karplus-Strong with a soft, filtered excitation."""
    n = int((dur + 0.8) * SR)
    p = max(2, int(round(SR / f)))
    burst = filt(RNG.uniform(-1, 1, p), "low", 2400 + 2000 * vel)
    x = np.zeros(n)
    x[:p] = burst
    g = 0.996
    a = np.zeros(p + 2)
    a[0] = 1
    a[p] = -g * 0.5
    a[p + 1] = -g * 0.5
    y = lfilter([1.0], a, x)
    y *= np.clip(1 - (t_(n) - dur) / 0.25, 0, 1)
    y = filt(y, "low", 3800)
    return y / (np.abs(y).max() + 1e-9) * vel


def bass(f: float, dur: float, vel: float) -> np.ndarray:
    n = int((dur + 0.2) * SR)
    t = t_(n)
    x = np.sin(2 * np.pi * f * t) + 0.25 * np.sin(4 * np.pi * f * t)
    x = np.tanh(1.4 * x) * env(n, 0.01, 0.9) * np.clip(1 - (t - dur) / 0.12, 0, 1)
    return filt(x * vel, "low", 380)


def kick(vel: float = 1.0) -> np.ndarray:
    n = int(0.42 * SR)
    t = t_(n)
    f = 46 + 70 * np.exp(-t / 0.035)
    ph = 2 * np.pi * np.cumsum(f) / SR
    x = np.sin(ph) * env(n, 0.002, 0.16)
    click = filt(RNG.normal(0, 1, n), "band", [800, 3000]) * np.exp(-t / 0.004) * 0.15
    return np.tanh(1.6 * (x + click)) * vel


def brush(vel: float = 1.0) -> np.ndarray:
    """A brushed snare: a soft swish of noise with a little body."""
    n = int(0.3 * SR)
    t = t_(n)
    nz = filt(RNG.normal(0, 1, n), "band", [1400, 7000]) * env(n, 0.006, 0.09)
    body = np.sin(2 * np.pi * 190 * t) * np.exp(-t / 0.05) * 0.4
    return (nz * 0.7 + body) * vel


def shaker(vel: float = 1.0) -> np.ndarray:
    n = int(0.09 * SR)
    nz = filt(RNG.normal(0, 1, n), "high", 5500, 3)
    return nz * env(n, 0.012, 0.025) * vel


# ---------------------------------------------------------------- sound effects
def sfx(kind: str, dur: float = 0.0) -> np.ndarray:
    if kind == "land":  # a sheet settling on the desk: a soft fwump of air and paper
        n = int(0.35 * SR)
        t = t_(n)
        air = filt(RNG.normal(0, 1, n), "band", [180, 1800]) * env(n, 0.03, 0.07)
        thud = np.sin(2 * np.pi * 85 * t) * env(n, 0.002, 0.05) * 0.5
        return air * 0.8 + thud
    if kind == "pin":  # a light tap as the pin lands
        n = int(0.18 * SR)
        t = t_(n)
        tap = filt(RNG.normal(0, 1, n), "band", [1500, 5000]) * np.exp(-t / 0.006)
        tone = np.sin(2 * np.pi * 880 * t) * np.exp(-t / 0.045) * 0.35
        return tap * 0.6 + tone
    if kind == "rustle":  # paper: many tiny crackles inside a breath of noise
        n = int(dur * SR)
        t = t_(n)
        shape = np.sin(np.pi * np.clip(t / dur, 0, 1)) ** 0.7
        bed = filt(RNG.normal(0, 1, n), "band", [600, 6500]) * 0.25
        crackle = np.zeros(n)
        for _ in range(int(140 * dur)):
            i = RNG.integers(0, n - 400)
            L = RNG.integers(60, 380)
            crackle[i : i + L] += RNG.normal(0, 1, L) * np.exp(-np.arange(L) / (L / 4)) * RNG.uniform(0.3, 1.2)
        crackle = filt(crackle, "band", [1200, 9000])
        return (bed + crackle) * shape
    if kind == "slide":  # the phone sliding off across the desk
        n = int(dur * SR)
        t = t_(n)
        shape = np.clip(t / (dur * 0.3), 0, 1) * np.clip((dur - t) / (dur * 0.5), 0, 1)
        return filt(RNG.normal(0, 1, n), "band", [250, 1400]) * shape * 0.8
    if kind == "thump":  # a rubber stamp (the same recipe the app plays on its Field Report)
        n = int(0.32 * SR)
        t = t_(n)
        f = 40 + 100 * np.exp(-t / 0.06)
        ph = 2 * np.pi * np.cumsum(f) / SR
        tri = 2 / np.pi * np.arcsin(np.sin(ph))
        smack = filt(RNG.normal(0, 1, n), "low", 1800) * np.exp(-t / 0.012) * 0.5
        return (tri * env(n, 0.002, 0.08) + smack) * 1.1
    if kind == "pencil":  # graphite on paper: grainy, band-limited scratch, down then up
        n = int(0.16 * SR)
        t = t_(n)
        grain = filt(RNG.normal(0, 1, n), "band", [2200, 8500]) * (0.5 + 0.5 * np.abs(RNG.normal(0, 1, n)))
        shape = np.interp(t, [0, 0.01, 0.06, 0.075, 0.13, 0.16], [0, 1, 0.55, 0.9, 0.7, 0])
        return grain * shape
    if kind == "shutter":  # two mechanical clicks
        n = int(0.16 * SR)
        t = t_(n)
        out = np.zeros(n)
        for at, g in ((0.0, 1.0), (0.055, 0.7)):
            i = int(at * SR)
            m_ = n - i
            tt = t_(m_)
            click = filt(RNG.normal(0, 1, m_), "band", [1800, 6000]) * np.exp(-tt / 0.004)
            ping = np.sin(2 * np.pi * 3100 * tt) * np.exp(-tt / 0.012) * 0.3
            body = np.sin(2 * np.pi * 240 * tt) * np.exp(-tt / 0.02) * 0.4
            out[i:] += (click + ping + body) * g
        return out
    if kind == "tick":  # a marker snapping onto a corner
        n = int(0.08 * SR)
        t = t_(n)
        return np.sin(2 * np.pi * 2400 * t) * np.exp(-t / 0.012) * 0.6
    raise ValueError(kind)


SFX_GAIN = {"land": 0.3, "pin": 0.2, "rustle": 0.16, "slide": 0.15, "thump": 0.5, "pencil": 0.17, "shutter": 0.3, "tick": 0.1}
SFX_PAN = {"pencil": 0.15, "slide": -0.5, "tick": 0.2}


# ---------------------------------------------------------------- the music
def music() -> np.ndarray:
    bus = np.zeros((N + SR, 2))
    bar = 4 * BEAT
    # One chord per bar; the last bar splits, then the tonic rings out under the held frame.
    chords = [
        (0 * bar, ["D3", "A3", "C#4", "E4", "F#4"], "D2"),  # Dmaj9
        (1 * bar, ["B2", "F#3", "A3", "C#4", "D4"], "B1"),  # Bm9
        (2 * bar, ["G2", "D3", "F#3", "A3", "B3"], "G1"),  # Gmaj9
        (3 * bar, ["E3", "G3", "B3", "D4", "F#4"], "E2"),  # Em9
        (4 * bar, ["A2", "E3", "G3", "B3", "D4"], "A1"),  # A7sus
        (5 * bar, ["G2", "D3", "F#3", "A3", "B3"], "G1"),  # Gmaj9
        (5 * bar + 2 * BEAT, ["A2", "E3", "G3", "C#4", "E4"], "A1"),  # A13
        (6 * bar, ["D3", "A3", "C#4", "E4", "F#4"], "D2"),  # Dmaj9, held to the end
    ]
    swing = BEAT * 0.06
    for ci, (at, notes, root) in enumerate(chords):
        nxt = chords[ci + 1][0] if ci + 1 < len(chords) else DUR
        span = nxt - at
        last = ci == len(chords) - 1
        # Keys: on the one, then a lighter push on the "and" of two and four.
        hits = [(0.0, 0.8, span - 0.05)] if last else [(0.0, 0.75, 0.85), (1.5 * BEAT + swing, 0.45, 0.5), (3.5 * BEAT + swing, 0.38, 0.4)]
        for off, vel, d in hits:
            if off >= span:
                continue
            for k, nm in enumerate(notes):
                spread = k * 0.008  # a hand rolls a chord, it doesn't hit it all at once
                place(bus, epiano(hz(m(nm)), d, vel * 0.22), at + off + spread, pan=-0.25 + 0.12 * k)
        # Guitar: 8th-note arpeggio an octave up, swung and humanised.
        if not last:
            order = [0, 2, 1, 3, 2, 4, 3, 1]
            steps = int(round(span / (BEAT / 2)))
            for s in range(steps):
                nm = notes[order[s % 8]]
                off = s * BEAT / 2 + (swing if s % 2 else 0) + RNG.normal(0, 0.004)
                v = (0.55 if s % 2 == 0 else 0.4) * RNG.uniform(0.85, 1.05)
                place(bus, pluck(hz(m(nm) + 12), BEAT * 0.9, v * 0.26), at + off, pan=0.35)
        else:
            for k, nm in enumerate(notes[1:]):
                place(bus, pluck(hz(m(nm) + 12), 0.6, 0.22), at + 0.05 + k * 0.045, pan=0.35)
        # Bass: root on one, a softer one on three.
        place(bus, bass(hz(m(root)), min(span, 1.1) if not last else 0.6, 0.55), at, pan=0)
        if span >= 3 * BEAT and not last:
            place(bus, bass(hz(m(root)), 0.45, 0.4), at + 2 * BEAT, pan=0)

    # Drums come in with the printing (bar 2) and step out for the end card.
    end = CUES["beats"]["end"]
    t = 0.0
    beat = 0
    while t < DUR:
        if bar <= t < end - 0.05:
            pos = beat % 4
            if pos == 0:
                place(bus, kick(0.85), t, gain=0.5)
            if pos == 2:
                place(bus, kick(0.6), t + BEAT / 2 + swing, gain=0.5)
            if pos in (1, 3):
                place(bus, brush(0.8), t, gain=0.3, pan=-0.1)
        if 0.6 <= t < end + 0.6:
            for half in (0, 1):
                tt = t + half * (BEAT / 2 + (swing if half else 0))
                place(bus, shaker(0.9 if half == 0 else 0.6), tt, gain=0.16, pan=0.45)
        t += BEAT
        beat += 1

    x = bus[:N]
    # Tape warmth: gentle saturation and a soft top.
    x = np.tanh(x * 1.3) / 1.3
    x = np.stack([filt(x[:, c], "low", 9000) for c in (0, 1)], axis=1)
    return x


# ---------------------------------------------------------------- voice, captions, mix
def voice() -> tuple[np.ndarray, list]:
    meta = json.loads((ROOT / "build" / "vo" / "lines.json").read_text())["lines"]
    bus = np.zeros((N + SR, 2))
    placed = []
    for v in CUES["vo"]:
        clip, sr = sf.read(ROOT / "build" / "vo" / f"line-{v['line']}.wav")
        clip = resample_poly(clip, SR, sr)
        # A touch of warmth and presence: trim the rumble, lift 3 kHz a little.
        clip = filt(clip, "high", 80)
        clip = clip + 0.25 * filt(clip, "band", [2500, 5000])
        place(bus, clip, v["at"])
        line = next(m_ for m_ in meta if m_["line"] == v["line"])
        placed.append((v["at"], v["at"] + len(clip) / SR, line["text"]))
    return bus[:N], placed


def duck(vo: np.ndarray, depth_db: float = 10.0) -> np.ndarray:
    """Gain curve for the music: down by depth_db while the voice speaks, smooth in and out."""
    level = np.abs(vo).max(axis=1)
    win = int(0.02 * SR)
    level = np.convolve(level, np.ones(win) / win, mode="same")
    talking = (level > 0.01).astype(float)
    # Hold through the gaps between words, then smooth: 60 ms in, 300 ms out.
    hold = int(0.25 * SR)
    talking = np.convolve(talking, np.ones(hold), mode="same") > 0
    g = np.where(talking, 10 ** (-depth_db / 20), 1.0)
    out = np.empty_like(g)
    a_att = np.exp(-1 / (0.06 * SR))
    a_rel = np.exp(-1 / (0.3 * SR))
    y = 1.0
    for i, target in enumerate(g):
        a = a_att if target < y else a_rel
        y = a * y + (1 - a) * target
        out[i] = y
    return out[:, None]


def limiter(x: np.ndarray, ceiling: float) -> np.ndarray:
    """Gain curve that keeps 4x-oversampled peaks under the ceiling: 2 ms look-ahead, 80 ms release."""
    peak = np.abs(resample_poly(x, 4, 1, axis=0)).max(axis=1).reshape(-1, 4).max(axis=1)[: len(x)]
    need = np.minimum(1.0, ceiling / np.maximum(peak, 1e-9))
    win = int(0.002 * SR)
    padded = np.concatenate([need, np.ones(win)])
    ahead = np.array([padded[i : i + win].min() for i in range(0, len(need))]) if need.min() < 1 else need
    out = np.empty_like(ahead)
    rel = np.exp(-1 / (0.08 * SR))
    y = 1.0
    for i, target in enumerate(ahead):
        y = target if target < y else rel * y + (1 - rel) * target
        out[i] = y
    return out[:, None]


def srt(placed: list) -> str:
    def ts(s: float) -> str:
        ms = int(round(s * 1000))
        return f"{ms // 3600000:02d}:{ms // 60000 % 60:02d}:{ms // 1000 % 60:02d},{ms % 1000:03d}"

    blocks = []
    for i, (a, b, text) in enumerate(placed, start=1):
        end = min(b + 0.35, placed[i][0] - 0.08) if i < len(placed) else DUR
        blocks.append(f"{i}\n{ts(a)} --> {ts(end)}\n{text}\n")
    return "\n".join(blocks)


def main() -> None:
    out = ROOT / "out"
    out.mkdir(exist_ok=True)
    vo, placed = voice()
    mus = music()
    mus *= duck(vo, 10.0)

    fx = np.zeros((N + SR, 2))
    for e in CUES["sfx"]:
        x = sfx(e["kind"], e.get("dur", 0.0))
        x = x / (np.abs(x).max() + 1e-9)
        # Line the effect's loudest moment up with its cue (long rustles start on theirs).
        peak = 0 if e["kind"] in ("rustle", "slide") else int(np.argmax(np.abs(x))) / SR
        place(fx, x, e["at"] - peak, gain=SFX_GAIN[e["kind"]], pan=SFX_PAN.get(e["kind"], 0.0))
    fx = fx[:N]

    # Levels: voice on top, music a bed under it, effects in between.
    mus *= 0.15
    bed = mus + fx
    mix = vo + bed
    # Fade only the last 60 ms so the file doesn't click off.
    fade = np.ones((N, 1))
    k = int(0.06 * SR)
    fade[-k:, 0] = np.linspace(1, 0, k)
    mix *= fade
    bed *= fade
    vo_out = vo * fade

    meter = pyln.Meter(SR)
    ceiling = 10 ** (-1.0 / 20)
    total = 1.0
    for _ in range(4):
        # Normalise to -16 LUFS, then hold true peaks under -1 dBTP; repeat until both hold.
        g = 10 ** ((-16.0 - meter.integrated_loudness(mix * total)) / 20)
        total *= g
        lim = limiter(mix * total, ceiling)
        if abs(meter.integrated_loudness(mix * total * lim) + 16.0) < 0.1:
            break
    mix, bed, vo_out = mix * total * lim, bed * total * lim, vo_out * total * lim
    lufs = meter.integrated_loudness(mix)
    tp = 20 * np.log10(np.abs(resample_poly(mix, 4, 1, axis=0)).max())

    sf.write(out / "paper-trail-mix.wav", mix, SR, subtype="PCM_24")
    sf.write(out / "paper-trail-vo.wav", vo_out, SR, subtype="PCM_24")
    sf.write(out / "paper-trail-music-sfx.wav", bed, SR, subtype="PCM_24")
    (out / "paper-trail.srt").write_text(srt(placed))
    print(f"mix: {lufs:.1f} LUFS integrated, true peak {tp:.1f} dBTP, {len(mix) / SR:.2f}s")
    # How the voice sits over the bed: RMS while talking vs. not.
    talk = duck(vo, 10.0)[:, 0] < 0.99
    rms = lambda x: 20 * np.log10(np.sqrt(np.mean(x**2)) + 1e-12)  # noqa: E731
    mus_only = mus * total * lim * fade
    print(
        f"voice {rms(vo_out[talk]):.1f} dB | music under voice {rms(mus_only[talk]):.1f} dB, "
        f"music alone {rms(mus_only[~talk]):.1f} dB | effects+music under voice {rms(bed[talk]):.1f} dB"
    )


if __name__ == "__main__":
    main()

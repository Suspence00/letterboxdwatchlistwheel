"""Synthesize the original 30-second promo score; no packages or source audio needed."""

from array import array
import math
from pathlib import Path
import random
import struct
import wave


ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "media" / "promo" / "wheel-promo.wav"
RATE = 48000
SECONDS = 30
SIZE = RATE * SECONDS
TAU = math.tau
LEFT = array("f", [0.0]) * SIZE
RIGHT = array("f", [0.0]) * SIZE
RANDOM = random.Random(861)


def mix(start, values, volume=1.0, pan=0.0, echo=0.0):
    """Equal-power pan with optional restrained stereo quarter-note echo."""
    offset = round(start * RATE)
    gain_l = math.sqrt((1 - pan) / 2) * volume
    gain_r = math.sqrt((1 + pan) / 2) * volume
    delay = round(0.25 * RATE)
    for index, value in enumerate(values):
        target = offset + index
        if 0 <= target < SIZE:
            LEFT[target] += value * gain_l
            RIGHT[target] += value * gain_r
        target += delay
        if echo and 0 <= target < SIZE:
            LEFT[target] += value * gain_r * echo
            RIGHT[target] += value * gain_l * echo


def note(frequency, length, kind="bell"):
    count = round(length * RATE)
    values = array("f")
    for index in range(count):
        time = index / RATE
        phase = TAU * frequency * time
        release = min(1.0, (length - time) / 0.06)
        if kind == "bass":
            envelope = min(1.0, time / 0.008) * math.exp(-time * 6) * release
            signal = math.sin(phase) + 0.22 * math.sin(phase * 2) + 0.08 * math.sin(phase * 3)
        elif kind == "pad":
            envelope = min(1.0, time / 0.35) * min(1.0, (length - time) / 0.65)
            signal = (math.sin(phase) + 0.28 * math.sin(phase * 1.003)
                      + 0.18 * math.sin(phase * 2)) / 1.46
        else:
            envelope = min(1.0, time / 0.004) * math.exp(-time * 4.3) * release
            signal = math.sin(phase) + 0.25 * math.sin(phase * 2) * math.exp(-time * 9)
        values.append(signal * envelope)
    return values


def kick(length=0.32):
    values = array("f")
    for index in range(round(length * RATE)):
        time = index / RATE
        phase = TAU * (46 * time + 3.1 * (1 - math.exp(-time * 33)))
        envelope = min(1.0, time / 0.002) * math.exp(-time * 15)
        click = (RANDOM.random() * 2 - 1) * math.exp(-time * 180) * 0.12
        values.append(math.sin(phase) * envelope + click)
    return values


def percussion(length, decay, tone=0):
    values = array("f")
    previous = 0.0
    for index in range(round(length * RATE)):
        time = index / RATE
        noise = RANDOM.random() * 2 - 1
        signal = noise - previous * 0.88
        previous = noise
        if tone:
            signal = signal * 0.7 + math.sin(TAU * tone * time) * 0.3
        values.append(signal * min(1.0, time / 0.001) * math.exp(-time * decay))
    return values


# A restrained 120 BPM bed: D minor / Bb / F / C, resolving into F major.
chords = [
    (0, [146.832, 174.614, 220.000, 261.626]),
    (2, [116.541, 146.832, 174.614, 220.000]),
    (4, [130.813, 174.614, 220.000, 261.626]),
    (6, [130.813, 164.814, 195.998, 246.942]),
    (8, [146.832, 174.614, 220.000, 261.626]),
    (10, [116.541, 146.832, 174.614, 220.000]),
    (12, [130.813, 164.814, 195.998, 246.942]),
    (14, [116.541, 146.832, 174.614, 220.000]),
    (16, [130.813, 164.814, 195.998, 246.942]),
    (18, [146.832, 174.614, 220.000, 261.626]),
    (20, [116.541, 146.832, 174.614, 220.000]),
    (23, [174.614, 220.000, 261.626, 329.628]),
    (26, [130.813, 174.614, 220.000, 261.626]),
    (28, [174.614, 220.000, 261.626, 349.228]),
]
for start, frequencies in chords:
    length = 3.1 if start in [20, 23] else 2.7
    for index, frequency in enumerate(frequencies):
        mix(start, note(frequency, length, "pad"), 0.075, (index - 1.5) * 0.35)

bass_roots = [73.416, 58.270, 87.307, 65.406, 73.416, 58.270, 65.406]
for beat in range(26):
    start = beat * 0.5
    frequency = bass_roots[min(beat // 4, len(bass_roots) - 1)]
    mix(start, note(frequency, 0.40, "bass"), 0.25)
    if beat % 2 == 0:
        mix(start, kick(), 0.47)
    else:
        mix(start, percussion(0.15, 30, 185), 0.13, 0.05, 0.12)
    mix(start + 0.25, percussion(0.055, 65), 0.035, -0.35)

# Sparse glassy notes leave room for typography and wheel transients.
motif = [293.665, 349.228, 440.000, 523.251, 440.000, 349.228, 329.628, 391.995]
for index, frequency in enumerate(motif):
    mix(0.25 + index * 0.75, note(frequency, 1.05), 0.095, (-1) ** index * 0.4, 0.32)
for index, frequency in enumerate([293.665, 349.228, 440.000, 523.251, 587.330, 698.456]):
    mix(8.25 + index * 0.5, note(frequency, 0.7), 0.07, (-1) ** index * 0.3, 0.22)

# Accelerating mechanical flapper clicks, then slowing into the selection.
time = 8.0
while time < 11.8:
    progress = (time - 8.0) / 3.8
    mix(time, percussion(0.042, 105, 1450), 0.09, 0.2 * math.sin(time * 3))
    time += 0.17 - progress * 0.11
for time in [11.86, 11.95, 12.06, 12.20, 12.37, 12.57, 12.82]:
    mix(time, percussion(0.055, 90, 1300), 0.10)
# Five soft knockout impacts synced to the visual rotor eliminations.
for index, time in enumerate([13.65, 14.40, 15.15, 15.90, 16.65]):
    mix(time, kick(0.45), 0.38 + index * 0.015)
    mix(time, note(130.813 * (1 + index * 0.12), 0.65), 0.08, (-1) ** index * 0.3, 0.3)
    mix(time + 0.02, percussion(0.17, 35), 0.085, 0, 0.12)

# Wheelchinko gets lightly panned wooden peg clicks over a restrained pulse.
for beat in range(10):
    time = 18 + beat * 0.5
    mix(time, note(73.416 if beat < 4 else 58.270, 0.4, "bass"), 0.18)
    if beat % 2 == 0:
        mix(time, kick(), 0.28)
    mix(time + 0.25, percussion(0.04, 80), 0.018, -0.3)
for index in range(25):
    time = 18.1 + index * 0.18 + math.sin(index * 1.7) * 0.025
    mix(time, percussion(0.04, 115, 1600 + index % 5 * 170), 0.052,
        math.sin(index * 1.1) * 0.48)

# Bright reveal arpeggio and resumed groove for the closing call to action.
for index, frequency in enumerate([349.228, 440.000, 523.251, 659.255, 698.456]):
    mix(23 + index * 0.09, note(frequency, 1.7), 0.14, (index - 2) * 0.23, 0.26)
mix(23, kick(0.45), 0.48)
mix(23, percussion(1.2, 6), 0.08, 0.1, 0.3)
for beat in range(6):
    time = 23.5 + beat * 0.5
    mix(time, note(87.307 if beat < 4 else 65.406, 0.42, "bass"), 0.24)
    mix(time, kick() if beat % 2 == 1 else percussion(0.15, 30, 185), 0.3 if beat % 2 else 0.12)
    mix(time + 0.25, percussion(0.055, 65), 0.035, -0.3)
for index, frequency in enumerate([349.228, 440.000, 523.251, 698.456]):
    mix(26 + index * 0.125, note(frequency, 2.0), 0.11, (index - 1.5) * 0.3, 0.3)
mix(26, kick(0.4), 0.4)
mix(28, note(87.307, 1.5, "bass"), 0.22)
mix(28, note(698.456, 2), 0.11, 0.15, 0.25)

# Light soft saturation, gentle entry, and a clean tail before normalizing.
peak = 0.0
sum_squared = 0.0
for index in range(SIZE):
    time = index / RATE
    fade = min(1.0, time / 0.018) * min(1.0, (SECONDS - time) / 1.3)
    LEFT[index] = math.tanh(LEFT[index] * 1.08) * fade
    RIGHT[index] = math.tanh(RIGHT[index] * 1.08) * fade
    peak = max(peak, abs(LEFT[index]), abs(RIGHT[index]))
gain = 10 ** (-1.2 / 20) / peak
samples = bytearray(SIZE * 4)
for index in range(SIZE):
    left = LEFT[index] * gain
    right = RIGHT[index] * gain
    sum_squared += left * left + right * right
    struct.pack_into("<hh", samples, index * 4, round(left * 32767), round(right * 32767))
OUTPUT.parent.mkdir(parents=True, exist_ok=True)
with wave.open(str(OUTPUT), "wb") as audio:
    audio.setnchannels(2)
    audio.setsampwidth(2)
    audio.setframerate(RATE)
    audio.writeframes(samples)
rms = math.sqrt(sum_squared / (SIZE * 2))
print(f"Created {OUTPUT}")
print(f"{SECONDS}s | {RATE} Hz | stereo | PCM 16-bit | peak -1.2 dBFS | RMS {20 * math.log10(rms):.1f} dBFS")

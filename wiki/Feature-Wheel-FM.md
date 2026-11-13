# Feature: Wheel.FM & Audio Synthesis

**Wheel.FM** is the integrated audio suite for the Letterboxd Watchlist Wheel. It pairs a background radio player with real-time procedural sound effects synthesized directly via the Web Audio API.

---

## 1. Playback Bar

The Wheel.FM bar stays at the bottom of the screen on desktop and mobile. The current track and previous, play/pause, and next buttons are always visible on the main page.

Open **Options** to choose a channel or track, seek, and adjust volume. Press Escape or click elsewhere to close the panel. Music continues while you use the wheel or switch wheels.

---

## 2. Multi-Channel Support & Custom Playlists

Wheel.FM broadcasts tracks defined in `wheel-fm/playlist.json`. It supports multiple themed broadcast channels as well as legacy flat playlists.

### Channel Dictionary Format (`playlist.json`)

To organize your audio library into distinct channels (e.g. ambient backgrounds, retro synthwave, or tension builders), use the channel map structure:

```json
{
  "Synthwave Lounge": [
    {
      "title": "Midnight Drive",
      "artist": "RetroWave",
      "file": "wheel-fm/tracks/midnight-drive.mp3"
    },
    {
      "title": "Neon Skyline",
      "artist": "Arcade Dreams",
      "file": "wheel-fm/tracks/neon-skyline.mp3"
    }
  ],
  "Cinema Suspense": [
    {
      "title": "Countdown to Reel",
      "artist": "Orchestral Hall",
      "file": "wheel-fm/tracks/countdown.mp3"
    }
  ]
}
```

### Legacy Flat Format Support
If your `playlist.json` uses a single flat array of track objects, Wheel.FM automatically wraps it into a **"Default Mix"** channel with full compatibility:

```json
[
  {
    "title": "Epic Spin Music",
    "artist": "Soundtrack Ensemble",
    "file": "wheel-fm/epic-spin.mp3"
  }
]
```

### Channel Selection & Switching
* The **Channel** dropdown menu lists all channels detected in `playlist.json`.
* Selecting a new channel instantly loads its track listing, pauses current audio, sets the first track, and updates the playlist status banner.

---

## 3. Player Controls & Seek Scrubber

Wheel.FM provides high-fidelity audio controls:

* **Transport Controls**:
  * **Play / Pause**: Starts or pauses audio. The button displays and announces the action you can take.
  * **Previous / Next Track**: Skips backward or forward. Reaching the end of the playlist wraps automatically back to track one.
* **Volume Slider**: Smooth range slider (0% to 100%).
* **Interactive Seek Scrubber**:
  * Precision range slider with 0.1% step resolution.
  * Dragging the slider previews current scrub position in the elapsed timestamp without audio hitching.
  * Releasing jumps playback directly to the desired second.
* **Time Display**: Real-time dual display showing current elapsed time (`0:00`) alongside total track duration (`0:00`).
* **Track Metadata Display**: Displays the current track title and artist name with automatic truncation and fallback labels.

> [!NOTE]
> **Browser Autoplay Policies**: Modern browsers prohibit audio playback until the user has interacted with the document (such as clicking or pressing a key). If playback is blocked, Wheel.FM gracefully sets its status to `Ready to play. Playback was blocked.` until you click Play.

---

## 4. Procedural Web Audio API Sound Effects

Beyond background music, the wheel engine uses the native browser **Web Audio API** to generate low-latency procedural sound effects—without relying on static audio files or external downloads.

| Sound Effect | Function | Synthesis Specifications | Acoustic Description |
| :--- | :--- | :--- | :--- |
| **Mechanical Tick** | `playTickSound()` | Triangle oscillator at **600 Hz** with rapid 120ms exponential gain decay. | Simulates the tactile peg-and-flapper clicking of a physical carnival prize wheel passing each slice. |
| **Win Chime Chord** | `playWinSound()` | Staggered triad of sine oscillators: $C_5$ (**523.25 Hz**), $E_5$ (**659.25 Hz**), and $G_5$ (**783.99 Hz**) spaced 120ms apart with smooth 450ms exponential release. | A celebratory, melodic major chord arpeggio that rings out when a winning title is chosen. |
| **Knockout Elimination** | `playKnockoutSound()` | Sawtooth oscillator with exponential frequency sweep from **520 Hz down to 220 Hz** over 400ms, decaying over 500ms. | A punchy, retro arcade pitch down-sweep signaling that a film has been knocked off the wheel. |

### Sound Effects Mute Toggle
You can mute or unmute procedural wheel sound effects at any time using the sound toggle icon button near the wheel controls. Muting wheel sound effects does not affect Wheel.FM background music playback, allowing you to spin in quiet mode while keeping background music rolling.

---

## Related Documentation

* **[User Guide](User-Guide)**: Using controls and spinning the wheel.
* **[Feature: Knockout Mode](Feature-Knockout-Mode)**: The elimination game mode and knockout sound triggers.
* **[Developer Guide](Developer-Guide)**: Architectural details on audio synthesis and ES modules.

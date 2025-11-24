# Feature: Wheel.FM

**Wheel.FM** is the built-in audio player that resides below the wheel. It allows you to play background music or sound effects to enhance the spinning experience.

## How to Use

1.  **Controls:** Use the Play/Pause, Next, and Previous buttons to control playback.
2.  **Volume:** Adjust the volume slider to your preference.
3.  **Minimize:** You can minimize the player if you want to save screen space.

## Adding Your Own Music

Wheel.FM is designed to play local MP3 files.

1.  **Add Files:** Place your `.mp3` files into the `wheel-fm/` folder in the project directory.
2.  **Update Playlist:** Open `wheel-fm/playlist.json` in a text editor.
3.  **Add Entries:** Add a new JSON object for each song you added.

### Example `playlist.json`

```json
[
  {
    "title": "Epic Spin Music",
    "artist": "My Band",
    "file": "wheel-fm/epic-spin.mp3"
  },
  {
    "title": "Suspense Track",
    "artist": "Unknown",
    "file": "wheel-fm/suspense.mp3"
  }
]
```

> [!TIP]
> The paths in the `file` property should be relative to the `index.html` file.

## Troubleshooting
*   **Autoplay:** Browsers often block audio from playing automatically. You may need to interact with the page (click anywhere) before the audio can start.
*   **Format:** Ensure your audio files are standard MP3s.

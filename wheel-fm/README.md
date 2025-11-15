# Wheel.FM playlist

Drop MP3 files in this folder and list them in `playlist.json` so the in-app player can find them. Each entry in the JSON array
should look like:

```
{
  "title": "Song title",
  "artist": "Artist name",
  "file": "wheel-fm/song-file.mp3"
}
```

The `file` value can point to any publicly reachable MP3, but keeping the audio inside this folder ensures offline access. You
can reorder entries to control the default play sequence.

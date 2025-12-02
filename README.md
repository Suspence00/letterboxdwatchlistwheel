# Letterboxd Watchlist Wheel

Give your Letterboxd watchlist a dramatic spin to decide what to watch next. Pure HTML/CSS/JS—no build step.

## Live demo

[https://wheel.sensei.lol](https://wheel.sensei.lol)

## What it does

- Import directly from a Letterboxd list/username (via a tiny Cloudflare Worker proxy) or upload a CSV.
- Curate before you spin: select/clear all, add custom entries, tweak colors and weights, and sort by name or weight.
- Save or move your setup: export movies/weights/history as a `.wheel` file or clipboard string, then import to reapply weights onto a fresh Letterboxd list or fully restore the wheel.
- Spin modes: single-spin, knockout elimination, or Random Boost (even odds, then boost the winner).
- History modal shows past winners with mode labels; Wheel.FM audio player for background tunes.

## Quick start

1. Open `index.html` locally or host the folder on any static site.
2. Import your list (Letterboxd URL/username or CSV). A sample file (`sample-watchlist.csv`) is included.
3. Pick your mode and press **Spin**. Slice colors/weights save in localStorage automatically.
4. Optional: open **Advanced options → Export or import your wheel** to download a `.wheel` backup or paste one to reuse weights/history.

## Wheel.FM playlist (optional)

1. Drop MP3s into `wheel-fm/`.
2. List them in `wheel-fm/playlist.json`:

   ```json
   [
     { "title": "Song title", "artist": "Artist name", "file": "wheel-fm/song-file.mp3" }
   ]
   ```

## License

MIT—see [`LICENSE`](LICENSE).

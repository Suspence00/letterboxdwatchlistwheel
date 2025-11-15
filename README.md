# Letterboxd Watchlist Wheel

Give your Letterboxd watchlist a dramatic spin to decide what to watch next. The app now supports importing picks straight from Letterboxd or from CSV exports, all with zero build tooling.

## Features

- **Direct Letterboxd import** – Paste any Letterboxd list or username to pull titles directly through the project’s Cloudflare Worker proxy. (Proxy feature by [@cwbcode](https://github.com/cwbcode).)
- **CSV upload fallback** – Prefer working with files? Upload any Letterboxd-exported CSV and curate the movies before you spin.
- **Download helper shortcut** – Launch the community “lizard” CSV generator in a new tab whenever you need a fresh export.
- **Curate your picks** – Toggle individual films on or off before each spin, or select/clear the whole list in one click.
- **Dynamic wheel** – A colorful wheel updates in real time as you adjust your selection.
- **Movie Knockout mode** – Enable knockout spins to automatically eliminate picks until a single winner remains, tuned for a brisk cadence by default.
- **Sound and animation** – Arcade-style ticking while the wheel spins, followed by a celebratory chime when a movie is chosen.
- **Wheel.FM radio** – Drop MP3 files into `wheel-fm/`, list them in `playlist.json`, and let the built-in mini player set the vibes while you spin.
- **No build step** – Pure HTML, CSS, and vanilla JavaScript that you can drop onto GitHub Pages or any static host.

## Getting started

1. Clone or download this repository and open `index.html` in your browser (or host the contents on any static site platform).
2. Choose your import path:
   - Paste a Letterboxd list URL or username into **Import directly from Letterboxd** and let the app fetch the titles for you.
   - Upload a CSV export via **Upload a CSV instead**, or follow the **Open download helper** button to generate one on the lizard tool.
3. Tweak the selection if needed, then press **Spin the wheel**. Open the advanced options to enable **Last movie standing** for an automatic knockout showdown.

A small sample file (`sample-watchlist.csv`) is included for quick testing.

## Wheel.FM playlist

1. Add your MP3 files to the `wheel-fm/` folder.
2. Edit `wheel-fm/playlist.json` and include an entry for each track:

   ```json
   [
     {
       "title": "Song title",
       "artist": "Artist name",
       "file": "wheel-fm/song-file.mp3"
     }
   ]
   ```

3. Reload the page. The Wheel.FM player below the wheel will read the playlist and let you play, pause, skip, and scrub through the audio.

## Acknowledgements

- Cloudflare Worker proxy provided by [@cwbcode](https://github.com/cwbcode).

## License

Released under the MIT License. See [`LICENSE`](LICENSE) for details.

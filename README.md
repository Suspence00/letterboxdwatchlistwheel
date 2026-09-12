# Letterboxd Watchlist Wheel

Give your Letterboxd watchlist a dramatic spin to decide what to watch next. Pure HTML/CSS/JS—no build step.

## Live demo

[https://wheel.sensei.lol](https://wheel.sensei.lol)

## What it does

- Import directly from a Letterboxd list/username (via a tiny Cloudflare Worker proxy) or upload a CSV.
- Curate before you spin: select/clear all, add custom entries, tweak colors and weights, and sort by name or weight.
- Save or move your setup: export movies/weights/history as a `.wheel` file or clipboard string, then import to reapply weights onto a fresh Letterboxd list or fully restore the wheel.
- Spin modes: single-spin, knockout elimination, or Random Boost (even odds, then boost the winner).
- VHS wheel: dimensional sleeves with movie artwork, a ten-tape lineup, and a focused movie-night stage.
- History modal shows past winners with mode labels; Wheel.FM audio player for background tunes.

## Quick start

1. Open `index.html` locally or host the folder on any static site.
2. Import your list (Letterboxd URL/username or CSV). A sample file (`sample-watchlist.csv`) is included.
3. Pick your mode and press **Spin**. Slice colors/weights save in localStorage automatically.
4. Optional: open **Advanced options → Export or import your wheel** to download a `.wheel` backup or paste one to reuse weights/history.

## VHS wheel and focus mode

VHS tapes are the default wheel style; choose **Classic wheel** to display the entire selection as slices.

- **1 Spin Mode:** up to ten eligible movies are drawn uniformly without replacement. Inspect a tape to see its odds or edit its weight. For larger lists, pin favorites and use **Draw another 10** to replace the unpinned tapes. Weights determine the winner within the displayed lineup; they do not affect the draw. Movies outside that lineup cannot win the current spin. Pins and lineups last for the current page session.
- **Knockout Mode:** every eligible movie enters. Large lists use fast weighted eliminations until ten remain, then switch to the VHS finale. Higher weights reduce elimination risk throughout.
- **Random Boost:** every eligible movie participates with equal odds. Original weights are restored before the winner receives its boost.

Spinning moves the live wheel into a focused stage and hides the surrounding page. **Exit focus** or Escape returns to the page while the spin continues; editing stays locked until it finishes. Closing the winner dialog restores the page position and controls. Reduced-motion preferences skip the spinning animation.

Poster artwork is loaded only for visible tapes and winners through the existing OMDb lookup. Missing artwork uses a labeled VHS sleeve. The wheel uses CSS 3D transforms and requires no additional libraries.

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

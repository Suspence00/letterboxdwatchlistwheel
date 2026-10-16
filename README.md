# Letterboxd Watchlist Wheel

Give your Letterboxd watchlist a dramatic spin (or pegboard drop!) to decide what to watch next. Pure HTML/CSS/JS—no build step.

## Live demo

[https://wheel.sensei.lol](https://wheel.sensei.lol)

## What it does

- **Import & Sync:** Import directly from a Letterboxd list/username (supports paginated watchlists and append/sync mode) or upload a CSV / bulk text list.
- **Multiple Boards (Workspaces):** Maintain separate watchlists, themes, weights, and histories for different movie nights or groups.
- **Curate & Boost:** Select/clear all, add custom entries, tweak slice colors and weights, sort/search, or use the **Boost Station** to track contributor boosts with custom tag colors.
- **Spin Modes:**
  - **Knockout Elimination:** Every eligible movie enters; higher weights reduce elimination risk until one champion remains.
  - **1 Spin Mode:** Single weighted spin to pick a winner immediately.
  - **Wheelchinko:** Physics-driven Plinko pegboard with three game styles:
    - **Random 10:** Aim and drop a puck into 10 randomly sampled movie slots.
    - **Elimination:** Multi-puck Battle Royale supporting up to 100 contenders on the board simultaneously, narrowing down to a single-puck Final 10 showdown.
    - **Spinchinko:** Drop 10 golden pucks to qualify 10 finalists, then launch directly into a 3D VHS Knockout or 1 Spin wheel showdown.
  - **Random Boost:** Even odds for every movie to win a +1 weight boost.
- **3D VHS Wheel & Theater Mode:** Dimensional VHS cassette sleeves with movie poster artwork (configurable capacity up to **250 3D tapes** or Classic 2D slice wheel) and a focused full-window Theater stage.
- **Themes & Integrations:** Built-in visual themes, fairness verification simulator, `.wheel` backup/restore, **Wheel.FM** background radio player, **Discord webhook** winner announcements, and **Radarr** integration.

## Quick start

1. Open `index.html` via any local static server (or host the folder on any static site).
2. Import your list (Letterboxd URL/username, CSV upload, or bulk entry). A sample file (`sample-watchlist.csv`) is included.
3. Pick your spin mode (**Knockout**, **1 Spin**, or **Wheelchinko**) and press **Spin** / **Drop Puck**. Everything saves per board in `localStorage` automatically.
4. Optional: open **Settings** to switch boards, change themes, adjust 3D VHS tape capacity, configure Discord/Radarr, or export/restore a `.wheel` backup.

## 3D VHS wheel and Theater mode

VHS tapes are the default wheel style (up to 250 tapes on the rotor by default, configurable in **Settings** or the stage controls); choose **Classic wheel** to display the entire selection as 2D slices.

- **1 Spin Mode:** Up to the configured tape capacity (default 250) is drawn uniformly without replacement. Inspect a tape to see its odds or edit its weight. When your list exceeds the tape capacity, pin favorites and use **Draw another N** to replace unpinned tapes.
- **Knockout Mode:** Every eligible movie enters. Lists larger than the configured VHS capacity use fast weighted eliminations first, then transition to the 3D VHS finale. Higher weights reduce elimination risk throughout.
- **Wheelchinko & Spinchinko:** Drop pucks through the pegboard into VHS/poster slots, or qualify 10 finalists with Golden Pucks and spin the 3D VHS wheel for the championship.

Spinning moves the live stage into **Theater Mode** and hides the surrounding page. **Exit focus** or `Escape` returns to the page while the spin continues. Reduced-motion preferences skip rapid spinning animations.

Poster artwork is loaded on demand for visible tapes, Wheelchinko slots, and winners. Missing artwork falls back to a labeled VHS sleeve.

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

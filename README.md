# Letterboxd Watchlist Wheel

Turn your Letterboxd watchlist export into a dramatic wheel spin that chooses what you should watch next. This project is a fully client-side site that you can host on GitHub Pages (or any static host).

## Features

- **CSV import** – Upload the `watchlist.csv` that Letterboxd gives you and automatically load every title.
- **Curate your picks** – Toggle individual films on or off before each spin. You can also select or clear the whole list in a click.
- **Dynamic wheel** – A colorful wheel updates in real-time as you adjust your selection.
- **Movie Knockout mode** – Flip on the knockout spinner to automatically eliminate picks until a single winner remains, now tuned for a brisk rapid cadence by default.
- **Sound and animation** – Arcade-style ticking while the wheel spins, followed by a celebratory chime when a movie is chosen.
- **No build step** – Pure HTML, CSS, and vanilla JavaScript. 

## Getting started

1. Export your data from Letterboxd: `Profile → Settings → Data → Export Your Data`. Once the archive arrives by email, unzip it and locate `watchlist.csv`.
   You can also export your watchlist from the watchlist page (https://letterboxd.com/[USERNAME]/watchlist/)
2. Clone or download this repository.
3. Open `index.html` in your browser.
4. Upload `watchlist.csv`, optionally deselect a few entries, and press **Spin the wheel**. Open the advanced options to enable **Movie Knockout mode** for an automatic knockout showdown.

A small sample file (`sample-watchlist.csv`) is included for quick testing.

## License

Released under the MIT License. See [`LICENSE`](LICENSE) for details.

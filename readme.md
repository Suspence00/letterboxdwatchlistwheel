# Letterboxd Watchlist Wheel

Turn your Letterboxd watchlist export into a dramatic wheel spin that chooses what you should watch next. This project is a fully client-side site that you can host on GitHub Pages (or any static host).

## Features

- **CSV import** – Upload the `watchlist.csv` that Letterboxd gives you and automatically load every title.
- **Curate your picks** – Toggle individual films on or off before each spin. You can also select or clear the whole list in a click.
- **Dynamic wheel** – A colorful wheel updates in real-time as you adjust your selection.
- **Sound and animation** – Arcade-style ticking while the wheel spins, followed by a celebratory chime when a movie is chosen.
- **No build step** – Pure HTML, CSS, and vanilla JavaScript. Drop it on GitHub Pages and you are ready to go.

## Getting started

1. Export your data from Letterboxd: `Profile → Settings → Data → Export Your Data`. Once the archive arrives by email, unzip it and locate `watchlist.csv`.
   You can also export your watchlist from the watchlist page (https://letterboxd.com/[USERNAME]/watchlist/)
2. Clone or download this repository.
3. Open `index.html` in your browser, or push the repository to GitHub and enable GitHub Pages for instant hosting.
4. Upload `watchlist.csv`, optionally deselect a few entries, and press **Spin the wheel**.

A small sample file (`sample-watchlist.csv`) is included for quick testing.

## Development notes

Everything runs locally in the browser, so there are no dependencies or frameworks to install. If you would like to tweak the styling or behaviour:

- `index.html` contains the markup for the two-step interface (upload + spin).
- `styles.css` defines the neon-inspired appearance of the page and the wheel.
- `script.js` handles CSV parsing, list management, drawing the wheel on a `<canvas>`, and triggering sound effects through the Web Audio API.

## Accessibility considerations

- The spin button is automatically disabled until at least one movie is selected.
- Status messages and the result announcement use `aria-live` regions so screen readers hear updates.
- Canvas colours meet contrast requirements against the dark background, and the chosen movie is highlighted in the list.

## License

Released under the MIT License. See [`LICENSE`](LICENSE) for details.

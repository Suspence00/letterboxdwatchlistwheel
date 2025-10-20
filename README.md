# Letterboxd Watchlist Wheel

Turn your Letterboxd watchlist export into a dramatic wheel spin that chooses what you should watch next. This project is a fully client-side site that you can host on GitHub Pages (or any static host).

## Features

- **CSV import** – Upload the `watchlist.csv` that Letterboxd gives you and automatically load every title.
- **Letterboxd list import** – Paste any public Letterboxd list URL (including the Detail view) to pull those movies straight into the wheel.
- **Curate your picks** – Toggle individual films on or off before each spin. You can also select or clear the whole list in a click.
- **Dynamic wheel** – A colorful wheel updates in real-time as you adjust your selection.
- **Sound and animation** – Arcade-style ticking while the wheel spins, followed by a celebratory chime when a movie is chosen.
- **No build step** – Pure HTML, CSS, and vanilla JavaScript. Drop it on GitHub Pages and you are ready to go.

## Getting started

1. Export your data from Letterboxd: `Profile → Settings → Data → Export Your Data`. Once the archive arrives by email, unzip it and locate `watchlist.csv`.
   You can also export your watchlist from the watchlist page (https://letterboxd.com/[USERNAME]/watchlist/)
2. Clone or download this repository.
3. Open `index.html` in your browser, or push the repository to GitHub and enable GitHub Pages for instant hosting.
4. Upload `watchlist.csv` or import a Letterboxd list URL, optionally deselect a few entries, and press **Spin the wheel**.

A small sample file (`sample-watchlist.csv`) is included for quick testing.

### Letterboxd list imports

Letterboxd does not currently send CORS headers for their HTML list pages. The importer first tries to use the
`/api-data/list/{user}/{slug}/entries` endpoint, and then falls back to HTML scraping through a few CORS-friendly proxies. If
your browser blocks every attempt you can provide your own proxy before `script.js` loads:

```html
<script>
  window.LETTERBOXD_LIST_PROXY = 'https://your-proxy.example/fetch?url={{URL}}';
  window.LETTERBOXD_LIST_PROXIES = [
    'https://another-proxy.example/{{URL}}'
  ];
</script>
```

Use `{{URL}}` to inject the entire Letterboxd page URL or `{{HOST_AND_PATH}}` for just `letterboxd.com/...`. When no proxy
works the importer surfaces an actionable error so you can fall back to the CSV export.

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

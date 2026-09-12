# Developer Guide

Welcome to the development documentation for the Letterboxd Watchlist Wheel.

## Project Philosophy

*   **No Build Step:** This project is designed to run without any build process (no Webpack, no Vite, no npm install required for basic usage). It uses standard ES Modules.
*   **Local First:** All state is managed in the browser's `localStorage` or `sessionStorage`.
*   **Vanilla Stack:** We use plain HTML, CSS, and JavaScript.

For a detailed look at the algorithms used, see the **[Technical Deep Dive](Technical-Deep-Dive)**.

## Directory Structure

```
/
├── css/                # Stylesheets
│   ├── main.css        # Main entry point
│   ├── ...             # Component-specific CSS
├── js/                 # JavaScript modules
│   ├── main.js         # Entry point
│   ├── ui.js           # UI initialization and public facade
│   ├── ui/             # Focused UI components and movie-list rendering
│   ├── types.js        # Shared JSDoc data contracts
│   ├── wheel.js        # Canvas drawing and physics
│   ├── state.js        # State management
│   ├── ...
├── wheel-fm/           # Audio files and playlist config
├── favicon/            # Favicon assets
├── index.html          # Main application file
└── wiki/               # Documentation (You are here)
```

## Running Locally

1.  **Clone the repo:**
    ```bash
    git clone https://github.com/yourusername/letterboxdwatchlistwheel.git
    ```
2.  **Serve the directory:**
    You need a local static file server because ES Modules require it (you cannot just open `index.html` file directly in some browsers due to CORS policies).
    *   **Python:** `python -m http.server`
    *   **Node:** `npx serve`
    *   **VS Code:** Use the "Live Server" extension.

3.  **Open in Browser:** Navigate to `http://localhost:8000` (or whatever port your server uses).

## Key Components

### The Wheel (`js/wheel.js`)
This module handles the HTML5 Canvas rendering. It draws the slices based on the current `appState.movies` list. It also handles the physics of the spin animation using `requestAnimationFrame`.

### State Management (`js/state.js`)
The app state is a simple object that tracks:
*   `movies`: Array of movie objects.
*   `selectedIds`: Set of IDs currently active on the wheel.
*   `history`: Array of past winners.
*   `filter`: Current search/filter settings.

State is automatically persisted to `localStorage` whenever it changes (debounced).

### UI (`js/ui.js`)
Initializes UI components, connects page controls, and preserves the public exports used by other modules. Feature implementations live under `js/ui/` (winner dialog, boards, boosts, slice editor, history, knockout UI, and generic dialogs).

Movie-list responsibilities are separated into three modules:

* `js/ui/movie-list.js` filters and sorts movies and coordinates updates with the wheel and slice editor.
* `js/ui/movie-list-item.js` builds individual rows and their selection, weight, color, and boost controls.
* `js/ui/movie-list-viewport.js` renders the list and manages virtualization for large lists.

Use initialization callbacks when a component needs to request an orchestrator update, rather than importing the facade back into the component. Keep related behavior together; the target of fewer than 500 lines is guidance for review, not a reason to fragment cohesive code.

### Data Contracts (`js/types.js`)
Shared JSDoc types describe normalized runtime data, including lowercase movie fields, booster contributions, the workspace index, and winner context. Reference these types from callers using JSDoc imports. These annotations support editor tooling; neither the browser nor the health check enforces type correctness.

## Verification

After JavaScript changes, run `node health_check.js`. It parses every JavaScript module under `js/` and reports advisory line-budget warnings. It does not execute modules, resolve imports or re-exports, or type-check JSDoc.

For everyday changes, run the affected Playwright tests, for example:

```bash
npx playwright test tests/wheel.spec.js
```

Run `npx playwright test` before merging or deploying changes across components. Playwright starts the local server automatically; Python and the development dependencies must be installed, along with the Chromium browser (`npx playwright install chromium`). Import and wheel tests use `sample-watchlist.csv`, and covered external requests are mocked. If the system's `npx` launcher is unavailable, the equivalent local entry point is `node node_modules/@playwright/test/cli.js test`.

## Contributing

1.  Fork the repository.
2.  Create a feature branch.
3.  Make your changes.
4.  Submit a Pull Request.

Please ensure you maintain the "No Build Step" philosophy. Do not introduce dependencies that require compilation unless absolutely necessary (and if so, keep them optional).

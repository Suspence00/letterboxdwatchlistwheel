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
│   ├── ui.js           # UI interaction logic
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
Handles all DOM manipulations, event listeners, and updating the HTML to reflect the current state.

## Contributing

1.  Fork the repository.
2.  Create a feature branch.
3.  Make your changes.
4.  Submit a Pull Request.

Please ensure you maintain the "No Build Step" philosophy. Do not introduce dependencies that require compilation unless absolutely necessary (and if so, keep them optional).

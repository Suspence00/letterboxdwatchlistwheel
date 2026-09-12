# Developer Guide

Welcome to the development guide for the **Letterboxd Watchlist Wheel**. This document outlines the project philosophy, architectural blueprint, module directory, and verification workflows for contributors.

---

## Project Philosophy

*   **No Build Step:** The application runs completely in modern browsers using native ES Modules (`import`/`export`). There is no bundler (Webpack, Vite, Rollup) or transpilation pipeline required for production execution.
*   **Dependency-Free Runtime:** Zero runtime npm dependencies. All UI widgets, canvas rendering, audio synthesis, and modal flows are crafted in vanilla JavaScript, semantic HTML, and standards-compliant CSS.
*   **Local-First Architecture:** User watchlists, multi-board workspaces, preferences, and winner histories are managed in `localStorage` without requiring backend databases or user accounts.
*   **Modular Component Design:** Code is organized into focused submodules with strict line-budget guidelines (< 500 lines target) to preserve readability and model reasoning quality.

For algorithmic details and probability mathematics, see the **[Technical Deep Dive](Technical-Deep-Dive)**.

---

## Directory Structure

```
letterboxdwatchlistwheel/
├── index.html                      # Main HTML entry point & semantic dialog definitions
├── health_check.js                 # Syntax and module line-budget verification script
├── playwright.config.js            # Playwright testing configuration
├── sample-watchlist.csv            # Sample test watchlist fixture
├── css/
│   ├── main.css                    # Master stylesheet importing base & components
│   ├── base.css                    # Typography, resets, and box-sizing primitives
│   ├── layout.css                  # Grid layout & container wrappers
│   ├── utilities.css               # Utility helper classes
│   ├── variables.css               # Global CSS custom property design tokens
│   └── components/                 # Component-specific styles (alphabetized declarations)
│       ├── theme-foundation.css    # Shared theme tokens and control metrics
│       ├── theme-picker.css        # Accessible theme card selector styles
│       ├── alaska-theme.css        # Alaska aurora & polaris theme styles
│       ├── america-theme.css       # 4th of July celebration theme styles
│       ├── birthday-theme.css      # Celebratory party balloons & golden candle theme styles
│       ├── chinese-new-year-theme.css # Lunar celebration red & gold theme styles
│       ├── cyber-theme.css         # Retro terminal theme styles
│       ├── fantasy-theme.css       # Runic parchment & ancient gold fantasy theme
│       ├── forest-theme.css        # Earthy camp & moss pine theme styles
│       ├── holiday-theme.css       # Festive Christmas & Hanukkah theme styles
│       ├── modern-theme.css        # Sleek glassmorphism minimalist theme styles
│       ├── retro-95-theme.css      # Vintage desktop operating system theme styles
│       ├── spooky-theme.css        # Halloween pumpkin & phantom purple theme styles
│       ├── st-patricks-theme.css   # Shamrock emerald & gold theme styles
│       ├── boosters.css            # Booster badge & contributor tag styling
│       ├── buttons.css             # Standardized button variants & states
│       ├── card.css                # Card containers and collapsible step headers
│       ├── discord-help.css        # Webhook integration setup accordion styles
│       ├── forms.css               # Input fields, checkboxes, and select dropdowns
│       ├── import.css              # Letterboxd proxy & CSV import form styling
│       ├── modals.css              # Accessible dialog overlays & popup wrappers
│       ├── movie-list.css          # Virtualized movie roster & row controls
│       ├── settings.css            # 6-tab settings modal grid & form controls
│       ├── spin-mode.css           # Radio buttons and mode selection badges
│       ├── tape-viewer.css         # Static 3D VHS cassette preview display
│       ├── verify.css              # Monte Carlo fairness audit report table
│       ├── vhs-wheel.css           # 3D VHS carousel, Returns Wall & flight animations
│       ├── wheel-fm.css            # Floating draggable audio player & FAB bubble
│       ├── wheel.css               # 2D Canvas wheel & mechanical flapper pointer
│       └── workspaces.css          # Multi-board switcher dropdown & board management
├── js/
│   ├── main.js                     # Main application entry point & event wiring
│   ├── audio.js                    # Web Audio synthesizer & floating Wheel.FM player
│   ├── backup.js                   # JSON/.wheel file import/export & identity matching
│   ├── discord.js                  # Discord Webhook winner notification dispatch
│   ├── import.js                   # Letterboxd proxy scraping & CSV parser engine
│   ├── movie-metadata.js           # Cloudflare proxy client for TMDB metadata enrichment
│   ├── radarr.js                   # Radarr v3 REST API client & connection diagnostics
│   ├── spin-theater.js             # Full-screen theater modal, Returns Wall, & stage slotting
│   ├── state.js                    # LocalStorage persistence & multi-board workspace storage
│   ├── tape-viewer.js              # Winner modal 3D VHS tape renderer
│   ├── types.js                    # Shared JSDoc data contracts & type annotations
│   ├── ui.js                       # Public UI barrel & feature orchestrator facade
│   ├── utils.js                    # Palettes, math, clampWeight (1-5x), identity keys
│   ├── verify.js                   # 10,000-spin Monte Carlo simulation fairness auditor
│   ├── vhs-wheel.js                # 3D VHS carousel engine, sampling, & flight animation
│   ├── wheel.js                    # 2D Canvas wheel physics, easing, & sector geometry
│   └── ui/                         # Focused UI submodules
│       ├── boards-ui.js            # Workspace switcher & board CRUD modal
│       ├── boost-station.js        # Booster contributor tags & weight adjustment
│       ├── confetti.js             # Canvas-free DOM/CSS particle burst
│       ├── history-modal.js        # Winner history log modal with clear controls
│       ├── knockout-ui.js          # Knockout tournament state & Contenders box
│       ├── modals.js               # Reusable confirm modal & prompt modal helpers
│       ├── movie-list-item.js      # Individual row markup, weight, and color controls
│       ├── movie-list-viewport.js  # Virtualized list viewport for large collections
│       ├── movie-list.js           # Filtering, sorting, and coordinator synchronization
│       ├── slice-editor.js         # Slice color picker & live odds readout display
│       ├── theme-picker.js         # Accessible theme card picker & decoration toggle
│       └── winner-modal.js         # Winner celebration, trailer search, & Radarr dispatch
├── wheel-fm/                       # Ambient audio files and channel playlists
│   ├── playlist.json               # Channel configurations and track metadata
│   └── README.md                   # Instructions for adding local audio tracks
├── tests/                          # Playwright end-to-end test suite
└── wiki/                           # Project documentation (You are here)
```

---

## Key Architecture & Components

### 1. 3D VHS Cassette Engine (`js/vhs-wheel.js`, `js/tape-viewer.js`)
* **Perspective Carousel:** Replaces flat slices with tangible 3D cassette tape elements featuring authentic perspective skewing, dynamic sleeve spine labels, and wear textures.
* **Lineup Sampling Algorithm:** Employs uniform sampling without replacement via a partial Fisher-Yates shuffle to select a curated batch (10, 24, 50, or 100 tapes) from the eligible pool.
* **Tape Pinning:** Tapes pinned by users are retained across redraws via a `pinnedIds` Set.
* **Batch Caching:** Lineups are keyed against active capacity and eligible IDs, ensuring deterministic stability between spins.

### 2. Spin Theater State Machine (`js/spin-theater.js`)
* **DOM Slot Preservation:** To avoid breaking canvas contexts or rebuilding complex DOM nodes when entering full-screen theater mode, the module inserts a comment placeholder (`document.createComment('wheel stage')`) and safely migrates the live `.wheel-stage` element into the dialog. Upon exit, the element is seamlessly restored to its original document location.
* **Returns Wall (4-Wide Elimination Grid):** Knockout eliminations are managed through a dual-phase animation pipeline (`prepareEliminationStackSlot` and `commitEliminationStackSlot`). A floating proxy element (`.vhs-flight-proxy`) executes a smooth 3D flight trajectory from the carousel into a 4-wide rental returns shelf.
* **Accessibility & Reduced Motion:** Respects `prefers-reduced-motion` media queries; when active, flight animations are skipped, immediately rendering the tape in the elimination stack within 60ms.

### 3. Modular UI Submodules (`js/ui/`)
To prevent monolithic controllers and maintain clean separation of concerns, UI coordination is divided into focused modules:
* `js/ui/movie-list.js`: Coordinates filtering, sorting (Original, Name A–Z/Z–A, Weight high–low/low–high), and orchestrates synchronization between the wheel, slice editor, and list view.
* `js/ui/movie-list-item.js`: Encapsulates individual row markup, weight stepper buttons, color picker swatches, and contributor booster badges.
* `js/ui/movie-list-viewport.js`: Virtualizes list rendering for massive watchlists (1,000+ movies) with zero frame drops.
* `js/ui/boost-station.js`: Manages booster identities, contributor tags, and handles weight modifications clamped strictly between 1x and 5x.
* `js/ui/winner-modal.js`: Coordinates the winner announcement dialog, trailer query construction, TMDB metadata enrichment, and Radarr dispatch.

### 4. Multi-Board Workspace Isolation (`js/state.js`, `js/ui/boards-ui.js`)
* **Storage Prefixing:** Boards are strictly isolated in `localStorage` under distinct keys (`letterboxd_workspace_<workspaceId>`), while a central index (`letterboxd_workspaces_index`) tracks metadata (name, creation date, last modified timestamp, and tied Letterboxd URL).
* **Deterministic Migration:** Legacy single-board state (`letterboxd_wheel_state`) is automatically detected on startup and migrated into a default workspace without data loss.

### 5. Integrations (`js/radarr.js`, `js/discord.js`, `js/movie-metadata.js`)
* **Radarr Client:** Directly communicates with Radarr v3 REST API endpoints (`/api/v3/qualityprofile`, `/api/v3/rootfolder`, `/api/v3/movie/lookup`, `/api/v3/movie`) using `X-Api-Key` authentication.
* **Discord Webhooks:** Constructs rich JSON embeds with Blurple branding, movie poster thumbnail, release year, winning odds, and Letterboxd hyperlink.
* **Metadata Scraping:** Fetches movie runtime and plot synopsis on demand via a Cloudflare worker proxy to TMDB.

---

## Verification & Testing

Always verify changes before submitting code.

### 1. Health Check Script
Run the automated syntax and module line-budget check:

```bash
node health_check.js
```

* **Syntax Verification:** Parses all 28 JavaScript modules under `js/` and `js/ui/` using Node's native syntax checker (`--check`). Ensures there are no syntax errors or illegal duplicate exports.
* **Line Budget Audit:** Verifies modules against the advisory 500-line budget to prevent code fragmentation or bloated files.

### 2. Playwright End-to-End Tests
Interactive behaviors, import flows, wheel physics, and modal interactions are validated via Playwright:

```bash
# Run all end-to-end tests
npx playwright test

# Run a specific test suite
npx playwright test tests/wheel.spec.js
```

* Tests automatically spin up a local static server and mock covered external API calls (such as the Letterboxd proxy and metadata scrapers).
* Fixtures such as `sample-watchlist.csv` are used to simulate real-world import and curation cycles.

---

## Contributing Workflow

1. Fork the repository and create a descriptive feature branch (`feature/custom-shuffler`).
2. Adhere to the **User Style & Aesthetic Guidelines**: never introduce dark blue cyber/terminal/neon glow "AI slop" styling. Choose sleek modern minimalist or fantasy-themed styling.
3. Keep individual JavaScript modules modular and lean (< 500 lines target).
4. Run `node health_check.js` to verify syntax and inspect line budgets.
5. Run `npx playwright test` to ensure all tests pass.
6. Submit a pull request with a concise overview of changes.

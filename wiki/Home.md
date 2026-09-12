# Welcome to the Letterboxd Watchlist Wheel Wiki

The **Letterboxd Watchlist Wheel** is a sleek, local-first web application designed to turn movie night decision fatigue into an engaging, cinematic event. Built entirely with native ES modules and zero build dependencies, it transforms your Letterboxd watchlists and custom movie lists into interactive spinning wheels, 3D VHS cassette carousels, and high-stakes knockout tournaments.

---

## Key Features

*   **Direct Letterboxd Import with Pagination:** Seamlessly fetch public watchlists and custom lists of any size directly from Letterboxd via an intelligent scraping proxy with multi-page pagination support.
*   **Tied List Syncing:** Associate your boards with Letterboxd lists to refresh titles in a single click while preserving custom weights, colors, and contributor tags.
*   **Bulk Add / Paste List Modal:** Rapidly import raw text lists or paste titles in bulk without needing a structured CSV.
*   **3D VHS Wheel Mode:** Experience an interactive, retro-tactile 3D cassette tape carousel rendered with realistic perspective, custom color palettes, and poster artwork sleeves.
*   **Spin Theater Mode:** Enter an immersive full-screen focus stage featuring a live **Contenders Box** and a 4-wide grid **Returns Wall** with real-time cassette flight animations.
*   **Workspaces & Multiple Boards:** Organize movies into isolated boards (e.g., *Horror Marathon*, *Oscar Nominees*, *Family Night*), each with independent state, selections, preferences, and winner histories.
*   **Home Theater & Community Integrations:** Automatically export winning films to **Radarr v3** for immediate downloading and dispatch rich embed announcements to your **Discord** channels via webhooks.
*   **Boost Station with Contributor Tags:** Give friends and movie-night guests contributor credit with named booster badges, weighted perks (up to 5x maximum weight), and exciting single-spin Random Boosts.
*   **12 Handcrafted Visual Themes:** Shift atmospheres effortlessly between *Classic*, *Fantasy & Runic*, *Forest Camp*, *Modern*, *Retro 95*, *Alaska*, and seasonal holiday palettes.
*   **Floating Draggable Wheel.FM:** Enjoy ambient background lo-fi, synthwave, and cinematic music with a floating player supporting Expanded, Compact, and draggable FAB bubble view modes.
*   **Monte Carlo Fairness Verification:** Audit wheel fairness with an instant 10,000-spin Monte Carlo simulation engine comparing empirical results with mathematical probabilities.

---

## Documentation Index

Explore the comprehensive guides below for complete documentation on user features, local setup, and internal architecture:

| Guide | Description |
| :--- | :--- |
| **[User Guide](User-Guide)** | Step-by-step walkthrough for importing movies, curating boards, spinning, configuring settings, and managing audio. |
| **[Developer Guide](Developer-Guide)** | Overview of the codebase architecture, complete directory structure, modular UI components, and testing practices. |
| **[Technical Deep Dive](Technical-Deep-Dive)** | Deep dive into probability mathematics (1x–5x weighting), 3D VHS sampling, theater state machine, and API contracts. |
| **[Feature: Importing](Feature-Importing)** | Detailed reference for direct pagination imports, list synchronization, CSV formatting, and backup recovery. |
| **[Feature: Knockout Mode](Feature-Knockout-Mode)** | Rules and mathematical rationale behind the Last Movie Standing elimination tournament, Spin Theater, and Returns Wall. |
| **[Feature: VHS Wheel](Feature-VHS-Wheel)** | 3D cassette tape wheel mode, tactile inspection, lineup capacity configuration, and winner reveal. |
| **[Feature: Themes](Feature-Themes)** | Complete visual catalog of all 12 themes, ambient particle effects, and custom slice color behavior. |
| **[Feature: Fairness & Verification](Feature-Fairness-and-Verification)** | Monte Carlo simulation tool, statistical audit report table, Law of Large Numbers, and PRNG integrity. |
| **[Feature: Wheel.FM](Feature-Wheel-FM)** | Instructions for configuring music channels, custom audio tracks, floating player modes, and audio synthesis. |
| **[Feature: Workspaces & Boards](Feature-Workspaces-and-Boards)** | Managing isolated movie watchlists, tied Letterboxd URLs, 1-click sync, and conflict resolution. |
| **[Feature: Boost Station](Feature-Boost-Station)** | Awarding contributor tags, manual and random boosts, 5x caps, and strategic odds impact. |
| **[Feature: Integrations](Feature-Integrations)** | Automated queueing to Radarr libraries and winner broadcast embeds to Discord channels. |

---

> [!NOTE]
> **Local-First & Privacy-Centric:** All movie data, workspace collections, preferences, and spin history are stored strictly within your browser via `localStorage`. No external databases, user accounts, or server runtimes are required.

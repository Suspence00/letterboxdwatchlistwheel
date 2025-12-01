# Technical Deep Dive

This page details the internal logic of the Letterboxd Watchlist Wheel, specifically focusing on the randomization algorithms and state management.

## Randomization Algorithm

The core of the wheel's fairness lies in the `performSpin` function within `js/wheel.js`. It uses a **Weighted Random Selection** algorithm.

### The Math
1.  **Calculate Total Weight:** The system sums the "effective weight" of all active movies on the wheel.
2.  **Pick a Random Point:** A random number (`targetWeight`) is generated between `0` and `Total Weight`.
    ```javascript
    const targetWeight = Math.random() * totalWeight;
    ```
3.  **Find the Winner:** The code iterates through the list of movies, adding each movie's weight to a running total. The first movie that causes the running total to exceed `targetWeight` is selected.

### Effective Weight & Modes
The "Effective Weight" changes based on the game mode:

*   **Standard / One Spin Mode:**
    *   `Effective Weight = User Assigned Weight`
    *   *Example:* A movie with weight **10** is 10 times more likely to be picked than a movie with weight **1**.

*   **Knockout Mode (Inverse Weighting):**
    *   `Effective Weight = 1 / User Assigned Weight`
    *   *Example:* A movie with weight **10** gets an effective weight of **0.1**. A movie with weight **1** gets an effective weight of **1**.
    *   Since the wheel picks which movie to **ELIMINATE**, the movie with weight 10 (effective 0.1) has a much smaller chance of being hit, thus it is "safer".

## Animation Physics

The spin animation is not a pre-recorded video; it is calculated in real-time on an HTML5 Canvas.

### Predetermined Outcome & Modes

*   **Standard / One Spin Mode:**
    *   The winner is decided **instantly** the moment you click "Spin".
    *   The animation is purely visual theater, calculated to land exactly on the pre-selected winner.

*   **Knockout Mode:**
    *   This mode runs a **sequence** of spins.
    *   For *each individual spin* in the sequence, the "loser" (the movie to be eliminated) is decided instantly at the start of that specific spin.
    *   However, the **Final Champion** is NOT predetermined at the very beginning of the game. The system actually plays out each round one by one.
    *   This means if you refresh the page in the middle of a knockout game, the final result might have been different if you let it finish!

### Knockout Mode Probability & Diminishing Returns

In Knockout Mode, we use **Inverse Weighting**.
*   Formula: `Effective Weight = 1 / User Weight`
*   A movie with weight **10** has an effective weight of **0.1**.
*   A movie with weight **1** has an effective weight of **1**.

Since the wheel picks a **loser** based on this effective weight, a lower effective weight means a lower chance of being eliminated.

**Does increasing weight make you 10x safer?**
Not exactly. It makes your *share of the elimination pie* 10x smaller, but your actual survival probability depends on the other movies in the pool. There are **diminishing returns** to increasing weight.

**Example Scenario:**
You are 1 Weighted Movie vs. 4 Standard Movies (Weight 1).

| Your Weight | Effective Weight | Total Pool Weight | Risk of Elimination (This Round) | Risk Reduction |
| :--- | :--- | :--- | :--- | :--- |
| **1x** | 1.0 | 5.0 | **20.0%** | - |
| **2x** | 0.5 | 4.5 | **11.1%** | ~9% safer |
| **5x** | 0.2 | 4.2 | **4.8%** | ~6.3% safer than 2x |
| **10x** | 0.1 | 4.1 | **2.4%** | ~2.4% safer than 5x |

As you can see, jumping from **1x to 2x** provides a massive safety boost. Jumping from **5x to 10x** provides a much smaller marginal benefit, even though the weight number doubled.

## Wheel Features & Logic

### Slice Editor
Clicking a slice on the wheel opens the **Slice Editor**.
*   **Logic:** This updates the specific movie object in the `appState.movies` array.
*   **Persistence:** Changes to color and weight are immediately saved to `localStorage`.
*   **Sync:** Updates here reflect instantly on the wheel and in the movie list.

### History System
*   **Storage:** Keeps the last 50 winners in `appState.history`.
*   **Deduplication:** It does *not* deduplicate. If you win the same movie twice, it appears twice.
*   **Persistence:** Survives page reloads.
*   **Spin context:** Each entry is tagged as Knockout, One Spin, or Random Boost. Boosted wins carry their increased weight forward.

### Sorting
*   **Modes:** Original order, Name (A-Z/Z-A), Weight (high→low or low→high).
*   **Scope:** Sorting applies to the curated list whenever knockout ordering isn’t in effect (knockout uses its own ordering to reflect eliminations).

### Random Boost Mode
*   **Setup:** When enabled, all selected weights are temporarily set to `1x` for an even-chance single spin.
*   **Outcome:** The winning slice is boosted by `+1x`. Turning Random Boost off preserves any boosted weights (restoring at least the pre-boost baseline).
*   **Locks:** Weight controls are disabled while Random Boost is active to keep the even field intact.

### Audio & Haptics
The app uses the **Web Audio API** for real-time sound synthesis (no pre-recorded MP3s for UI sounds).

*   **Tick Sound:**
    *   Triggered whenever the `segmentIndex` under the pointer changes during rotation.
    *   **Synthesis:** A triangle wave oscillator at 600Hz with a rapid exponential decay (0.12s).
*   **Win Sound:**
    *   Triggered when the wheel stops on a winner.
    *   **Synthesis:** A major triad chord (C, E, G) played with sine waves, staggered slightly to create a pleasant chime.
*   **Knockout Sound:**
    *   Triggered when a movie is eliminated.
    *   **Synthesis:** A sawtooth wave that sweeps pitch downwards (520Hz to 220Hz), simulating a "power down" or "elimination" effect.

## Visuals & Physics

### Color Assignment
Colors are assigned deterministically based on the movie's index in the list.

1.  **Base Palette:** The first 15 movies get colors from a hand-picked, high-contrast palette.
2.  **Golden Angle Generator:** For the 16th movie and beyond, the app uses the **Golden Angle (137.5°)** to generate unique colors.
    *   `Hue = (Index * 137.508) % 360`
    *   This mathematical property ensures that no matter how many movies you add, the colors will always be maximally distant from their neighbors on the color wheel, preventing clashes.

### Spin Physics
The spin animation is calculated to land precisely on the pre-determined winner while maintaining the illusion of physics.

1.  **Target Calculation:**
    *   The app calculates the exact angle required to align the pointer with the winning segment.
    *   It adds a random number of full rotations (e.g., 8 to 12 spins) to build suspense.
    *   It adds a random **offset** within the winning slice so the pointer doesn't always land perfectly in the center, making it feel organic.
2.  **Easing:**
    *   An `easeOutCubic` function (`1 - (1 - x)^3`) is used.
    *   This creates a realistic friction effect: the wheel starts at maximum speed and decelerates naturally, spending most of the animation time in the final few rotations.

## Import Architecture

The import system (`js/import.js`) handles bringing external data into the app.

### 1. Letterboxd Proxy
Since Letterboxd does not have a public API and CORS prevents direct fetching from the browser, we use a Cloudflare Worker as a proxy.

*   **Endpoint:** `https://<proxy-worker-url>/?url=...`
*   **Process:**
    1.  The app sends the user's Letterboxd list URL to the worker.
    2.  The worker fetches the HTML from Letterboxd.
    3.  It parses the HTML to extract movie data (Name, Year, URI).
    4.  It converts this data into a CSV-like text response and sends it back to the browser.
    5.  The browser then parses this text as if it were a CSV file.

### 2. CSV Parsing
The app includes a custom, lightweight CSV parser (no heavy external libraries like PapaParse).

*   **Detection:** It automatically detects delimiters (comma, tab, semicolon, pipe) by analyzing the first line.
*   **Robustness:** It handles quoted fields (e.g., `"Movie Title, The"`) and newlines within fields.
*   **Normalization:** It looks for common header names (e.g., "Name", "Title", "Film") to map columns correctly, making it compatible with various export formats (Letterboxd, Lizard, custom).

### 3. Weight Persistence on Re-import
Custom slice weights survive re-imports so you do not lose tuning when the underlying list changes.

*   **Lookup:** Before rebuilding `appState.movies`, the importer builds a map of prior weights keyed by `(URI)`, then `(name + year)`, then `(name)` as a last resort.
*   **Restore:** Each incoming row attempts to restore its weight from that map; if no match exists, it falls back to `1x`.
*   **Scope:** Works for both proxy imports and CSV uploads, so edits made in the UI persist across refreshed or updated source lists.

## State Management (`js/state.js`)

The application uses a **Local-First** architecture. There is no backend database.

*   **Storage:** All data (movie list, selection status, history, weights) is stored in the browser's `localStorage` under the key `letterboxd_wheel_state`.
*   **Persistence:** The state is saved automatically whenever you make a change (debounced by 1 second to prevent performance issues).
*   **Data Structure:**
    ```javascript
    const appState = {
        movies: [],        // Array of all imported movies
        selectedIds: new Set(), // IDs of movies currently active
        history: [],       // Log of past winners
        filter: { ... }    // Current search/filter settings
    };
    ```

## Audio System

Audio is handled via the Web Audio API (for sound effects) and a standard HTML5 `<audio>` element (for Wheel.FM).

*   **Tick Sounds:** The `tick()` function in `wheel.js` checks the wheel's rotation every frame. If the segment under the pointer changes index, it triggers a tick sound.
*   **Wheel.FM:** This is a simple wrapper around an `<audio>` tag. It loads the `playlist.json` file to know which paths to fetch.

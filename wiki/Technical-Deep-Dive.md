# Technical Deep Dive

This document details the mathematical models, algorithmic implementations, state machines, and integration protocols powering the **Letterboxd Watchlist Wheel**.

---

## 1. Randomization Algorithms & Probability Models

The application's fairness relies on cumulative weighted random selection implemented in `js/wheel.js` and audited by `js/verify.js`. Movie weights are strictly clamped between **1x** (baseline) and **5x** (maximum boost).

### Standard / One Spin Mode
In standard single-spin mode, a movie's selection probability is directly proportional to its assigned weight.

$$\text{Effective Weight } w_i = \text{User Weight}_i \quad (1 \le w_i \le 5)$$

$$\text{Selection Probability } P(i) = \frac{w_i}{\sum_{j=1}^{N} w_j}$$

A movie with a **2x weight** occupies twice the radial sector of a 1x movie and has exactly twice the mathematical probability of being selected on a single spin.

---

### Knockout Mode & Inverse Weighting
In Knockout Mode, the wheel repeatedly spins to select which movie to **eliminate** until only one champion survives. To ensure that increasing weight protects a film rather than endangering it, the engine applies **Inverse Weighting**:

$$\text{Effective Weight } w'_i = \frac{1}{w_i}$$

$$\text{Risk of Elimination (Current Round) } P_{\text{elim}}(i) = \frac{w'_i}{\sum_{j=1}^{N} w'_j}$$

Since the wheel selects a movie for elimination, a lower effective weight $w'_i$ yields a smaller target sector on the elimination canvas, significantly reducing the film's risk of being eliminated.

---

### Marginal Safety & Diminishing Returns (1x–5x Scale)
While increasing weight always improves a movie's survival chances, the marginal safety benefit follows a logarithmic curve with **diminishing returns**.

#### Scenario: 1 Weighted Movie vs. 4 Standard Movies (Weight 1.0)
In a pool with 4 standard movies ($w_j = 1.0$, effective weight $w'_j = 1.0$) and 1 target movie with user weight $w$, the total pool weight is $W_{\text{total}} = 4.0 + \frac{1}{w}$, and the elimination risk is:

$$P_{\text{elim}} = \frac{1/w}{4 + 1/w} = \frac{1}{4w + 1}$$

| User Weight | Effective Weight ($w'$) | Total Pool Weight ($W_{\text{total}}$) | Round Elimination Risk | Marginal Risk Reduction |
| :--- | :--- | :--- | :--- | :--- |
| **1x** | $1.000$ | $5.000$ | **20.00%** | Baseline |
| **2x** | $0.500$ | $4.500$ | **11.11%** | ~8.89% safer than 1x |
| **3x** | $0.333$ | $4.333$ | **7.69%** | ~3.42% safer than 2x |
| **4x** | $0.250$ | $4.250$ | **5.88%** | ~1.81% safer than 3x |
| **5x** (Cap) | $0.200$ | $4.200$ | **4.76%** | ~1.12% safer than 4x |

> [!NOTE]
> Increasing weight from **1x to 2x** cuts elimination risk nearly in half (an 8.89% absolute drop). However, increasing from **4x to 5x** yields only a 1.12% marginal improvement. This ensures boosted movies are favored without making outcomes completely deterministic.

---

## 2. 3D VHS Lineup Sampling Algorithm

When operating in 3D VHS mode (`js/vhs-wheel.js`), rendering hundreds of active physical tapes simultaneously would degrade canvas rendering performance. The carousel utilizes a deterministic **curated lineup sampling algorithm**:

```
+-----------------------------------------------------------------------------+
| Eligible Movie Pool (e.g., 250 movies)                                      |
|  [ Pinned Tapes (up to capacity) ] + [ Uniform Random Sampling w/o Replace ] |
|                                 |                                           |
|                                 v                                           |
| Active VHS Lineup (10 / 24 / 50 / 100 tapes)                                |
+-----------------------------------------------------------------------------+
```

### Algorithm Mechanics (`getVhsLineup`)
1. **Workspace Boundary Isolation:** Switching workspaces instantly purges `pinnedIds` and clears cached lineup batch keys.
2. **Batch Key Caching:** A unique fingerprint is computed for the eligible pool:
   $$\text{Key} = \text{Capacity} + \text{":"} + \text{Movie IDs joined by } \text{U+001F}$$
   If the eligible pool and capacity remain unchanged and `redraw` is false, the cached `batchIds` are returned immediately.
3. **Tape Pinning:** Any movie IDs present in `pinnedIds` that remain eligible are preserved at the front of the lineup (up to `capacity`).
4. **Uniform Sampling Without Replacement:** Unpinned eligible slots are populated using a partial **Fisher-Yates shuffle**:
   ```javascript
   const count = Math.min(capacity - pinned.length, remaining.length);
   for (let index = 0; index < count; index += 1) {
       const other = index + Math.floor(Math.random() * (remaining.length - index));
       [remaining[index], remaining[other]] = [remaining[other], remaining[index]];
   }
   batchIds = [...pinned, ...remaining.slice(0, count)].map(movie => movie.id);
   ```
5. **Redraw Invalidation:** Clicking **Draw another 10** (or 24/50/100) forces `redraw = true`, drawing a fresh random batch while preserving pinned favorites.

---

## 3. Spin Theater State Machine

The **Spin Theater** (`js/spin-theater.js`) provides an accessible full-screen modal environment for knockout elimination tournaments.

```
Normal Page DOM                             Spin Theater Modal (Dialog)
+------------------------+                  +--------------------------------+
| [ Import Step ]        |                  |  Exit Button (Esc / Tab-trap)  |
| [ Curate Step ]        |                  |  +--------------------------+  |
| <!-- wheel stage -->   | === Migrates ==> |  | Live .wheel-stage        |  |
| [ Movie List Viewport ]|                  |  | (Canvas or 3D VHS)       |  |
|                        |                  |  +--------------------------+  |
|                        |                  |  [Contenders] [Returns Wall]|  |
+------------------------+                  +--------------------------------+
```

### 1. DOM Preservation via Comment Placeholders
To avoid re-instantiating WebGL/Canvas contexts, reloading video cassette assets, or dropping event listeners during modal transitions:
* When opening the theater, `document.createComment('wheel stage')` is inserted immediately preceding `.wheel-stage`.
* The live `.wheel-stage` element is detached and appended into the modal dialog (`.spin-theater__stage`).
* Background elements are placed in an accessible `inert` state.
* Upon exit, `stageSlot.replaceWith(stage)` seamlessly restores the live canvas/carousel to its exact original place in the page flow.

### 2. Elimination Flight Animation Pipeline
When a tape is eliminated in Knockout Mode:
1. `prepareEliminationStackSlot(movie, order)` creates an invisible placeholder slot in the 4-wide grid **Returns Wall** (`#spin-theater-stack-list`) and calculates its target screen coordinates (`getBoundingClientRect()`).
2. A temporary `.vhs-flight-proxy` clone is spawned at the exact viewport coordinates of the source tape on the carousel.
3. The Web Animations API executes a physics-modeled flight trajectory:
   ```javascript
   proxy.animate([
       {
           boxShadow: '0 8px 24px rgba(0, 0, 0, 0.5)',
           transform: 'translate3d(0, 0, 0) scale(1.04) rotateZ(-3deg)'
       },
       {
           boxShadow: '0 14px 32px rgba(0, 0, 0, 0.65)',
           transform: `translate3d(${dx * 0.45}px, ${dy * 0.45 - 20}px, 0) scale(1.02) rotateZ(2deg)`
       },
       {
           boxShadow: '0 4px 10px rgba(0, 0, 0, 0.4)',
           transform: `translate3d(${dx}px, ${dy}px, 0) scale(1) rotateZ(0deg)`
       }
   ], {
       duration: 650,
       easing: 'cubic-bezier(0.22, 1, 0.36, 1)'
   });
   ```
4. Once settled, `commitEliminationStackSlot(movie, order)` makes the Returns Wall tape visible with its rental stamp (`ELIMINATED #X`), and removes the proxy element.

### 3. Accessibility & `prefers-reduced-motion`
Before initiating the flight animation, the engine inspects:
```javascript
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
```
If reduced motion is requested by the OS:
* The 650ms flight animation and 3D rotations are skipped entirely.
* `addTapeToEliminationStack(movie, order)` is called immediately.
* Screen reader live status announcements (`.spin-theater__hint`) update within 60ms.

---

## 4. Monte Carlo Simulation Audit

To allow mathematical verification of the random number generator and weighting mechanics, `js/verify.js` implements a high-throughput **Monte Carlo Fairness Audit**.

### Simulation Loop (`runFairnessAudit`)
1. Resolves all currently filtered and selected candidates.
2. Calls `computeWheelModel(candidates)` to build the exact segment map and calculate total weight:
   $$\text{Expected Ratio}_i = \frac{\text{weight}_i}{\text{Total Weight}}$$
3. Executes a synchronous **10,000-iteration** simulation:
   ```javascript
   for (let i = 0; i < iterations; i++) {
       const targetWeight = Math.random() * totalWeight;
       let cumulative = 0;
       for (const segment of segments) {
           cumulative += segment.weight;
           if (targetWeight <= cumulative) {
               stats.get(segment.movie.id).wins++;
               break;
           }
       }
   }
   ```
4. Computes empirical distribution and statistical deviation:
   $$\text{Actual Ratio}_i = \frac{\text{wins}_i}{10000}$$
   $$\text{Diff}_i = \text{Actual Ratio}_i - \text{Expected Ratio}_i$$
5. Renders a comprehensive audit table. In standard conditions, individual movie deviations consistently fall within expected normal statistical bounds ($\pm 0.5\%$). The entire 10,000-spin simulation executes in **< 10 milliseconds**.

---

## 5. Multi-Board Workspace Storage Isolation

State persistence (`js/state.js`) uses a namespaced storage schema in `localStorage` to support multiple independent boards.

```
localStorage
├── "letterboxd_workspaces_index"     ──> [ { id, name, created, lastModified, letterboxdUrl }, ... ]
├── "letterboxd_active_workspace_id"  ──> "workspace-uuid-1"
├── "letterboxd_workspace_uuid-1"     ──> { allMovies, selectedIds, history, preferences, filterState }
└── "letterboxd_workspace_uuid-2"     ──> { allMovies, selectedIds, history, preferences, filterState }
```

### Schema Contracts
* **Workspace Metadata Index (`letterboxd_workspaces_index`):**
  ```typescript
  interface Workspace {
      id: string;              // crypto.randomUUID()
      name: string;            // Board display title (e.g. "Horror Marathon")
      created: number;         // Unix timestamp
      lastModified: number;    // Unix timestamp
      letterboxdUrl?: string;  // Tied Letterboxd URL for 1-click sync
  }
  ```
* **Active Workspace Pointer (`letterboxd_active_workspace_id`):** Stores the UUID string of the currently viewed board.
* **Workspace Data Bucket (`letterboxd_workspace_<id>`):**
  ```typescript
  interface WorkspaceData {
      allMovies: Movie[];
      selectedIds: string[];
      history: HistoryEntry[];
      filterState: MovieFilter;
      preferences: Preferences;
      winnerId: string | null;
      winnerSpinMode: string | null;
  }
  ```

### Deterministic State Migration
On boot, `loadState()` checks for legacy single-board data:
1. If `letterboxd_workspaces_index` does not exist but legacy `letterboxd_wheel_state` is present:
2. A new UUID is generated for a "Default Board".
3. The legacy state object is moved directly to `letterboxd_workspace_<newId>`.
4. The workspace index is initialized with the new board and saved.
5. All subsequent reads and writes operate strictly within the isolated workspace bucket.

---

## 6. Integrations & API Specifications

### Radarr v3 REST API Client (`js/radarr.js`)
All communication with Radarr is conducted over standard JSON REST endpoints using API key authentication.

* **Authentication Header:**
  ```http
  X-Api-Key: <RADARR_API_KEY>
  Content-Type: application/json
  ```

* **Endpoints Used:**
  1. `GET /api/v3/qualityprofile` - Fetches available library quality profiles.
  2. `GET /api/v3/rootfolder` - Fetches accessible storage root folders and free disk space.
  3. `GET /api/v3/movie/lookup?term={encodeURIComponent(term)}` - Searches Radarr/TMDB database by movie title and release year.
  4. `POST /api/v3/movie` - Ingests the movie into the user's library.

* **Add Movie Payload Specification:**
  ```json
  {
    "title": "Challengers",
    "tmdbId": 937287,
    "year": 2024,
    "qualityProfileId": 1,
    "rootFolderPath": "/media/movies",
    "monitored": true,
    "minimumAvailability": "released",
    "addOptions": {
      "searchForMovie": true
    },
    "images": [
      {
        "coverType": "poster",
        "url": "https://image.tmdb.org/t/p/original/..."
      }
    ]
  }
  ```

---

### Discord Webhook Dispatcher (`js/discord.js`)
When a winner is crowned, Wheelbur sends an automated Discord embed notification to the user's configured webhook.

* **Endpoint:** `POST <discordWebhookUrl>`
* **Headers:** `Content-Type: application/json`
* **Payload Specification:**
  ```json
  {
    "content": "☸️ **The Wheel has spoken!**",
    "embeds": [
      {
        "title": "Challengers (2024) is the winner!",
        "description": "The Wheel has spoken! **Challengers** was selected via **Knockout**. Praise the Wheel!",
        "color": 5793266,
        "image": {
          "url": "https://image.tmdb.org/t/p/w500/..."
        },
        "fields": [
          {
            "name": "Odds",
            "value": "11.1%",
            "inline": true
          },
          {
            "name": "Weight",
            "value": "2x",
            "inline": true
          },
          {
            "name": "Letterboxd",
            "value": "[View Movie](https://letterboxd.com/film/challengers/)",
            "inline": true
          }
        ],
        "footer": {
          "text": "Wheelbur • via wheel.sensei.lol"
        },
        "timestamp": "2026-09-12T12:00:00.000Z"
      }
    ]
  }
  ```

# User Guide

Welcome to the comprehensive guide for the **Letterboxd Watchlist Wheel**. Whether you are curating a cozy solo film screening or hosting a heated group movie night, this guide walks you through every step from importing films to celebrating the final victor.

---

## 1. Bring in Your Letterboxd Picks

Populating your wheel with movies is simple and flexible. The application supports direct online imports, automatic list synchronization, CSV file uploads, and bulk text entry.

```
+----------------------------------------------------------------------------+
|  1. Bring in your Letterboxd picks                                         |
|  [ https://letterboxd.com/username/watchlist/            ] [ Import List ] |
|  [ Choose CSV file ]               [ 📋 Bulk Add / Paste List ]             |
+----------------------------------------------------------------------------+
```

### Option A: Direct Import with Pagination (Recommended)
1. Navigate to the **"1. Bring in your Letterboxd picks"** section at the top of the board.
2. Enter your Letterboxd username, a public watchlist URL (e.g., `https://letterboxd.com/username/watchlist/`), or any public curated list URL (e.g., `https://letterboxd.com/username/list/spooky-season/`).
3. Click **Import to the wheel** (or press Enter).
4. The built-in proxy automatically navigates through multiple Letterboxd pages (100 movies per page), combining all titles into your current board.
5. If movies already exist on your board, you will be prompted to either **Replace Existing List** or **Add New Movies Only**.

> [!NOTE]
> Direct import works with all **public** lists and watchlists. If your Letterboxd profile or list is set to private, use the CSV upload method below.

### Option B: "Sync List" for Tied Lists
When you import a Letterboxd URL into an active board, that URL becomes permanently tied to the board.
* Whenever your Letterboxd watchlist changes, an **Import Sync Bar** appears with a **Sync List** button.
* Clicking **Sync List** re-fetches the latest titles from Letterboxd while intelligently preserving your custom slice colors, weights (1x–5x), and contributor booster badges.

### Option C: CSV File Upload
If you have an exported Letterboxd archive or a custom spreadsheet:
1. Export your data from Letterboxd (**Settings → Import & Export → Export Your Data**) and extract the `.zip` archive.
2. Under "Prefer to upload a CSV?", click **Choose CSV file** and select your `watchlist.csv` (or any custom CSV containing `Name`, `Year`, and optional `Letterboxd URI` headers).
3. The custom parser detects delimiters automatically (comma, tab, semicolon, pipe) and populates the board instantly.

### Option D: Bulk Add / Paste List Modal
Need to quickly throw together a list from a group chat, notes app, or text file?
1. Click the **Bulk Add** / **Paste List** button.
2. In the modal textarea, paste a list of movie titles—one per line.
3. Click **Add Movies**. The titles are instantly normalized, assigned distinct palette hues, and appended to your active selection.

---

## 2. Curate Your Wheel

Once your titles are loaded, fine-tune your contenders in the **"2. Curate your wheel"** section.

```
+----------------------------------------------------------------------------+
|  2. Curate your wheel (42 selected)                                        |
|  [ Search movies...    ]  Sort: [ Weight (high to low) v ]  [ Select All ] |
|  [+ Custom Movie Entry]   [🚀 Boost Station]                               |
+----------------------------------------------------------------------------+
```

### Filtering & Search
* **Search Filter:** Type into the search field to filter your list by movie title, release year, or import date in real time.
* **Custom Filter Toggle:** Toggle "Show custom selections" under Advanced Options or Settings to show or hide manually added entries.
* **Batch Selection:** Use **Select all** or **Clear all** to quickly adjust which movies are active on the wheel. Individual checkboxes allow granular inclusion.

### Sorting Options
Organize large movie libraries using the sorting dropdown:
* **Original:** Preserves the initial import sequence from Letterboxd or CSV.
* **Name (A–Z):** Alphabetical ascending order.
* **Name (Z–A):** Alphabetical descending order.
* **Weight (high to low):** Surfaces boosted and high-priority favorites to the top.
* **Weight (low to high):** Surfaces standard or low-weight entries first.

### Custom Movie Entry Modal
Add off-watchlist movies, surprise wildcards, or unreleased screenings:
1. Click **Add a custom entry**.
2. Enter the **Movie Title**, optional **Release Year**, and optional **Letterboxd URL**.
3. Choose an initial slice color and weight multiplier (1x to 5x), then click **Add to Wheel**.

### The Boost Station & Contributor Tags
The **Boost Station** allows group members or contributors to back their favorite films:
1. Click **Boost Station** in the curation toolbar.
2. **Booster Name:** Enter the name of the participant (e.g., *Alex*, *Sam*).
3. **Select Movie:** Choose a movie from the dropdown or type in the autocomplete filter.
4. **Boost Selected:** Increases the movie's weight by `+1x` (up to the maximum **5x weight cap**) and attaches a permanent contributor tag displaying the booster's name and timestamp.
5. **Remove Boost:** Removes a booster contribution or reduces weight.
6. **Random Boost:** Triggers a unique single spin where every eligible movie temporarily receives equal 1x odds; whichever movie wins receives an automatic `+1x` permanent boost!

> [!TIP]
> Movies with contributor tags display compact, styled badges on the movie list and in the Slice Editor, showing who boosted the film and when.

---

## 3. Spin the Wheel

Scroll down to **"3. Spin the wheel"** to initiate your selection.

```
+----------------------------------------------------------------------------+
|  3. Spin the wheel                                                         |
|  (o) Knockout Mode   ( ) One Spin Mode                 [ Draw another 10 ] |
|  +----------------------------------------------------------------------+  |
|  |                 [ 3D VHS Carousel or Classic Canvas ]                |  |
|  +----------------------------------------------------------------------+  |
|                        [  SPIN THE WHEEL / THEATER  ]                      |
+----------------------------------------------------------------------------+
```

### 3D VHS Mode vs. Classic Wheel
Toggle between two rendering engines via the controls or **Settings → Options**:
* **3D VHS Wheel Mode (Default):** Displays an interactive carousel of physical video cassette tapes featuring high-resolution poster sleeves, authentic wear textures, sleeve spine labels, and dynamic 3D perspective.
* **Classic Wheel Mode:** Displays a vibrant 2D HTML5 Canvas pie wheel with crisp slice typography and a mechanical indicator flapper.

### Spin Modes
* **One Spin Mode:** A single spin picks the definitive winner immediately. Higher weights correspond directly to larger slice sectors and higher selection probability.
* **Knockout Mode ("Last Movie Standing"):** A battle royale tournament where each consecutive spin **eliminates** a movie until only one champion survives.
  * In Knockout Mode, the system employs **Inverse Weighting**: higher weights reduce the chance of elimination on each spin, making boosted movies significantly safer.

### Spin Theater Mode
Click **Theater Mode** (or launch a Knockout game) to open the full-screen cinematic stage:
* **Focus Arena:** Dims distracting page elements, locks background scrolling, and centers the wheel in a distraction-free dialog stage.
* **Contenders Box:** A live scoreboard displaying surviving movies and their current odds of ultimate victory.
* **Returns Wall (4-Wide Elimination Grid):** As movies are eliminated, their VHS cassettes perform a smooth flight animation across the screen into an authentic 4-wide rental shelf "Returns Wall" stamped with their elimination order (`#1`, `#2`, etc.).

### "Draw Another 10" (VHS Lineup Shuffle)
When spinning large watchlists in 3D VHS mode:
* The carousel displays a curated batch based on your configured capacity (10, 24, 50, or 100 tapes).
* Click **Draw another 10** to reshuffle a fresh random sample of eligible movies into the carousel without replacement.
* Pinned tapes are automatically retained across redraws so your priority picks remain front and center.

---

## 4. Settings Modal

Access global configuration anytime by clicking the gear icon (**Settings**) in the header. Settings are organized into 6 dedicated tabs:

### Tab 1: Options
* **Visual Theme:** Select from 13 handcrafted preview cards including *Classic*, *Fantasy & Runic*, *Modern*, *Christmas*, *Hanukkah*, *Alaska*, *Chinese New Year*, *St. Patrick's Day*, *4th of July*, *Retro 95*, *Spooky Halloween*, *Forest Camp*, and *Birthday Party*.
* **Show Seasonal Decorations:** Toggle themed corner artwork and festive accents without changing palette colors.
* **Wheel Style:** Switch between *3D VHS Tapes* and *Classic Wheel*.
* **Lineup Capacity:** Set carousel density to *10*, *24*, *50*, or *100* tapes.
* **Show Bottom Rental Labels:** Toggle visibility of cassette bottom spine labels.
* **Final Contenders Display:** Choose whether to show the Contenders box from the start of a game or hide it entirely.

### Tab 2: Data (Import & Export)
* **Export Wheel:** Click **Download .wheel** or **Copy String** to produce a complete JSON backup containing all movies, weights, custom colors, selection states, preferences, and winner history.
* **Import Wheel:** Paste backup JSON text or upload a `.wheel` file:
  * **Apply weights only:** Matches movies by URI or title/year and updates their weights, colors, and tags on your current list without overwriting the movie roster.
  * **Full Restore:** Completely restores all movies, settings, and (optionally) history.

### Tab 3: Discord Webhooks
Send instant announcements to your friends or movie club server when a champion is crowned:
1. In Discord, go to **Channel Settings → Integrations → Webhooks → New Webhook**.
2. Copy the Webhook URL and paste it into the **Webhook URL** field.
3. Click **Test Notification** to verify delivery. When a winner is selected, Wheelbur sends a rich embed featuring the movie poster, release year, winning odds, weight, and Letterboxd link.

### Tab 4: Radarr Integration
Automatically add winning films directly to your home media library:
1. **Radarr URL:** Enter your server address (e.g., `http://localhost:7878` or reverse proxy URL).
2. **API Key:** Enter your Radarr API key (found in Radarr under **Settings → General → Security**). Use the Show/Hide button to verify.
3. Click **Test Connection**. The app contacts your Radarr instance and populates your configured **Quality Profiles** and **Root Folders**.
4. Select your preferred default profile and folder.
5. Check **Search for movie after adding** if you want Radarr to immediately initiate download searches upon winner selection.

> [!NOTE]
> If your Radarr instance is behind a reverse proxy, ensure standard CORS headers (`Access-Control-Allow-Origin`) are enabled on the proxy server.

### Tab 5: Boards Management
Manage multiple distinct watchlists and workspaces:
* **Active Board:** Switch between saved boards with the dropdown.
* **Create New Board:** Enter a board name (e.g., *Oscar 2026 Contenders*) and click **Create**.
* **My Boards List:** View all boards with their last-modified dates and tied Letterboxd URLs. Rename boards inline or delete unused ones (the active board and last remaining board cannot be deleted).

### Tab 6: Advanced (Fairness Audit)
* Click **🛡️ Verify Fairness** to execute a synchronous 10,000-spin Monte Carlo simulation.
* Inspect an empirical audit report displaying each movie's mathematical expected probability, simulated win count, actual percentage, and deviation delta (typically within ±0.5%).

---

## 5. Audio & Wheel.FM

Enhance the room atmosphere with synthesized audio effects and ambient soundtrack playback.

```
+-------------------------------------------------------------+
| 📻 Wheel.FM  [ Synthwave Chill v ]   [<] [ > ] [>]  [ _ ]   |
| "Midnight Drive" - Neon Horizon       01:24 / 03:45 ========|
+-------------------------------------------------------------+
```

### Floating Draggable Player
The **Wheel.FM** player floats above the interface and can be dragged anywhere on the screen:
* Click and hold the header bar (or FAB bubble) to reposition the player. Coordinates are saved to your browser so the player remembers its position across reloads.
* Automatic viewport clamping prevents the player from disappearing off-screen during window resizing.

### Three View Modes
Cycle through three viewing layouts using the header minimize button:
1. **Expanded Mode (Default):** Full track title, artist info, interactive seek scrubber, time readout, volume slider, channel dropdown, and playback controls.
2. **Compact Mode (`_`):** Sleek, condensed bar retaining playback buttons and title without taking up vertical canvas room.
3. **FAB Radio Bubble Mode (`═`):** Collapses into a minimal circular floating action button with a radio icon (📻). Can be parked in any screen corner and clicked once to restore.

### Channels & Soundtracks
* Select from curated music channels (e.g., *Synthwave*, *Lofi Chill*, *Cinematic Orchestral*).
* Use the seek scrubber to skip to any point in the track, or adjust volume via the slider.

### Synthesized Sound Effects
* Tactile mechanical wheel ticks, winning orchestral major-triad chimes, and knockout pitch-sweep effects are generated in real time using the browser's **Web Audio API**.
* Click the speaker icon in the curation toolbar anytime to toggle sound effects on or off.

---

## 6. Winner Dialog & History

When the wheel lands on a winner (or the final knockout survivor emerges), celebrate your selection:

```
+-------------------------------------------------------------+
|                     WINNER!                                 |
|               +-------------------+                         |
|               |  [ VHS Tape /     |  The Matrix (1999)      |
|               |    Poster Cover ] |  2h 16m • Sci-Fi        |
|               +-------------------+                         |
|  "A computer hacker learns from mysterious rebels about     |
|  the true nature of his reality..."                         |
|                                                             |
|  [ View on Letterboxd ] [ Watch Trailer ] [ + Add to Radarr ]
+-------------------------------------------------------------+
```

### The Winner Modal
* **Confetti Celebration:** A lightweight DOM/CSS particle burst animates across the viewport.
* **Poster or 3D VHS Cover:** Displays high-resolution movie artwork or an authentic 3D video cassette cover depending on your active wheel style.
* **Enriched Metadata:** Automatically retrieves runtime (e.g., `2h 16m`) and movie synopsis.
* **Direct Actions:**
  * **View on Letterboxd:** Opens the official film page in a new tab.
  * **Watch Trailer:** Queries YouTube for official trailers.
  * **Add to Radarr:** If Radarr is configured, adds the film to your library with one click and reports live status feedback.

### Spin History Log
* Click **History** in the wheel control bar to inspect past results.
* Stores up to 50 previous winners with timestamps and game mode badges (*One Spin*, *Knockout*, *Random Boost*).
* Remove individual history items or click **Clear All History** to reset the log for your active board.

# Feature: Importing

The **Letterboxd Watchlist Wheel** offers multiple streamlined ways to import movie collections into your wheel—from live Letterboxd web scraping to local CSV files and bulk text pasting.

---

## 1. Direct Letterboxd Import (Live Proxy)

The primary method for importing movies is via the built-in Cloudflare Worker proxy. It fetches and parses public Letterboxd watchlists and curated lists directly into the wheel without requiring an account or server login.

### Supported Input Formats

You can paste any of the following into the **Letterboxd URL or profile name** field:

| Format | Example | Description |
| :--- | :--- | :--- |
| **Curated List URL** | `https://letterboxd.com/username/list/spooky-season/` | Scrapes all movies in a user-created public list. |
| **Watchlist URL** | `https://letterboxd.com/username/watchlist/` | Scrapes the public watchlist of a specific user. |
| **Username Only** | `username` | Automatically resolves to `https://letterboxd.com/username/watchlist/`. |

> [!NOTE]
> Direct import only works for **public** Letterboxd watchlists and lists. If your watchlist is set to private, use the [CSV Import](#2-csv-import) method instead.

### Multi-Page Pagination

Letterboxd divides lists and watchlists into pages of up to 100 films each (e.g. `/page/1/`, `/page/2/`, etc.).

* **Automated Multi-Page Scraper**: When you import a list with more than 100 titles, the proxy automatically increments page numbers, fetches consecutive pages, and aggregates all rows into a single collection.
* **Large Catalog Support**: The scraper safely handles lists up to 50 pages (up to 5,000 films).
* **Live Progress Reporting**: As pages are retrieved, the status bar displays live feedback (e.g., `Fetching page 3 from Letterboxd (200 movies loaded)…`), keeping you informed during large imports.
* **Workspace Guard**: If you switch boards while an import is actively fetching pages, the operation safely cancels to prevent cross-board state corruption.

---

## 2. CSV Import

For private watchlists, offline movie nights, or non-Letterboxd movie archives, you can upload a CSV file directly.

### How to Export from Letterboxd
1. Log in to [Letterboxd](https://letterboxd.com).
2. Go to **Settings → Import & Export**.
3. Click **Export Your Data** and download the resulting ZIP archive.
4. Extract the ZIP archive and locate `watchlist.csv` (or any exported list CSV).

### File Format Requirements
The parser automatically detects delimiters (commas `,`, tabs `\t`, semicolons `;`, or pipes `|`) and expects standard Letterboxd column headers:

* `Name` / `Title`: Film title (*required*).
* `Year` / `Release Year`: Release year of the film (*optional*).
* `Letterboxd URI` / `URL`: Canonical link to the Letterboxd film entry (*optional*).
* `Date` / `Added`: Date added to the list (*optional*).

> [!TIP]
> The CSV upload control is housed in a compact, sleek button in Step 1. Choosing a CSV triggers instant parsing, detects missing fields gracefully, and collapses Step 1 automatically once the titles are loaded.

---

## 3. Bulk Add / Paste List Modal

Need to add a custom list of titles quickly without creating a Letterboxd list or CSV file? Use the **Bulk Add / Paste List** modal.

### Opening the Modal
* In **Step 1 (Bring in your Letterboxd picks)**: Click the **Bulk Add / Paste List** button next to the CSV upload button.
* In **Step 2 (Curate your wheel)**: Click the **Bulk Add** button in the curation action bar.

### Pasting Raw Titles
1. Paste plain text into the modal textarea with **one movie title per line**:
   ```text
   Blade Runner 2049
   Arrival
   Dune: Part One
   Dune: Part Two
   Interstellar
   ```
2. Press **Add to Wheel** (or press <kbd>Ctrl</kbd>+<kbd>Enter</kbd> / <kbd>Cmd</kbd>+<kbd>Enter</kbd>).
3. The app parses each row, decodes HTML entities, generates unique custom entries, assigns default slice colors, and selects all added titles.
4. The **Show custom entries** toggle is automatically enabled so your newly pasted films appear immediately on the wheel.

---

## 4. Tied List Syncing & Auto-Collapse

When you import a Letterboxd URL into an active board, the application establishes a permanent binding between the URL and that board.

### The "Sync List" Banner
* Once a list is tied to a board, an elegant status banner appears at the top of Step 1 displaying the tied Letterboxd URL and a **Sync List** button.
* You do not need to re-type or re-paste the URL when your Letterboxd list changes. Simply click **Sync List** to refresh the board.

### Incremental Re-Sync Algorithm
When you trigger a list sync:
1. **Preserve Custom Entries**: Any titles added via "Add Custom Movie" or "Bulk Add" are preserved untouched.
2. **Remove Outdated Titles**: Films removed from your Letterboxd list are pruned from the wheel.
3. **Add New Discoveries**: Newly added films are appended, automatically selected, assigned palette colors, and initialized with a 1x weight.
4. **Preserve Existing Weights**: Movies that remain on the list retain their existing customized weights and booster tags.
5. **Interactive Diff Tooltips**: The status message reports exact totals (e.g. `Sync complete! Added 3 new movies, removed 1 movie.`). Hovering over the badge reveals a tooltip listing the specific titles added or removed.

### Step 1 Auto-Collapse
To maximize screen space for the interactive wheel and slice editor, Step 1 automatically collapses (`card--collapsed`) upon successful import or sync. An **Expand Step** toggle button remains available whenever you wish to view the import controls or tie a new URL.

---

## 5. Board URL Conflict Resolution

Because each board represents an isolated watchlist (such as "Horror Month", "Oscar Contenders", or "Family Night"), the application protects against accidental URL duplication across boards.

If you paste a Letterboxd URL that is already tied to a different board, a **Board Conflict** modal appears:

> **Board Conflict**  
> *This Letterboxd URL is already tied to a different board: **Horror Month**. Did you mean to update that board instead?*

### Available Actions

| Option | Action | Result |
| :--- | :--- | :--- |
| **Switch & Update That Board** | *Recommended* | Automatically switches the active board to the tied board and prompts you to refresh its contents. |
| **Import into Current Board Anyway** | Secondary | Imports the movies into your current board and unbinds the URL from the previous board. |
| **Cancel Import** | Abort | Closes the modal with no changes made to any board. |

---

## 6. Overwrite vs. Append (Merge Mode)

When importing a Letterboxd URL or CSV file into a board that already contains movies, the app presents an **Import Options** dialog:

### 1. Replace Existing List (Overwrite)
* Replaces the current movie list with the incoming data.
* Retains any manually added custom entries (`isCustom: true`).
* Resets Knockout Mode progression for a clean slate.
* Re-selects all imported entries.

### 2. Add New Movies Only (Append / Merge Mode)
* Evaluates incoming films against the existing board using identity matching (`buildMovieIdentityKey`).
* Existing titles are left untouched, preserving their current selection state, slice position, and knockout status.
* Only brand-new movies are appended to the wheel and selected.
* A tooltip summary confirms the exact count and titles of new movies merged into the board.

---

## 7. Weight Restoration Heuristics

When updating or re-importing a list, the application prevents loss of slice customization through automatic weight caching:

1. **Identity Key Generation**: Each movie generates a normalized identity key based primarily on its canonical Letterboxd URI (e.g. `https://letterboxd.com/film/alien/`). If no URI exists, it falls back to a normalized composite of `title + year`.
2. **Weight Lookup Map**: Before replacing movies, existing slice weights (and booster contributions) are indexed in an in-memory lookup table (`buildWeightLookup`).
3. **Restoration on Ingestion**: As new rows are mapped, `restoreWeight` inspects the lookup table. Any movie that previously had an increased weight (e.g. 2x, 3x, or 5x) automatically regains its customized weight.
4. **Protection Against Accidental Resets**: Even across list re-imports or periodic syncs, your movie night favorites retain their boosted odds.

---

## 8. Backups with Imports

If you wish to reapply custom weights or migrate configurations between devices:
1. Export a `.wheel` file via **Advanced options → Export or import your wheel**.
2. When importing a new list, select **Apply weights to current list** in the import popup to layer saved weights and colors without duplicating movies.

---

## Related Documentation

* **[User Guide](User-Guide)**: Overview of adding movies, curating wheels, and spinning.
* **[Feature: Workspaces & Boards](Feature-Workspaces-and-Boards)**: Managing multiple isolated watchlists and tied URLs.
* **[Feature: Boost Station](Feature-Boost-Station)**: Awarding weights and booster tags to movie night picks.

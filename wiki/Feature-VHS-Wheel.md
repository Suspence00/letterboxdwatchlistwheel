# Feature: 3D VHS Wheel

The **3D VHS Wheel** is an interactive, tactile alternative to the classic 2D canvas spinner. It renders your watchlist as a rotating carousel of physical videocassette tapes, complete with textured sleeves, spine labels, rental stickers, and full 3D spatial inspection.

---

## 3D Cassette Aesthetics & Construction

Each cassette tape is modeled as an interactive 3D cuboid with distinct textured faces:

* **Textured 3D Sleeves**: Tapes feature authentic sleeve geometry rendered via CSS 3D transforms (`transform-style: preserve-3d; perspective: 1300px;`). Slices without external poster artwork receive deterministic, high-contrast sleeve hues calculated by list index (`(index * 43 + 15) % 360`) with retro cardboard grain styling.
* **Front Cover & Movie Artwork**: The front face (`.vhs-face--front`) fetches high-resolution movie posters asynchronously via OMDb/Letterboxd metadata providers. If artwork is unavailable or loading, an authentic video store cardboard fallback displays the film title, release year, and header typography.
* **Spine Labels**: The left spine (`.vhs-face--left`) displays the movie title oriented vertically (`writing-mode: vertical-rl; text-orientation: mixed;`) in classic serif typography, allowing titles to be read as tapes rotate past the viewer.
* **Rental Stickers**: The bottom face and cover edge feature nostalgic rental stickers (`.vhs-rental`, "BE KIND, REWIND" or catalog number `VHS #01`), evoking vintage home video rental libraries.
* **Bottom Label Toggle**: In **Settings → Options**, users can toggle **Show bottom tape labels** (`vhsShowLabels` preference) on or off. Hiding bottom labels maximizes artwork visibility and cleans up sleeve presentation.
* **Rotor Assembly**: The center wheel assembly (`.vhs-rotor`) features three layered metallic discs (`.vhs-disc--back`, `.vhs-disc--middle`, `.vhs-disc--front`) with an elevated brass hub (`.vhs-hub`) emblazoned with "PRAISE THE WHEEL!" and an elevated, fixed flapper pointer (`.vhs-flapper`).

---

## Interactive Inspection

Users can examine individual tapes before or after spinning:

1. **Hover & Keyboard Focus**: Hovering over or tabbing to any tape elevates its position in 3D space with an accessible golden focus indicator (`outline: 4px solid #ffcf87;`).
2. **Click to Inspect**: Selecting a tape activates the **VHS Inspector Panel** (`.vhs-inspector`):
   * **Movie Title & Metadata**: Displays the film's title, release year, and assigned weight multiplier.
   * **Live Odds Calculation**: Shows the exact mathematical odds for the selected film within the current lineup (e.g., `10.0% elimination risk` in Knockout Mode or `10.0% chance in this lineup` in One Spin mode).
   * **Pinning Control**: Allows toggling pin status directly from the inspector.
   * **Weight Editor**: Clicking **Edit weight** smoothly opens the **Slice Editor** modal to adjust weight multipliers (1x to 5x) or custom colors.

---

## Lineup Capacity Configuration

The 3D rotor dynamically adjusts its geometry based on your preferred tape capacity:

| Capacity Tier | Rotor Layout | Best Suited For |
| :---: | :---: | :---: |
| **10 Tapes** *(Default)* | Standard full-size cassettes (`scale: 1.00`) | Intimate shortlist selections, group deliberation, and standard watchlists. |
| **24 Tapes** | Compact scaled cassettes (`scale: 0.85`) | Medium watchlist samplers and extended knockout tournaments. |
| **50 Tapes** | Dense radial arrangement (`scale: 0.65`) | Large watchlists, marathon tournaments, and broad genre sweeps. |
| **100 Tapes** | High-density showcase (`scale: 0.45`) | Massive library samplers and high-capacity knockout arena games. |

### Adjusting Capacity

You can configure lineup capacity in two locations:
* **Settings Modal**: Navigate to **Settings → Options → VHS Lineup Capacity** (`#settings-vhs-capacity`) and choose between 10, 24, 50, or 100 tapes.
* **Stage Controls**: When multiple tapes are loaded, the capacity dropdown on the stage (`#vhs-capacity-select`) allows instant on-the-fly switching.

---

## Tape Pinning & Uniform Redraws ("VHS Shuffle")

When your eligible watchlist exceeds your chosen lineup capacity, the app employs **uniform random sampling without replacement** to construct a balanced batch:

* **Draw Another Tapes ("VHS Shuffle")**:
  * Clicking **Draw another 10** (or 24/50/100) re-samples a fresh set of eligible movies from your list.
  * Sampling uses the Fisher–Yates uniform shuffle algorithm, guaranteeing that every eligible movie has an equal mathematical chance of entering the carousel.
* **Tape Pinning**:
  * Click **Pin tape** (`#vhs-pin`) in the inspector to lock high-priority movies into the active carousel.
  * Pinned tapes remain anchored across consecutive redraws while unpinned slots rotate through fresh selections from your broader watchlist.
  * Pinned count and status are dynamically reflected in the lineup notes (e.g., `10 tapes from 1,001 eligible movies. 2 pinned.`).

> [!TIP]
> Use tape pinning when you have two or three must-watch movies you want to pit against a randomized selection of wildcards from a massive watchlist.

---

## Winner Reveal & Static Tape Viewer

When the wheel stops on the winning film, the application celebrates the pick with a dedicated two-stage presentation:

1. **3D Center Reveal Animation (`.vhs-reveal`)**: The winning cassette lifts off the rotor assembly, glides to the center of the viewport, and rotates smoothly (`rotateY(-18deg) rotateZ(-5deg) scale(2.25)`) to showcase its front cover art while dimming the background rotor.
2. **Winner Dialog Tape Viewer (`.tape-viewer`)**:
   * The **Winner Celebration Dialog** (`#win-modal`) renders a static, high-fidelity 3D videocassette sleeve (`js/tape-viewer.js`).
   * The sleeve features an authentic angled spine, cardboard slipcase borders, "THE VIDEO STORE" emblem, and "BE KIND, REWIND" rental badge.
   * Movie artwork uses an aspect-ratio-preserving fit (`object-fit: contain;`) so original movie posters are never cropped or distorted.
   * Action buttons below the viewer allow one-click export to **Radarr**, copying title details, searching trailers, or closing the celebration.

---

## Classic Wheel Fallback Toggle

For users who prefer traditional 2D carnival-style wheel physics or simpler canvas rendering:

1. Open **Settings → Options**.
2. Locate the **Wheel Presentation Style** option (`#wheel-style`).
3. Select **Classic Wheel** to instantly switch the stage to the 2D HTML5 Canvas wheel.
4. All current movies, weights, custom colors, and history are preserved seamlessly between modes.

> [!NOTE]
> When running Knockout Mode on large watchlists (>100 movies), the application automatically uses fast elimination passes on the classic engine before transitioning to the 3D VHS arena for the dramatic finale.

---

## Related Documentation

* **[Feature: Knockout Mode](Feature-Knockout-Mode)**: Sequential elimination tournament, Returns Wall, and Spin Theater mode.
* **[Feature: Themes](Feature-Themes)**: Complete guide to visual themes and custom color persistence.
* **[Feature: Fairness and Verification](Feature-Fairness-and-Verification)**: Monte Carlo verification tools and statistical audit reports.
* **[User Guide](User-Guide)**: General setup and configuration.

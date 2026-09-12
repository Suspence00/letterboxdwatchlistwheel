# Feature: Knockout Mode

**Knockout Mode** (also known as "Last Movie Standing") transforms movie night selection into a high-stakes elimination tournament. Instead of choosing a winner in a single spin, the wheel sequentially eliminates movies one by one until only a single champion remains standing in the arena.

---

## Overview & Gameplay Flow

Knockout Mode builds anticipation and suspense for group watch parties:

1. **Movie Selection**: Populate your wheel with at least two active movies from your imported watchlist or custom entries.
2. **Mode Toggle**: In the **Spin Mode** selector above the stage, select **Knockout Mode**.
3. **Launch the Tournament**: Click **Start Movie Knockout mode** to launch the arena sequence.
4. **Sequential Elimination**:
   * The wheel spins automatically.
   * Whichever movie the flapper pointer lands on is **knocked out**.
   * The eliminated title is celebrated, recorded with its exit standing, and removed from the active wheel pool.
   * The wheel automatically spins again with the remaining survivors.
5. **The Crowning**: When only one title remains, the wheel halts and crowns the **Knockout Champion**, opening the celebration dialog and recording the victory in your history.

> [!NOTE]
> Unlike One Spin mode where the winner is determined instantaneously, Knockout Mode calculates each round sequentially in real time. The final champion is not predetermined at the start; each spin is an independent survival event.

---

## Inverse Weighting Math

In standard One Spin mode, a movie with higher weight receives a larger slice on the wheel, increasing its chance of selection. In Knockout Mode, however, the pointer selects which film is **eliminated**.

To keep weight intuitive—where higher weight always benefits the movie you want to watch—Knockout Mode utilizes **Inverse Weighting**:

$$\text{Effective Weight} = \frac{1}{\text{User Assigned Weight}}$$

* **Higher Weight = Harder to Eliminate**: A movie assigned a higher weight receives a smaller slice on the elimination wheel, reducing its likelihood of being landed on.
* **Scale**: Weights range from **1x** (baseline) to **5x** (maximum boost).
* **Survival Principle**: Increasing a movie's weight reduces its share of the elimination pie, dramatically improving its chances of surviving each round.

### Elimination Risk & Diminishing Returns

The probability that movie $i$ is eliminated in any given round is:

$$P(\text{Elimination}_i) = \frac{\text{Effective Weight}_i}{\sum_{j} \text{Effective Weight}_j}$$

Because survival depends on the total pool weight of all remaining contenders, boosting a movie provides significant initial protection, followed by diminishing marginal returns at higher tiers:

| Assigned Weight | Effective Weight | Example Pool (1 Boosted vs. 4 Standard 1x) | Elimination Risk This Round | Survival Benefit vs. 1x |
| :---: | :---: | :---: | :---: | :---: |
| **1x** | $1.000$ | $1.000 / 5.000$ | **20.0%** | Baseline |
| **2x** | $0.500$ | $0.500 / 4.500$ | **11.1%** | ~8.9% safer |
| **3x** | $0.333$ | $0.333 / 4.333$ | **7.7%** | ~12.3% safer |
| **4x** | $0.250$ | $0.250 / 4.250$ | **5.9%** | ~14.1% safer |
| **5x** | $0.200$ | $0.200 / 4.200$ | **4.8%** | ~15.2% safer |

> [!IMPORTANT]
> The app manages all inverse transformations automatically. You never need to calculate reciprocals manually: **Higher weight is always safer and more advantageous for your picks.**

---

## Spin Theater Mode

During intense knockout tournaments, the application can project the wheel onto a dedicated **Spin Theater Stage** (`.spin-theater`):

* **Focus Activation**:
  * **Automatic Transition**: Starting a knockout game can automatically transport the stage into theater focus.
  * **Manual Toggle**: Click the **Theater Mode ⛶** button (`#wheel-theater-btn`) on the wheel stage at any time.
  * When a spin sequence is active and you exit theater mode, the toggle button displays an active badge: **Return to Theater Mode ⛶**.
* **Visual Presentation**: The theater features a warm, rich cinematic radial backdrop (`radial-gradient(ellipse at 50% 50%, #282b26 0%, #101413 50%, #070b0a 100%)`) that isolates the wheel, returns shelf, and contenders list while dimming distractions.
* **Accessibility & Page Focus**:
  * All background DOM elements outside the theater are set to `inert` to trap focus safely.
  * An accessible **Exit focus ↗** button (`.spin-theater__exit`) sits in the theater header.
  * Pressing the <kbd>Escape</kbd> key cleanly closes the theater, restoring focus to your previous position without interrupting the active spin sequence.

---

## Live Knockout Status

While the wheel rotates, real-time status indicators keep viewers engaged:

1. **Center Wheel Status Ticker**: The centered result banner over the wheel (`#result`) dynamically tracks whichever movie is currently gliding under the pointer:
   * **Selecting/Eliminating Phase**: Displays `Knocking out: [Movie Title]`.
   * **Elimination Phase**: Emphasizes `Knocked out: [Movie Title] · [X] remain`.
   * **Victory Phase**: Announces `Movie Knockout winner: [Movie Title] ([Year])`.
2. **Eliminated Counter**: The shelf header displays a live tabular counter (`#spin-theater-stack-count`) showing progress through the bracket (e.g., `Eliminated: 7/24`).
3. **Screen Reader Announcements**: Live region announcements (`.spin-theater__hint` with `aria-live="polite"`) broadcast eliminations to assistive technologies.

---

## The Returns Wall (Elimination Shelf)

Eliminated movies are archived on the **Returns Wall** (`#spin-theater-stack`):

* **4-Wide Grid Shelf**: A structured 4-column display (`.spin-theater__stack-list`) showcasing eliminated tapes in reverse chronological order.
* **Sleeve Artwork & Stamping**: Each eliminated tape displays its high-resolution poster (or stylized retro fallback sleeve), stamped diagonally with a prominent crimson badge: `ELIMINATED #X`.
* **Rental Metadata**: Bottom rental banners display `VHS #X` corresponding to the exact knockout round.
* **Smooth Reconciliation**: The stack uses a two-phase slot preparation workflow (`prepareEliminationStackSlot` followed by `commitEliminationStackSlot`). This calculates exact bounding coordinates and prevents visual DOM flashes or layout jumps when tapes transition onto the shelf.

---

## Final Contenders Box

When the tournament narrows down to its final contenders, the **Final Contenders Box** (`#knockout-remaining`) activates alongside the stage:

* **Automatic Activation**: Pops into view when the surviving pool drops to **10 or fewer movies** (configurable in **Settings** to always show from the start or hide entirely).
* **Live Odds Calculation**: Recalculates real-time survival odds for each contender after every knockout round.
* **Contender Badges**: Each entry features:
  * Numbered ranking and title badge.
  * Theme-aware color swatch matching the wheel slice.
  * Release year and custom-entry indicators.
  * Calculated win percentage (`Odds: XX%`).
* **Active Slice Tracking**: Highlights the active candidate (`.is-active`, `aria-current="true"`) in real time as the pointer ticks past each slice.

---

## Elimination Flight Animation & Accessibility

When a tape is eliminated, the visual engine orchestrates a cinematic departure:

```
[ Active Wheel Rotor ] ──( 3D Flight Proxy )──> [ Returns Wall Shelf ]
         │                                               │
    Hides Tape                                   Commits Slot Position
```

1. **3D Flight Proxy (`.vhs-flight-proxy`)**: A detached DOM proxy clones the eliminated tape's sleeve hue, title typography, and artwork.
2. **Curved Flight Trajectory**: Using the Web Animations API, the proxy scales up slightly (`scale(1.04)`), arcs across the screen with rotational tilt (`-3deg` to `+2deg`), and drops cleanly into its designated slot on the Returns Wall with a cubic-bezier ease (`cubic-bezier(0.22, 1, 0.36, 1)`).
3. **Reduced Motion Fallback**:
   * For users with `prefers-reduced-motion: reduce` enabled, the flight animation is automatically bypassed.
   * Eliminated tapes immediately commit directly to the Returns Wall without spatial translation, maintaining full tournament pacing without disorienting motion.

---

## Related Documentation

* **[Feature: VHS Wheel](Feature-VHS-Wheel)**: 3D cassette aesthetics, inspection controls, and capacity configuration.
* **[Feature: Themes](Feature-Themes)**: Visual themes, parchment/glassmorphism styling, and custom slice color behavior.
* **[Feature: Fairness and Verification](Feature-Fairness-and-Verification)**: Monte Carlo verification tools and mathematical probability distribution.
* **[User Guide](User-Guide)**: Getting started with lists and wheel controls.

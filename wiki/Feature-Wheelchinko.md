# Feature: Wheelchinko

**Wheelchinko** is an arcade-inspired pegboard mode for selecting movies from your Letterboxd watchlist. Instead of spinning a radial wheel, a weighted mini-wheel puck drops through a field of deflection pegs, ricocheting with real-time physics and authentic acoustic clacks into movie box art slots arranged directly inside the bottom of the board.

---

## Game Styles & Scalability (Up to 100 Movies)

Wheelchinko features three distinct game styles tailored for different group sizes and decision formats, supporting watchlists of up to 100+ movies:

| Style | Description | Mechanics |
| :--- | :--- | :--- |
| **Random 10** *(Default)* | Fixed 10-slot showcase | Samples 10 movies from your eligible watchlist. Includes a **Draw another 10** redraw button when your watchlist exceeds capacity. |
| **Elimination** | Mega-Wide Battle Royale (Up to 100 Movies) | Puts **all contenders (up to 100 movies)** directly onto the board simultaneously in a unified Battle Royale! Drops rapid multi-puck salvos (1 to 5 pucks) targeting active contenders evenly across the entire width. Hit movies are knocked out (`✕`), and the **remaining slots dynamically expand in real time**! As contenders thin out (100 → 50 → 20 → 10), posters grow progressively larger until two massive finalist showdown cards face off. Automatically throttles to **1 single puck at the Final 10** for maximum drama! |
| **Spinchinko** | 10 Golden Pucks Qualifier & Wheel Showdown | Puts **all contenders (up to 100 movies)** onto the board simultaneously. Drops a salvo of **10 golden pucks** simultaneously across the field. Landing slots are qualified with golden borders, ambient glow, and star badges (`★`). Once 10 distinct finalists are qualified, they transfer to the wheel for a grand finale showdown! Users can select either **1 Spin Mode** or **Knockout Mode** for the wheel showdown, and can re-drop pucks at any time. |

---

## Mega-Wide Battle Royale & Dynamically Expanding Slots

To keep elimination fast, intuitive, and 100% fair without complex pod math or round partitions:
* **All-In-One Mega Board**: All active movies (up to 100) line up along the grounded bottom tray from the very start.
* **Dynamic Slot Expansion**: Whenever a wave eliminates contenders, the board slot geometry recalculates and the remaining slots expand to fill the entire floor width.
  * *100 Contenders*: Ultra-compact sleek cards with full-title popover tooltips on hover.
  * *50 Contenders*: Standard compact cards.
  * *20 Contenders*: Full 2:3 widescreen posters.
  * *Final 2 Showdown*: Huge, face-to-face cinematic showdown cards!
* **Dynamic Puck & Divider Scaling**: Puck radius and divider clearance scale proportionally with slot density ($5.5\text{px}$ up to $12\text{px}$+), ensuring pucks smoothly enter narrow slots without pinching or wedging.
* **Multi-Target Fair Launcher**: Rather than dropping from a static center point (which creates a central Plinko bell-curve bias), the launcher targets randomly selected active contenders across the board, guaranteeing every movie has an equal probability of interaction.
* **Multi-Puck Salvos (1 to 5)**: High-speed waves eliminate multiple movies simultaneously, finishing a 100-movie battle in ~60–90 seconds.
* **Automatic Final 10 Climax**: When only 10 contenders remain, the game automatically locks to single-puck drops with suspenseful pacing down to the final champion!
* **Endgame Interleaved Grid & Knife-Edge Seam Drops**: In the final 2–5 showdowns, the floor automatically transitions to an interleaved alternating grid (e.g. 10 alternating `[A, B, A, B, A, B, A, B, A, B]` slots for the Final 2, 9 slots for the Final 3, etc.). Instead of dropping into giant slots where the outcome is predetermined by drop position, pucks drop directly on the knife-edge dividing seams between opposing contenders with micro-jitter. Every single peg bounce shifts the puck between opponents, creating an edge-of-your-seat, authentic 50/50 duel!

## In-Board Tall Box Art Slots & Catcher Floor

* **Authentic 2:3 Box Art Cases**: Box art maintains standard 2:3 vertical movie poster aspect ratio without stretching, framed with subtle card borders, realistic depth shadows, and grounded at the bottom of each chute on the catcher floor tray.
* **Grounded Metallic Catcher Floor**: A solid physical bottom tray and catcher floor baseboard with warm slate and amber bevels anchors the slots to the board.
* **True In-Slot Landing**: The slot cards sit inside the bottom slot bay behind the canvas divider rails. As the puck falls down a chute, it lands resting directly on top of / inside the movie's box art.
* **High-Res Posters & Fallbacks**: Posters are dynamically fetched and cached via the movie metadata provider, with cinematic fallback title cards for movies without posters.
* **Slot Badges**: Top-left slot numbering badges (`#1`, `#2`, etc.) and top-right weight badges (`2x`, `3x`) overlay neatly in the corners of each box art case.
* **Winner & Knockout Highlights**: Winning slots illuminate with an arcade golden pulse; eliminated slots flash with a knockout `✕` stamp and dissolve effect.
* **Floating Tooltip Popovers**: Hovering or focusing any slot reveals an anchored popover above the card with full, unwrapped title text and metadata.

---

## Widescreen Pegboard, "PTW!" Mini-Wheel Puck, & Physics Engine

* **Widescreen Coordinates (1400 × 1040px)**: Engineered with wide 1400px geometry and 17 rows of staggered pegs (~370 pegs). Slot chutes provide wide clearance (59px opening for a 24px puck with 20 movies), completely preventing pucks from wedging or getting stuck.
* **Sealed Perimeter Deflectors**: Angled triangular wall deflectors on alternating rows seal off the left and right borders of the board, preventing pucks from slipping into a vertical straight-down hallway along the outer edges without hitting pegs.
* **Apex Anti-Wedge Safeguards**: Divider caps feature apex deflectors that apply lateral impulses if a puck ever hits dead-center on a cap, guaranteeing it always tips into a slot.
* **"PTW!" Mini-Wheel Puck**: Modeled as a mini Letterboxd Watchlist Wheel with 6 multi-colored spokes, dark slate gold-rimmed hub, and centered bold `PTW!` ("Praise The Wheel!") text. Features rotational physics and spin ricochets.
* **Substep Integration**: Runs a 4-substep physics loop per frame to prevent peg tunneling and guarantee smooth, realistic bounces even at high terminal velocities.
* **Theater Mode Expansion**: Clicking the dedicated **Theater Mode ⛶** button opens an expansive widescreen arena (up to 1680px wide) that utilizes full viewport space.

---

## VHS Mode Compatibility

When **3D VHS Wheel** mode is enabled in preferences, Wheelchinko's bottom slots automatically adopt retro cassette styling:
* Authentic VHS cassette tape spine accents with sleeve color borders matching the palette.
* Full integration with the 3D VHS cassette inspection flow and winner tape viewer.

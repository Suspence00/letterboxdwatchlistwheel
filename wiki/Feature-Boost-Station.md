# Feature: Boost Station

The **Boost Station** brings social stakes to movie night. Instead of passively spinning a uniform wheel, participants can advocate for films they are eager to watch by "boosting" them—giving their favorites a larger share of the wheel or greater resilience in elimination mode.

---

## 1. Purpose of the Boost Station

Movie nights often run into the classic dilemma: multiple people have strong opinions, yet endless debating stalls the evening. 

The Boost Station provides a structured, gamified solution:
* **Participant Ownership**: Friends, family members, or stream viewers can "put their name on" movies.
* **Weighted Influence**: Slices scale proportionally with the number of boosts, making higher-staked movies more likely to win while keeping every selected title in play.
* **Full Transparency**: Colored contributor tags reveal exactly who boosted which film, complete with a timestamped audit log.

---

## 2. Opening the Boost Station & Attributing Boosts

The Boost Station can be opened from multiple locations in the interface:
* **Curate Header**: Click the **Boost Station** icon button or **☸️ Random Boost** button in Step 2.
* **Slice Editor**: Click **Boost** directly while editing an individual film.

```
+-------------------------------------------------------------+
| Boost Station                                           [×] |
+-------------------------------------------------------------+
| Booster Name:                                               |
| [ Alice                                                   ] |
|                                                             |
| Select Movie to Boost:                                      |
| [ Filter movies...                                        ] |
| +---------------------------------------------------------+ |
| | Alien (1979) [1x]                                       | |
| | Blade Runner (1982) [2x]                                | |
| | The Thing (1982) [3x]                                   | |
| +---------------------------------------------------------+ |
|                                                             |
| [ Boost Selected ]  [ Remove ]    OR    [ 🎲 Random Boost ] |
+-------------------------------------------------------------+
```

### Booster Attribution
1. **Enter a Booster Name**: Enter the name of the participant (e.g. *Alice*, *Dave*, *Host*). If left blank, boosts default to *Anonymous*.
2. **Filter & Select**: Type in the search box to filter the watchlist instantly, then click the desired title.
3. **Execute the Boost**: Click **Boost Selected** to apply a +1x weight increase.

---

## 3. Boost Mechanics: Specific vs. Random Boost

The Boost Station provides two distinct methods for allocating boosts:

### Method A: Specific Boost (+1x)
* Selecting a movie and clicking **Boost Selected** increases that film's weight by **+1x**.
* A booster record is appended to the movie:
  ```json
  {
    "name": "Alice",
    "timestamp": 1740000000000,
    "source": "manual"
  }
  ```
* The movie row updates immediately, reflecting the new weight multiplier and displaying a colored booster tag.

### Method B: Random Boost (+1x via Spin)
* Don't know what to boost, or want the wheel itself to award a bonus? Click **Random Boost**.
* The application prompts for a booster name, smoothly scrolls to the wheel, and initiates a special spin.
* **The Level Playing Field**: During a Random Boost spin, all active movies are temporarily treated as having an equal **1x weight**, regardless of current multipliers.
* **The Prize**: Whichever film the wheel lands on is permanently awarded a **+1x boost** attributed to that booster (`source: 'random'`).

---

## 4. Contributor Tags & Booster Action Overlay

When a movie receives boosts, pill tags appear alongside the title in the movie list (e.g., `Alice x2`, `Bob x1`).

### Custom Booster Colors
* The system automatically generates a deterministic pastel color for each unique booster name.
* You can customize any booster's signature color via the action overlay color picker. Custom colors are saved across the workspace in `appState.preferences.boosterColors`.

### The Booster Action Overlay
Clicking directly on any booster tag in the list opens a management card:

```
+---------------------------------------------------+
| Alice                                        [🎨] |
| Contributions to The Thing: 2                     |
+---------------------------------------------------+
| History:                                          |
| • ➕ Manual Boost     Feb 18, 8:30 PM             |
| • 🎲 Random Boost     Feb 18, 8:15 PM             |
+---------------------------------------------------+
| [ ➕ Add Boost (+1) ]                             |
| [ ➖ Remove One (-1) ]                            |
| [ 🗑️ Remove All     ]                            |
| [ Done             ]                              |
+---------------------------------------------------+
```

From this dialog you can:
* **View History**: Inspect timestamps and see whether boosts came from manual selection or a Random Boost spin.
* **Add Boost (+1)**: Increment the booster's contribution by 1.
* **Remove One (-1)**: Reduce the booster's contribution by 1.
* **Remove All**: Completely remove all contributions from this booster for this movie.
* **Change Color**: Pick a new color swatch for this person across all their boosted titles.

---

## 5. Removing Boosts & Arithmetic Reduction

Boosts can be decremented through the Boost Station modal or the Contributor Tag overlay:

* **Single Decrement**: Clicking **Remove** in the Boost Station decrements the selected movie's weight by 1x and removes the most recent booster entry.
* **Baseline Limit**: Weights cannot be reduced below the baseline minimum of **1x**. If a film is already at 1x, the Remove button is disabled.
* **Recalculation Formula**:
  $$\text{Weight} = \max\left(1, \; \text{Booster Count} + 1, \; \text{Target Weight}\right)$$
  This guarantees that total weight stays synchronized with the sum of active booster tags.

---

## 6. The 5x Boost Limit Rule

To maintain game balance and prevent a single participant from hijacking the wheel, slice weights are strictly capped:

$$\text{Weight Range: } [1\text{x}, \; 5\text{x}]$$

* **Why 5x?** In testing, unconstrained weights (e.g., 20x or 50x) warped the wheel into a near-certainty, ruining the excitement for other participants. A 5x cap ensures that even heavily boosted films remain vulnerable to lucky underdogs.
* **Reaching the Cap**: Once a movie reaches 5x, further boost attempts are blocked with a friendly alert (`Max weight reached!`).

---

## 7. Strategic Odds Impact by Game Mode

Boosts behave differently depending on which spin mode you play:

### One Spin Mode (Proportional Area)
In standard One Spin mode, a movie's selection probability is strictly proportional to its slice area:

$$P(\text{Win}_i) = \frac{w_i}{\sum_{k=1}^N w_k}$$

* If a pool of 10 movies has nine 1x titles and one 5x title, the total weight is $9 + 5 = 14$.
* The 5x film commands a $\frac{5}{14} \approx 35.7\%$ chance of winning on that single spin.
* The 1x films each hold $\frac{1}{14} \approx 7.1\%$.

### Knockout Mode (Inverse Survival Probability)
In Knockout Mode ("Last Movie Standing"), the pointer eliminates movies one by one. To ensure higher weight still benefits the movie, **the math is inverted**:

$$P(\text{Elimination}_i) = \frac{1 / w_i}{\sum_{k=1}^M (1 / w_k)}$$

* **Higher Weight = Smaller Elimination Slice**: A 5x film receives an elimination slice weight of $\frac{1}{5} = 0.2$, whereas a 1x film receives an elimination slice weight of $\frac{1}{1} = 1.0$.
* **Compounding Survival**: Because the 5x movie is 5 times less likely to be eliminated in *each individual round*, its cumulative chance of surviving all elimination rounds and emerging as champion is dramatically amplified.

| Film | Weight | One Spin Win Odds (10 films) | Knockout Round 1 Elimination Risk |
| :--- | :--- | :--- | :--- |
| *Contender A* | **1x** | $7.1\%$ | $\approx 10.9\%$ |
| *Contender B* | **2x** | $13.3\%$ | $\approx 5.4\%$ |
| *Contender C* | **5x** | **$31.2\%$** | **$\approx 2.2\%$** |

---

## Related Documentation

* **[User Guide](User-Guide)**: Overview of wheel curation, slice editing, and spinning.
* **[Feature: Knockout Mode](Feature-Knockout-Mode)**: Detailed breakdown of elimination mechanics.
* **[Feature: Workspaces & Boards](Feature-Workspaces-and-Boards)**: How weights and booster tags are persisted per board.

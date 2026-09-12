# Feature: Fairness and Verification

When organizing a group movie night, trust in the selection process is paramount. If participants suspect the wheel is rigged, biased, or inconsistent, the fun evaporates. The **Letterboxd Watchlist Wheel** is built on transparent, verifiable mathematics and includes an in-browser **Monte Carlo Simulation Tool** so any participant can audit the system's fairness in real time.

---

## The Value of Verifiable Fairness

In standard tabletop or digital wheels, visual animations can sometimes mask flawed selection logic. In this application:

* **Separation of Outcome and Animation**: The winning outcome is determined by a cryptographically sound mathematical distribution before animation physics begin. The visual spin is an organic physical simulation calculated to land precisely on the calculated winner.
* **Deterministic Weight Accounting**: When movies are given custom weights (e.g., 2x or 5x) or boosted via contributors, their exact share of the probability distribution scales proportionally without rounding distortions.
* **No Server-Side Tampering**: The application is 100% local-first and runs in your browser. No remote servers influence, record, or bias the selection.

---

## The Monte Carlo Simulation Tool

To prove that runtime wheel odds match theoretical expectations, the app includes a dedicated audit tool:

### Accessing the Tool

1. Open the **Settings ⚙️** dialog.
2. Select the **Advanced** tab (`#tab-advanced`).
3. Under **System Audit**, click **🛡️ Verify Fairness** (`#verify-fairness-btn`).
4. The system executes a full simulation and immediately presents the **Fairness Audit Report Modal** (`#verify-modal`).

### How the Simulation Works

The simulation engine (`js/verify.js`) runs directly against your current active lineup:

1. **Active Filter Matching**: Retrieves the exact filtered and selected movie candidates currently present on the wheel.
2. **Probability Model Construction**: Computes segment boundaries using `computeWheelModel(candidates)`, reflecting current user weights and active multipliers.
3. **10,000 Synthetic Spins**: Simulates 10,000 independent spins using the identical cumulative probability sampling routine executed during real spins:
   ```javascript
   const targetWeight = Math.random() * totalWeight;
   let cumulative = 0;
   for (const segment of segments) {
       cumulative += segment.weight;
       if (targetWeight <= cumulative) {
           winnerId = segment.movie.id;
           break;
       }
   }
   ```
4. **Sub-10ms Execution**: Because calculations occur in optimized synchronous JavaScript without rendering overhead, all 10,000 trials complete in **under 10 milliseconds**.
5. **Statistical Aggregation**: Aggregates win counts for every film, calculates empirical ratios, and computes deviations from theoretical expected values.

---

## Understanding the Audit Report Table

The **Fairness Audit Report** formats the empirical test into an accessible, sortable table:

| Column | Description | Example |
| :--- | :--- | :---: |
| **Movie** | Title of the film in the current audit pool. | *The Witch* |
| **Weight** | The movie's active weight multiplier. | `2.00` |
| **Expected** | Theoretical probability percentage: $\frac{\text{Weight}_i}{\text{Total Weight}} \times 100\%$. | `20.00%` |
| **Actual** | Empirical frequency across 10,000 simulated spins: $\frac{\text{Wins}_i}{10,000} \times 100\%$. | `20.14%` |
| **Diff** | The net variance between empirical and theoretical percentages: $\text{Actual} - \text{Expected}$. | `+0.14% ✅` |

### Status Badges & Variance Thresholds

Each row's **Diff** column is classified by strict statistical thresholds:

* **Good (`diff-good`) ✅**: Variance is less than $\pm 0.50\%$. The simulated frequency aligns almost perfectly with the theoretical distribution.
* **OK (`diff-ok`) ⬜**: Variance is between $\pm 0.50\%$ and $\pm 1.00\%$. Well within normal statistical fluctuations for 10,000 trials.
* **Review Needed (`diff-bad`) ⚠️**: Variance exceeds $\pm 1.00\%$. Indicates an unexpected anomaly or heavily skewed sample requiring review.

The dialog summary header aggregates overall health at a glance (e.g., `Perfect! All 10 items are within optimal variance.` with badge counts for Good, OK, and High Diff).

---

## Verification Mathematics & Probability Theory

The audit tool's reliability rests on foundational theorems of probability and statistics:

### 1. The Law of Large Numbers (LLN)
The Law of Large Numbers states that as the number of identically distributed independent trials ($N$) grows, the sample mean converges almost surely to the theoretical expected value:

$$\lim_{N \to \infty} P\left(\left| \frac{1}{N}\sum_{k=1}^N X_k - \mu \right| < \epsilon \right) = 1$$

With $N = 10{,}000$ iterations, empirical win frequencies reliably cluster tightly around their true mathematical weights.

### 2. Standard Error & Variance Bounds
For a movie with theoretical probability $p$, the number of simulated wins follows a binomial distribution $B(N, p)$. The standard error ($\sigma$) of the sample proportion $\hat{p} = \frac{\text{Wins}}{N}$ is given by:

$$\sigma_{\hat{p}} = \sqrt{\frac{p(1 - p)}{N}}$$

For a typical film on a 10-movie wheel with $p = 0.10$ ($10\%$) and $N = 10{,}000$:

$$\sigma_{\hat{p}} = \sqrt{\frac{0.10 \times 0.90}{10{,}000}} = \sqrt{\frac{0.09}{10{,}000}} = \sqrt{0.000009} = 0.003 = 0.30\%$$

Under the normal approximation to the binomial distribution:
* **$68.2\%$** of trials fall within $\pm 1\sigma$ ($\pm 0.30\%$).
* **$95.4\%$** of trials fall within $\pm 2\sigma$ ($\pm 0.60\%$).
* **$99.7\%$** of trials fall within $\pm 3\sigma$ ($\pm 0.90\%$).

This mathematical proof confirms that the application's threshold of **$< 0.50\%$ for Good** and **$< 1.00\%$ for OK** perfectly mirrors the natural statistical confidence intervals of a fair 10,000-trial simulation.

### 3. Pseudorandom Number Generator (PRNG) Integrity
The wheel uses modern JavaScript browser engines' high-entropy implementation of `Math.random()`, typically powered by **xorshift128+** or **Permuted Congruential Generators (PCG)**. These PRNGs provide period lengths of $2^{128} - 1$, preventing cyclic repetition, clustering, or predictable outcomes during movie night spins.

---

## Related Documentation

* **[Technical Deep Dive](Technical-Deep-Dive)**: Comprehensive breakdown of wheel physics, canvas rendering, and state management.
* **[Feature: Knockout Mode](Feature-Knockout-Mode)**: Inverse weighting mathematics and tournament bracket rules.
* **[Feature: VHS Wheel](Feature-VHS-Wheel)**: 3D cassette lineup sampling and inspection.
* **[User Guide](User-Guide)**: Getting started with the application.

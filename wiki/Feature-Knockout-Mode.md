# Feature: Knockout Mode

**Knockout Mode** (also known as "Last Movie Standing") is a unique way to select a movie. Instead of picking a winner in one spin, the wheel eliminates movies one by one until only one remains.

## How it Works

1.  **Selection:** Ensure you have multiple movies selected (at least 2).
2.  **Mode Check:** Make sure "One Spin to Rule them all" is **unchecked** in Advanced Options.
3.  **Start:** Click **Start Movie Knockout mode**.
4.  **The Process:**
    *   The wheel spins.
    *   The movie it lands on is **ELIMINATED** (removed from the wheel).
    *   The wheel spins again with the remaining movies.
    *   This repeats automatically.
5.  **The Winner:** The last movie remaining on the wheel is the winner!

## Inverse Weighting

In Knockout Mode, the logic for "Weights" is flipped to be intuitive for survival:

*   **Higher Weight = Harder to Kill.**
*   If you give a movie a **10x weight**, it means it has a much *smaller* slice on the elimination wheel, making it less likely to be hit by the pointer.
*   Therefore, **Higher Weight = Higher Chance of Winning**.

> [!IMPORTANT]
> This is different from "One Spin" mode, where a larger slice means a higher chance of being picked. The app handles this math for you, so just remember: **More Weight is always "Better" for the movie you want to win.**

## Strategy
Use Knockout Mode when you have a short list of strong contenders and want to build suspense. It's great for group nights where everyone cheers as their least favorites get knocked out.

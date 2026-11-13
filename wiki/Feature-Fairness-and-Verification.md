# Feature: Fairness and Verification

The Fairness Audit compares the expected odds for your current wheel with the results of 10,000 simulated trials. The simulation runs in your browser.

1. Select **1 Spin** or **Knockout**.
2. Open **Settings → Advanced** and click **Verify Fairness**.
3. Close the report with **×**, **Escape**, or a click outside the dialog.

The audit uses the same selection and filters as a real spin. In **1 Spin**, it uses the current VHS tape lineup or the full eligible pool on the Classic wheel. Each movie's chance is its weight divided by the total lineup weight.

In **Knockout**, all eligible movies enter the simulation. Each round uses inverse weights to choose an elimination. The audit samples the mathematically equivalent exponential-clock model, where the last clock to ring determines the winner. The expected result accounts for the full tournament.

The report shows each movie's assigned weight, expected win percentage, simulated win percentage, and the difference in percentage points. Each run draws a new sample, so the actual percentages vary.

- [Knockout Mode](Feature-Knockout-Mode)
- [3D VHS Wheel](Feature-VHS-Wheel)

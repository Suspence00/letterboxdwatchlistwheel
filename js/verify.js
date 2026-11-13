import { getCurrentSpinMode, getFilteredSelectedMovies } from './state.js';
import { computeWheelModel } from './wheel.js';
import { getVhsLineup } from './vhs-wheel.js';
import { getKnockoutWinOdds, groupKnockoutMovies, pickWeighted } from './wheel-odds.js';
import { getStoredWeight } from './utils.js';

export function runFairnessAudit(iterations = 10000) {
    const mode = getCurrentSpinMode();
    if (mode === 'wheelchinko') return { error: 'Switch to 1 Spin or Knockout to audit the wheel.' };

    const candidates = getVhsLineup(getFilteredSelectedMovies(), mode);
    if (!candidates.length) return { error: 'No movies selected to audit.' };

    const { segments, totalWeight } = computeWheelModel(candidates, mode);
    const knockout = mode === 'knockout';
    const expected = knockout ? getKnockoutWinOdds(candidates) : null;
    const groups = knockout ? groupKnockoutMovies(candidates) : [];
    const wins = new Map(candidates.map(movie => [movie.id, 0]));

    for (let i = 0; i < iterations; i++) {
        const winner = knockout ? sampleKnockoutWinner(groups) : pickWeighted(segments, totalWeight).movie;
        wins.set(winner.id, wins.get(winner.id) + 1);
    }

    const results = segments.map(({ movie, weight }) => {
        const expectedRatio = expected?.get(movie.id) ?? weight / totalWeight;
        const actualRatio = wins.get(movie.id) / iterations;
        return { name: movie.name, weight: getStoredWeight(movie), expectedRatio, actualRatio, diff: actualRatio - expectedRatio };
    });
    results.sort((a, b) => b.expectedRatio - a.expectedRatio);
    return { mode, iterations, candidatesCount: candidates.length, results };
}

// The maximum of n independent exponential clocks has CDF (1 - exp(-rate * t))^n.
// Sample one maximum per weight group. Every movie in the winning group is equally likely.
function sampleKnockoutWinner(groups) {
    let latest = -Infinity;
    let finalists;
    for (const { rate, movies } of groups) {
        const draw = Math.random();
        const time = draw === 0 ? 0 : -Math.log(-Math.expm1(Math.log(draw) / movies.length)) / rate;
        if (time > latest) {
            latest = time;
            finalists = movies;
        }
    }
    return finalists[Math.floor(Math.random() * finalists.length)];
}

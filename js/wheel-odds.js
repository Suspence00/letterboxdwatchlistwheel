import { getStoredWeight } from './utils.js';

/** @param {import('./types.js').Movie} movie */
export function getEffectiveWeight(movie, mode) {
    if (mode === 'random-boost') return 1;
    const weight = getStoredWeight(movie);
    return mode === 'knockout' ? 1 / weight : weight;
}

export function pickWeighted(items, totalWeight) {
    let target = Math.random() * totalWeight;
    for (const item of items) {
        target -= item.weight;
        if (target < 0) return item;
    }
    return items.at(-1);
}

/** @param {import('./types.js').Movie[]} movies */
export function groupKnockoutMovies(movies) {
    const byRate = new Map();
    for (const movie of movies) {
        const rate = getEffectiveWeight(movie, 'knockout');
        if (!byRate.has(rate)) byRate.set(rate, { rate, movies: [] });
        byRate.get(rate).movies.push(movie);
    }
    return [...byRate.values()];
}

/**
 * Independent exponential clocks ordered by their time give the same elimination
 * probabilities as drawing repeatedly with inverse weights. The last clock wins.
 * Integrate the density of one clock ringing after all the others.
 * @param {import('./types.js').Movie[]} movies
 * @returns {import('./types.js').OddsMap}
 */
export function getKnockoutWinOdds(movies) {
    const groups = groupKnockoutMovies(movies);
    if (groups.length <= 1) return new Map(movies.map(movie => [movie.id, 1 / movies.length]));

    const estimates = groups.map(() => 0);
    const stepSize = 0.025;
    // Stop when the probability that any clock is still running is below 1e-12.
    const slowestRate = Math.min(...groups.map(group => group.rate));
    const steps = 2 * Math.ceil(Math.log(movies.length / 1e-12) / (2 * stepSize * slowestRate));
    for (let step = 1; step <= steps; step++) {
        const time = step * stepSize;
        const eliminated = groups.map(({ rate }) => -Math.expm1(-rate * time));
        const allEliminated = groups.reduce((probability, group, index) =>
            probability * eliminated[index] ** group.movies.length, 1);
        const coefficient = step === steps ? 1 : step % 2 ? 4 : 2;
        groups.forEach(({ rate }, index) => {
            estimates[index] += coefficient * allEliminated * rate * Math.exp(-rate * time) / eliminated[index];
        });
    }
    // The common Simpson integration factor cancels during normalization.
    const total = groups.reduce((sum, group, index) => sum + group.movies.length * estimates[index], 0);
    return new Map(groups.flatMap((group, index) => group.movies.map(movie => [movie.id, estimates[index] / total])));
}

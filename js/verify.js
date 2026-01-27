/**
 * Monte Carlo Simulation to audit wheel fairness
 */

import { computeWheelModel } from './wheel.js';
import { appState } from './state.js';

export function runFairnessAudit(iterations = 10000) {
    // 1. Get current candidates (filtered & selected)
    // We replicate the exact logic from wheel.js/spinWheel
    // Filters and selection state must be respected.
    const { movies, selectedIds, filter } = appState;
    const candidates = movies.filter(movie => {
        if (!selectedIds.has(movie.id)) return false;
        if (!filter.showCustoms && movie.isCustom) return false;
        if (filter.normalizedQuery) {
            const haystack = [movie.name, movie.year, movie.date]
                .filter(part => typeof part === 'string' && part.trim())
                .join(' ')
                .toLowerCase();
            if (!haystack.includes(filter.normalizedQuery)) return false;
        }
        return true;
    });

    if (!candidates.length) {
        return { error: "No movies selected to audit." };
    }

    // 2. Compute the exact probability model the wheel uses
    // We need to check if inverse mode is active (though for audit we usually assume standard unless specified)
    // For now, let's just use the default state from appState if we had access, but wheel.js handles it internally
    // if we don't pass override. However, since we are outside the wheel module context of 'useInverseWeights',
    // we should probably respect the current UI state or just assume standard for the audit.
    // Let's assume standard for now to match the 'weight' column display.
    const { segments, totalWeight } = computeWheelModel(candidates);

    if (!segments.length || totalWeight <= 0) {
        return { error: "Total weight is zero." };
    }

    // 3. Map segment "Expected" probabilities
    // Map<MovieID, { expectedPct, wins, name }>
    const stats = new Map();

    segments.forEach(seg => {
        stats.set(seg.movie.id, {
            id: seg.movie.id,
            name: seg.movie.name,
            weight: seg.weight,
            expectedRatio: seg.weight / totalWeight,
            wins: 0
        });
    });

    // 4. Run Monte Carlo Simulation
    // We manually simulate the random selection loop from performSpin()
    // Doing this synchronously for 10k items is instant in JS (sub-10ms)

    for (let i = 0; i < iterations; i++) {
        const targetWeight = Math.random() * totalWeight;
        let cumulative = 0;
        let winnerId = segments[segments.length - 1].movie.id; // Default fallback

        for (const segment of segments) {
            cumulative += segment.weight;
            if (targetWeight <= cumulative) {
                winnerId = segment.movie.id;
                break;
            }
        }

        const entry = stats.get(winnerId);
        if (entry) {
            entry.wins++;
        }
    }

    // 5. Format Results
    const results = Array.from(stats.values()).map(entry => {
        return {
            ...entry,
            actualRatio: entry.wins / iterations,
            diff: (entry.wins / iterations) - entry.expectedRatio
        };
    });

    // Sort by expected probability (descending)
    results.sort((a, b) => b.expectedRatio - a.expectedRatio);

    return {
        iterations,
        candidatesCount: candidates.length,
        results
    };
}

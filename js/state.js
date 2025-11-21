/**
 * State management for the Letterboxd Watchlist Wheel
 */

import { debounce } from './utils.js';

const STORAGE_KEY = 'letterboxd_wheel_state';

export const appState = {
    movies: [],
    selectedIds: new Set(),
    history: [],
    filter: {
        query: '',
        normalizedQuery: '',
        showCustoms: true
    },
    knockoutResults: new Map()
};

/**
 * Saves the current state to localStorage
 */
export function saveState() {
    const stateToSave = {
        allMovies: appState.movies,
        selectedIds: Array.from(appState.selectedIds),
        history: appState.history,
        filterState: appState.filter
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stateToSave));
}

export const debouncedSaveState = debounce(saveState, 1000);

/**
 * Loads state from localStorage
 * @returns {boolean} True if state was loaded and has movies, false otherwise
 */
export function loadState() {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return false;

    try {
        const loaded = JSON.parse(stored);
        if (loaded.allMovies && Array.isArray(loaded.allMovies)) {
            appState.movies = loaded.allMovies;
        }
        if (loaded.selectedIds && Array.isArray(loaded.selectedIds)) {
            appState.selectedIds = new Set(loaded.selectedIds);
        }
        if (loaded.history && Array.isArray(loaded.history)) {
            appState.history = loaded.history;
        }
        if (loaded.filterState) {
            Object.assign(appState.filter, loaded.filterState);
        }

        return appState.movies.length > 0;
    } catch (e) {
        console.error('Failed to load state', e);
        return false;
    }
}

/**
 * Adds a movie to the history
 * @param {Object} movie 
 */
export function addToHistory(movie) {
    const entry = {
        id: crypto.randomUUID(),
        movieId: movie.id,
        name: movie.name,
        year: movie.year,
        timestamp: Date.now(),
        uri: movie.uri
    };
    appState.history.unshift(entry);
    // Keep only last 50 entries
    if (appState.history.length > 50) {
        appState.history = appState.history.slice(0, 50);
    }
    saveState();
}

/**
 * Clears the history
 */
export function clearHistory() {
    appState.history = [];
    saveState();
}

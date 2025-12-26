/**
 * Utility functions for the Letterboxd Watchlist Wheel
 */

export const basePalette = [
    '#ff8600',
    '#3ab0ff',
    '#f25f5c',
    '#70e000',
    '#9d4edd',
    '#f9844a',
    '#00bbf9',
    '#ffd23f',
    '#06d6a0',
    '#ff70a6',
    '#f896d8',
    '#1fab89',
    '#ffbe0b',
    '#577590',
    '#ff5d8f'
];

export const holidayPalette = [
    '#c93737',
    '#1f7a4d',
    '#f0c75e',
    '#9b2f2f',
    '#2e9b6b',
    '#f2a65a',
    '#7ab6d9',
    '#d1495b',
    '#2d6a4f',
    '#f7e1a1',
    '#b56576',
    '#4c956c',
    '#f28482',
    '#84a59d',
    '#f6bd60'
];

export const hanukkahPalette = [
    '#1d4ed8',
    '#3b82f6',
    '#60a5fa',
    '#fde68a',
    '#facc15',
    '#2563eb',
    '#93c5fd',
    '#1e40af',
    '#f59e0b',
    '#38bdf8',
    '#7dd3fc',
    '#1e3a8a',
    '#eab308',
    '#0ea5e9',
    '#fbbf24'
];

export const DEFAULT_SLICE_COLOR = basePalette[0];

const getActivePalette = () => {
    if (typeof document === 'undefined') {
        return basePalette;
    }
    if (document.body && document.body.classList.contains('theme-holiday')) {
        return holidayPalette;
    }
    if (document.body && document.body.classList.contains('theme-hanukkah')) {
        return hanukkahPalette;
    }
    return basePalette;
};

/**
 * Converts HSL color values to Hex string
 * @param {number} h Hue (0-360)
 * @param {number} s Saturation (0-100)
 * @param {number} l Lightness (0-100)
 * @returns {string} Hex color string (e.g. "#ff0000")
 */
export function hslToHex(h, s, l) {
    const hue = ((Number(h) % 360) + 360) % 360;
    const saturation = Math.max(0, Math.min(100, Number.isFinite(s) ? s : 0)) / 100;
    const lightness = Math.max(0, Math.min(100, Number.isFinite(l) ? l : 0)) / 100;
    const a = saturation * Math.min(lightness, 1 - lightness);
    const convert = (n) => {
        const k = (n + hue / 30) % 12;
        const color = lightness - a * Math.max(-1, Math.min(k - 3, Math.min(9 - k, 1)));
        return Math.round(255 * color)
            .toString(16)
            .padStart(2, '0');
    };
    return `#${convert(0)}${convert(8)}${convert(4)}`;
}

/**
 * Generates a dynamic color based on an index using the Golden Angle
 * @param {number} index 
 * @returns {string} Hex color string
 */
export function generateDynamicColor(index) {
    const goldenAngle = 137.508;
    const hue = (index * goldenAngle) % 360;
    const saturation = 65 + ((index * 7) % 18);
    const lightness = 48 + ((index * 11) % 12);
    return hslToHex(hue, saturation, lightness);
}

/**
 * Gets a color for a specific index, using the base palette or generating a dynamic one
 * @param {number} index 
 * @returns {string} Hex color string
 */
export function getDefaultColorForIndex(index) {
    const palette = getActivePalette();
    if (!Number.isFinite(index)) {
        return palette[0] || DEFAULT_SLICE_COLOR;
    }
    const normalizedIndex = Math.max(0, Math.floor(index));
    if (normalizedIndex < palette.length) {
        return palette[normalizedIndex];
    }
    return generateDynamicColor(normalizedIndex);
}

/**
 * Debounces a function call
 * @param {Function} fn Function to debounce
 * @param {number} delay Delay in milliseconds
 * @returns {Function} Debounced function
 */
export function debounce(fn, delay = 200) {
    let timeoutId;
    return (...args) => {
        if (timeoutId) {
            window.clearTimeout(timeoutId);
        }
        timeoutId = window.setTimeout(() => {
            timeoutId = null;
            fn(...args);
        }, delay);
    };
}

/**
 * Shuffles an array in place
 * @param {Array} array 
 * @returns {Array} The shuffled array
 */
export function shuffle(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

export function escapeSelector(value) {
    if (window.CSS && typeof window.CSS.escape === 'function') {
        return window.CSS.escape(value);
    }
    return String(value).replace(/["\\]/g, '\\$&');
}

export function sanitizeColor(value, fallback) {
    if (typeof value === 'string') {
        const trimmed = value.trim().toLowerCase();
        if (/^#([0-9a-f]{6})$/i.test(trimmed)) {
            return trimmed;
        }
    }
    if (typeof fallback === 'string' && /^#([0-9a-f]{6})$/i.test(fallback.trim())) {
        return fallback.trim().toLowerCase();
    }
    const palette = getActivePalette();
    return palette[0] || DEFAULT_SLICE_COLOR;
}

export function getStoredColor(movie, fallback) {
    if (!movie || typeof movie !== 'object') {
        return sanitizeColor('', fallback);
    }
    return sanitizeColor(movie.color, fallback);
}

export function clampWeight(value) {
    if (!Number.isFinite(value)) {
        return 1;
    }
    return Math.min(10, Math.max(1, Math.round(value)));
}

export function getStoredWeight(movie) {
    if (!movie || typeof movie !== 'object') {
        return 1;
    }
    return clampWeight(Number(movie.weight));
}

export function getMovieOriginalIndex(movie, allMovies) {
    if (!movie || typeof movie !== 'object') {
        return -1;
    }
    if (Number.isFinite(movie.initialIndex)) {
        return movie.initialIndex;
    }
    const index = allMovies.indexOf(movie);
    return index >= 0 ? index : -1;
}

export function buildMovieIdentityKey(movie = {}) {
    const uri = typeof movie.uri === 'string' ? movie.uri.trim().toLowerCase() : '';
    if (uri) {
        return `uri:${uri}`;
    }
    const name = typeof movie.name === 'string' ? movie.name.trim().toLowerCase() : '';
    const year = typeof movie.year === 'string' ? movie.year.trim() : '';
    if (name && year) {
        return `name:${name}|year:${year}`;
    }
    if (name) {
        return `name:${name}`;
    }
    return null;
}

/**
 * Decodes HTML entities in a string (e.g. "Freddy&#039;s" -> "Freddy's")
 * @param {string} text 
 * @returns {string}
 */
export function decodeHtmlEntities(text) {
    if (!text) return '';
    const doc = new DOMParser().parseFromString(text, 'text/html');
    return doc.documentElement.textContent;
}

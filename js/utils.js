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

export const DEFAULT_SLICE_COLOR = basePalette[0];

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
    if (!Number.isFinite(index)) {
        return DEFAULT_SLICE_COLOR;
    }
    const normalizedIndex = Math.max(0, Math.floor(index));
    if (normalizedIndex < basePalette.length) {
        return basePalette[normalizedIndex];
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
    return DEFAULT_SLICE_COLOR;
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

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

export const cyberPalette = [
    '#f70776', // Hot Pink
    '#2de2e6', // Cyan
    '#9d4edd', // Deep Purple
    '#f7f707', // Neon Yellow
    '#ff0055', // Red Pink
    '#02fdfe', // Bright Blue
    '#d60270', // Magenta
    '#9b5de5', // Lavender
    '#0038a8', // Deep Blue
    '#f15bb5', // Bubblegum
    '#00f5d4', // Teal Neon
    '#7209b7', // Violet
    '#4cc9f0', // Sky Neon
    '#4361ee', // Royal Blue
    '#3a0ca3'  // Indigo
];

export const modernPalette = [
    '#ff453a', // Red
    '#ff9f0a', // Orange
    '#ffd60a', // Yellow
    '#32d74b', // Green
    '#64d2ff', // Teal
    '#0a84ff', // Blue
    '#5e5ce6', // Indigo
    '#bf5af2', // Purple
    '#ff375f', // Pink
    '#ac8e68', // Brown
    '#ff453a', // Red (Repeat)
    '#0a84ff'  // Blue (Repeat)
];

export const alaskaPalette = [
    '#1e3a8a', // Flag Blue
    '#FFD700', // Polaris Gold
    '#0ea5e9', // Sky Blue
    '#c084fc', // Aurora Purple
    '#4ade80', // Aurora Green
    '#334155', // Slate Rock
    '#f1f5f9', // Snow White
    '#0369a1', // Deep Sea
    '#e11d48', // Salmon Red
    '#facc15'  // Summer Sun
];

export const DEFAULT_SLICE_COLOR = basePalette[0];

const getActiveTheme = () => {
    if (typeof document === 'undefined') {
        return 'default';
    }
    if (document.body && document.body.classList.contains('theme-holiday')) {
        return 'holiday';
    }
    if (document.body && document.body.classList.contains('theme-hanukkah')) {
        return 'hanukkah';
    }
    if (document.body && document.body.classList.contains('theme-cyber')) {
        return 'cyber';
    }
    if (document.body && document.body.classList.contains('theme-modern')) {
        return 'modern';
    }
    if (document.body && document.body.classList.contains('theme-alaska')) {
        return 'alaska';
    }
    return 'default';
};

const getActivePalette = () => {
    const theme = getActiveTheme();
    if (theme === 'holiday') {
        return holidayPalette;
    }
    if (theme === 'hanukkah') {
        return hanukkahPalette;
    }
    if (theme === 'cyber') {
        return cyberPalette;
    }
    if (theme === 'modern') {
        return modernPalette;
    }
    if (theme === 'alaska') {
        return alaskaPalette;
    }
    return basePalette;
};

const isThemePaletteLocked = () => getActiveTheme() !== 'default';

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
 * Generates a stable color from a string
 * @param {string} str Input string
 * @returns {string} Hex color
 */
export function stringToColor(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    const c = (hash & 0x00ffffff).toString(16).toUpperCase();
    return '#' + '00000'.substring(0, 6 - c.length) + c;
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

export function getPaletteColorForIndex(index, palette, options = {}) {
    const { allowDynamic = true } = options;
    const safePalette = Array.isArray(palette) && palette.length ? palette : basePalette;
    if (!Number.isFinite(index)) {
        return safePalette[0] || DEFAULT_SLICE_COLOR;
    }
    const normalizedIndex = Math.max(0, Math.floor(index));
    if (!allowDynamic) {
        return safePalette[normalizedIndex % safePalette.length];
    }
    if (normalizedIndex < safePalette.length) {
        return safePalette[normalizedIndex];
    }
    return generateDynamicColor(normalizedIndex);
}

/**
 * Gets a color for a specific index, using the base palette or generating a dynamic one
 * @param {number} index 
 * @returns {string} Hex color string
 */
export function getDefaultColorForIndex(index) {
    const palette = getActivePalette();
    return getPaletteColorForIndex(index, palette, { allowDynamic: !isThemePaletteLocked() });
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
    return getPaletteColorForIndex(0, getActivePalette(), { allowDynamic: false });
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

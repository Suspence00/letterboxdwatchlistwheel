/** Shared helpers for uploaded and remote CSV data. */
import { buildMovieIdentityKey, clampWeight } from './utils.js';

export function buildWeightLookup(existingMovies = []) {
    const lookup = new Map();
    existingMovies.forEach((movie) => {
        const key = buildMovieIdentityKey(movie);
        if (!key) {
            return;
        }
        lookup.set(key, clampWeight(Number(movie.weight)));
    });
    return lookup;
}

export function restoreWeight(movie, lookup = new Map()) {
    const key = buildMovieIdentityKey(movie);
    if (!key || !lookup.has(key)) {
        return 1;
    }
    const storedWeight = lookup.get(key);
    if (!Number.isFinite(storedWeight)) {
        return 1;
    }
    return clampWeight(storedWeight);
}

export function formatTooltipList(names) {
    if (!names || names.length === 0) return 'None';
    const limit = 15;
    const formatted = names.slice(0, limit).map(name => `• ${name}`).join('\n');
    if (names.length > limit) {
        return `${formatted}\n...and ${names.length - limit} more`;
    }
    return formatted;
}

export function detectDelimiter(text) {
    const lines = text.split(/\r?\n/);
    const firstContentLine = lines.find((line) => line.trim().length);
    if (!firstContentLine) {
        return ',';
    }

    const candidates = [',', '\t', ';', '|'];
    let bestDelimiter = ',';
    let bestSegmentCount = 1;

    candidates.forEach((candidate) => {
        const segments = firstContentLine.split(candidate);
        if (segments.length > bestSegmentCount) {
            bestSegmentCount = segments.length;
            bestDelimiter = candidate;
        }
    });

    return bestDelimiter;
}

export function parseCSV(text, delimiter = ',') {
    const rows = [];
    let current = '';
    let insideQuotes = false;
    let cells = [];

    const addCell = () => {
        current = current.replace(/\r/g, '');
        cells.push(current);
        current = '';
    };

    for (let i = 0; i < text.length; i += 1) {
        const char = text[i];

        if (char === '"') {
            if (insideQuotes && text[i + 1] === '"') {
                current += '"';
                i += 1;
            } else {
                insideQuotes = !insideQuotes;
            }
        } else if (char === delimiter && !insideQuotes) {
            addCell();
        } else if ((char === '\n' || char === '\r') && !insideQuotes) {
            addCell();
            if (cells.length) {
                rows.push(cells);
            }
            cells = [];
        } else {
            current += char;
        }
    }

    if (current.length > 0 || insideQuotes || cells.length) {
        addCell();
        if (cells.length) {
            rows.push(cells);
        }
    }

    return rows;
}

/**
 * Match Letterboxd films by URL, with a title/year fallback for CSV exports
 * and short links. Distinct canonical film URLs may share a title and year.
 */
export function createLetterboxdMovieIndex(movies = []) {
    const byUrl = new Set();
    const byTitleYear = new Set();
    const withoutCanonicalUrl = new Set();

    function getKeys(movie) {
        const uri = movie.uri?.trim() || '';
        const canonical = uri.match(/^(?:https?:\/\/)?(?:www\.)?letterboxd\.com(\/film\/[^/?#]+)/i)?.[1];
        const url = canonical?.toLowerCase() || uri.replace(/^https?:\/\//i, '').replace(/\/+$/, '');
        const titleYear = buildMovieIdentityKey({ name: movie.name, year: movie.year });
        return { url, titleYear, canonical };
    }

    function add(movie) {
        const { url, titleYear, canonical } = getKeys(movie);
        if (url) byUrl.add(url);
        if (titleYear) {
            byTitleYear.add(titleYear);
            if (!canonical) withoutCanonicalUrl.add(titleYear);
        }
    }

    movies.forEach(add);
    return {
        add,
        has(movie) {
            const { url, titleYear, canonical } = getKeys(movie);
            return byUrl.has(url) ||
                (canonical ? withoutCanonicalUrl : byTitleYear).has(titleYear);
        }
    };
}

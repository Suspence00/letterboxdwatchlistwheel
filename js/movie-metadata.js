/** Shared, bounded poster/metadata cache for the wheel and winner dialog. */
const metadataCache = new Map();
const METADATA_API_URL = 'https://www.omdbapi.com/';
const METADATA_API_KEY = 'trilogy';

export function buildMetadataKey(movie) {
    return `${(movie?.name || '').toLowerCase()}__${movie?.year || ''}`;
}

export function fetchMovieMetadata(movie) {
    if (!movie?.name) {
        return Promise.resolve({ status: 'invalid', data: null });
    }
    const key = buildMetadataKey(movie);
    if (metadataCache.has(key)) return metadataCache.get(key);
    const request = requestMetadata(movie);
    metadataCache.set(key, request);
    if (metadataCache.size > 512) metadataCache.delete(metadataCache.keys().next().value);
    return request;
}

async function requestMetadata(movie) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6500);
    try {
        const params = new URLSearchParams({ apikey: METADATA_API_KEY, t: movie.name });
        if (movie.year) params.set('y', movie.year);
        const response = await fetch(`${METADATA_API_URL}?${params}`, { signal: controller.signal });
        if (!response.ok) throw new Error('Metadata unavailable');
        const raw = await response.json();
        if (raw?.Response !== 'True') return { status: 'not-found', data: null };
        let poster = '';
        try {
            const url = new URL(raw.Poster);
            if (url.protocol === 'https:') poster = url.href;
        } catch { /* A missing poster uses the handwritten sleeve. */ }
        return {
            status: 'success',
            data: {
                title: raw.Title || movie.name,
                year: raw.Year && raw.Year !== 'N/A' ? raw.Year : '',
                runtime: raw.Runtime && raw.Runtime !== 'N/A' ? raw.Runtime : '',
                plot: raw.Plot && raw.Plot !== 'N/A' ? raw.Plot : '',
                poster
            }
        };
    } catch {
        return { status: 'error', data: null };
    } finally {
        clearTimeout(timeout);
    }
}

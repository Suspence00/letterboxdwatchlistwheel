/** Normalize public Letterboxd sources and read linked lists from saved wheels. */
import { normalizeLetterboxdUrl } from './utils.js';

export function parseLetterboxdSource(value) {
    if (typeof value !== 'string' || !value.trim()) return null;
    const input = value.trim();
    if (/\s/.test(input)) return null;
    const address = /^(?:www\.)?(?:letterboxd\.com|boxd\.it)(?:\/|$)/i.test(input)
        ? `https://${input}`
        : input;
    try {
        const url = new URL(address, 'https://letterboxd.com/');
        if (!['http:', 'https:'].includes(url.protocol) || url.port || url.username || url.password) return null;

        const path = url.pathname.replace(/\/page\/\d+\/?$/i, '').replace(/\/+$/, '');
        if (!path) return null;
        if (url.hostname === 'boxd.it') return `https://boxd.it${path}/`;
        if (!['letterboxd.com', 'www.letterboxd.com'].includes(url.hostname)) return null;

        const sourcePath = /^\/[\w-]+$/.test(path) ? `${path}/watchlist` : path;
        return `https://letterboxd.com${sourcePath}/`;
    } catch {
        return null;
    }
}

export function letterboxdSourceKey(url) {
    return url.startsWith('https://boxd.it/') ? url : normalizeLetterboxdUrl(url);
}

/** @param {import('./types.js').Workspace} [workspace] */
export function getWorkspaceLetterboxdUrls(workspace) {
    const saved = Array.isArray(workspace?.letterboxdUrls) ? workspace.letterboxdUrls : [workspace?.letterboxdUrl];
    const urls = new Map();
    for (const value of saved) {
        const url = parseLetterboxdSource(value);
        if (url) urls.set(letterboxdSourceKey(url), url);
    }
    return [...urls.values()];
}

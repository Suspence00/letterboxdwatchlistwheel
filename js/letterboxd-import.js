/** Public Letterboxd imports and synchronization for the active wheel. */
import { appState, saveState, switchWorkspace } from './state.js';
import { decodeHtmlEntities, getDefaultColorForIndex } from './utils.js';
import { updateMovieList, renderBoardsList, resetSliceEditor, showConfirmModal } from './ui.js';
import { escapeHtml } from './ui/boards-ui.js';
import {
    buildWeightLookup,
    createLetterboxdMovieIndex,
    formatTooltipList,
    parseCSV,
    restoreWeight
} from './import-data.js';
import { getWorkspaceLetterboxdUrls, letterboxdSourceKey, parseLetterboxdSource } from './letterboxd-sources.js';
import { invalidateWheelCache } from './wheel.js';

/**
 * Watchlists display 28 films per page, member film catalogs 72, and lists 100.
 * @param {string} url
 */
export function getLetterboxdPaginationConfig(url) {
    const isWatchlist = /\/watchlist(?:\/|$)/i.test(url);
    const isFilms = /\/films(?:\/|$)/i.test(url);
    const expectedPageSize = isWatchlist ? 28 : (isFilms ? 72 : 100);
    const maxPages = isWatchlist ? 200 : 50;
    return { expectedPageSize, maxPages, isWatchlist, isFilms };
}

function parseLetterboxdPage(rows) {
    const header = rows[0]?.map(cell => cell.trim().toLowerCase()) || [];
    const titleIndex = header.findIndex(cell => ['title', 'name'].includes(cell));
    if (titleIndex === -1) throw new Error('Could not find a title column in the CSV.');

    const uriIndex = header.findIndex(cell => ['letterboxduri', 'letterboxd uri', 'url', 'uri'].includes(cell));
    const yearIndex = header.findIndex(cell => ['year', 'release year', 'film year'].includes(cell));

    return rows.slice(1).flatMap(row => {
        const name = decodeHtmlEntities(row[titleIndex]?.trim() || '').trim();
        return name ? [{ name, uri: row[uriIndex]?.trim() || '', year: row[yearIndex]?.trim() || '', date: '' }] : [];
    });
}

async function fetchLetterboxdMovies(urls, signal, status, verb) {
    const movies = [];
    const movieIndex = createLetterboxdMovieIndex();

    for (const [index, url] of urls.entries()) {
        const { expectedPageSize, maxPages } = getLetterboxdPaginationConfig(url);
        const source = urls.length > 1 ? ` for list ${index + 1} of ${urls.length}` : '';
        let loadedCount = 0;

        try {
            for (let page = 1; page <= maxPages; page++) {
                status.textContent = page === 1
                    ? `${verb} from Letterboxd${source}…`
                    : `${verb} page ${page} from Letterboxd${source} (${loadedCount} movies loaded)…`;

                const pageUrl = page === 1 ? url : `${url}page/${page}/`;
                const proxyUrl = `https://letterboxd-proxy.cwbcode.workers.dev/?url=${encodeURIComponent(pageUrl)}&t=${Date.now()}`;
                const response = await fetch(proxyUrl, { signal });
                if (!response.ok) throw new Error(`Worker returned ${response.status}`);
                const rows = parseCSV(await response.text()).filter(row => row.some(cell => cell.trim()));
                signal.throwIfAborted();
                if (page > 1 && rows.length === 0) break;

                for (const movie of parseLetterboxdPage(rows)) {
                    if (movieIndex.has(movie)) continue;
                    movieIndex.add(movie);
                    movies.push(movie);
                }

                const rowCount = rows.length - 1;
                loadedCount += rowCount;
                if (rowCount < expectedPageSize) break;
            }
        } catch (error) {
            if (signal.aborted || urls.length === 1) throw error;
            throw new Error(`Letterboxd list ${index + 1} of ${urls.length} could not be loaded.`, { cause: error });
        }
    }

    return movies;
}

function movieCount(count) {
    return `${count} ${count === 1 ? 'movie' : 'movies'}`;
}

function movieCountWithTooltip(names, prefix = '') {
    const label = `${names.length} ${prefix}${names.length === 1 ? 'movie' : 'movies'}`;
    return names.length
        ? `<span class="sync-tooltip-trigger" data-tooltip="${escapeHtml(formatTooltipList(names))}">${label}</span>`
        : label;
}

function assignMovieDefaults(movie, index, weight = 1) {
    return {
        ...movie,
        id: `imported-${Date.now()}-${index}-${Math.random().toString(36).slice(2)}`,
        initialIndex: index,
        color: getDefaultColorForIndex(index),
        weight
    };
}

function applyFetchedMovies(fetched, mode) {
    const fetchedIndex = mode === 'sync' ? createLetterboxdMovieIndex(fetched) : null;
    const weights = mode === 'replace' ? buildWeightLookup(appState.movies) : new Map();
    const remaining = [];
    const removed = [];

    for (const movie of appState.movies) {
        if (movie.isCustom || mode === 'append' || (mode === 'sync' && fetchedIndex.has(movie))) {
            remaining.push(movie);
        } else {
            removed.push(movie.name);
        }
    }

    const remainingIndex = createLetterboxdMovieIndex(remaining);
    const added = [];
    for (const movie of fetched) {
        if (remainingIndex.has(movie)) continue;
        const index = added.length + (mode === 'replace' ? 0 : remaining.length);
        added.push(assignMovieDefaults(movie, index, restoreWeight(movie, weights)));
    }

    appState.movies = mode === 'replace' ? [...added, ...remaining] : [...remaining, ...added];
    const selected = appState.selectedIds;
    appState.selectedIds = new Set(appState.movies
        .filter(movie => mode === 'replace' || selected.has(movie.id))
        .map(movie => movie.id));
    added.forEach(movie => appState.selectedIds.add(movie.id));
    if (mode === 'replace') appState.knockoutResults.clear();

    return { added: added.map(movie => movie.name), removed };
}

function linkSources(workspace, urls, append) {
    const linked = new Map();
    const previous = append ? getWorkspaceLetterboxdUrls(workspace) : [];
    for (const url of [...previous, ...urls]) linked.set(letterboxdSourceKey(url), url);
    workspace.letterboxdUrls = [...linked.values()];
    delete workspace.letterboxdUrl;

    const importedKeys = new Set(urls.map(letterboxdSourceKey));
    for (const other of appState.workspaces) {
        if (other === workspace) continue;
        const existing = getWorkspaceLetterboxdUrls(other);
        const remaining = existing.filter(url => !importedKeys.has(letterboxdSourceKey(url)));
        if (existing.length === remaining.length) continue;
        other.letterboxdUrls = remaining;
        delete other.letterboxdUrl;
    }
}

export function initLetterboxdImport(elements, setImportCardCollapsed) {
    const { letterboxdProxyForm: form, letterboxdProxyInput: primary, letterboxdProxyStatus: status } = elements;
    const addButton = document.getElementById('letterboxd-add-list');
    const extraSources = document.getElementById('letterboxd-extra-lists');
    const template = document.getElementById('letterboxd-source-template');
    const syncContainer = document.getElementById('import-sync-container');
    const syncLinks = document.getElementById('import-sync-urls');
    const syncButton = document.getElementById('import-sync-btn');
    const fetchButton = document.getElementById('letterboxd-proxy-open');
    let request = null;

    const getActiveWorkspace = () => appState.workspaces.find(ws => ws.id === appState.activeWorkspaceId);

    function renderSyncSources() {
        const urls = getWorkspaceLetterboxdUrls(getActiveWorkspace());
        syncContainer.hidden = urls.length === 0;
        syncLinks.replaceChildren(...urls.map(url => {
            const item = document.createElement('li');
            const link = document.createElement('a');
            link.className = 'link-subtle';
            link.href = url;
            link.target = '_blank';
            link.rel = 'noopener';
            link.textContent = url;
            item.append(link);
            return item;
        }));
        syncButton.querySelector('span').textContent = request && request.mode === 'sync'
            ? 'Syncing…'
            : (urls.length > 1 ? 'Sync Lists' : 'Sync List');
    }

    function setStatus(message, state) {
        status.textContent = message;
        status.classList.toggle('status--error', state === 'error');
        status.classList.toggle('status--success', state === 'success');
    }

    addButton.addEventListener('click', () => {
        const row = template.content.firstElementChild.cloneNode(true);
        const input = row.querySelector('input');
        const remove = row.querySelector('button');
        remove.addEventListener('click', () => {
            const nextInput = row.nextElementSibling?.querySelector('input') ||
                row.previousElementSibling?.querySelector('input') || addButton;
            row.remove();
            extraSources.hidden = !extraSources.childElementCount;
            nextInput.focus();
        });
        extraSources.append(row);
        extraSources.hidden = false;
        input.focus();
    });

    function setBusy(busy) {
        const sourceControls = form.querySelectorAll('input, button');
        [...sourceControls, syncButton, elements.csvInput].filter(Boolean).forEach(control => {
            control.disabled = busy;
        });
        fetchButton.querySelector('span').textContent = busy && request?.mode !== 'sync' ? 'Fetching…' : 'Fetch Movies';
    }

    async function runImport(urls, mode) {
        if (request) return;
        const workspace = getActiveWorkspace();
        const controller = new AbortController();
        request = { controller, mode };
        setBusy(true);
        renderSyncSources();
        setStatus('');

        try {
            const fetched = await fetchLetterboxdMovies(urls, controller.signal, status, mode === 'sync' ? 'Syncing' : 'Fetching');
            controller.signal.throwIfAborted();
            if (mode !== 'sync' && fetched.length === 0) throw new Error('The imported CSV appears to be empty.');

            const { added, removed } = applyFetchedMovies(fetched, mode);
            if (mode !== 'sync') {
                linkSources(workspace, urls, mode === 'append');
                primary.value = '';
                extraSources.replaceChildren();
                extraSources.hidden = true;
                setImportCardCollapsed(true);
            }
            saveState();
            renderBoardsList();
            updateMovieList();
            invalidateWheelCache();
            if (elements.resultEl) elements.resultEl.textContent = '';

            setStatus('', 'success');
            if (mode === 'sync') {
                status.innerHTML = `Sync complete! Added ${movieCountWithTooltip(added, 'new ')}, removed ${movieCountWithTooltip(removed)}.`;
            } else if (mode === 'append') {
                status.innerHTML = `Added ${movieCountWithTooltip(added, 'new ')} (out of ${fetched.length} imported) successfully!`;
            } else {
                status.textContent = `Imported ${movieCount(appState.movies.length)} successfully!`;
            }
        } catch (error) {
            if (controller.signal.aborted) {
                setStatus(`${mode === 'sync' ? 'Sync' : 'Import'} cancelled because the current wheel changed.`, 'error');
            } else {
                console.error(error);
                const action = mode === 'sync' ? 'sync with Letterboxd' : 'import list';
                setStatus(`Failed to ${action}. ${error.message} No changes were made.`, 'error');
            }
        } finally {
            request = null;
            setBusy(false);
            renderSyncSources();
        }
    }

    function chooseImportMode(urls) {
        if (!appState.movies.length) {
            runImport(urls, 'replace');
            return;
        }

        showConfirmModal({
            title: 'Import Options',
            message: `This wheel already contains ${movieCount(appState.movies.length)}. Would you like to replace the existing list or only add new movies?`,
            confirmText: 'Replace Existing List',
            secondaryText: 'Add New Movies Only',
            cancelText: 'Cancel Import',
            onConfirm: () => runImport(urls, 'replace'),
            onSecondary: () => runImport(urls, 'append'),
            onCancel: () => setStatus('Import cancelled.', 'error')
        });
    }

    form.addEventListener('submit', event => {
        event.preventDefault();
        if (request) return;
        const urls = new Map();
        for (const input of form.querySelectorAll('input')) {
            if (!input.value.trim()) continue;
            const url = parseLetterboxdSource(input.value);
            if (!url) {
                setStatus('Enter a valid Letterboxd list URL or username.', 'error');
                input.focus();
                return;
            }
            urls.set(letterboxdSourceKey(url), url);
        }
        if (urls.size === 0) {
            setStatus('Please enter a Letterboxd list URL or username.', 'error');
            primary.focus();
            return;
        }

        const sources = [...urls.values()];
        const conflicts = appState.workspaces.filter(workspace => workspace !== getActiveWorkspace() &&
            getWorkspaceLetterboxdUrls(workspace).some(url => urls.has(letterboxdSourceKey(url))));
        if (conflicts.length === 0) {
            chooseImportMode(sources);
            return;
        }

        const [conflict] = conflicts;
        const single = conflicts.length === 1;
        const names = conflicts.map(workspace => `<strong>${escapeHtml(workspace.name)}</strong>`).join(', ');
        showConfirmModal({
            title: 'Saved wheel conflict',
            message: `A Letterboxd source is already linked to ${names}. Importing it into this wheel will move its sync link.`,
            confirmText: single ? 'Switch & update that wheel' : 'Import into current wheel anyway',
            secondaryText: single ? 'Import into current wheel anyway' : undefined,
            cancelText: 'Cancel Import',
            onConfirm: () => {
                if (single && !switchWorkspace(conflict.id)) return;
                if (single) resetSliceEditor();
                chooseImportMode(sources);
            },
            onSecondary: () => chooseImportMode(sources),
            onCancel: () => setStatus('Import cancelled.', 'error')
        });
    });

    syncButton.addEventListener('click', () => {
        const urls = getWorkspaceLetterboxdUrls(getActiveWorkspace());
        if (urls.length) runImport(urls, 'sync');
    });

    window.addEventListener('letterboxd:workspacechange', () => {
        request?.controller.abort();
        renderSyncSources();
    });

    if (getWorkspaceLetterboxdUrls(getActiveWorkspace()).length) setImportCardCollapsed(true);
    renderSyncSources();
}

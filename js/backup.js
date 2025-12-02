/**
 * Backup, export, and import helpers for the Letterboxd Watchlist Wheel
 */

import { appState, saveState } from './state.js';
import { buildMovieIdentityKey, clampWeight, getDefaultColorForIndex, sanitizeColor } from './utils.js';

const BACKUP_VERSION = 1;

let elements = {};
let callbacks = {
    refreshMovies: () => { },
    renderHistory: () => { },
    refreshPreferences: () => { },
    resetKnockoutUI: () => { }
};

let parsedBackup = null;

export function initBackup(domElements, uiCallbacks = {}) {
    elements = domElements;
    callbacks = { ...callbacks, ...uiCallbacks };

    if (elements.backupExportBtn) {
        elements.backupExportBtn.addEventListener('click', handleExportFile);
    }
    if (elements.backupCopyBtn) {
        elements.backupCopyBtn.addEventListener('click', handleCopyBackup);
    }
    if (elements.backupImportBtn) {
        elements.backupImportBtn.addEventListener('click', openImportModal);
    }
    if (elements.backupModalCloseBtn) {
        elements.backupModalCloseBtn.addEventListener('click', closeImportModal);
    }
    if (elements.backupModal) {
        elements.backupModal.addEventListener('click', (event) => {
            if (event.target === elements.backupModal) {
                closeImportModal();
            }
        });
    }
    if (elements.backupFileInput) {
        elements.backupFileInput.addEventListener('change', handleBackupFileSelected);
    }
    if (elements.backupApplyWeightsBtn) {
        elements.backupApplyWeightsBtn.addEventListener('click', () => handleImportAction('apply'));
    }
    if (elements.backupRestoreBtn) {
        elements.backupRestoreBtn.addEventListener('click', () => handleImportAction('restore'));
    }
    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && elements.backupModal && !elements.backupModal.hidden) {
            closeImportModal();
        }
    });
}

function handleExportFile() {
    try {
        const payload = buildBackupPayload();
        const json = JSON.stringify(payload, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        const timestamp = new Date().toISOString().replace(/[:]/g, '-');
        const filename = `watchlist-wheel-${timestamp}.wheel`;
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        link.click();
        URL.revokeObjectURL(url);
        setStatus(elements.backupExportStatus, `Downloaded ${filename}`, false);
    } catch (error) {
        console.error(error);
        setStatus(elements.backupExportStatus, 'Could not create backup file.', true);
    }
}

async function handleCopyBackup() {
    try {
        const payload = buildBackupPayload();
        const json = JSON.stringify(payload, null, 2);
        if (navigator.clipboard?.writeText) {
            await navigator.clipboard.writeText(json);
        } else {
            const temp = document.createElement('textarea');
            temp.value = json;
            document.body.appendChild(temp);
            temp.select();
            document.execCommand('copy');
            temp.remove();
        }
        setStatus(elements.backupExportStatus, 'Backup string copied to your clipboard.', false);
    } catch (error) {
        console.error(error);
        setStatus(elements.backupExportStatus, 'Unable to copy backup string.', true);
    }
}

function buildBackupPayload() {
    return {
        version: BACKUP_VERSION,
        exportedAt: new Date().toISOString(),
        movies: appState.movies.map((movie, index) => {
            const identity = buildMovieIdentityKey(movie) || (movie.id ? `id:${movie.id}` : `slot:${index}`);
            return {
                id: movie.id,
                identity,
                name: movie.name || '',
                year: movie.year || '',
                uri: movie.uri || '',
                date: movie.date || '',
                isCustom: Boolean(movie.isCustom),
                fromLizard: Boolean(movie.fromLizard),
                weight: clampWeight(movie.weight),
                color: sanitizeColor(movie.color, getDefaultColorForIndex(index))
            };
        }),
        history: Array.isArray(appState.history) ? appState.history : [],
        preferences: {
            hideFinalistsBox: Boolean(appState.preferences?.hideFinalistsBox),
            showFinalistsFromStart: Boolean(appState.preferences?.showFinalistsFromStart)
        },
        selected: Array.from(appState.selectedIds)
    };
}

function openImportModal() {
    parsedBackup = null;
    if (elements.backupTextInput) {
        elements.backupTextInput.value = '';
    }
    if (elements.backupFileInput) {
        elements.backupFileInput.value = '';
    }
    setStatus(elements.backupImportStatus, '', false);
    if (!elements.backupModal) {
        return;
    }
    elements.backupModal.hidden = false;
    requestAnimationFrame(() => elements.backupModal.classList.add('show'));
    if (elements.backupTextInput) {
        elements.backupTextInput.focus();
    }
}

function closeImportModal() {
    if (!elements.backupModal) {
        return;
    }
    elements.backupModal.classList.remove('show');
    setTimeout(() => {
        elements.backupModal.hidden = true;
    }, 220);
}

function handleBackupFileSelected(event) {
    const file = event.target.files?.[0];
    if (!file) {
        return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
        if (elements.backupTextInput) {
            elements.backupTextInput.value = e.target.result;
        }
        try {
            parsedBackup = parseBackupString(e.target.result);
            setStatus(elements.backupImportStatus, `Loaded backup from ${file.name}.`, false);
        } catch (error) {
            console.error(error);
            parsedBackup = null;
            setStatus(elements.backupImportStatus, error.message || 'Invalid .wheel file.', true);
        }
    };
    reader.onerror = () => {
        setStatus(elements.backupImportStatus, 'Failed to read the selected file.', true);
    };
    reader.readAsText(file);
}

function handleImportAction(mode = 'apply') {
    const importHistory = elements.backupImportHistoryToggle ? elements.backupImportHistoryToggle.checked : true;
    const textInput = elements.backupTextInput?.value?.trim();
    let backupToUse = parsedBackup;

    if (textInput) {
        try {
            backupToUse = parseBackupString(textInput);
            parsedBackup = backupToUse;
        } catch (error) {
            console.error(error);
            setStatus(elements.backupImportStatus, error.message || 'Backup text could not be parsed.', true);
            return;
        }
    }

    if (!backupToUse) {
        setStatus(elements.backupImportStatus, 'Paste a backup string or choose a .wheel file first.', true);
        return;
    }

    if (mode === 'apply') {
        try {
            const result = applyBackupWeights(backupToUse, { includeHistory: importHistory });
            setStatus(
                elements.backupImportStatus,
                `Applied weights to ${result.matched} of ${result.total} saved entries${importHistory ? ' and replaced history.' : '.'}`,
                false
            );
            callbacks.refreshMovies();
            if (importHistory) {
                callbacks.renderHistory();
            }
            closeImportModal();
        } catch (error) {
            console.error(error);
            setStatus(elements.backupImportStatus, error.message || 'Could not apply weights.', true);
        }
        return;
    }

    if (mode === 'restore') {
        try {
            const result = restoreBackupState(backupToUse, { includeHistory: importHistory });
            setStatus(
                elements.backupImportStatus,
                `Restored ${result.movieCount} entries${importHistory ? ' with history' : ''}.`,
                false
            );
            callbacks.refreshMovies();
            if (importHistory) {
                callbacks.renderHistory();
            }
            callbacks.refreshPreferences();
            callbacks.resetKnockoutUI();
            closeImportModal();
        } catch (error) {
            console.error(error);
            setStatus(elements.backupImportStatus, error.message || 'Could not restore backup.', true);
        }
    }
}

function applyBackupWeights(backup, options = {}) {
    const includeHistory = Boolean(options.includeHistory);
    const lookup = new Map();

    backup.movies.forEach((movie, index) => {
        const identity = getIdentity(movie, index);
        if (!identity || lookup.has(identity)) {
            return;
        }
        lookup.set(identity, {
            color: sanitizeColor(movie.color, getDefaultColorForIndex(index)),
            weight: clampWeight(movie.weight)
        });
    });

    if (!lookup.size) {
        throw new Error('Backup does not include any movie data.');
    }

    let matched = 0;
    appState.movies.forEach((movie, index) => {
        const identity = getIdentity(movie, index);
        if (!identity || !lookup.has(identity)) {
            return;
        }
        const update = lookup.get(identity);
        movie.weight = update.weight;
        movie.color = update.color;
        matched += 1;
    });

    if (includeHistory && Array.isArray(backup.history)) {
        appState.history = backup.history;
    }

    saveState();

    return { matched, total: lookup.size };
}

function restoreBackupState(backup, options = {}) {
    const includeHistory = Boolean(options.includeHistory);
    const sanitizedMovies = (backup.movies || []).map((movie, index) => {
        const defaultColor = getDefaultColorForIndex(index);
        const id = typeof movie.id === 'string' && movie.id.trim() ? movie.id.trim() : `backup-${index}`;
        return {
            id,
            initialIndex: index,
            name: typeof movie.name === 'string' && movie.name.trim() ? movie.name.trim() : 'Untitled entry',
            year: typeof movie.year === 'string' ? movie.year.trim() : '',
            uri: typeof movie.uri === 'string' ? movie.uri.trim() : '',
            date: typeof movie.date === 'string' ? movie.date.trim() : '',
            fromLizard: Boolean(movie.fromLizard),
            isCustom: Boolean(movie.isCustom),
            weight: clampWeight(movie.weight),
            color: sanitizeColor(movie.color, defaultColor)
        };
    });

    appState.movies = sanitizedMovies;
    const savedSelected = Array.isArray(backup.selected) ? backup.selected.filter(Boolean) : [];
    const selected = new Set(savedSelected.filter((id) => sanitizedMovies.some((movie) => movie.id === id)));
    if (!selected.size) {
        sanitizedMovies.forEach((movie) => selected.add(movie.id));
    }
    appState.selectedIds = selected;
    appState.knockoutResults = new Map();

    if (includeHistory && Array.isArray(backup.history)) {
        appState.history = backup.history;
    }

    const restoredPreferences = normalizePreferences(backup.preferences);
    const existingPreferences = normalizePreferences(appState.preferences);
    appState.preferences = { ...existingPreferences, ...restoredPreferences };
    saveState();

    return {
        movieCount: sanitizedMovies.length,
        selectedCount: selected.size
    };
}

function parseBackupString(text) {
    if (!text || typeof text !== 'string') {
        throw new Error('No backup data found to import.');
    }
    let parsed;
    try {
        parsed = JSON.parse(text);
    } catch (error) {
        throw new Error('Backup is not valid JSON.');
    }
    if (!parsed || typeof parsed !== 'object') {
        throw new Error('Backup data is empty.');
    }
    if (!Array.isArray(parsed.movies) || !parsed.movies.length) {
        throw new Error('Backup is missing movie data.');
    }
    const version = Number.isFinite(parsed.version) ? parsed.version : 1;
    if (version > BACKUP_VERSION) {
        throw new Error('This backup was created with a newer version of the wheel.');
    }
    return {
        ...parsed,
        version,
        history: Array.isArray(parsed.history) ? parsed.history : [],
        preferences: normalizePreferences(parsed.preferences),
        selected: Array.isArray(parsed.selected) ? parsed.selected : []
    };
}

function getIdentity(movie, fallbackIndex) {
    if (movie && typeof movie.identity === 'string' && movie.identity.trim()) {
        return movie.identity.trim().toLowerCase();
    }
    const derived = buildMovieIdentityKey(movie);
    if (derived) {
        return derived;
    }
    if (movie && typeof movie.id === 'string' && movie.id.trim()) {
        return `id:${movie.id.trim().toLowerCase()}`;
    }
    if (Number.isFinite(fallbackIndex)) {
        return `slot:${fallbackIndex}`;
    }
    return null;
}

function normalizePreferences(preferences = {}) {
    return {
        hideFinalistsBox: Boolean(preferences?.hideFinalistsBox),
        showFinalistsFromStart: Boolean(preferences?.showFinalistsFromStart)
    };
}

function setStatus(target, message, isError) {
    if (!target) {
        return;
    }
    target.textContent = message;
    target.classList.toggle('status--error', Boolean(isError));
    target.classList.toggle('status--success', Boolean(message && !isError));
}

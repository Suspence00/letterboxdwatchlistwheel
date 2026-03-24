/**
 * Radarr integration for automatically adding winning movies to Radarr
 */

import { appState, saveState } from './state.js';

let elements = {};

/**
 * Returns the current Radarr config from preferences
 */
export function getRadarrConfig() {
    const cfg = appState.preferences.radarr || {};
    return {
        url: (cfg.url || '').replace(/\/+$/, ''),
        apiKey: cfg.apiKey || '',
        qualityProfileId: cfg.qualityProfileId || null,
        rootFolderPath: cfg.rootFolderPath || '',
        searchOnAdd: cfg.searchOnAdd !== false
    };
}

/**
 * Whether Radarr is configured enough to attempt adding movies
 */
export function isRadarrConfigured() {
    const cfg = getRadarrConfig();
    return Boolean(cfg.url && cfg.apiKey && cfg.qualityProfileId && cfg.rootFolderPath);
}

/**
 * Initialize Radarr integration — wire up the settings panel
 */
export function initRadarr(domElements) {
    elements = domElements;

    ensurePreferencesObject();
    restoreSettings();

    if (elements.radarrUrlInput) {
        elements.radarrUrlInput.addEventListener('change', () => {
            ensurePreferencesObject();
            appState.preferences.radarr.url = elements.radarrUrlInput.value.trim();
            saveState();
        });
    }

    if (elements.radarrApiKeyInput) {
        elements.radarrApiKeyInput.addEventListener('change', () => {
            ensurePreferencesObject();
            appState.preferences.radarr.apiKey = elements.radarrApiKeyInput.value.trim();
            saveState();
        });
    }

    if (elements.radarrApiKeyToggle) {
        elements.radarrApiKeyToggle.addEventListener('click', () => {
            if (!elements.radarrApiKeyInput) return;
            const isPassword = elements.radarrApiKeyInput.type === 'password';
            elements.radarrApiKeyInput.type = isPassword ? 'text' : 'password';
            elements.radarrApiKeyToggle.textContent = isPassword ? 'Hide' : 'Show';
            elements.radarrApiKeyToggle.setAttribute('aria-label', isPassword ? 'Hide API key' : 'Show API key');
        });
    }

    if (elements.radarrTestBtn) {
        elements.radarrTestBtn.addEventListener('click', handleTestConnection);
    }

    if (elements.radarrQualitySelect) {
        elements.radarrQualitySelect.addEventListener('change', () => {
            ensurePreferencesObject();
            const val = elements.radarrQualitySelect.value;
            appState.preferences.radarr.qualityProfileId = val ? Number(val) : null;
            saveState();
        });
    }

    if (elements.radarrRootSelect) {
        elements.radarrRootSelect.addEventListener('change', () => {
            ensurePreferencesObject();
            appState.preferences.radarr.rootFolderPath = elements.radarrRootSelect.value;
            saveState();
        });
    }

    if (elements.radarrSearchToggle) {
        elements.radarrSearchToggle.addEventListener('change', () => {
            ensurePreferencesObject();
            appState.preferences.radarr.searchOnAdd = elements.radarrSearchToggle.checked;
            saveState();
        });
    }
}

function ensurePreferencesObject() {
    if (!appState.preferences.radarr || typeof appState.preferences.radarr !== 'object') {
        appState.preferences.radarr = {
            url: '',
            apiKey: '',
            qualityProfileId: null,
            rootFolderPath: '',
            searchOnAdd: true
        };
    }
}

function restoreSettings() {
    const cfg = getRadarrConfig();

    if (elements.radarrUrlInput) {
        elements.radarrUrlInput.value = cfg.url;
    }
    if (elements.radarrApiKeyInput) {
        elements.radarrApiKeyInput.value = cfg.apiKey;
    }
    if (elements.radarrSearchToggle) {
        elements.radarrSearchToggle.checked = cfg.searchOnAdd;
    }

    // If we have saved quality/root, try to restore them (they'll re-populate on test)
    if (cfg.qualityProfileId && elements.radarrQualitySelect) {
        setSelectIfOptionExists(elements.radarrQualitySelect, String(cfg.qualityProfileId));
    }
    if (cfg.rootFolderPath && elements.radarrRootSelect) {
        setSelectIfOptionExists(elements.radarrRootSelect, cfg.rootFolderPath);
    }
}

function setSelectIfOptionExists(select, value) {
    const option = Array.from(select.options).find(o => o.value === value);
    if (option) {
        select.value = value;
    }
}

/**
 * Make an authenticated request to the Radarr API
 */
async function radarrFetch(endpoint, options = {}) {
    const cfg = getRadarrConfig();
    if (!cfg.url || !cfg.apiKey) {
        throw new Error('Radarr URL and API key are required.');
    }

    const url = `${cfg.url}/api/v3${endpoint}`;
    const headers = {
        'X-Api-Key': cfg.apiKey,
        'Content-Type': 'application/json',
        ...(options.headers || {})
    };

    const response = await fetch(url, { ...options, headers });

    if (!response.ok) {
        const text = await response.text().catch(() => '');
        throw new Error(`Radarr API error ${response.status}: ${text || response.statusText}`);
    }

    return response.json();
}

function setStatus(message, type = 'info') {
    if (!elements.radarrStatus) return;
    elements.radarrStatus.textContent = message;
    elements.radarrStatus.className = 'status';
    if (type === 'success') {
        elements.radarrStatus.classList.add('status--success');
    } else if (type === 'error') {
        elements.radarrStatus.classList.add('status--error');
    }
}

/**
 * Test connection and populate quality profile / root folder dropdowns
 */
async function handleTestConnection() {
    const cfg = getRadarrConfig();
    if (!cfg.url || !cfg.apiKey) {
        setStatus('Please enter a Radarr URL and API key first.', 'error');
        return;
    }

    setStatus('Connecting to Radarr…');

    if (elements.radarrTestBtn) {
        elements.radarrTestBtn.disabled = true;
    }

    try {
        const [profiles, folders] = await Promise.all([
            radarrFetch('/qualityprofile'),
            radarrFetch('/rootfolder')
        ]);

        // Populate Quality Profiles
        if (elements.radarrQualitySelect && Array.isArray(profiles)) {
            elements.radarrQualitySelect.innerHTML = '<option value="">Select a quality profile</option>';
            profiles.forEach(p => {
                const opt = document.createElement('option');
                opt.value = String(p.id);
                opt.textContent = p.name;
                elements.radarrQualitySelect.appendChild(opt);
            });
            elements.radarrQualitySelect.disabled = false;

            // Restore saved selection
            const savedId = appState.preferences.radarr?.qualityProfileId;
            if (savedId) {
                setSelectIfOptionExists(elements.radarrQualitySelect, String(savedId));
            }
        }

        // Populate Root Folders
        if (elements.radarrRootSelect && Array.isArray(folders)) {
            elements.radarrRootSelect.innerHTML = '<option value="">Select a root folder</option>';
            folders.forEach(f => {
                const opt = document.createElement('option');
                opt.value = f.path;
                opt.textContent = `${f.path} (${formatBytes(f.freeSpace)})`;
                elements.radarrRootSelect.appendChild(opt);
            });
            elements.radarrRootSelect.disabled = false;

            // Restore saved selection
            const savedPath = appState.preferences.radarr?.rootFolderPath;
            if (savedPath) {
                setSelectIfOptionExists(elements.radarrRootSelect, savedPath);
            }
        }

        setStatus(`Connected! Found ${profiles.length} profile(s) and ${folders.length} folder(s).`, 'success');
    } catch (error) {
        console.error('Radarr connection test failed:', error);

        const isCORS = error instanceof TypeError && error.message.includes('Failed to fetch');
        if (isCORS) {
            setStatus('Connection blocked (CORS). If Radarr is behind a reverse proxy, enable CORS headers.', 'error');
        } else {
            setStatus(`Connection failed: ${error.message}`, 'error');
        }
    } finally {
        if (elements.radarrTestBtn) {
            elements.radarrTestBtn.disabled = false;
        }
    }
}

/**
 * Look up a movie in Radarr by name (and optionally year)
 */
export async function lookupMovie(movieName, year) {
    const term = year ? `${movieName} ${year}` : movieName;
    const results = await radarrFetch(`/movie/lookup?term=${encodeURIComponent(term)}`);

    if (!Array.isArray(results) || results.length === 0) {
        return null;
    }

    // Try to find an exact match by year first
    if (year) {
        const exactMatch = results.find(r => String(r.year) === String(year));
        if (exactMatch) return exactMatch;
    }

    return results[0];
}

/**
 * Add the winning movie to Radarr
 * @param {Object} movie — the wheel movie object { name, year, ... }
 * @returns {Promise<{success: boolean, message: string}>}
 */
export async function addMovieToRadarr(movie) {
    if (!isRadarrConfigured()) {
        return { success: false, message: 'Radarr is not fully configured. Check Settings → Radarr.' };
    }

    const cfg = getRadarrConfig();

    try {
        // Step 1: Lookup the movie
        const lookupResult = await lookupMovie(movie.name, movie.year);

        if (!lookupResult) {
            return { success: false, message: `"${movie.name}" was not found in Radarr's movie database.` };
        }

        // Check if already in library
        if (lookupResult.id && lookupResult.id > 0) {
            return { success: false, message: `"${lookupResult.title}" is already in your Radarr library.` };
        }

        // Step 2: Add the movie
        const payload = {
            title: lookupResult.title,
            tmdbId: lookupResult.tmdbId,
            year: lookupResult.year,
            qualityProfileId: cfg.qualityProfileId,
            rootFolderPath: cfg.rootFolderPath,
            monitored: true,
            minimumAvailability: lookupResult.minimumAvailability || 'released',
            addOptions: {
                searchForMovie: cfg.searchOnAdd
            }
        };

        // Include images if present in lookup
        if (lookupResult.images) {
            payload.images = lookupResult.images;
        }

        await radarrFetch('/movie', {
            method: 'POST',
            body: JSON.stringify(payload)
        });

        const searchNote = cfg.searchOnAdd ? ' Radarr is now searching for it.' : '';
        return { success: true, message: `"${lookupResult.title}" added to Radarr!${searchNote}` };

    } catch (error) {
        console.error('Radarr add movie failed:', error);

        if (error.message && error.message.includes('already been added')) {
            return { success: false, message: `"${movie.name}" is already in your Radarr library.` };
        }

        return { success: false, message: `Failed to add movie: ${error.message}` };
    }
}

function formatBytes(bytes) {
    if (!bytes || bytes <= 0) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
}

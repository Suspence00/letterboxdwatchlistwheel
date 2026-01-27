/**
 * State management for the Letterboxd Watchlist Wheel
 */

import { debounce } from './utils.js';

const STORAGE_PREFIX = 'letterboxd_workspace_';
const INDEX_KEY = 'letterboxd_workspaces_index';
const ACTIVE_KEY = 'letterboxd_active_workspace_id';
const LEGACY_KEY = 'letterboxd_wheel_state';

export const appState = {
    // Workspace Meta
    workspaces: [],
    activeWorkspaceId: null,

    // Workspace Data
    movies: [],
    selectedIds: new Set(),
    history: [],
    filter: {
        query: '',
        normalizedQuery: '',
        showCustoms: true,
        sortMode: 'original'
    },
    knockoutResults: new Map(),
    preferences: {
        hideFinalistsBox: false,
        showFinalistsFromStart: false,
        theme: 'default',
        themeColorOverrides: {}
    }
};

/**
 * Saves the current state to localStorage
 */
/**
 * Saves the current state to the active workspace
 */
export function saveState() {
    if (!appState.activeWorkspaceId) return;

    const stateToSave = {
        allMovies: appState.movies,
        selectedIds: Array.from(appState.selectedIds),
        history: appState.history,
        filterState: appState.filter,
        preferences: appState.preferences
    };

    // Save data for active workspace
    localStorage.setItem(STORAGE_PREFIX + appState.activeWorkspaceId, JSON.stringify(stateToSave));

    // Update last modified in index
    const ws = appState.workspaces.find(w => w.id === appState.activeWorkspaceId);
    if (ws) {
        ws.lastModified = Date.now();
        saveWorkspacesIndex();
    }
}

function saveWorkspacesIndex() {
    localStorage.setItem(INDEX_KEY, JSON.stringify(appState.workspaces));
    if (appState.activeWorkspaceId) {
        localStorage.setItem(ACTIVE_KEY, appState.activeWorkspaceId);
    }
}

export const debouncedSaveState = debounce(saveState, 1000);

/**
 * Loads state from localStorage
 * @returns {boolean} True if state was loaded and has movies, false otherwise
 */
/**
 * Loads state from localStorage, handling migration
 * @returns {boolean} True if state was loaded and has movies, false otherwise
 */
export function loadState() {
    // 1. Load Workspace Index
    try {
        const storedIndex = localStorage.getItem(INDEX_KEY);
        if (storedIndex) {
            appState.workspaces = JSON.parse(storedIndex);
        }
    } catch (e) {
        console.error('Failed to parse workspace index', e);
        appState.workspaces = [];
    }

    // 2. Load Active ID
    let activeId = localStorage.getItem(ACTIVE_KEY);

    // 3. Migration Check: If no workspaces but we have legacy data
    const hasLegacy = localStorage.getItem(LEGACY_KEY);
    if (appState.workspaces.length === 0 && hasLegacy) {
        console.log('Migrating legacy data to Default Workspace...');
        const defaultId = crypto.randomUUID();
        const legacyData = localStorage.getItem(LEGACY_KEY);

        // Create entry
        appState.workspaces = [{
            id: defaultId,
            name: 'Default Board',
            created: Date.now(),
            lastModified: Date.now()
        }];

        // Move data
        localStorage.setItem(STORAGE_PREFIX + defaultId, legacyData);
        activeId = defaultId;

        // Save new structure
        saveWorkspacesIndex();

        // Optional: clear legacy key after successful verification, keeping for safety now
    } else if (appState.workspaces.length === 0) {
        // Brand new user
        const newId = crypto.randomUUID();
        appState.workspaces = [{
            id: newId,
            name: 'My Watchlist',
            created: Date.now(),
            lastModified: Date.now()
        }];
        activeId = newId;
        saveWorkspacesIndex();
    }

    // Validate Active ID
    if (!activeId || !appState.workspaces.find(w => w.id === activeId)) {
        activeId = appState.workspaces[0].id;
    }

    appState.activeWorkspaceId = activeId;
    saveWorkspacesIndex(); // ensure active key is set

    // 4. Load Data for Active Workspace
    return loadWorkspaceData(activeId);
}

function loadWorkspaceData(id) {
    const stored = localStorage.getItem(STORAGE_PREFIX + id);
    if (!stored) {
        // Initialize empty state for this workspace
        resetInternalState();
        return false;
    }

    try {
        const loaded = JSON.parse(stored);

        if (loaded.allMovies && Array.isArray(loaded.allMovies)) {
            appState.movies = loaded.allMovies;
        } else {
            appState.movies = [];
        }

        if (loaded.selectedIds && Array.isArray(loaded.selectedIds)) {
            appState.selectedIds = new Set(loaded.selectedIds);
        } else {
            appState.selectedIds = new Set();
        }

        if (loaded.history && Array.isArray(loaded.history)) {
            appState.history = loaded.history;
        } else {
            appState.history = [];
        }

        if (loaded.filterState) {
            Object.assign(appState.filter, loaded.filterState);
        } else {
            // Reset filters to defaults
            appState.filter.query = '';
            appState.filter.normalizedQuery = '';
            appState.filter.showCustoms = true;
            appState.filter.sortMode = 'original';
        }

        if (loaded.preferences && typeof loaded.preferences === 'object') {
            const overrides = loaded.preferences.themeColorOverrides;
            const safeOverrides = overrides && typeof overrides === 'object' && !Array.isArray(overrides) ? overrides : {};
            appState.preferences = {
                hideFinalistsBox: Boolean(loaded.preferences.hideFinalistsBox),
                showFinalistsFromStart: Boolean(loaded.preferences.showFinalistsFromStart),
                theme: typeof loaded.preferences.theme === 'string' ? loaded.preferences.theme : 'default',
                themeColorOverrides: safeOverrides,
                discordWebhookUrl: loaded.preferences.discordWebhookUrl || ''
            };
        } else {
            appState.preferences = {
                hideFinalistsBox: false,
                showFinalistsFromStart: false,
                theme: 'default',
                themeColorOverrides: {}
            };
        }

        // Just to ensure
        if (typeof appState.filter.showCustoms !== 'boolean') {
            appState.filter.showCustoms = true;
        }

        return appState.movies.length > 0;
    } catch (e) {
        console.error('Failed to load state for workspace ' + id, e);
        resetInternalState();
        return false;
    }
}

function resetInternalState() {
    appState.movies = [];
    appState.selectedIds = new Set();
    appState.history = [];
    appState.knockoutResults = new Map();
    // Keep user preferences or reset? Resetting is safer for clean slate
    appState.preferences = {
        hideFinalistsBox: false,
        showFinalistsFromStart: false,
        theme: 'default',
        themeColorOverrides: {}
    };
}

// --- Workspace Management API ---

export function createWorkspace(name) {
    const newId = crypto.randomUUID();
    const newWorkspace = {
        id: newId,
        name: name || 'New Board',
        created: Date.now(),
        lastModified: Date.now()
    };
    appState.workspaces.push(newWorkspace);
    saveWorkspacesIndex();
    return newId;
}

export function switchWorkspace(id) {
    if (id === appState.activeWorkspaceId) return false;

    const target = appState.workspaces.find(w => w.id === id);
    if (!target) return false;

    // 1. Save current
    saveState();

    // 2. Switch
    appState.activeWorkspaceId = id;
    saveWorkspacesIndex();

    // 3. Load new
    loadWorkspaceData(id);

    return true;
}

export function renameWorkspace(id, newName) {
    const ws = appState.workspaces.find(w => w.id === id);
    if (ws) {
        ws.name = newName;
        saveWorkspacesIndex();
        return true;
    }
    return false;
}

export function deleteWorkspace(id) {
    // Prevent deleting the last workspace
    if (appState.workspaces.length <= 1) return false;

    const index = appState.workspaces.findIndex(w => w.id === id);
    if (index === -1) return false;

    // Remove data
    localStorage.removeItem(STORAGE_PREFIX + id);

    // Remove from index
    appState.workspaces.splice(index, 1);

    // If we deleted the active one, switch to another
    if (id === appState.activeWorkspaceId) {
        const nextId = appState.workspaces[0].id;
        appState.activeWorkspaceId = nextId;
        loadWorkspaceData(nextId);
        saveWorkspacesIndex();
    } else {
        saveWorkspacesIndex();
    }

    return true;
}

/**
 * Adds a movie to the history
 * @param {Object} movie 
 */
export function addToHistory(movie, spinMode = 'unknown') {
    const entry = {
        id: crypto.randomUUID(),
        movieId: movie.id,
        name: movie.name,
        year: movie.year,
        timestamp: Date.now(),
        uri: movie.uri,
        mode: spinMode
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

/**
 * Removes a single history entry by ID
 * @param {string} id 
 */
export function removeHistoryEntry(id) {
    appState.history = appState.history.filter(entry => entry.id !== id);
    saveState();
}

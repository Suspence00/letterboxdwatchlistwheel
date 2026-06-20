/**
 * Import functionality for Letterboxd Watchlist Wheel
 */

import { appState, saveState, switchWorkspace, saveWorkspacesIndex } from './state.js';
import { buildMovieIdentityKey, clampWeight, decodeHtmlEntities, getDefaultColorForIndex, normalizeLetterboxdUrl } from './utils.js';
import { updateMovieList, closeWinnerPopup, renderWorkspaceSwitcher, renderBoardsList, resetSliceEditor, renderHistory, showConfirmModal } from './ui.js';

let elements = {};

export function initImport(domElements) {
    elements = domElements;

    if (elements.letterboxdProxyForm) {
        console.log('Attaching submit listener to letterboxdProxyForm');
        elements.letterboxdProxyForm.addEventListener('submit', handleLetterboxdProxyImport);
    }

    if (elements.csvInput) {
        elements.csvInput.addEventListener('change', handleFileUpload);
    }

    if (elements.importToggleBtn && elements.importCard && elements.importCardBody) {
        elements.importToggleBtn.addEventListener('click', () => {
            const willCollapse = !elements.importCard.classList.contains('card--collapsed');
            setImportCardCollapsed(willCollapse);
        });
    }

    // Set up sync button
    const syncBtn = document.getElementById('import-sync-btn');
    if (syncBtn) {
        syncBtn.addEventListener('click', handleSyncBtnClick);
    }
}

export function setImportCardCollapsed(collapsed) {
    if (!elements.importToggleBtn || !elements.importCard || !elements.importCardBody) {
        return;
    }

    elements.importCard.classList.toggle('card--collapsed', collapsed);
    elements.importCardBody.hidden = collapsed;
    elements.importToggleBtn.setAttribute('aria-expanded', String(!collapsed));
    elements.importToggleBtn.textContent = collapsed ? 'Expand Step' : 'Collapse Step';
}

function buildWeightLookup(existingMovies = []) {
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

function restoreWeight(movie, lookup = new Map()) {
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

function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;')
              .replace(/</g, '&lt;')
              .replace(/>/g, '&gt;')
              .replace(/"/g, '&quot;')
              .replace(/'/g, '&#039;');
}

function formatTooltipList(names) {
    if (!names || names.length === 0) return 'None';
    const limit = 15;
    const formatted = names.slice(0, limit).map(name => `• ${name}`).join('\n');
    if (names.length > limit) {
        return `${formatted}\n...and ${names.length - limit} more`;
    }
    return formatted;
}

async function handleLetterboxdProxyImport(event) {
    console.log('handleLetterboxdProxyImport triggered');
    event.preventDefault();

    const input = elements.letterboxdProxyInput;
    const status = elements.letterboxdProxyStatus;
    if (!input || !status) return;

    const rawValue = input.value.trim();
    if (!rawValue) {
        status.textContent = 'Please enter a Letterboxd list URL.';
        status.classList.add('status--error');
        return;
    }

    // Normalize the entered URL
    let listUrl = rawValue;
    if (!/^https?:\/\//i.test(listUrl)) {
        listUrl = `https://letterboxd.com/${listUrl.replace(/^\/+/, '')}/`;
    }

    const normalizedInput = normalizeLetterboxdUrl(listUrl);
    const conflictWorkspace = appState.workspaces.find(
        (w) => w.id !== appState.activeWorkspaceId && w.letterboxdUrl && normalizeLetterboxdUrl(w.letterboxdUrl) === normalizedInput
    );

    if (conflictWorkspace) {
        showConfirmModal({
            title: 'Board Conflict',
            message: `This Letterboxd URL is already tied to a different board: <strong>${escapeHtml(conflictWorkspace.name)}</strong>.<br><br>Did you mean to update that board instead?`,
            confirmText: 'Switch & Update That Board',
            secondaryText: 'Import into Current Board Anyway',
            cancelText: 'Cancel Import',
            onConfirm: () => {
                if (switchWorkspace(conflictWorkspace.id)) {
                    if (elements.workspaceSelect) {
                        elements.workspaceSelect.value = conflictWorkspace.id;
                    }
                    updateMovieList();
                    renderHistory();
                    resetSliceEditor();
                    renderWorkspaceSwitcher();
                    renderBoardsList();

                    if (elements.letterboxdProxyInput) {
                        elements.letterboxdProxyInput.value = listUrl;
                    }
                    promptForImportModeOrExecute(listUrl, normalizedInput);
                }
            },
            onSecondary: () => {
                promptForImportModeOrExecute(listUrl, normalizedInput);
            },
            onCancel: () => {
                status.textContent = 'Import cancelled.';
                status.classList.remove('status--success');
                status.classList.add('status--error');
            }
        });
        return;
    }

    promptForImportModeOrExecute(listUrl, normalizedInput);
}

function promptForImportModeOrExecute(listUrl, normalizedInput) {
    const status = elements.letterboxdProxyStatus;
    if (appState.movies.length > 0) {
        showConfirmModal({
            title: 'Import Options',
            message: `This board already contains ${appState.movies.length} movies. Would you like to replace the existing list or only add new movies?`,
            confirmText: 'Replace Existing List',
            secondaryText: 'Add New Movies Only',
            cancelText: 'Cancel Import',
            onConfirm: () => {
                executeLetterboxdProxyImport(listUrl, normalizedInput, false);
            },
            onSecondary: () => {
                executeLetterboxdProxyImport(listUrl, normalizedInput, true);
            },
            onCancel: () => {
                if (status) {
                    status.textContent = 'Import cancelled.';
                    status.classList.remove('status--success');
                    status.classList.add('status--error');
                }
            }
        });
    } else {
        executeLetterboxdProxyImport(listUrl, normalizedInput, false);
    }
}

async function executeLetterboxdProxyImport(listUrl, normalizedInput, appendMode) {
    const status = elements.letterboxdProxyStatus;
    if (!status) return;

    const proxyUrl = `https://letterboxd-proxy.cwbcode.workers.dev/?url=${encodeURIComponent(listUrl)}&t=${Date.now()}`;

    status.textContent = 'Fetching list from Letterboxd…';
    status.classList.remove('status--error', 'status--success');

    try {
        const res = await fetch(proxyUrl);
        if (!res.ok) throw new Error(`Worker returned ${res.status}`);
        const csvText = await res.text();
        console.log('Proxy content length:', csvText.length);

        // Parse CSV text using your custom parser
        const rows = parseCSV(csvText, ',').filter(
            (row) => row.length && row.some((cell) => cell.trim() !== '')
        );

        if (rows.length <= 1) {
            status.textContent = 'The imported CSV appears to be empty.';
            status.classList.add('status--error');
            return;
        }

        // Identify header indices
        const header = rows[0].map((h) => h.trim().toLowerCase());
        const findColumn = (names) => {
            for (const n of names) {
                const idx = header.indexOf(n);
                if (idx !== -1) return idx;
            }
            return -1;
        };

        const titleIndex = findColumn(['title', 'name']);
        const uriIndex = findColumn(['letterboxduri', 'url', 'uri']);

        if (titleIndex === -1) {
            status.textContent = 'Could not find a title column in the CSV.';
            status.classList.add('status--error');
            return;
        }

        // Map rows into your app’s expected movie structure
        const existingWeights = buildWeightLookup(appState.movies);

        const newMovies = rows.slice(1).map((row, i) => {
            const rawTitle = row[titleIndex]?.trim() || '';
            if (!rawTitle) return null;
            const title = decodeHtmlEntities(rawTitle);
            const uri = uriIndex >= 0 ? row[uriIndex]?.trim() : '';
            const weight = restoreWeight({ uri, name: title }, existingWeights);
            return {
                id: `${i}-${title}`,
                name: title,
                uri,
                year: '',
                date: '',
                weight,
                color: getDefaultColorForIndex(i),
                initialIndex: i,
            };
        }).filter(Boolean);

        let addedCount = 0;
        const addedMovieNames = [];

        if (appendMode) {
            const existingKeys = new Set(
                appState.movies
                    .map((m) => buildMovieIdentityKey(m))
                    .filter(Boolean)
            );

            const moviesToAppend = [];
            newMovies.forEach((newMovie) => {
                const key = buildMovieIdentityKey(newMovie);
                if (key && existingKeys.has(key)) {
                    return;
                }
                const index = appState.movies.length + addedCount;
                newMovie.initialIndex = index;
                newMovie.color = getDefaultColorForIndex(index);
                newMovie.id = `imported-${Date.now()}-${index}-${Math.random().toString(36).substr(2, 9)}`;
                
                moviesToAppend.push(newMovie);
                addedMovieNames.push(newMovie.name);
                addedCount++;
            });

            appState.movies = [...appState.movies, ...moviesToAppend];
            moviesToAppend.forEach((m) => appState.selectedIds.add(m.id));
        } else {
            appState.movies = newMovies;
            appState.selectedIds = new Set(newMovies.map((m) => m.id));
            appState.knockoutResults.clear();
        }

        // Tie the URL to the current workspace, untie from others
        const currentBoard = appState.workspaces.find((w) => w.id === appState.activeWorkspaceId);
        if (currentBoard) {
            currentBoard.letterboxdUrl = listUrl;
        }
        appState.workspaces.forEach((w) => {
            if (w.id !== appState.activeWorkspaceId && w.letterboxdUrl && normalizeLetterboxdUrl(w.letterboxdUrl) === normalizedInput) {
                w.letterboxdUrl = '';
            }
        });
        saveWorkspacesIndex();
        renderBoardsList();

        updateMovieList();
        setImportCardCollapsed(true);
        saveState();

        if (elements.resultEl) elements.resultEl.textContent = '';

        if (appendMode) {
            const tooltipText = formatTooltipList(addedMovieNames);
            status.innerHTML = `Added <span class="sync-tooltip-trigger" data-tooltip="${escapeHtml(tooltipText)}">${addedCount} new movies</span> (out of ${newMovies.length} imported) successfully!`;
        } else {
            status.textContent = `Imported ${appState.movies.length} movies successfully!`;
        }
        status.classList.add('status--success');
    } catch (err) {
        console.error(err);
        status.textContent = 'Failed to import list.';
        status.classList.add('status--error');
    }
}

async function handleSyncBtnClick() {
    const currentBoard = appState.workspaces.find((w) => w.id === appState.activeWorkspaceId);
    if (!currentBoard || !currentBoard.letterboxdUrl) return;

    const syncBtn = document.getElementById('import-sync-btn');
    const status = elements.letterboxdProxyStatus;
    
    if (syncBtn) {
        syncBtn.disabled = true;
        const span = syncBtn.querySelector('span');
        if (span) span.textContent = 'Syncing...';
    }

    if (status) {
        status.textContent = 'Syncing with Letterboxd URL...';
        status.classList.remove('status--error', 'status--success');
    }

    try {
        await executeLetterboxdProxySync(currentBoard.letterboxdUrl);
    } catch (err) {
        console.error(err);
        if (status) {
            status.textContent = 'Failed to sync with Letterboxd.';
            status.classList.add('status--error');
        }
    } finally {
        if (syncBtn) {
            syncBtn.disabled = false;
            const span = syncBtn.querySelector('span');
            if (span) span.textContent = 'Sync List';
        }
    }
}

async function executeLetterboxdProxySync(listUrl) {
    const status = elements.letterboxdProxyStatus;
    const proxyUrl = `https://letterboxd-proxy.cwbcode.workers.dev/?url=${encodeURIComponent(listUrl)}&t=${Date.now()}`;

    const res = await fetch(proxyUrl);
    if (!res.ok) throw new Error(`Worker returned ${res.status}`);
    const csvText = await res.text();

    const rows = parseCSV(csvText, ',').filter(
        (row) => row.length && row.some((cell) => cell.trim() !== '')
    );

    if (rows.length <= 1) {
        throw new Error('The imported CSV appears to be empty.');
    }

    // Identify header indices
    const header = rows[0].map((h) => h.trim().toLowerCase());
    const findColumn = (names) => {
        for (const n of names) {
            const idx = header.indexOf(n);
            if (idx !== -1) return idx;
        }
        return -1;
    };

    const titleIndex = findColumn(['title', 'name']);
    const uriIndex = findColumn(['letterboxduri', 'url', 'uri']);

    if (titleIndex === -1) {
        throw new Error('Could not find a title column in the CSV.');
    }

    // Map rows into movie structure
    const newMovies = rows.slice(1).map((row, i) => {
        const rawTitle = row[titleIndex]?.trim() || '';
        if (!rawTitle) return null;
        const title = decodeHtmlEntities(rawTitle);
        const uri = uriIndex >= 0 ? row[uriIndex]?.trim() : '';
        return {
            name: title,
            uri,
            year: '',
            date: '',
        };
    }).filter(Boolean);

    const fetchedKeys = new Set(newMovies.map((m) => buildMovieIdentityKey(m)).filter(Boolean));
    const updatedMovies = [];
    const existingKeys = new Set();
    const removedMovieNames = [];

    // 1. Keep existing movies that are custom or still in the fetched list
    appState.movies.forEach((movie) => {
        const key = buildMovieIdentityKey(movie);
        if (movie.isCustom) {
            updatedMovies.push(movie);
            if (key) existingKeys.add(key);
        } else if (key && fetchedKeys.has(key)) {
            updatedMovies.push(movie);
            existingKeys.add(key);
        } else {
            removedMovieNames.push(movie.name);
        }
    });

    const removedCount = appState.movies.length - updatedMovies.length;
    let addedCount = 0;
    const addedMovieNames = [];

    // 2. Add new movies from fetched list
    newMovies.forEach((newMovie) => {
        const key = buildMovieIdentityKey(newMovie);
        if (key && !existingKeys.has(key)) {
            const index = updatedMovies.length;
            newMovie.initialIndex = index;
            newMovie.color = getDefaultColorForIndex(index);
            newMovie.id = `imported-${Date.now()}-${index}-${Math.random().toString(36).substr(2, 9)}`;
            newMovie.weight = 1;
            
            updatedMovies.push(newMovie);
            appState.selectedIds.add(newMovie.id);
            addedMovieNames.push(newMovie.name);
            addedCount++;
        }
    });

    appState.movies = updatedMovies;

    // 3. Clean up selectedIds
    const existingIds = new Set(appState.movies.map((m) => m.id));
    appState.selectedIds.forEach((id) => {
        if (!existingIds.has(id)) {
            appState.selectedIds.delete(id);
        }
    });

    updateMovieList();
    saveState();

    if (elements.resultEl) elements.resultEl.textContent = '';

    if (status) {
        const addedTooltip = formatTooltipList(addedMovieNames);
        const removedTooltip = formatTooltipList(removedMovieNames);
        
        let msg = 'Sync complete! ';
        if (addedCount > 0) {
            msg += `Added <span class="sync-tooltip-trigger" data-tooltip="${escapeHtml(addedTooltip)}">${addedCount} new movies</span>`;
        } else {
            msg += 'Added 0 new movies';
        }
        msg += ', ';
        if (removedCount > 0) {
            msg += `removed <span class="sync-tooltip-trigger" data-tooltip="${escapeHtml(removedTooltip)}">${removedCount} movies</span>`;
        } else {
            msg += 'removed 0 movies';
        }
        msg += '.';
        
        status.innerHTML = msg;
        status.classList.add('status--success');
    }
}

function handleFileUpload(event) {
    const file = event.target.files && event.target.files[0];
    if (!file) {
        return;
    }

    closeWinnerPopup({ restoreFocus: false });

    if (!file.name.toLowerCase().endsWith('.csv')) {
        if (elements.statusMessage) elements.statusMessage.textContent = 'Please choose a CSV file exported from Letterboxd.';
        return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const text = e.target.result;
            const delimiter = detectDelimiter(text);
            const rows = parseCSV(text, delimiter).filter(
                (row) => row.length > 0 && row.some((cell) => cell.trim() !== '')
            );
            if (rows.length <= 1) {
                if (elements.statusMessage) elements.statusMessage.textContent = 'The CSV appears to be empty.';
                return;
            }

            const header = rows[0].map((h) => h.trim().toLowerCase());
            const findColumn = (candidates) => {
                for (const candidate of candidates) {
                    const index = header.indexOf(candidate);
                    if (index !== -1) {
                        return index;
                    }
                }
                return -1;
            };

            const dateIndex = findColumn(['date', 'watched date', 'watcheddate', 'added', 'added date']);
            const nameIndex = findColumn(['name', 'title', 'film title', 'movie', 'film']);
            const yearIndex = findColumn(['year', 'release year', 'film year']);
            const uriIndex = header.findIndex((h) => h.includes('letterboxd') || h === 'url' || h === 'uri');

            if (nameIndex === -1) {
                if (elements.statusMessage) elements.statusMessage.textContent = 'Could not find a title column in this CSV.';
                return;
            }

            const isLikelyLizardExport = header.some((h) => h.includes('letterboxduri'));
            const existingWeights = buildWeightLookup(appState.movies);

            const newMovies = rows
                .slice(1)
                .map((row, index) => {
                    const rawNameInput = nameIndex >= 0 && row[nameIndex] ? row[nameIndex].trim() : '';
                    if (!rawNameInput) {
                        return null;
                    }
                    const rawName = decodeHtmlEntities(rawNameInput);

                    const uri = uriIndex >= 0 && row[uriIndex] ? row[uriIndex].trim() : '';
                    const year = yearIndex >= 0 && row[yearIndex] ? row[yearIndex].trim() : '';
                    const date = dateIndex >= 0 && row[dateIndex] ? row[dateIndex].trim() : '';
                    const weight = restoreWeight({ uri, name: rawName, year }, existingWeights);
                    const idBase = uri || rawName || index;

                    return {
                        id: `${index}-${idBase}`,
                        initialIndex: index,
                        name: rawName,
                        year,
                        date,
                        uri,
                        fromLizard: isLikelyLizardExport,
                        weight,
                        color: getDefaultColorForIndex(index)
                    };
                })
                .filter(Boolean);

            if (!newMovies.length) {
                if (elements.statusMessage) elements.statusMessage.textContent = 'No movies found in the CSV file.';
                return;
            }

            if (appState.movies.length > 0) {
                showConfirmModal({
                    title: 'Import Options',
                    message: `This board already contains ${appState.movies.length} movies. Would you like to replace the existing list or only add new movies?`,
                    confirmText: 'Replace Existing List',
                    secondaryText: 'Add New Movies Only',
                    cancelText: 'Cancel Import',
                    onConfirm: () => {
                        processUploadedCSVData(newMovies, false);
                    },
                    onSecondary: () => {
                        processUploadedCSVData(newMovies, true);
                    },
                    onCancel: () => {
                        if (elements.statusMessage) elements.statusMessage.textContent = 'Import cancelled.';
                        if (elements.csvInput) elements.csvInput.value = '';
                    }
                });
            } else {
                processUploadedCSVData(newMovies, false);
            }
        } catch (error) {
            console.error(error);
            if (elements.statusMessage) elements.statusMessage.textContent = 'Something went wrong while reading the CSV.';
            if (elements.csvInput) elements.csvInput.value = '';
        }
    };
    reader.onerror = () => {
        if (elements.statusMessage) elements.statusMessage.textContent = 'Failed to read the file. Please try again.';
        if (elements.csvInput) elements.csvInput.value = '';
    };
    reader.readAsText(file);
}

function processUploadedCSVData(newMovies, appendMode) {
    let addedCount = 0;
    const addedMovieNames = [];

    if (appendMode) {
        const existingKeys = new Set(
            appState.movies
                .map((m) => buildMovieIdentityKey(m))
                .filter(Boolean)
        );

        const moviesToAppend = [];
        newMovies.forEach((newMovie) => {
            const key = buildMovieIdentityKey(newMovie);
            if (key && existingKeys.has(key)) {
                return;
            }
            const index = appState.movies.length + addedCount;
            newMovie.initialIndex = index;
            newMovie.color = getDefaultColorForIndex(index);
            newMovie.id = `imported-${Date.now()}-${index}-${Math.random().toString(36).substr(2, 9)}`;
            
            moviesToAppend.push(newMovie);
            addedMovieNames.push(newMovie.name);
            addedCount++;
        });

        appState.movies = [...appState.movies, ...moviesToAppend];
        moviesToAppend.forEach((m) => appState.selectedIds.add(m.id));
    } else {
        appState.movies = newMovies;
        appState.knockoutResults.clear();
        appState.selectedIds = new Set(newMovies.map((movie) => movie.id));
    }

    if (elements.resultEl) elements.resultEl.textContent = '';
    if (elements.statusMessage) {
        if (appendMode) {
            const tooltipText = formatTooltipList(addedMovieNames);
            elements.statusMessage.innerHTML = `Added <span class="sync-tooltip-trigger" data-tooltip="${escapeHtml(tooltipText)}">${addedCount} new movies</span> (out of ${newMovies.length} imported). Ready to spin!`;
        } else {
            elements.statusMessage.textContent = `${appState.movies.length} movies imported. Ready to spin!`;
        }
    }
    updateMovieList();
    setImportCardCollapsed(true);
    saveState();

    if (elements.csvInput) {
        elements.csvInput.value = '';
    }
}

function detectDelimiter(text) {
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

function parseCSV(text, delimiter = ',') {
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

/** CSV uploads and the common import card controls. */
import { appState, saveState } from './state.js';
import { buildMovieIdentityKey, decodeHtmlEntities, getDefaultColorForIndex } from './utils.js';
import { updateMovieList, closeWinnerPopup, showConfirmModal } from './ui.js';
import { escapeHtml } from './ui/boards-ui.js';
import { buildWeightLookup, detectDelimiter, formatTooltipList, parseCSV, restoreWeight } from './import-data.js';
import { initLetterboxdImport } from './letterboxd-import.js';

export { getLetterboxdPaginationConfig } from './letterboxd-import.js';

let elements = {};

export function initImport(domElements) {
    elements = domElements;
    initLetterboxdImport(elements, setImportCardCollapsed);

    elements.csvInput?.addEventListener('change', handleFileUpload);
    elements.importToggleBtn?.addEventListener('click', () => {
        const willCollapse = !elements.importCard.classList.contains('card--collapsed');
        setImportCardCollapsed(willCollapse);
    });
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
                    message: `This wheel already contains ${appState.movies.length} movies. Would you like to replace the existing list or only add new movies?`,
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

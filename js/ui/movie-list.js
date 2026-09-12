/** Movie filtering, ordering, and synchronization with wheel and slice controls. */
import { appState, debouncedSaveState } from '../state.js';
import { getStoredWeight, getMovieOriginalIndex } from '../utils.js';
import {
    drawWheel,
    drawEmptyWheel,
    getIsSpinning,
    getIsLastStandingInProgress,
    getWinnerId,
    setWinnerId,
    setWeightMode,
    getSelectionOdds
} from '../wheel.js';
import { closeWinnerPopup, updateReshowWinnerButton } from './winner-modal.js';
import { resetSliceEditor, syncSliceEditorWithSelection, updateDisplayedOdds } from './slice-editor.js';
import { buildMovieListItem, getSafeHttpUrl } from './movie-list-item.js';
import { createMovieListViewport } from './movie-list-viewport.js';

const elements = {};
let getSpinMode = () => 'knockout';
let updateSpinButtonLabel = () => {};
let viewport = null;
let wheelUpdateFrame = null;
let pendingWheelSelection = null;
let pendingOddsMaps = null;

function isThemePaletteLocked() {
    return Boolean(appState.preferences?.theme && appState.preferences.theme !== 'default');
}

/** Connect list updates to the orchestrator without importing the UI facade. */
export function initMovieList(domElements, callbacks) {
    Object.assign(elements, domElements);
    getSpinMode = callbacks.getSpinMode;
    updateSpinButtonLabel = callbacks.updateSpinButtonLabel;
    const actions = {
        updateMovieList,
        removeCustomEntry,
        onAppearanceChange: () => {
            scheduleWheelUpdate();
            syncSliceEditorWithSelection(getFilteredSelectedMovies());
        }
    };
    viewport = createMovieListViewport(elements, (movie, index, context) =>
        buildMovieListItem(movie, index, context, actions));
}

/** @returns {import('../types.js').Movie[]} */
export function getFilteredMovies() {
    const { movies, filter } = appState;

    return movies.filter((movie) => {
        if (!filter.showCustoms && movie.isCustom) return false;

        if (filter.normalizedQuery) {
            const haystack = [movie.name, movie.year, movie.date]
                .filter((part) => typeof part === 'string' && part.trim())
                .join(' ')
                .toLowerCase();

            if (!haystack.includes(filter.normalizedQuery)) return false;
        }

        return true;
    });
}

/** @returns {import('../types.js').Movie[]} */
export function getFilteredSelectedMovies() {
    return getFilteredMovies().filter((movie) => appState.selectedIds.has(movie.id));
}

function getActiveFilterDescriptions() {
    const descriptions = [];
    if (appState.filter.query) {
        descriptions.push(`search "${appState.filter.query}"`);
    }
    if (!appState.filter.showCustoms) {
        descriptions.push('Custom entries hidden');
    }
    if (appState.filter.sortMode && appState.filter.sortMode !== 'original') {
        descriptions.push(`sorted by ${appState.filter.sortMode}`);
    }
    return descriptions;
}

function getModeCopy(isInverseMode) {
    if (isInverseMode) {
        return {
            riskLabel: 'Pick risk this spin',
            winLabel: 'Odds to be final winner',
            weightHelp: 'Knockout mode: higher weight makes a movie harder to be picked in elimination spins (better odds to reach the end).',
            weightLabel: 'Knockout weight'
        };
    }
    return {
        riskLabel: 'Odds to win',
        winLabel: 'Final winner odds',
        weightHelp: 'One Spin mode: higher weight increases the chance this movie is picked on the single spin.',
        weightLabel: 'Spin weight (more likely)'
    };
}

function applyWeightCopy(copy) {
    if (elements.sliceWeightLabel) {
        elements.sliceWeightLabel.textContent = copy.weightLabel;
    }
    if (elements.sliceWeightHelp) {
        elements.sliceWeightHelp.title = copy.weightHelp;
        elements.sliceWeightHelp.setAttribute('aria-label', copy.weightHelp);
    }
    if (elements.sliceOddsLabelRisk) {
        elements.sliceOddsLabelRisk.textContent = copy.riskLabel;
    }
    if (elements.sliceOddsLabelWin) {
        elements.sliceOddsLabelWin.textContent = copy.winLabel;
    }
}

export function updateMovieList() {
    if (!elements.movieListEl) return;

    const syncContainer = document.getElementById('import-sync-container');
    const syncUrlLink = document.getElementById('import-sync-url');
    if (syncContainer && syncUrlLink) {
        const currentBoard = appState.workspaces.find(w => w.id === appState.activeWorkspaceId);
        if (currentBoard && currentBoard.letterboxdUrl) {
            syncContainer.hidden = false;
            const safeUrl = getSafeHttpUrl(currentBoard.letterboxdUrl);
            syncUrlLink.href = safeUrl || '#';
            syncUrlLink.textContent = currentBoard.letterboxdUrl;
        } else {
            syncContainer.hidden = true;
        }
    }

    const spinMode = getSpinMode();
    const inverseMode = spinMode === 'knockout';
    setWeightMode(inverseMode ? 'inverse' : 'normal');
    const currentWeightCopy = getModeCopy(inverseMode);
    applyWeightCopy(currentWeightCopy);
    const weightsEnabled = true;
    const randomBoostActive = spinMode === 'random-boost';
    const themeLocked = isThemePaletteLocked();

    if (!appState.movies.length) {
        viewport.resetVirtualList();
        elements.movieListEl.innerHTML = '';
        const emptyItem = document.createElement('li');
        emptyItem.className = 'empty';
        emptyItem.textContent = 'Upload a CSV to see your movies here.';
        elements.movieListEl.appendChild(emptyItem);
        if (elements.spinButton) elements.spinButton.disabled = true;
        drawEmptyWheel();
        closeWinnerPopup({ restoreFocus: false });
        updateSpinButtonLabel();
        resetSliceEditor();
        updateDisplayedOdds();
        return;
    }

    const filteredMovies = getFilteredMovies();
    const winnerId = getWinnerId();

    const winnerVisible = filteredMovies.some((movie) => movie.id === winnerId && appState.selectedIds.has(movie.id));
    if (winnerId && !winnerVisible) {
        setWinnerId(null);
        if (elements.resultEl) elements.resultEl.textContent = '';
        closeWinnerPopup({ restoreFocus: false });
    }

    if (!filteredMovies.length) {
        viewport.resetVirtualList();
        elements.movieListEl.innerHTML = '';
        const emptyItem = document.createElement('li');
        emptyItem.className = 'empty';
        const descriptions = getActiveFilterDescriptions();
        emptyItem.textContent = descriptions.length
            ? `No movies match your current filters (${descriptions.join(', ')}).`
            : 'No movies match your current filters.';
        elements.movieListEl.appendChild(emptyItem);
        if (elements.spinButton) elements.spinButton.disabled = true;
        drawEmptyWheel();
        resetSliceEditor();
        updateDisplayedOdds();
        return;
    }

    const selectedMovies = filteredMovies.filter((movie) => appState.selectedIds.has(movie.id));
    const oddsMap = getSelectionOdds(selectedMovies, { inverseModeOverride: inverseMode });
    const winOddsMap = getSelectionOdds(selectedMovies, { inverseModeOverride: false });

    const displayMovies = [...filteredMovies];
    if (!appState.knockoutResults.size) {
        const mode = appState.filter.sortMode || 'original';
        displayMovies.sort((a, b) => {
            if (mode === 'name-asc') {
                return (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base' });
            }
            if (mode === 'name-desc') {
                return (b.name || '').localeCompare(a.name || '', undefined, { sensitivity: 'base' });
            }
            if (mode === 'weight-desc') {
                return (getStoredWeight(b) || 0) - (getStoredWeight(a) || 0);
            }
            if (mode === 'weight-asc') {
                return (getStoredWeight(a) || 0) - (getStoredWeight(b) || 0);
            }
            return 0;
        });
    }
    if (appState.knockoutResults.size) {
        displayMovies.sort((a, b) => {
            const aStatus = appState.knockoutResults.get(a.id);
            const bStatus = appState.knockoutResults.get(b.id);
            const aOrder = aStatus && Number.isFinite(aStatus.order) ? aStatus.order : null;
            const bOrder = bStatus && Number.isFinite(bStatus.order) ? bStatus.order : null;

            if (aOrder !== null && bOrder !== null) {
                if (aOrder !== bOrder) {
                    return aOrder - bOrder;
                }
                if (aStatus?.status === 'champion' && bStatus?.status !== 'champion') {
                    return 1;
                }
                if (aStatus?.status !== 'champion' && bStatus?.status === 'champion') {
                    return -1;
                }
                return 0;
            }

            if (aOrder !== null) return -1;
            if (bOrder !== null) return 1;

            const aIndex = getMovieOriginalIndex(a, appState.movies);
            const bIndex = getMovieOriginalIndex(b, appState.movies);
            if (aIndex === bIndex) {
                return 0;
            }
            if (!Number.isFinite(aIndex)) return 1;
            if (!Number.isFinite(bIndex)) return -1;
            return aIndex - bIndex;
        });
    }

    const renderContext = {
        oddsMap,
        winOddsMap,
        weightsEnabled,
        randomBoostActive,
        themeLocked,
        winnerId,
        weightCopy: currentWeightCopy
    };
    viewport.renderMovieList(displayMovies, renderContext);

    if (elements.spinButton) {
        elements.spinButton.disabled = selectedMovies.length === 0 || getIsSpinning() || getIsLastStandingInProgress();
    }
    if (!selectedMovies.length) {
        closeWinnerPopup({ restoreFocus: false });
    }
    syncSliceEditorWithSelection(selectedMovies);
    scheduleWheelUpdate(selectedMovies, { oddsMap, winOddsMap });
    updateSpinButtonLabel();
    updateReshowWinnerButton();
}

function scheduleWheelUpdate(selectionOverride = null, oddsOverride = null) {
    if (selectionOverride) {
        pendingWheelSelection = selectionOverride;
    }
    if (oddsOverride) {
        pendingOddsMaps = oddsOverride;
    }
    if (wheelUpdateFrame) {
        return;
    }
    wheelUpdateFrame = requestAnimationFrame(() => {
        wheelUpdateFrame = null;
        const selectedMoviesSnapshot = pendingWheelSelection || getFilteredSelectedMovies();
        const oddsMaps = pendingOddsMaps;
        pendingWheelSelection = null;
        pendingOddsMaps = null;
        drawWheel(selectedMoviesSnapshot);
        updateDisplayedOdds(selectedMoviesSnapshot, oddsMaps);
        debouncedSaveState();
    });
}

function removeCustomEntry(id) {
    const movie = appState.movies.find((item) => item.id === id && item.isCustom);
    if (!movie) return;

    appState.movies = appState.movies.filter((item) => item.id !== id);
    appState.knockoutResults.delete(id);
    appState.selectedIds.delete(id);
    if (elements.statusMessage) elements.statusMessage.textContent = `Removed “${movie.name}” from the wheel.`;
    updateMovieList();
}

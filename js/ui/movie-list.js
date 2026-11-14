/** Movie filtering, ordering, and synchronization with wheel and slice controls. */
import { appState, debouncedSaveState, getFilteredMovies, getFilteredSelectedMovies } from '../state.js';
import { getStoredWeight, getMovieOriginalIndex } from '../utils.js';
import {
    drawWheel,
    getWinnerId,
    setWinnerId,
    getModeOdds
} from '../wheel.js';
import { getActiveSpinMode } from '../vhs-wheel.js';
import { closeWinnerPopup, updateReshowWinnerButton } from './winner-modal.js';
import { resetSliceEditor, syncSliceEditorWithSelection, updateSliceOddsDisplay } from './slice-editor.js';
import { buildMovieListItem } from './movie-list-item.js';
import { getModeCopy, updateMovieOdds } from './movie-odds.js';
import { createMovieListViewport } from './movie-list-viewport.js';

const elements = {};
let updateSpinButtonLabel = () => {};
let viewport = null;
let wheelUpdateFrame = null;

function isThemePaletteLocked() {
    return Boolean(appState.preferences?.theme && appState.preferences.theme !== 'default');
}

/** Connect list updates to the orchestrator without importing the UI facade. */
export function initMovieList(domElements, callbacks) {
    Object.assign(elements, domElements);
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

    const spinMode = getActiveSpinMode();
    const currentWeightCopy = getModeCopy(spinMode);
    applyWeightCopy(currentWeightCopy);
    const weightsEnabled = true;
    const randomBoostActive = spinMode === 'random-boost';
    const themeLocked = isThemePaletteLocked();
    const filteredMovies = getFilteredMovies();
    const selectedMovies = filteredMovies.filter((movie) => appState.selectedIds.has(movie.id));

    updateSpinEligibility(selectedMovies.length);

    const winnerId = getWinnerId();
    const winnerVisible = selectedMovies.some((movie) => movie.id === winnerId);
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
        if (!appState.movies.length) {
            emptyItem.textContent = 'Import from Letterboxd, upload a CSV, paste a list, or add a movie to get started.';
        } else {
            emptyItem.textContent = descriptions.length
                ? `No movies match your current filters (${descriptions.join(', ')}).`
                : 'No movies match your current filters.';
        }
        elements.movieListEl.appendChild(emptyItem);
        closeWinnerPopup({ restoreFocus: false });
        updateSpinButtonLabel();
        resetSliceEditor();
        scheduleWheelUpdate();
        return;
    }

    const { oddsMap, winOddsMap } = getModeOdds(selectedMovies, spinMode);

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
        spinMode,
        oddsMap,
        winOddsMap,
        weightsEnabled,
        randomBoostActive,
        themeLocked,
        winnerId,
        weightCopy: currentWeightCopy
    };
    viewport.renderMovieList(displayMovies, renderContext);

    if (!selectedMovies.length) {
        closeWinnerPopup({ restoreFocus: false });
    }
    syncSliceEditorWithSelection(selectedMovies);
    scheduleWheelUpdate();
    updateSpinButtonLabel();
    updateReshowWinnerButton();
}

export function updateDisplayedOdds() {
    const spinMode = getActiveSpinMode();
    const weightCopy = getModeCopy(spinMode);
    const { oddsMap, winOddsMap } = getModeOdds(undefined, spinMode);
    const context = { oddsMap, winOddsMap, spinMode, weightCopy };
    const ids = new Map(appState.movies.map(movie => [String(movie.id), movie.id]));
    viewport.updateOdds(context);
    for (const row of elements.movieListEl.querySelectorAll('li[data-id]')) {
        const id = ids.get(row.dataset.id);
        updateMovieOdds(row, id, appState.selectedIds.has(id), context);
    }
    updateSliceOddsDisplay(context);
}

function updateSpinEligibility(count) {
    if (elements.spinEligibility) {
        const label = `${count} ${count === 1 ? 'movie' : 'movies'} eligible to spin`;
        if (elements.spinEligibility.textContent !== label) elements.spinEligibility.textContent = label;
    }
    if (elements.goToSpin) elements.goToSpin.hidden = count === 0;
}

export function scheduleWheelUpdate() {
    if (wheelUpdateFrame) return;
    wheelUpdateFrame = requestAnimationFrame(() => {
        wheelUpdateFrame = null;
        drawWheel();
        updateDisplayedOdds();
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

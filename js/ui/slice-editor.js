/**
 * Slice editor and odds calculation display management.
 */

import {
    appState,
    debouncedSaveState
} from '../state.js';
import {
    clampWeight,
    getStoredColor,
    getStoredWeight,
    getDefaultColorForIndex,
    sanitizeColor,
    escapeSelector,
    getMovieOriginalIndex
} from '../utils.js';
import {
    drawWheel,
    getSelectionOdds,
    invalidateWheelCache,
    getIsSpinning,
    getIsLastStandingInProgress
} from '../wheel.js';

// Internal module state
export let activeSliceId = null;

let wheelUpdateFrame = null;
let pendingWheelSelection = null;
let pendingOddsMaps = null;

const domOverrides = {};

const elements = new Proxy(domOverrides, {
    get(target, prop) {
        if (target[prop]) return target[prop];
        if (typeof document === 'undefined') return null;
        const idMap = {
            sliceEditor: 'slice-editor',
            sliceEditorBody: 'slice-editor-body',
            sliceEditorHint: 'slice-editor-hint',
            sliceEditorName: 'slice-editor-name',
            sliceEditorClearBtn: 'slice-editor-clear',
            sliceWeightLabel: 'slice-weight-label',
            sliceWeightHelp: 'slice-weight-help',
            sliceColorInput: 'slice-color',
            sliceColorSwatch: 'slice-color-swatch',
            sliceWeightInput: 'slice-weight',
            sliceWeightValue: 'slice-weight-value',
            sliceOddsLabelRisk: 'slice-odds-label-risk',
            sliceOddsValueRisk: 'slice-odds-value-risk',
            sliceOddsLabelWin: 'slice-odds-label-win',
            sliceOddsValueWin: 'slice-odds-value-win',
            movieListEl: 'movie-list',
            wheelAside: 'wheel-aside',
            wheelLayout: 'wheel-layout',
            knockoutBox: 'knockout-remaining'
        };
        const id = idMap[prop];
        return id ? document.getElementById(id) : null;
    },
    set(target, prop, value) {
        target[prop] = value;
        return true;
    }
});

function isThemePaletteLocked() {
    return Boolean(appState.preferences?.theme && appState.preferences.theme !== 'default');
}

function isRandomBoostEnabled() {
    return false;
}

function getSpinMode() {
    if (typeof document === 'undefined') return 'knockout';
    const radios = document.querySelectorAll('input[name="spin-mode"]');
    for (const radio of radios) {
        if (radio.checked) {
            return radio.value;
        }
    }
    return 'knockout';
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

function formatOddsPercent(value = 0) {
    const numeric = Number(value) * 100;
    const safePercent = Number.isFinite(numeric) ? Math.min(100, Math.max(0, numeric)) : 0;
    if (safePercent === 0 || safePercent === 100 || safePercent >= 10) {
        return Math.round(safePercent) + '%';
    }
    return safePercent.toFixed(1) + '%';
}

function buildMovieOddsLabel(oddsValue = 0, isSelected = false, label = '') {
    if (!isSelected) {
        return label + ': 0% (not selected)';
    }
    return label + ': ' + formatOddsPercent(oddsValue);
}

function getFilteredSelectedMovies() {
    const { movies = [], selectedIds = new Set(), filter = {} } = appState;
    return movies.filter((movie) => {
        if (!selectedIds.has(movie.id)) return false;
        if (filter.showCustoms === false && movie.isCustom) return false;
        if (filter.normalizedQuery) {
            const haystack = [movie.name, movie.year]
                .filter(Boolean)
                .join(' ')
                .toLowerCase();
            if (!haystack.includes(filter.normalizedQuery)) return false;
        }
        return true;
    });
}

function updateWheelAsideLayout() {
    const wheelAside = elements.wheelAside;
    const wheelLayout = elements.wheelLayout;
    if (!wheelAside || !wheelLayout) return;
    const knockoutBox = elements.knockoutBox;
    const sliceEditor = elements.sliceEditor;
    const asideVisible = (knockoutBox && !knockoutBox.hidden) || (sliceEditor && !sliceEditor.hidden);
    wheelAside.classList.toggle('is-hidden', !asideVisible);
    wheelLayout.classList.toggle('is-centered', !asideVisible);
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
    const raf = typeof requestAnimationFrame === 'function' ? requestAnimationFrame : setTimeout;
    wheelUpdateFrame = raf(() => {
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

function redrawWheelAndPersist() {
    invalidateWheelCache();
    scheduleWheelUpdate();
}

function syncListControlsWithMovie(movie, colorOverride = null) {
    if (!elements.movieListEl) return;
    const safeId = escapeSelector(movie.id);
    const row = elements.movieListEl.querySelector(`li[data-id="${safeId}"]`);
    if (!row) return;

    const weightSelect = row.querySelector('.movie-weight__select');
    if (weightSelect) {
        weightSelect.value = String(getStoredWeight(movie));
    }

    const colorInput = row.querySelector('.movie-color__input');
    if (colorInput) {
        const resolvedColor = colorOverride || getSliceDefaults(movie).color;
        colorInput.value = resolvedColor;
    }
}

export function handleSliceSelection(movie) {
    if (!movie || (typeof getIsSpinning === 'function' && getIsSpinning()) || (typeof getIsLastStandingInProgress === 'function' && getIsLastStandingInProgress())) {
        return;
    }
    setActiveSlice(movie);
}

function setActiveSlice(movie, { skipWheelUpdate = false } = {}) {
    if (!movie || !elements.sliceEditor) {
        return;
    }

    const { color, fallback, weight } = getSliceDefaults(movie);
    movie.color = color;
    movie.weight = weight;
    activeSliceId = movie.id;
    const themeLocked = isThemePaletteLocked();

    elements.sliceEditor.hidden = false;
    if (elements.sliceEditorBody) {
        elements.sliceEditorBody.hidden = false;
    }
    if (elements.sliceEditorHint) {
        elements.sliceEditorHint.textContent = themeLocked
            ? 'Holiday theme is active, so slice colors follow the theme palette.'
            : 'Adjust slice color and weight.';
    }
    if (elements.sliceEditorName) {
        elements.sliceEditorName.textContent = movie.name;
    }
    if (elements.sliceColorInput) {
        elements.sliceColorInput.value = color;
        elements.sliceColorInput.disabled = themeLocked;
    }
    if (elements.sliceColorSwatch) {
        elements.sliceColorSwatch.style.backgroundColor = color;
    }
    updateSliceWeightDisplay(weight);
    if (elements.sliceWeightInput) {
        elements.sliceWeightInput.disabled = isRandomBoostEnabled();
    }
    updateSliceOddsDisplay();
    syncListControlsWithMovie(movie, color);
    updateWheelAsideLayout();
    if (!skipWheelUpdate) {
        redrawWheelAndPersist();
    }
}

export function resetSliceEditor() {
    activeSliceId = null;
    if (elements.sliceEditor) {
        elements.sliceEditor.hidden = true;
    }
    if (elements.sliceEditorBody) {
        elements.sliceEditorBody.hidden = true;
    }
    if (elements.sliceEditorHint) {
        elements.sliceEditorHint.textContent = 'Click a wheel slice to adjust its color and weight.';
    }
    if (elements.sliceEditorName) {
        elements.sliceEditorName.textContent = '';
    }
    if (elements.sliceColorSwatch) {
        elements.sliceColorSwatch.style.backgroundColor = 'transparent';
    }
    if (elements.sliceColorInput) {
        elements.sliceColorInput.value = '#ff8600';
        elements.sliceColorInput.disabled = isThemePaletteLocked();
    }
    if (elements.sliceOddsValueRisk) {
        elements.sliceOddsValueRisk.textContent = '0%';
        elements.sliceOddsValueRisk.classList.add('slice-editor__odds-value--inactive');
    }
    if (elements.sliceOddsValueWin) {
        elements.sliceOddsValueWin.textContent = '0%';
        elements.sliceOddsValueWin.classList.add('slice-editor__odds-value--inactive');
    }
    updateSliceWeightDisplay(1);
    updateWheelAsideLayout();
}

function getSliceDefaults(movie) {
    const originalIndex = getMovieOriginalIndex(movie, appState.movies);
    let paletteIndex = originalIndex;
    if (!Number.isFinite(paletteIndex) || paletteIndex < 0) {
        paletteIndex = appState.movies.indexOf(movie);
    }
    const fallback = getDefaultColorForIndex(paletteIndex);
    const color = isThemePaletteLocked() ? fallback : getStoredColor(movie, fallback);
    const weight = getStoredWeight(movie);
    return { color, fallback, weight };
}

export function getActiveSliceMovie() {
    if (!activeSliceId) {
        return null;
    }
    return appState.movies.find((movie) => movie.id === activeSliceId) || null;
}

export function updateSliceWeightDisplay(weight) {
    if (elements.sliceWeightInput) {
        elements.sliceWeightInput.value = String(weight);
        elements.sliceWeightInput.setAttribute('aria-valuenow', String(weight));
    }
    if (elements.sliceWeightValue) {
        elements.sliceWeightValue.textContent = weight + 'x';
    }
}

function handleSliceColorInput(event) {
    if (isThemePaletteLocked()) {
        return;
    }
    const movie = getActiveSliceMovie();
    if (!movie) {
        return;
    }
    const { fallback } = getSliceDefaults(movie);
    const sanitized = sanitizeColor(event.target.value, fallback);
    movie.color = sanitized;
    event.target.value = sanitized;
    if (elements.sliceColorSwatch) {
        elements.sliceColorSwatch.style.backgroundColor = sanitized;
    }
    syncListControlsWithMovie(movie, sanitized);
    redrawWheelAndPersist();
}

function handleSliceWeightInput(event) {
    if (isRandomBoostEnabled()) {
        event.target.value = '1';
        return;
    }
    const movie = getActiveSliceMovie();
    if (!movie) {
        return;
    }
    const numericValue = Number(event.target.value);
    const clamped = clampWeight(numericValue);
    movie.weight = clamped;
    event.target.value = String(clamped);
    updateSliceWeightDisplay(clamped);
    syncListControlsWithMovie(movie);
    redrawWheelAndPersist();
}

export function syncSliceEditorWithSelection(currentSelection = []) {
    if (!elements.sliceEditor) {
        return;
    }
    if (!activeSliceId) {
        resetSliceEditor();
        return;
    }
    const movie = appState.movies.find((item) => item.id === activeSliceId);
    const stillVisible = movie && currentSelection.some((entry) => entry.id === activeSliceId);
    if (!stillVisible) {
        resetSliceEditor();
        return;
    }
    setActiveSlice(movie, { skipWheelUpdate: true });
    updateWheelAsideLayout();
}

export function populateSliceEditor(m) {
    if (!elements.sliceEditor) return;
    elements.sliceEditor.hidden = false;
    if (elements.sliceEditorName) elements.sliceEditorName.textContent = m.name;
    if (elements.sliceWeightValue) elements.sliceWeightValue.textContent = getStoredWeight(m) + 'x';
}

export function updateDisplayedOdds(selectionOverride = null, oddsOverride = null) {
    const selectedMovies = Array.isArray(selectionOverride) ? selectionOverride : getFilteredSelectedMovies();
    const spinMode = getSpinMode();
    const currentWeightCopy = getModeCopy(spinMode === 'knockout');
    const oddsMap = oddsOverride?.oddsMap || getSelectionOdds(selectedMovies, { inverseModeOverride: spinMode === 'knockout' });
    const winOddsMap = oddsOverride?.winOddsMap || getSelectionOdds(selectedMovies, { inverseModeOverride: false });
    if (elements.movieListEl) {
        const items = elements.movieListEl.querySelectorAll('li[data-id]');
        items.forEach((item) => {
            const oddsEl = item.querySelector('.movie-odds');
            if (!oddsEl) return;
            const id = item.dataset.id;
            const isSelected = appState.selectedIds.has(id);
            const hasRisk = oddsMap.has(id);
            const hasWin = winOddsMap.has(id);
            const isActive = isSelected && hasRisk;
            const isWinActive = isSelected && hasWin;
            const oddsValue = isActive ? oddsMap.get(id) || 0 : 0;
            oddsEl.textContent = buildMovieOddsLabel(oddsValue, isActive, currentWeightCopy.riskLabel);
            oddsEl.classList.toggle('movie-odds--inactive', !isActive);
            const winOddsEl = item.querySelector('.movie-odds--win');
            if (winOddsEl) {
                const winOddsValue = isWinActive ? winOddsMap.get(id) || 0 : 0;
                winOddsEl.textContent = buildMovieOddsLabel(winOddsValue, isWinActive, currentWeightCopy.winLabel);
                winOddsEl.classList.toggle('movie-odds--inactive', !isWinActive);
            }
        });
    }
    updateSliceOddsDisplay(oddsMap, selectedMovies);
}

export function updateSliceOddsDisplay(oddsMap = null, selectionOverride = null) {
    if (!elements.sliceOddsValueRisk || !elements.sliceOddsValueWin) {
        return;
    }
    const currentWeightCopy = getModeCopy(getSpinMode() === 'knockout');
    if (elements.sliceOddsLabelRisk) {
        elements.sliceOddsLabelRisk.textContent = currentWeightCopy.riskLabel;
    }
    if (elements.sliceOddsLabelWin) {
        elements.sliceOddsLabelWin.textContent = currentWeightCopy.winLabel;
    }
    const movie = getActiveSliceMovie();
    if (!movie || !appState.selectedIds.has(movie.id)) {
        elements.sliceOddsValueRisk.textContent = '0%';
        elements.sliceOddsValueRisk.classList.add('slice-editor__odds-value--inactive');
        elements.sliceOddsValueWin.textContent = '0%';
        elements.sliceOddsValueWin.classList.add('slice-editor__odds-value--inactive');
        return;
    }
    const selectedMovies = Array.isArray(selectionOverride) ? selectionOverride : getFilteredSelectedMovies();
    const resolvedMap = oddsMap || getSelectionOdds(selectedMovies);
    const winMap = getSelectionOdds(selectedMovies, { inverseModeOverride: false });
    const hasRiskOdds = resolvedMap.has(movie.id);
    const hasWinOdds = winMap.has(movie.id);
    const oddsValue = hasRiskOdds ? resolvedMap.get(movie.id) || 0 : 0;
    const winOddsValue = hasWinOdds ? winMap.get(movie.id) || 0 : 0;
    elements.sliceOddsValueRisk.textContent = formatOddsPercent(oddsValue);
    elements.sliceOddsValueRisk.classList.toggle('slice-editor__odds-value--inactive', !hasRiskOdds || oddsValue <= 0);
    elements.sliceOddsValueWin.textContent = formatOddsPercent(winOddsValue);
    elements.sliceOddsValueWin.classList.toggle('slice-editor__odds-value--inactive', !hasWinOdds || winOddsValue <= 0);
}

export function initSliceEditor(domElements = {}) {
    Object.assign(domOverrides, domElements);
    if (elements.sliceColorInput) {
        elements.sliceColorInput.addEventListener('input', handleSliceColorInput);
    }
    if (elements.sliceWeightInput) {
        elements.sliceWeightInput.addEventListener('input', handleSliceWeightInput);
    }
    if (elements.sliceEditorClearBtn) {
        elements.sliceEditorClearBtn.addEventListener('click', () => resetSliceEditor());
    }
}

export {
    setActiveSlice,
    getSliceDefaults,
    handleSliceColorInput,
    handleSliceWeightInput
};

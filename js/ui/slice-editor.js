/**
 * Slice editor and odds calculation display management.
 */

import { appState } from '../state.js';
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
    getModeOdds,
    invalidateWheelCache,
    getIsSpinning,
    getIsLastStandingInProgress
} from '../wheel.js';
import { getActiveSpinMode } from '../vhs-wheel.js';
import { getModeCopy } from './movie-odds.js';

// Internal module state
export let activeSliceId = null;

let scheduleWheelUpdate;

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

function formatOddsPercent(value = 0) {
    const numeric = Number(value) * 100;
    const safePercent = Number.isFinite(numeric) ? Math.min(100, Math.max(0, numeric)) : 0;
    if (safePercent === 0 || safePercent === 100 || safePercent >= 10) {
        return Math.round(safePercent) + '%';
    }
    return safePercent.toFixed(1) + '%';
}

function updateWheelAsideLayout() {
    const wheelAside = elements.wheelAside;
    const wheelLayout = elements.wheelLayout;
    if (!wheelAside || !wheelLayout) return;
    const knockoutBox = elements.knockoutBox;
    const asideVisible = Boolean(knockoutBox && !knockoutBox.hidden);
    wheelAside.classList.toggle('is-hidden', !asideVisible);
    wheelLayout.classList.toggle('is-centered', !asideVisible);
}

function redrawWheelAndPersist() {
    invalidateWheelCache();
    scheduleWheelUpdate?.();
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
            ? 'Slice colors follow the active theme palette.'
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

export function updateSliceOddsDisplay({ oddsMap, winOddsMap } = getModeOdds()) {
    if (!elements.sliceOddsValueRisk || !elements.sliceOddsValueWin) {
        return;
    }
    const mode = getActiveSpinMode();
    const currentWeightCopy = getModeCopy(mode);
    elements.sliceOddsValueRisk.parentElement.hidden = mode !== 'knockout';
    elements.sliceOddsValueWin.parentElement.hidden = mode === 'wheelchinko';
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
    const oddsValue = oddsMap.get(movie.id) || 0;
    const winOddsValue = winOddsMap.get(movie.id) || 0;
    elements.sliceOddsValueRisk.textContent = formatOddsPercent(oddsValue);
    elements.sliceOddsValueRisk.classList.toggle('slice-editor__odds-value--inactive', oddsValue <= 0);
    elements.sliceOddsValueWin.textContent = formatOddsPercent(winOddsValue);
    elements.sliceOddsValueWin.classList.toggle('slice-editor__odds-value--inactive', winOddsValue <= 0);
}

export function initSliceEditor(domElements, refreshWheel) {
    Object.assign(domOverrides, domElements);
    scheduleWheelUpdate = refreshWheel;
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

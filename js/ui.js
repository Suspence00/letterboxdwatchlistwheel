/**
 * UI management orchestrator and facade for Letterboxd Watchlist Wheel.
 * Re-exports all sub-modules under js/ui/ to maintain backwards-compatibility.
 */

import {
    appState,
    debouncedSaveState,
    saveState
} from './state.js';
import {
    decodeHtmlEntities,
    getDefaultColorForIndex,
    getStoredColor,
    getStoredWeight,
    clampWeight,
    sanitizeColor,
    escapeSelector,
    getMovieOriginalIndex,
    debounce
} from './utils.js';
import {
    drawWheel,
    drawEmptyWheel,
    spinWheel,
    getIsSpinning,
    getIsLastStandingInProgress,
    getWinnerId,
    setWinnerId,
    setWeightMode,
    getSelectionOdds,
    invalidateWheelCache
} from './wheel.js';

// Sub-module Imports
import {
    initKnockoutUI,
    applyKnockoutStatusToElement,
    handleSpinPrep,
    resetKnockoutLaunchEffects,
    knockoutLaunchPrimed,
    knockoutLaunchEngaged
} from './ui/knockout-ui.js';
import {
    initWinnerModal,
    showWinnerPopup,
    closeWinnerPopup,
    updateReshowWinnerButton,
    handleReshowWinner
} from './ui/winner-modal.js';
import {
    initBoostStation,
    renderBoosterTags
} from './ui/boost-station.js';
import {
    initHistoryModal,
    renderHistory
} from './ui/history-modal.js';
import {
    initSliceEditor,
    resetSliceEditor,
    syncSliceEditorWithSelection,
    getActiveSliceMovie,
    updateDisplayedOdds
} from './ui/slice-editor.js';
import { initBoardsUI } from './ui/boards-ui.js';
import { promptForInput } from './ui/modals.js';

// Re-export public API from submodules
export { triggerConfetti, getConfettiPalette } from './ui/confetti.js';
export { showConfirmModal, promptForInput, showVerificationResults } from './ui/modals.js';
export { renderWorkspaceSwitcher, renderBoardsList, initBoardsUI } from './ui/boards-ui.js';
export {
    showWinnerPopup,
    closeWinnerPopup,
    updateReshowWinnerButton,
    handleReshowWinner,
    setupRadarrButton,
    resetRadarrButton
} from './ui/winner-modal.js';
export {
    markMovieKnockedOut,
    markMovieChampion,
    updateKnockoutRemainingBox,
    refreshKnockoutBoxVisibility,
    highlightKnockoutCandidate,
    updateKnockoutResultText,
    triggerKnockoutLaunchEffects,
    resetKnockoutLaunchEffects,
    handleSpinPrep,
    applyKnockoutStatusToElement,
    applyKnockoutStatusToItem,
    reorderMovieListForKnockout
} from './ui/knockout-ui.js';
export {
    initBoostControls,
    openBoostStation,
    closeBoostStation,
    populateBoostSelect,
    filterBoostOptions,
    handleBoostSpecific,
    handleBoostRemove,
    handleBoostRandom,
    getBoosterColor,
    renderBoosterTags,
    handleBoosterTagClick,
    modifyBooster
} from './ui/boost-station.js';
export {
    handleSliceSelection,
    resetSliceEditor,
    updateDisplayedOdds,
    updateSliceOddsDisplay,
    populateSliceEditor,
    getActiveSliceMovie,
    updateSliceWeightDisplay,
    syncSliceEditorWithSelection
} from './ui/slice-editor.js';
export { renderHistory } from './ui/history-modal.js';

// DOM Elements Cache
const elements = {};
let currentWeightCopy = getModeCopy(true);
const VIRTUALIZATION_THRESHOLD = 250;
const VIRTUAL_OVERSCAN = 6;
const VIRTUAL_ROW_ESTIMATE = 128;
const virtualListState = {
    enabled: false,
    rowHeight: 0,
    data: [],
    context: null,
    startIndex: 0,
    endIndex: -1,
    renderScheduled: false,
    forceRender: false
};
let wheelUpdateFrame = null;
let pendingWheelSelection = null;
let pendingOddsMaps = null;

function isThemePaletteLocked() {
    return Boolean(appState.preferences?.theme && appState.preferences.theme !== 'default');
}

function escapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function getSafeHttpUrl(value) {
    if (typeof value !== 'string' || !value.trim()) return '';
    try {
        const url = new URL(value, window.location.href);
        return url.protocol === 'http:' || url.protocol === 'https:' ? url.href : '';
    } catch (error) {
        return '';
    }
}

export function initUI(domElements) {
    Object.assign(elements, domElements);

    // Initialize sub-modules
    initKnockoutUI(domElements);
    initWinnerModal(domElements);
    initBoostStation(domElements, { updateMovieList });
    initHistoryModal(domElements);
    initSliceEditor(domElements);

    // Attach event listeners
    if (elements.selectAllBtn) {
        elements.selectAllBtn.addEventListener('click', () => {
            appState.movies.forEach((movie) => appState.selectedIds.add(movie.id));
            updateMovieList();
        });
    }

    if (elements.clearSelectionBtn) {
        elements.clearSelectionBtn.addEventListener('click', () => {
            appState.selectedIds.clear();
            updateMovieList();
        });
    }

    if (elements.resetWeightsBtn) {
        elements.resetWeightsBtn.addEventListener('click', () => {
            if (confirm('Are you sure you want to reset all weights to 1x?')) {
                appState.movies.forEach((movie) => {
                    movie.weight = 1;
                });
                updateMovieList();
                resetSliceEditor();
            }
        });
    }

    if (elements.spinButton) {
        elements.spinButton.addEventListener('click', () => {
            handleSpinPrep();
            spinWheel(getSpinMode());
        });
    }

    if (elements.winModalCloseBtn) {
        elements.winModalCloseBtn.addEventListener('click', () => closeWinnerPopup());
    }

    if (elements.winModal) {
        elements.winModal.addEventListener('click', (event) => {
            if (event.target === elements.winModal) {
                closeWinnerPopup();
            }
        });
    }

    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') {
            closeWinnerPopup();
        } else if (event.key === 'Tab') {
            const activeModal = document.querySelector('.win-modal:not([hidden])');
            if (!activeModal) return;

            const focusables = Array.from(
                activeModal.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')
            ).filter((el) => !el.disabled && el.offsetParent !== null);

            if (focusables.length === 0) return;
            const first = focusables[0];
            const last = focusables[focusables.length - 1];

            if (event.shiftKey) {
                if (document.activeElement === first || !activeModal.contains(document.activeElement)) {
                    last.focus();
                    event.preventDefault();
                }
            } else {
                if (document.activeElement === last || !activeModal.contains(document.activeElement)) {
                    first.focus();
                    event.preventDefault();
                }
            }
        }
    });

    if (elements.reshowWinnerBtn) {
        elements.reshowWinnerBtn.addEventListener('click', () => {
            handleReshowWinner();
        });
    }

    if (elements.historyBtn) {
        elements.historyBtn.addEventListener('click', () => {
            renderHistory();
            if (elements.historyModal) {
                elements.historyModal.hidden = false;
                requestAnimationFrame(() => elements.historyModal.classList.add('show'));
            }
        });
    }

    if (elements.historyModalCloseBtn) {
        elements.historyModalCloseBtn.addEventListener('click', () => {
            if (elements.historyModal) {
                elements.historyModal.classList.remove('show');
                setTimeout(() => {
                    elements.historyModal.hidden = true;
                }, 250);
            }
        });
    }

    if (elements.searchInput) {
        elements.searchInput.addEventListener(
            'input',
            debounce((event) => {
                const query = event.target.value.trim();
                appState.filter.query = query;
                appState.filter.normalizedQuery = query.toLowerCase();
                updateMovieList();
            }, 300)
        );
    }

    if (elements.sortSelect) {
        elements.sortSelect.addEventListener('change', (event) => {
            appState.filter.sortMode = event.target.value;
            updateMovieList();
        });
    }

    if (elements.showCustomsToggle) {
        elements.showCustomsToggle.addEventListener('change', (event) => {
            appState.filter.showCustoms = event.target.checked;
            updateMovieList();
        });
    }

    if (elements.spinModeRadios) {
        elements.spinModeRadios.forEach((radio) => {
            radio.addEventListener('change', () => {
                updateMovieList();
            });
        });
    }

    if (elements.selectionToggleBtn) {
        elements.selectionToggleBtn.addEventListener('click', () => {
            const isCollapsed = elements.selectionCard.classList.contains('card--collapsed');
            setSelectionCardCollapsed(!isCollapsed);
        });
    }

    if (elements.advancedCardToggleBtn) {
        elements.advancedCardToggleBtn.addEventListener('click', () => {
            const isCollapsed = elements.advancedCard.classList.contains('card--collapsed');
            setAdvancedCardCollapsed(!isCollapsed);
        });
    }

    if (elements.customEntryForm) {
        elements.customEntryForm.addEventListener('submit', (event) => {
            event.preventDefault();
            addCustomEntry();
            if (elements.customEntryModal) {
                elements.customEntryModal.classList.remove('show');
                setTimeout(() => {
                    elements.customEntryModal.hidden = true;
                }, 200);
            }
        });
    }

    if (elements.openCustomModalBtn) {
        elements.openCustomModalBtn.addEventListener('click', () => {
            if (!elements.customEntryModal) return;
            elements.customEntryModal.hidden = false;
            requestAnimationFrame(() => elements.customEntryModal.classList.add('show'));
            if (elements.customEntryInput) {
                elements.customEntryInput.focus();
            }
        });
    }

    if (elements.customModalCloseBtn) {
        elements.customModalCloseBtn.addEventListener('click', () => {
            if (!elements.customEntryModal) return;
            elements.customEntryModal.classList.remove('show');
            setTimeout(() => {
                elements.customEntryModal.hidden = true;
            }, 200);
        });
    }

    if (elements.customEntryModal) {
        elements.customEntryModal.addEventListener('click', (event) => {
            if (event.target === elements.customEntryModal) {
                elements.customEntryModal.classList.remove('show');
                setTimeout(() => {
                    elements.customEntryModal.hidden = true;
                }, 200);
            }
        });
    }

    initBoardsUI(domElements, {
        onBoardSwitch: (val) => {
            updateMovieList();
            resetSliceEditor();
            renderHistory();
        }
    });

    initVirtualList();
}

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

function formatOddsPercent(value = 0) {
    const numeric = Number(value) * 100;
    const safePercent = Number.isFinite(numeric) ? Math.min(100, Math.max(0, numeric)) : 0;
    if (safePercent === 0 || safePercent === 100 || safePercent >= 10) {
        return `${Math.round(safePercent)}%`;
    }
    return `${safePercent.toFixed(1)}%`;
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

function buildMovieOddsLabel(oddsValue = 0, isSelected = false, label = '') {
    if (!isSelected) {
        return `${label}: 0% (not selected)`;
    }
    return `${label}: ${formatOddsPercent(oddsValue)}`;
}

function getModeLabel(mode) {
    if (mode === 'random-boost') return 'Random Boost';
    if (mode === 'one-spin') return 'One Spin';
    if (mode === 'knockout') return 'Knockout';
    return '';
}

function initVirtualList() {
    if (!elements.movieListWrapper || !elements.movieListEl) {
        return;
    }

    elements.movieListWrapper.addEventListener(
        'scroll',
        () => {
            if (!virtualListState.enabled) {
                return;
            }
            requestVirtualRender();
        },
        { passive: true }
    );

    window.addEventListener('resize', () => {
        if (!virtualListState.enabled) {
            return;
        }
        virtualListState.rowHeight = 0;
        requestVirtualRender(true);
    });
}

function shouldVirtualize(total) {
    return total >= VIRTUALIZATION_THRESHOLD && Boolean(elements.movieListWrapper);
}

function resetVirtualList() {
    virtualListState.enabled = false;
    virtualListState.data = [];
    virtualListState.context = null;
    virtualListState.startIndex = 0;
    virtualListState.endIndex = -1;
    virtualListState.rowHeight = 0;
    virtualListState.renderScheduled = false;
    virtualListState.forceRender = false;
    if (elements.movieListEl) {
        elements.movieListEl.style.paddingBottom = '';
        elements.movieListEl.style.paddingTop = '';
    }
}

function getListGap() {
    if (!elements.movieListEl) {
        return 0;
    }
    const styles = window.getComputedStyle(elements.movieListEl);
    const gapValue = styles.rowGap || styles.gap || '0';
    const gap = Number.parseFloat(gapValue);
    return Number.isFinite(gap) ? gap : 0;
}

function measureVirtualRowHeight() {
    if (!elements.movieListEl) {
        return;
    }
    const firstItem = elements.movieListEl.querySelector('li[data-id]');
    if (!firstItem) {
        return;
    }
    const rect = firstItem.getBoundingClientRect();
    const gap = getListGap();
    const height = rect.height + gap;
    if (Number.isFinite(height) && height > 0) {
        virtualListState.rowHeight = height;
    }
}

function requestVirtualRender(force = false) {
    if (!virtualListState.enabled) {
        return;
    }
    if (force) {
        virtualListState.forceRender = true;
    }
    if (virtualListState.renderScheduled) {
        return;
    }
    virtualListState.renderScheduled = true;
    requestAnimationFrame(() => {
        virtualListState.renderScheduled = false;
        const shouldForce = virtualListState.forceRender;
        virtualListState.forceRender = false;
        renderVirtualWindow(shouldForce);
    });
}

function renderVirtualWindow(force = false) {
    if (!virtualListState.enabled || !elements.movieListEl || !elements.movieListWrapper) {
        return;
    }
    const { data, context } = virtualListState;
    const total = data.length;
    if (!total) {
        elements.movieListEl.innerHTML = '';
        elements.movieListEl.style.paddingBottom = '';
        elements.movieListEl.style.paddingTop = '';
        return;
    }

    const rowHeight = virtualListState.rowHeight || VIRTUAL_ROW_ESTIMATE;
    const gap = getListGap();
    const scrollTop = elements.movieListWrapper.scrollTop || 0;
    const viewportHeight = elements.movieListWrapper.clientHeight || 0;
    const startIndex = Math.max(0, Math.floor(scrollTop / rowHeight) - VIRTUAL_OVERSCAN);
    const endIndex = Math.min(
        total - 1,
        Math.ceil((scrollTop + viewportHeight) / rowHeight) + VIRTUAL_OVERSCAN
    );

    if (!force && startIndex === virtualListState.startIndex && endIndex === virtualListState.endIndex) {
        return;
    }

    virtualListState.startIndex = startIndex;
    virtualListState.endIndex = endIndex;

    elements.movieListEl.innerHTML = '';
    const beforeCount = startIndex;
    const afterCount = Math.max(0, total - endIndex - 1);
    const topPadding = beforeCount ? Math.max(0, (beforeCount * rowHeight) - gap) : 0;
    const bottomPadding = afterCount ? Math.max(0, (afterCount * rowHeight) - gap) : 0;
    elements.movieListEl.style.paddingTop = `${topPadding}px`;
    elements.movieListEl.style.paddingBottom = `${bottomPadding}px`;

    for (let i = startIndex; i <= endIndex; i += 1) {
        const movie = data[i];
        if (!movie) {
            continue;
        }
        elements.movieListEl.appendChild(buildMovieListItem(movie, i, context));
    }

    measureVirtualRowHeight();
}

function renderMovieList(displayMovies, context) {
    if (!elements.movieListEl) {
        return;
    }

    if (!shouldVirtualize(displayMovies.length)) {
        resetVirtualList();
        elements.movieListEl.innerHTML = '';
        displayMovies.forEach((movie, index) => {
            elements.movieListEl.appendChild(buildMovieListItem(movie, index, context));
        });
        measureVirtualRowHeight();
        return;
    }

    const wasEnabled = virtualListState.enabled;
    virtualListState.enabled = true;
    virtualListState.data = displayMovies;
    virtualListState.context = context;

    if (!wasEnabled && elements.movieListWrapper) {
        elements.movieListWrapper.scrollTop = 0;
    }

    requestVirtualRender(true);
}

function buildMovieListItem(movie, index, context) {
    const { oddsMap, winOddsMap, weightsEnabled, randomBoostActive, themeLocked, winnerId } = context;
    const li = document.createElement('li');
    li.dataset.id = movie.id;
    if (winnerId === movie.id) {
        li.classList.add('highlight');
    }
    if (weightsEnabled) {
        li.classList.add('show-weights');
    }

    const originalIndex = getMovieOriginalIndex(movie, appState.movies);
    if (Number.isFinite(originalIndex) && originalIndex >= 0) {
        li.dataset.originalIndex = String(originalIndex);
    } else {
        li.removeAttribute('data-original-index');
    }

    const sanitizedWeight = getStoredWeight(movie);
    if (movie.weight !== sanitizedWeight) {
        movie.weight = sanitizedWeight;
    }

    let colorIndex = originalIndex;
    if (!Number.isFinite(colorIndex) || colorIndex < 0) {
        colorIndex = appState.movies.indexOf(movie);
    }
    const defaultColor = getDefaultColorForIndex(colorIndex);
    const resolvedColor = themeLocked ? defaultColor : getStoredColor(movie, defaultColor);
    if (movie.color !== resolvedColor) {
        movie.color = resolvedColor;
    }

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    const isSelected = appState.selectedIds.has(movie.id);
    checkbox.checked = isSelected;
    checkbox.id = `movie-${movie.id}`;
    checkbox.addEventListener('change', (event) => {
        if (event.target.checked) {
            appState.selectedIds.add(movie.id);
        } else {
            appState.selectedIds.delete(movie.id);
        }
        updateMovieList();
    });

    const label = document.createElement('label');
    label.setAttribute('for', checkbox.id);

    const nameEl = document.createElement('span');
    nameEl.className = 'movie-name';
    nameEl.textContent = movie.name;

    const metaEl = document.createElement('span');
    metaEl.className = 'movie-meta';
    const parts = [];
    if (movie.year) parts.push(movie.year);
    if (movie.date) parts.push(`Added ${movie.date}`);
    if (movie.isCustom) parts.push('Custom entry');
    metaEl.textContent = parts.join(' • ');

    label.appendChild(nameEl);
    if (parts.length) {
        label.appendChild(metaEl);
    }

    const hasRiskOdds = oddsMap.has(movie.id);
    const hasWinOdds = winOddsMap.has(movie.id);
    const oddsValue = hasRiskOdds ? oddsMap.get(movie.id) || 0 : 0;
    const winOddsValue = hasWinOdds ? winOddsMap.get(movie.id) || 0 : 0;
    const isActive = isSelected && hasRiskOdds;
    const isWinActive = isSelected && hasWinOdds;
    const oddsGroup = document.createElement('div');
    oddsGroup.className = 'movie-odds-group';

    const oddsEl = document.createElement('span');
    oddsEl.className = 'movie-odds movie-odds--risk';
    oddsEl.classList.toggle('movie-odds--inactive', !isActive);
    oddsEl.textContent = buildMovieOddsLabel(oddsValue, isActive, currentWeightCopy.riskLabel);

    const winOddsEl = document.createElement('span');
    winOddsEl.className = 'movie-odds movie-odds--win';
    winOddsEl.classList.toggle('movie-odds--inactive', !isWinActive);
    winOddsEl.textContent = buildMovieOddsLabel(winOddsValue, isWinActive, currentWeightCopy.winLabel);

    oddsGroup.appendChild(oddsEl);
    oddsGroup.appendChild(winOddsEl);
    label.appendChild(oddsGroup);

    const safeMovieUrl = getSafeHttpUrl(movie.uri);
    if (safeMovieUrl) {
        const link = document.createElement('a');
        link.href = safeMovieUrl;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        link.className = 'movie-link';
        link.textContent = 'Open on Letterboxd';
        label.appendChild(link);
    }

    li.appendChild(checkbox);
    li.appendChild(label);

    if (weightsEnabled) {
        const weightWrapper = document.createElement('div');
        weightWrapper.className = 'movie-weight';

        const weightSelectId = `weight-${index}`;
        const weightLabel = document.createElement('label');
        weightLabel.setAttribute('for', weightSelectId);
        weightLabel.textContent = currentWeightCopy.weightLabel;

        const weightHelp = document.createElement('span');
        weightHelp.className = 'weight-help';
        weightHelp.setAttribute('role', 'img');
        weightHelp.setAttribute('aria-label', currentWeightCopy.weightHelp);
        weightHelp.title = currentWeightCopy.weightHelp;
        weightHelp.textContent = '?';
        weightLabel.appendChild(weightHelp);

        // Boosters Tags
        if (movie.boosters && movie.boosters.length > 0) {
            const boostersList = document.createElement('div');
            boostersList.className = 'movie-boosters-list';
            renderBoosterTags(boostersList, movie);
            label.appendChild(boostersList);
        }

        const controlsDiv = document.createElement('div');
        controlsDiv.className = 'weight-controls';

        const weightSelect = document.createElement('select');
        weightSelect.id = weightSelectId;
        weightSelect.className = 'movie-weight__select';
        for (let value = 1; value <= 5; value += 1) {
            const option = document.createElement('option');
            option.value = String(value);
            option.textContent = `${value}x`;
            weightSelect.appendChild(option);
        }
        weightSelect.value = String(sanitizedWeight);
        weightSelect.disabled = randomBoostActive;
        weightSelect.addEventListener('change', (event) => {
            if (randomBoostActive) {
                event.target.value = '1';
                return;
            }
            const selectedValue = Number(event.target.value);
            movie.weight = clampWeight(selectedValue);
            event.target.value = String(movie.weight);
            redrawWheelAndPersist();
            syncSliceEditorWithSelection(getFilteredSelectedMovies());
        });

        // Boost Button
        const boostBtn = document.createElement('button');
        boostBtn.type = 'button';
        boostBtn.className = 'btn-boost';
        boostBtn.textContent = '+';
        boostBtn.title = 'Add a booster';
        boostBtn.disabled = randomBoostActive;
        boostBtn.addEventListener('click', () => {
            if (randomBoostActive) return;
            promptForInput('Who is boosting this movie?', 'Booster Name', (name) => {
                const currentW = getStoredWeight(movie);
                const newW = clampWeight(currentW + 1);
                movie.weight = newW;
                if (!movie.boosters) movie.boosters = [];
                movie.boosters.push({
                    name: name,
                    timestamp: Date.now(),
                    source: 'manual'
                });
                debouncedSaveState();
                updateMovieList();
            });
        });

        controlsDiv.appendChild(weightSelect);
        controlsDiv.appendChild(boostBtn);

        weightWrapper.appendChild(weightLabel);
        weightWrapper.appendChild(controlsDiv);
        li.appendChild(weightWrapper);

        const colorWrapper = document.createElement('div');
        colorWrapper.className = 'movie-color';

        const colorInputId = `color-${index}`;
        const colorLabel = document.createElement('label');
        colorLabel.setAttribute('for', colorInputId);
        colorLabel.textContent = 'Slice color';

        const colorInput = document.createElement('input');
        colorInput.type = 'color';
        colorInput.id = colorInputId;
        colorInput.className = 'movie-color__input';
        colorInput.disabled = themeLocked;
        colorInput.value = resolvedColor;
        colorInput.addEventListener('input', (event) => {
            const selectedColor = sanitizeColor(event.target.value, defaultColor);
            movie.color = selectedColor;
            event.target.value = selectedColor;
            redrawWheelAndPersist();
            syncSliceEditorWithSelection(getFilteredSelectedMovies());
        });

        colorWrapper.appendChild(colorLabel);
        colorWrapper.appendChild(colorInput);
        li.appendChild(colorWrapper);
    }

    if (movie.isCustom) {
        const removeButton = document.createElement('button');
        removeButton.type = 'button';
        removeButton.className = 'btn remove-custom';
        removeButton.textContent = 'Remove';
        removeButton.addEventListener('click', () => removeCustomEntry(movie.id));
        li.appendChild(removeButton);
    }

    const knockoutStatus = appState.knockoutResults.get(movie.id);
    applyKnockoutStatusToElement(li, knockoutStatus);

    return li;
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
    currentWeightCopy = getModeCopy(inverseMode);
    applyWeightCopy(currentWeightCopy);
    const weightsEnabled = true;
    const randomBoostActive = spinMode === 'random-boost';
    const themeLocked = isThemePaletteLocked();

    if (!appState.movies.length) {
        resetVirtualList();
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
        resetVirtualList();
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
        winnerId
    };
    renderMovieList(displayMovies, renderContext);

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

function redrawWheelAndPersist() {
    scheduleWheelUpdate();
}

export function updateSpinButtonLabel() {
    if (!elements.spinButton) return;
    const spinMode = getSpinMode();
    const inverseMode = spinMode === 'knockout';
    const lastStandingActive = getIsLastStandingInProgress();
    const spinning = getIsSpinning();
    elements.spinButton.disabled = spinning || lastStandingActive || getFilteredSelectedMovies().length === 0;

    if (knockoutLaunchPrimed && lastStandingActive) {
        // Handled in knockout-ui
    }

    if (knockoutLaunchPrimed && knockoutLaunchEngaged && !lastStandingActive && !spinning) {
        resetKnockoutLaunchEffects();
    }

    setWeightMode(inverseMode ? 'inverse' : 'normal');
    const selector = document.querySelector('.spin-mode-selector');
    if (selector) {
        selector.hidden = spinning || lastStandingActive;
    }

    if (lastStandingActive) {
        elements.spinButton.textContent = 'Eliminating.';
        return;
    }

    if (spinMode === 'one-spin') {
        elements.spinButton.textContent = 'Spin One Spin Mode';
        return;
    }

    const remaining = getFilteredSelectedMovies();
    if (remaining.length > 1) {
        elements.spinButton.textContent = 'Start Movie Knockout mode';
        return;
    }

    elements.spinButton.textContent = 'Spin the wheel';
}

export function isAdvancedOptionsEnabled() {
    return true;
}

export function getSpinMode() {
    const radios = document.querySelectorAll('input[name="spin-mode"]');
    for (const radio of radios) {
        if (radio.checked) {
            return radio.value;
        }
    }
    return 'knockout';
}

export function isRandomBoostEnabled() {
    return false;
}

export function isOneSpinModeEnabled() {
    return getSpinMode() !== 'knockout';
}

function getStepToggleLabel(collapsed) {
    return collapsed ? 'Expand Step' : 'Collapse Step';
}

export function setSelectionCardCollapsed(collapsed) {
    if (!elements.selectionToggleBtn || !elements.selectionCard || !elements.selectionBody) return;

    elements.selectionCard.classList.toggle('card--collapsed', collapsed);
    elements.selectionBody.hidden = collapsed;
    elements.selectionToggleBtn.setAttribute('aria-expanded', String(!collapsed));
    elements.selectionToggleBtn.textContent = getStepToggleLabel(collapsed);
}

export function setAdvancedCardCollapsed(collapsed) {
    if (!elements.advancedCardToggleBtn || !elements.advancedCard || !elements.advancedBody) return;

    elements.advancedCard.classList.toggle('card--collapsed', collapsed);
    elements.advancedBody.hidden = collapsed;
    elements.advancedCardToggleBtn.setAttribute('aria-expanded', String(!collapsed));
    elements.advancedCardToggleBtn.textContent = getStepToggleLabel(collapsed);
}

function addCustomEntry() {
    if (!elements.customEntryInput) return;
    const name = elements.customEntryInput.value.trim();
    if (!name) {
        elements.customEntryInput.focus();
        return;
    }

    const id = `custom-${Date.now()}`;
    const customMovie = {
        id,
        initialIndex: appState.movies.length,
        name,
        year: '',
        date: '',
        uri: '',
        isCustom: true,
        weight: 1,
        color: getDefaultColorForIndex(appState.movies.length)
    };

    appState.movies = [...appState.movies, customMovie];
    appState.selectedIds.add(id);
    if (elements.customEntryForm) {
        elements.customEntryForm.reset();
    }
    elements.customEntryInput.focus();
    if (elements.statusMessage) elements.statusMessage.textContent = `Added “${name}” to the wheel.`;
    updateMovieList();
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

export function addBulkEntries(rawText) {
    if (!rawText || !rawText.trim()) return 0;
    const lines = rawText
        .split(/\r?\n/)
        .map((line) => decodeHtmlEntities(line.trim()))
        .filter(Boolean);

    if (lines.length === 0) return 0;

    appState.filter.showCustoms = true;
    if (elements.showCustomsToggle) {
        elements.showCustomsToggle.checked = true;
    }

    const startIndex = appState.movies.length;
    const newEntries = lines.map((name, i) => {
        const index = startIndex + i;
        const id = `custom-${Date.now()}-${index}-${Math.random().toString(36).substr(2, 6)}`;
        return {
            id,
            initialIndex: index,
            name,
            year: '',
            date: '',
            uri: '',
            isCustom: true,
            weight: 1,
            color: getDefaultColorForIndex(index)
        };
    });

    appState.movies = [...appState.movies, ...newEntries];
    newEntries.forEach((item) => appState.selectedIds.add(item.id));

    if (elements.resultEl) {
        elements.resultEl.textContent = '';
    }

    if (elements.statusMessage) {
        elements.statusMessage.textContent = `Added ${newEntries.length} ${newEntries.length === 1 ? 'entry' : 'entries'} to the wheel.`;
    }

    updateMovieList();
    invalidateWheelCache();
    saveState();

    return newEntries.length;
}

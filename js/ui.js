/**
 * UI management for the Letterboxd Watchlist Wheel
 */

import { appState, debouncedSaveState, clearHistory, removeHistoryEntry } from './state.js';
import {
    getDefaultColorForIndex,
    getStoredColor,
    getStoredWeight,
    clampWeight,
    sanitizeColor,
    escapeSelector,
    getMovieOriginalIndex
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
    getSelectionOdds
} from './wheel.js';
import { sendDiscordNotification } from './discord.js';



// DOM Elements
const elements = {};
let activeSliceId = null;
let updateWheelAsideLayout = () => { };
let currentWeightCopy = getModeCopy(true);
let knockoutLaunchPrimed = false;
let knockoutLaunchEngaged = false;
let lastKnockoutRemaining = [];
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

export function initUI(domElements) {
    Object.assign(elements, domElements);

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
        }
    });

    if (elements.historyBtn) {
        elements.historyBtn.addEventListener('click', () => {
            renderHistory();
            elements.historyModal.hidden = false;
            requestAnimationFrame(() => elements.historyModal.classList.add('show'));
        });
    }

    if (elements.historyModalCloseBtn) {
        elements.historyModalCloseBtn.addEventListener('click', () => {
            elements.historyModal.classList.remove('show');
            setTimeout(() => {
                elements.historyModal.hidden = true;
            }, 250);
        });
    }

    if (elements.clearHistoryBtn) {
        elements.clearHistoryBtn.addEventListener('click', () => {
            if (confirm('Are you sure you want to clear the history?')) {
                clearHistory();
                renderHistory();
            }
        });
    }

    if (elements.historyModal) {
        elements.historyModal.addEventListener('click', (event) => {
            if (event.target === elements.historyModal) {
                elements.historyModal.classList.remove('show');
                setTimeout(() => {
                    elements.historyModal.hidden = true;
                }, 250);
            }
        });
    }

    if (elements.customEntryForm) {
        elements.customEntryForm.addEventListener('submit', (event) => {
            event.preventDefault();
            addCustomEntry();
        });
    }

    if (elements.selectionToggleBtn) {
        elements.selectionToggleBtn.addEventListener('click', () => {
            const willCollapse = !elements.selectionCard.classList.contains('card--collapsed');
            setSelectionCardCollapsed(willCollapse);
        });
    }

    if (elements.advancedCardToggleBtn) {
        elements.advancedCardToggleBtn.addEventListener('click', () => {
            const willCollapse = !elements.advancedCard.classList.contains('card--collapsed');
            setAdvancedCardCollapsed(willCollapse);
            updateMovieList();
            updateSpinButtonLabel();
        });
    }

    if (elements.sliceColorInput) {
        elements.sliceColorInput.addEventListener('input', handleSliceColorInput);
    }

    if (elements.sliceWeightInput) {
        elements.sliceWeightInput.addEventListener('input', handleSliceWeightInput);
    }

    if (elements.sliceEditorClearBtn) {
        elements.sliceEditorClearBtn.addEventListener('click', () => resetSliceEditor());
    }

    updateWheelAsideLayout = createWheelAsideUpdater(elements);
    initVirtualList();
    resetSliceEditor();
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

    if (movie.uri) {
        const link = document.createElement('a');
        link.href = movie.uri;
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

        // Boosters Text
        if (movie.boosters && movie.boosters.length > 0) {
            const boostersText = document.createElement('span');
            boostersText.className = 'movie-boosters';
            boostersText.textContent = formatBoostersText(sanitizedWeight, movie.boosters);
            label.appendChild(boostersText);
        }

        const controlsDiv = document.createElement('div');
        controlsDiv.className = 'weight-controls';

        const weightSelect = document.createElement('select');
        weightSelect.id = weightSelectId;
        weightSelect.className = 'movie-weight__select';
        for (let value = 1; value <= 10; value += 1) {
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
                movie.boosters.push(name);
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

function formatBoostersText(weight, boosters = []) {
    if (!boosters || !boosters.length) return '';
    const counts = {};
    boosters.forEach(name => {
        counts[name] = (counts[name] || 0) + 1;
    });

    // Sort by count desc
    const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
    const parts = sorted.map(([name, count]) => `${count}x ${name}`);

    // Check if there is base weight not attributed to anyone
    const attributedWeight = boosters.length;
    // The visual weight might be clamped, but boosters could exceed it theoretically if logic drifts, 
    // but typically weight >= attributed. 
    // If weight > attributed, the difference is "Base" or anonymous. 
    // User asked for: "3x (1x Spencer, 2x Riley)"
    // If weight is 4x and we have 3 boosters, it implies 1x is base. We usually don't list base unless asked.
    // Let's just list the boosters in parens.

    return `(${parts.join(', ')})`;
}

export function promptForInput(title, label, callback) {
    const modal = document.getElementById('input-modal');
    const form = document.getElementById('input-modal-form');
    const input = document.getElementById('input-modal-field');
    const titleEl = document.getElementById('input-modal-title');
    const labelEl = document.getElementById('input-modal-label');
    const closeBtn = document.getElementById('input-modal-close');

    if (!modal || !form || !input) return;

    titleEl.textContent = title;
    labelEl.textContent = label;
    input.value = '';

    const close = () => {
        modal.classList.remove('show');
        setTimeout(() => { modal.hidden = true; }, 200);
        input.value = ''; // Clear for security/cleanliness
    };

    const submitHandler = (e) => {
        e.preventDefault();
        const value = input.value.trim();
        if (value) {
            callback(value);
            close();
        }
        form.removeEventListener('submit', submitHandler);
        closeBtn.removeEventListener('click', closeHandler);
    };

    const closeHandler = () => {
        close();
        form.removeEventListener('submit', submitHandler);
        closeBtn.removeEventListener('click', closeHandler);
    };

    form.addEventListener('submit', submitHandler);
    closeBtn.addEventListener('click', closeHandler);

    modal.hidden = false;
    requestAnimationFrame(() => modal.classList.add('show'));
    input.focus();
}

export function updateMovieList() {
    if (!elements.movieListEl) return;

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
}

export function updateDisplayedOdds(selectionOverride = null, oddsOverride = null) {
    const selectedMovies = Array.isArray(selectionOverride) ? selectionOverride : getFilteredSelectedMovies();
    const oddsMap = oddsOverride?.oddsMap || getSelectionOdds(selectedMovies, { inverseModeOverride: getSpinMode() === 'knockout' });
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

function updateSliceOddsDisplay(oddsMap = null, selectionOverride = null) {
    if (!elements.sliceOddsValueRisk || !elements.sliceOddsValueWin) {
        return;
    }
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

export function updateSpinButtonLabel() {
    if (!elements.spinButton) return;
    const spinMode = getSpinMode();
    const inverseMode = spinMode === 'knockout';
    const lastStandingActive = getIsLastStandingInProgress();
    const spinning = getIsSpinning();

    if (knockoutLaunchPrimed && lastStandingActive) {
        knockoutLaunchEngaged = true;
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
        elements.spinButton.textContent = 'Spin the One Spin to Rule them all';
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
    return false; // Random boost is now a transient single-shot action, not a persistent mode
}

export function isOneSpinModeEnabled() {
    return getSpinMode() !== 'knockout';
}

function getStepToggleLabel(collapsed) {
    return collapsed ? 'Expand Step' : 'Collapse Step';
}

function setImportCardCollapsedUI(collapsed) {
    if (!elements.importCard || !elements.importCardBody || !elements.importToggleBtn) {
        return;
    }
    elements.importCard.classList.toggle('card--collapsed', collapsed);
    elements.importCardBody.hidden = collapsed;
    elements.importToggleBtn.setAttribute('aria-expanded', String(!collapsed));
    elements.importToggleBtn.textContent = getStepToggleLabel(collapsed);
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

function collapseAllSteps() {
    setImportCardCollapsedUI(true);
    setSelectionCardCollapsed(true);
    setAdvancedCardCollapsed(true);
}

export function handleSliceSelection(movie) {
    if (!movie || getIsSpinning() || getIsLastStandingInProgress()) {
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

function resetSliceEditor() {
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

function getActiveSliceMovie() {
    if (!activeSliceId) {
        return null;
    }
    return appState.movies.find((movie) => movie.id === activeSliceId) || null;
}

function updateSliceWeightDisplay(weight) {
    if (elements.sliceWeightInput) {
        elements.sliceWeightInput.value = String(weight);
        elements.sliceWeightInput.setAttribute('aria-valuenow', String(weight));
    }
    if (elements.sliceWeightValue) {
        elements.sliceWeightValue.textContent = `${weight}x`;
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

function syncSliceEditorWithSelection(currentSelection = []) {
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

function shouldLaunchKnockoutEffects() {
    const selection = getFilteredSelectedMovies();
    return getSpinMode() === 'knockout' && selection.length > 1 && !getIsSpinning() && !getIsLastStandingInProgress();
}

function clearSpinButtonShards() {
    if (!elements.spinButton) {
        return;
    }
    const shards = elements.spinButton.querySelector('.spin-button__shards');
    if (shards) {
        shards.remove();
    }
}

function createSpinButtonShards() {
    if (!elements.spinButton) {
        return null;
    }
    const shardCount = 16;
    const burst = document.createElement('span');
    burst.className = 'spin-button__shards';
    burst.setAttribute('aria-hidden', 'true');

    for (let index = 0; index < shardCount; index += 1) {
        const shard = document.createElement('span');
        shard.className = 'spin-button__shard';
        const offsetX = (Math.random() - 0.5) * 220;
        const offsetY = (Math.random() - 0.2) * 160;
        const spin = (Math.random() - 0.5) * 180;
        const delay = Math.random() * 0.12;
        const scale = 0.7 + Math.random() * 0.6;
        shard.style.setProperty('--shard-x', `${offsetX}px`);
        shard.style.setProperty('--shard-y', `${offsetY}px`);
        shard.style.setProperty('--shard-rotate', `${spin}deg`);
        shard.style.setProperty('--shard-delay', `${delay}s`);
        shard.style.setProperty('--shard-scale', scale.toFixed(2));
        burst.appendChild(shard);
    }

    return burst;
}

function boostWheelStage() {
    if (elements.wheelStage) {
        elements.wheelStage.classList.add('wheel-stage--amped');
    }
}

function resetWheelStageBoost() {
    if (elements.wheelStage) {
        elements.wheelStage.classList.remove('wheel-stage--amped');
    }
}

function triggerKnockoutLaunchEffects() {
    if (!shouldLaunchKnockoutEffects() || knockoutLaunchPrimed) {
        return;
    }
    knockoutLaunchPrimed = true;
    knockoutLaunchEngaged = false;

    if (elements.spinButton) {
        elements.spinButton.classList.add('spin-button--obliterated');
        elements.spinButton.disabled = true;
        clearSpinButtonShards();
        const burst = createSpinButtonShards();
        if (burst) {
            elements.spinButton.appendChild(burst);
            requestAnimationFrame(() => burst.classList.add('is-active'));
        }
    }
    boostWheelStage();
}

function resetKnockoutLaunchEffects() {
    knockoutLaunchPrimed = false;
    knockoutLaunchEngaged = false;
    if (elements.spinButton) {
        elements.spinButton.classList.remove('spin-button--obliterated');
        clearSpinButtonShards();
        elements.spinButton.disabled = getFilteredSelectedMovies().length === 0
            || getIsSpinning()
            || getIsLastStandingInProgress();
    }
    resetWheelStageBoost();
}

function handleSpinPrep() {
    collapseAllSteps();
    resetSliceEditor();
    triggerKnockoutLaunchEffects();
}

function addCustomEntry() {
    if (!elements.customEntryInput) return;
    const name = elements.customEntryInput.value.trim();
    if (!name) {
        elements.customEntryInput.focus();
        return;
    }

    // We need a counter. Let's store it in state or just use timestamp/random.
    // Original code used a counter.
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

// Modal Logic
let modalHideTimeoutId = null;
let lastFocusedBeforeModal = null;
let currentModalMetadataKey = null;
const metadataCache = new Map();
const METADATA_API_URL = 'https://www.omdbapi.com/';
const METADATA_API_KEY = 'trilogy';

export function showWinnerPopup(movie, context = {}) {
    const { spinMode } = context;
    if (!elements.winModal) return;

    if (modalHideTimeoutId) {
        clearTimeout(modalHideTimeoutId);
        modalHideTimeoutId = null;
    }

    const details = [];
    if (movie.year) {
        details.push(`Released ${movie.year}`);
    }
    if (movie.date) {
        details.push(`Added to your watchlist ${movie.date}`);
    }
    if (spinMode === 'random-boost' && Number.isFinite(Number(movie.weight))) {
        details.push(`Random Boost winner · boosted to ${movie.weight}x`);
    } else if (spinMode === 'one-spin') {
        details.push('One Spin to Rule them all winner');
    } else if (spinMode === 'knockout') {
        details.push('Movie Knockout champion');
    }

    if (elements.winModalTitle) {
        elements.winModalTitle.textContent = `The movie selected was ${movie.name}!`;
    }
    if (elements.winModalDetails) {
        elements.winModalDetails.textContent = details.length
            ? details.join(' • ')
            : 'Get comfy, cue it up, and enjoy the show!';
    }

    if (elements.winModalLink) {
        if (movie.uri) {
            elements.winModalLink.href = movie.uri;
            elements.winModalLink.classList.remove('hidden');
            elements.winModalLink.textContent = 'View on Letterboxd';
        } else {
            elements.winModalLink.classList.add('hidden');
            elements.winModalLink.removeAttribute('href');
        }
    }

    const metadataKey = buildMetadataKey(movie);
    currentModalMetadataKey = metadataKey;
    setWinnerModalLoadingState(movie);
    populateWinnerModalMetadata(movie, metadataKey).then((metadata) => {
        if (!metadata) return;
        const posterUrl = metadata.poster && metadata.poster !== 'N/A' ? metadata.poster : '';

        // Calculate Odds
        const totalWeight = appState.movies.reduce((sum, m) => {
            return appState.selectedIds.has(m.id) ? sum + getStoredWeight(m) : sum;
        }, 0);
        const movieWeight = getStoredWeight(movie);
        const odds = totalWeight > 0 ? ((movieWeight / totalWeight) * 100).toFixed(1) + '%' : 'N/A';

        sendDiscordNotification(movie.name, posterUrl, {
            odds: odds,
            weight: movieWeight,
            link: movie.uri || null,
            spinMode: spinMode
        });
    });

    elements.winModal.setAttribute('aria-hidden', 'false');
    elements.winModal.removeAttribute('hidden');
    requestAnimationFrame(() => {
        elements.winModal.classList.add('show');
    });

    lastFocusedBeforeModal = document.activeElement;
    if (elements.winModalCloseBtn) {
        elements.winModalCloseBtn.focus();
    }
}

export function closeWinnerPopup({ restoreFocus = true } = {}) {
    if (!elements.winModal || elements.winModal.hasAttribute('hidden')) {
        return;
    }

    if (modalHideTimeoutId) {
        clearTimeout(modalHideTimeoutId);
        modalHideTimeoutId = null;
    }

    elements.winModal.classList.remove('show');
    elements.winModal.setAttribute('aria-hidden', 'true');

    modalHideTimeoutId = window.setTimeout(() => {
        elements.winModal.setAttribute('hidden', '');
        if (restoreFocus && lastFocusedBeforeModal && typeof lastFocusedBeforeModal.focus === 'function') {
            lastFocusedBeforeModal.focus();
        }
        lastFocusedBeforeModal = null;
        modalHideTimeoutId = null;
    }, 220);
}

function buildMetadataKey(movie) {
    if (!movie) {
        return 'unknown';
    }
    const name = (movie.name || '').toLowerCase();
    const year = movie.year || '';
    return `${name}__${year}`;
}

function setWinnerModalLoadingState(movie) {
    if (elements.winModalPosterWrapper) {
        elements.winModalPosterWrapper.hidden = true;
    }
    if (elements.winModalPoster) {
        elements.winModalPoster.removeAttribute('src');
        elements.winModalPoster.alt = '';
    }
    if (elements.winModalRuntime) {
        elements.winModalRuntime.textContent = 'Looking up runtime…';
        elements.winModalRuntime.classList.add('is-loading');
    }
    if (elements.winModalSynopsis) {
        elements.winModalSynopsis.textContent = 'Fetching synopsis…';
        elements.winModalSynopsis.classList.add('is-loading');
    }
    if (elements.winModalTrailer) {
        const trailerUrl = buildTrailerSearchUrl(movie?.name, movie?.year);
        elements.winModalTrailer.href = trailerUrl;
        elements.winModalTrailer.textContent = 'Find a trailer';
        elements.winModalTrailer.classList.remove('hidden');
        if (movie?.name) {
            elements.winModalTrailer.setAttribute('aria-label', `Find a trailer for ${movie.name}`);
        } else {
            elements.winModalTrailer.removeAttribute('aria-label');
        }
    }
}

async function populateWinnerModalMetadata(movie, metadataKey) {
    if (!movie || !movie.name) {
        return applyWinnerModalFallback(movie);
    }

    const result = await fetchMovieMetadata(movie);
    if (metadataKey !== currentModalMetadataKey) {
        return;
    }

    if (!result || result.status !== 'success' || !result.data) {
        return applyWinnerModalFallback(movie);
    }

    const { title, runtime, plot, poster, year } = result.data;

    if (elements.winModalRuntime) {
        elements.winModalRuntime.textContent = runtime || 'Runtime unavailable.';
        elements.winModalRuntime.classList.toggle('is-loading', false);
    }

    if (elements.winModalSynopsis) {
        elements.winModalSynopsis.textContent = plot || 'Synopsis unavailable. Check the movie page for more.';
        elements.winModalSynopsis.classList.toggle('is-loading', false);
    }

    if (elements.winModalPosterWrapper && elements.winModalPoster) {
        if (poster) {
            elements.winModalPoster.src = poster;
            elements.winModalPoster.alt = title ? `Poster for ${title}` : 'Movie poster';
            elements.winModalPosterWrapper.hidden = false;
        } else {
            elements.winModalPosterWrapper.hidden = true;
            elements.winModalPoster.removeAttribute('src');
            elements.winModalPoster.alt = '';
        }
    }

    if (elements.winModalTrailer) {
        const trailerUrl = buildTrailerSearchUrl(title || movie.name, year || movie.year);
        elements.winModalTrailer.href = trailerUrl;
        elements.winModalTrailer.textContent = 'Watch trailer';
        if (title || movie.name) {
            elements.winModalTrailer.setAttribute('aria-label', `Watch trailer for ${title || movie.name}`);
        } else {
            elements.winModalTrailer.removeAttribute('aria-label');
        }
        elements.winModalTrailer.classList.remove('hidden');
    }
    return result.data;
}

function applyWinnerModalFallback(movie) {
    if (elements.winModalRuntime) {
        elements.winModalRuntime.textContent = 'Runtime unavailable.';
        elements.winModalRuntime.classList.toggle('is-loading', false);
    }

    if (elements.winModalSynopsis) {
        elements.winModalSynopsis.textContent = 'Synopsis unavailable. Check the movie page for more.';
        elements.winModalSynopsis.classList.toggle('is-loading', false);
    }

    if (elements.winModalPosterWrapper) {
        elements.winModalPosterWrapper.hidden = true;
    }
    if (elements.winModalPoster) {
        elements.winModalPoster.removeAttribute('src');
        elements.winModalPoster.alt = '';
    }

    if (elements.winModalTrailer) {
        const trailerUrl = buildTrailerSearchUrl(movie?.name, movie?.year);
        elements.winModalTrailer.href = trailerUrl;
        elements.winModalTrailer.textContent = 'Find a trailer';
        if (movie?.name) {
            elements.winModalTrailer.setAttribute('aria-label', `Find a trailer for ${movie.name}`);
        } else {
            elements.winModalTrailer.removeAttribute('aria-label');
        }
        elements.winModalTrailer.classList.remove('hidden');
    }

    return {
        title: movie.name,
        year: movie.year || '',
        poster: ''
    };
}

async function fetchMovieMetadata(movie) {
    const key = buildMetadataKey(movie);
    if (metadataCache.has(key)) {
        return metadataCache.get(key);
    }

    if (!movie || !movie.name) {
        const value = { status: 'invalid', data: null };
        metadataCache.set(key, value);
        return value;
    }

    try {
        const params = new URLSearchParams({
            apikey: METADATA_API_KEY,
            t: movie.name
        });
        if (movie.year) {
            params.set('y', movie.year);
        }
        const response = await fetch(`${METADATA_API_URL}?${params.toString()}`);
        if (!response.ok) {
            throw new Error('Metadata request failed');
        }
        const data = await response.json();
        if (data && data.Response === 'True') {
            const normalized = normalizeMetadataResponse(data, movie);
            const value = { status: 'success', data: normalized };
            metadataCache.set(key, value);
            return value;
        }
        const notFound = { status: 'not-found', data: null };
        metadataCache.set(key, notFound);
        return notFound;
    } catch (error) {
        const failure = { status: 'error', data: null };
        metadataCache.set(key, failure);
        return failure;
    }
}

function normalizeMetadataResponse(raw, movie) {
    return {
        title: raw.Title || movie.name,
        year: raw.Year && raw.Year !== 'N/A' ? raw.Year : movie.year || '',
        runtime: raw.Runtime && raw.Runtime !== 'N/A' ? raw.Runtime : '',
        plot: raw.Plot && raw.Plot !== 'N/A' ? raw.Plot : '',
        poster: raw.Poster && raw.Poster !== 'N/A' ? raw.Poster : ''
    };
}

function buildTrailerSearchUrl(name, year) {
    const terms = [name, year, 'trailer'].filter(Boolean).join(' ');
    const query = terms || 'movie trailer';
    return `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
}

// Confetti
let confettiTimeoutId = null;

function getConfettiPalette() {
    if (typeof document !== 'undefined' && document.body && document.body.classList.contains('theme-hanukkah')) {
        return ['#1d4ed8', '#60a5fa', '#facc15', '#fde68a', '#93c5fd', '#2563eb'];
    }
    if (typeof document !== 'undefined' && document.body && document.body.classList.contains('theme-holiday')) {
        return ['#d1495b', '#2ea44f', '#f0c75e', '#f7e1a1', '#9b2f2f', '#4c956c'];
    }
    return ['#ff8600', '#ffd23f', '#06d6a0', '#00bbf9', '#f94144', '#9d4edd'];
}

export function triggerConfetti() {
    if (!elements.confettiContainer) return;

    if (confettiTimeoutId) {
        clearTimeout(confettiTimeoutId);
        confettiTimeoutId = null;
    }

    elements.confettiContainer.classList.remove('show');
    elements.confettiContainer.innerHTML = '';

    const colors = getConfettiPalette();
    const pieceCount = 140;

    for (let i = 0; i < pieceCount; i += 1) {
        const piece = document.createElement('span');
        piece.className = 'confetti-piece';
        const size = 8 + Math.random() * 8;
        piece.style.width = `${size}px`;
        piece.style.height = `${size * 1.4}px`;
        piece.style.backgroundColor = colors[i % colors.length];
        piece.style.left = `${Math.random() * 100}%`;
        piece.style.animationDelay = `${Math.random() * 0.3}s`;
        const duration = 2.2 + Math.random() * 1.5;
        piece.style.animationDuration = `${duration}s`;
        const horizontalDrift = (Math.random() - 0.5) * 40;
        piece.style.setProperty('--confetti-x-move', `${horizontalDrift}vw`);
        elements.confettiContainer.appendChild(piece);
    }

    void elements.confettiContainer.offsetWidth;
    elements.confettiContainer.classList.add('show');

    confettiTimeoutId = window.setTimeout(() => {
        elements.confettiContainer.classList.remove('show');
        elements.confettiContainer.innerHTML = '';
        confettiTimeoutId = null;
    }, 4200);
}

// History
// History
export function renderHistory() {
    if (!elements.historyListEl) return;
    elements.historyListEl.innerHTML = '';
    if (!appState.history.length) {
        if (elements.historyEmptyMsg) elements.historyEmptyMsg.hidden = false;
        return;
    }
    if (elements.historyEmptyMsg) elements.historyEmptyMsg.hidden = true;

    appState.history.forEach(entry => {
        const li = document.createElement('li');
        li.className = 'history-item';
        const modeLabel = getModeLabel(entry.mode);

        const date = new Date(entry.timestamp).toLocaleDateString(undefined, {
            month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
        });

        li.innerHTML = `
      <div class="history-item__info">
        <span class="history-item__name">${entry.name} ${entry.year ? `(${entry.year})` : ''}</span>
        ${modeLabel ? `<span class="history-item__mode">${modeLabel}</span>` : ''}
        <span class="history-item__date">${date}</span>
      </div>
      <div class="history-item__actions">
        ${entry.uri ? `<a href="${entry.uri}" target="_blank" class="btn btn--small" rel="noopener noreferrer">View</a>` : ''}
        <button type="button" class="btn btn--small btn--danger remove-history-btn" aria-label="Remove from history">×</button>
      </div>
    `;

        const removeBtn = li.querySelector('.remove-history-btn');
        if (removeBtn) {
            removeBtn.addEventListener('click', () => {
                if (confirm(`Remove “${entry.name}” from history?`)) {
                    removeHistoryEntry(entry.id);
                    renderHistory();
                }
            });
        }

        elements.historyListEl.appendChild(li);
    });
}

// Knockout helpers
export function markMovieKnockedOut(movieId, order) {
    appState.knockoutResults.set(movieId, { order, status: 'knocked-out' });
    applyKnockoutStatusToItem(movieId);
    reorderMovieListForKnockout();
}

export function markMovieChampion(movieId, order) {
    appState.knockoutResults.set(movieId, { order, status: 'champion' });
    applyKnockoutStatusToItem(movieId);
    reorderMovieListForKnockout();
}

export function updateKnockoutRemainingBox(remainingMovies = []) {
    if (!elements.knockoutBox || !elements.knockoutList) return;

    lastKnockoutRemaining = Array.isArray(remainingMovies) ? [...remainingMovies] : [];
    elements.knockoutList.innerHTML = '';

    const preferences = appState.preferences || {};
    const hideFinalistsBox = Boolean(preferences.hideFinalistsBox);
    const showFromStart = Boolean(preferences.showFinalistsFromStart);

    if (hideFinalistsBox || !Array.isArray(remainingMovies) || !remainingMovies.length) {
        elements.knockoutBox.hidden = true;
        updateWheelAsideLayout();
        return;
    }

    if (!showFromStart && remainingMovies.length > 10) {
        elements.knockoutBox.hidden = true;
        updateWheelAsideLayout();
        return;
    }

    elements.knockoutBox.hidden = false;
    const oddsMap = getSelectionOdds(lastKnockoutRemaining, { inverseModeOverride: true });
    const winOddsMap = getSelectionOdds(lastKnockoutRemaining, { inverseModeOverride: false });
    const themeLocked = isThemePaletteLocked();

    lastKnockoutRemaining.forEach((movie) => {
        const originalIndex = getMovieOriginalIndex(movie, appState.movies);
        let colorIndex = originalIndex;
        if (!Number.isFinite(colorIndex) || colorIndex < 0) {
            colorIndex = appState.movies.indexOf(movie);
        }
        const defaultColor = getDefaultColorForIndex(colorIndex);
        const resolvedColor = themeLocked ? defaultColor : getStoredColor(movie, defaultColor);
        if (movie.color !== resolvedColor) {
            movie.color = resolvedColor;
        }

        const item = document.createElement('li');
        item.className = 'knockout-remaining__item';
        item.dataset.id = movie.id;

        const titleRow = document.createElement('div');
        titleRow.className = 'knockout-remaining__line';

        const colorSwatch = document.createElement('span');
        colorSwatch.className = 'knockout-remaining__color';
        colorSwatch.style.backgroundColor = resolvedColor;
        colorSwatch.setAttribute('aria-hidden', 'true');

        const title = document.createElement('span');
        title.className = 'knockout-remaining__name';
        title.textContent = movie.name;

        titleRow.appendChild(colorSwatch);
        titleRow.appendChild(title);
        item.appendChild(titleRow);

        const metaParts = [];
        if (movie.year) metaParts.push(movie.year);
        if (movie.isCustom) metaParts.push('Custom');
        if (metaParts.length) {
            const meta = document.createElement('span');
            meta.className = 'knockout-remaining__meta';
            meta.textContent = metaParts.join(' | ');
            item.appendChild(meta);
        }

        const winOddsValue = winOddsMap.get(movie.id) || oddsMap.get(movie.id) || 0;
        const odds = document.createElement('span');
        odds.className = 'knockout-remaining__odds';
        odds.textContent = `Odds: ${formatOddsPercent(winOddsValue)}`;
        item.appendChild(odds);

        elements.knockoutList.appendChild(item);
    });

    updateWheelAsideLayout();
}

export function refreshKnockoutBoxVisibility() {
    updateKnockoutRemainingBox(lastKnockoutRemaining);
}

export function highlightKnockoutCandidate(movieId) {
    if (!elements.knockoutList) return;
    const items = elements.knockoutList.querySelectorAll('.knockout-remaining__item');
    items.forEach((item) => {
        const isActive = Boolean(movieId && item.dataset.id === movieId);
        item.classList.toggle('is-active', isActive);
        if (isActive) {
            item.setAttribute('aria-current', 'true');
        } else {
            item.removeAttribute('aria-current');
        }
    });
}

export function updateKnockoutResultText(type, countOrMovie, extra) {
    if (!elements.resultEl) return;

    if (type === 'start') {
        elements.resultEl.classList.add('result--knockout');
        elements.resultEl.classList.remove('result--champion');
        elements.resultEl.innerHTML = `🔥 Movie Knockout begins! <strong>${countOrMovie}</strong> movie${countOrMovie === 1 ? '' : 's'} enter the arena.`;
    } else if (type === 'eliminated') {
        const remainingCount = countOrMovie;
        const eliminatedMovie = extra;
        const remainText = remainingCount === 1 ? 'Final showdown! One movie remains.' : `${remainingCount} movies remain.`;
        const eliminatedLabel = `${eliminatedMovie.name}${eliminatedMovie.year ? ` (${eliminatedMovie.year})` : ''}`;
        elements.resultEl.innerHTML = `💥 Knocked out: <strong>${eliminatedLabel}</strong> ${remainText}`;
    } else if (type === 'winner') {
        const finalMovie = extra;
        elements.resultEl.classList.add('result--champion');
        elements.resultEl.innerHTML = `🏆 Movie Knockout winner: <strong>${finalMovie.name}</strong>${finalMovie.year ? ` (${finalMovie.year})` : ''}`;
    }
}

function applyKnockoutStatusToElement(element, status) {
    if (!element) return;

    if (!status) {
        element.classList.remove('is-champion', 'is-knocked-out');
        element.removeAttribute('data-knockout-order');
        element.removeAttribute('data-knockout-status');
        const existing = element.querySelector('.knockout-badge');
        if (existing) {
            existing.remove();
        }
        return;
    }

    element.dataset.knockoutOrder = String(status.order);
    element.dataset.knockoutStatus = status.status;

    element.classList.toggle('is-knocked-out', status.status === 'knocked-out');
    element.classList.toggle('is-champion', status.status === 'champion');

    let badge = element.querySelector('.knockout-badge');
    if (!badge) {
        badge = document.createElement('span');
        badge.className = 'knockout-badge';
        const removeButton = element.querySelector('.remove-custom');
        if (removeButton && removeButton.parentElement === element) {
            element.insertBefore(badge, removeButton);
        } else {
            element.appendChild(badge);
        }
    } else {
        const removeButton = element.querySelector('.remove-custom');
        if (removeButton && removeButton.parentElement === element && badge.nextSibling !== removeButton) {
            element.insertBefore(badge, removeButton);
        }
    }

    if (status.status === 'champion') {
        badge.textContent = 'Knockout champion';
    } else {
        badge.textContent = status.order ? `Knocked out #${status.order}` : 'Knocked out';
    }
}

function applyKnockoutStatusToItem(movieId) {
    if (!elements.movieListEl) return;
    const safeId = escapeSelector(movieId);
    const item = elements.movieListEl.querySelector(`li[data-id="${safeId}"]`);
    if (!item) return;
    const status = appState.knockoutResults.get(movieId);
    applyKnockoutStatusToElement(item, status);
}

function reorderMovieListForKnockout() {
    if (!elements.movieListEl || !appState.knockoutResults.size || virtualListState.enabled) {
        return;
    }

    const items = Array.from(elements.movieListEl.children).filter((item) => !item.classList.contains('empty'));
    if (!items.length) {
        return;
    }

    const sorted = items.sort((a, b) => {
        const aOrder = Number.parseInt(a.dataset.knockoutOrder, 10);
        const bOrder = Number.parseInt(b.dataset.knockoutOrder, 10);
        const aHasOrder = Number.isFinite(aOrder);
        const bHasOrder = Number.isFinite(bOrder);

        if (aHasOrder && bHasOrder) {
            return aOrder - bOrder;
        }
        if (aHasOrder) {
            return -1;
        }
        if (bHasOrder) {
            return 1;
        }

        const aIndex = Number.parseInt(a.dataset.originalIndex, 10);
        const bIndex = Number.parseInt(b.dataset.originalIndex, 10);
        if (Number.isFinite(aIndex) && Number.isFinite(bIndex)) {
            return aIndex - bIndex;
        }
        return 0;
    });

    sorted.forEach((item) => {
        elements.movieListEl.appendChild(item);
    });
}

function createWheelAsideUpdater(domElements) {
    const { wheelAside, wheelLayout, knockoutBox, sliceEditor } = domElements;
    return () => {
        if (!wheelAside || !wheelLayout) {
            return;
        }
        const asideVisible = (knockoutBox && !knockoutBox.hidden) || (sliceEditor && !sliceEditor.hidden);
        wheelAside.classList.toggle('is-hidden', !asideVisible);
        wheelLayout.classList.toggle('is-centered', !asideVisible);
    };
}


function populateSliceEditor(m) {
    if (!elements.sliceEditor) return;
    elements.sliceEditor.hidden = false;
    if (elements.sliceEditorName) elements.sliceEditorName.textContent = m.name;
    if (elements.sliceWeightValue) elements.sliceWeightValue.textContent = getStoredWeight(m) + 'x';
}




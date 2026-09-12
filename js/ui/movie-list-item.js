/** Movie row rendering and its selection, weight, color, and booster controls. */
import { appState, debouncedSaveState } from '../state.js';
import {
    getDefaultColorForIndex,
    getStoredColor,
    getStoredWeight,
    clampWeight,
    sanitizeColor,
    getMovieOriginalIndex
} from '../utils.js';
import { applyKnockoutStatusToElement } from './knockout-ui.js';
import { renderBoosterTags } from './boost-station.js';
import { promptForInput } from './modals.js';

export function getSafeHttpUrl(value) {
    if (typeof value !== 'string' || !value.trim()) return '';
    try {
        const url = new URL(value, window.location.href);
        return url.protocol === 'http:' || url.protocol === 'https:' ? url.href : '';
    } catch (error) {
        return '';
    }
}

function formatOddsPercent(value = 0) {
    const numeric = Number(value) * 100;
    const safePercent = Number.isFinite(numeric) ? Math.min(100, Math.max(0, numeric)) : 0;
    if (safePercent === 0 || safePercent === 100 || safePercent >= 10) {
        return `${Math.round(safePercent)}%`;
    }
    return `${safePercent.toFixed(1)}%`;
}

function buildMovieOddsLabel(oddsValue = 0, isSelected = false, label = '') {
    if (!isSelected) {
        return `${label}: 0% (not selected)`;
    }
    return `${label}: ${formatOddsPercent(oddsValue)}`;
}

/**
 * @param {import('../types.js').Movie} movie
 * @param {number} index
 * @param {object} context Current odds, mode copy, theme, and winner snapshot.
 * @param {{ updateMovieList: () => void, onAppearanceChange: () => void, removeCustomEntry: (id: string|number) => void }} actions
 */
export function buildMovieListItem(movie, index, context, actions) {
    const { oddsMap, winOddsMap, weightsEnabled, randomBoostActive, themeLocked, winnerId, weightCopy } = context;
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
        actions.updateMovieList();
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
    oddsEl.textContent = buildMovieOddsLabel(oddsValue, isActive, weightCopy.riskLabel);

    const winOddsEl = document.createElement('span');
    winOddsEl.className = 'movie-odds movie-odds--win';
    winOddsEl.classList.toggle('movie-odds--inactive', !isWinActive);
    winOddsEl.textContent = buildMovieOddsLabel(winOddsValue, isWinActive, weightCopy.winLabel);

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
        weightLabel.textContent = weightCopy.weightLabel;

        const weightHelp = document.createElement('span');
        weightHelp.className = 'weight-help';
        weightHelp.setAttribute('role', 'img');
        weightHelp.setAttribute('aria-label', weightCopy.weightHelp);
        weightHelp.title = weightCopy.weightHelp;
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
            actions.onAppearanceChange();
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
                actions.updateMovieList();
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
            actions.onAppearanceChange();
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
        removeButton.addEventListener('click', () => actions.removeCustomEntry(movie.id));
        li.appendChild(removeButton);
    }

    const knockoutStatus = appState.knockoutResults.get(movie.id);
    applyKnockoutStatusToElement(li, knockoutStatus);

    return li;
}

/**
 * Boost Station UI logic for Letterboxd Watchlist Wheel
 */

import { appState, saveState, debouncedSaveState } from '../state.js';
import {
    clampWeight,
    stringToColor,
    getStoredWeight,
    sanitizeColor,
    debounce
} from '../utils.js';
import { spinWheel } from '../wheel.js';
import { promptForInput } from './modals.js';

let elements = {};
let updateMovieListCallback = () => {};

export function initBoostStation(domElements, callbacks = {}) {
    Object.assign(elements, domElements);
    if (callbacks.updateMovieList) {
        updateMovieListCallback = callbacks.updateMovieList;
    }
    initBoostControls();
}

function escapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

export function initBoostControls() {
    const randomBoostBtn = elements.randomBoostBtn || document.getElementById('random-boost-btn');
    if (randomBoostBtn) {
        randomBoostBtn.addEventListener('click', () => {
            promptForInput('Who is this boost for?', 'Booster Name', (name) => {
                const wheelSection = document.querySelector('.wheel-section');
                if (wheelSection) {
                    wheelSection.scrollIntoView({ behavior: 'smooth' });
                }
                spinWheel('random-boost', { booster: name });
            });
        });
    }

    const boostModalCloseBtn = elements.boostModalCloseBtn || document.getElementById('boost-modal-close');
    if (boostModalCloseBtn) {
        boostModalCloseBtn.addEventListener('click', closeBoostStation);
    }
    const boostModal = elements.boostModal || document.getElementById('boost-modal');
    if (boostModal) {
        boostModal.addEventListener('click', (e) => {
            if (e.target === boostModal) closeBoostStation();
        });
    }

    const boostMovieFilter = elements.boostMovieFilter || document.getElementById('boost-movie-filter');
    if (boostMovieFilter) {
        boostMovieFilter.addEventListener('input', (e) => {
            filterBoostOptions(e.target.value);
        });
    }
    const boostMovieSelect = elements.boostMovieSelect || document.getElementById('boost-movie-select');
    const btnBoostSpecific = elements.btnBoostSpecific || document.getElementById('btn-boost-specific');
    const btnBoostRemove = elements.btnBoostRemove || document.getElementById('btn-boost-remove');
    const btnBoostRandom = elements.btnBoostRandom || document.getElementById('btn-boost-random');

    if (boostMovieSelect) {
        boostMovieSelect.addEventListener('change', () => {
            const hasSelection = Boolean(boostMovieSelect.value);
            if (btnBoostSpecific) btnBoostSpecific.disabled = !hasSelection;
            if (btnBoostRemove) btnBoostRemove.disabled = !hasSelection;
        });
        boostMovieSelect.addEventListener('dblclick', () => {
            if (boostMovieSelect.value) handleBoostSpecific();
        });
    }
    if (btnBoostSpecific) {
        btnBoostSpecific.addEventListener('click', handleBoostSpecific);
    }
    if (btnBoostRemove) {
        btnBoostRemove.addEventListener('click', handleBoostRemove);
    }
    if (btnBoostRandom) {
        btnBoostRandom.addEventListener('click', handleBoostRandom);
    }
}

export function openBoostStation() {
    const boostModal = elements.boostModal || document.getElementById('boost-modal');
    if (!boostModal) return;
    populateBoostSelect();
    const boostBoosterName = elements.boostBoosterName || document.getElementById('boost-booster-name');
    const boostMovieFilter = elements.boostMovieFilter || document.getElementById('boost-movie-filter');
    const btnBoostSpecific = elements.btnBoostSpecific || document.getElementById('btn-boost-specific');
    const btnBoostRemove = elements.btnBoostRemove || document.getElementById('btn-boost-remove');

    if (boostBoosterName) boostBoosterName.value = '';
    if (boostMovieFilter) boostMovieFilter.value = '';
    if (btnBoostSpecific) btnBoostSpecific.disabled = true;
    if (btnBoostRemove) btnBoostRemove.disabled = true;

    boostModal.hidden = false;
    requestAnimationFrame(() => boostModal.classList.add('show'));
    if (boostBoosterName) boostBoosterName.focus();
}

export function closeBoostStation() {
    const boostModal = elements.boostModal || document.getElementById('boost-modal');
    if (!boostModal) return;
    boostModal.classList.remove('show');
    setTimeout(() => { boostModal.hidden = true; }, 200);
}

export function populateBoostSelect() {
    const boostMovieSelect = elements.boostMovieSelect || document.getElementById('boost-movie-select');
    if (!boostMovieSelect) return;
    boostMovieSelect.innerHTML = '';

    const sorted = [...appState.movies].sort((a, b) => a.name.localeCompare(b.name));

    sorted.forEach(movie => {
        const option = document.createElement('option');
        option.value = movie.id;
        const weight = getStoredWeight(movie);
        const weightLabel = weight > 1 ? ` [${weight}x]` : '';
        option.textContent = `${movie.name} (${movie.year || 'N/A'})${weightLabel}`;
        boostMovieSelect.appendChild(option);
    });
}

export function filterBoostOptions(query) {
    const boostMovieSelect = elements.boostMovieSelect || document.getElementById('boost-movie-select');
    if (!boostMovieSelect) return;
    const term = query.toLowerCase();
    const options = Array.from(boostMovieSelect.options);

    options.forEach(opt => {
        const match = opt.textContent.toLowerCase().includes(term);
        opt.hidden = !match;
    });

    if (boostMovieSelect.value) {
        const current = boostMovieSelect.querySelector(`option[value="${boostMovieSelect.value}"]`);
        if (current && current.hidden) boostMovieSelect.value = '';
    }

    const hasSelection = Boolean(boostMovieSelect.value);
    const btnBoostSpecific = elements.btnBoostSpecific || document.getElementById('btn-boost-specific');
    const btnBoostRemove = elements.btnBoostRemove || document.getElementById('btn-boost-remove');
    if (btnBoostSpecific) btnBoostSpecific.disabled = !hasSelection;
    if (btnBoostRemove) btnBoostRemove.disabled = !hasSelection;
}

export function handleBoostSpecific() {
    const boostMovieSelect = elements.boostMovieSelect || document.getElementById('boost-movie-select');
    const boostBoosterName = elements.boostBoosterName || document.getElementById('boost-booster-name');
    const movieId = boostMovieSelect ? boostMovieSelect.value : null;
    const name = boostBoosterName ? boostBoosterName.value.trim() : 'Anonymous';

    if (!movieId) return;

    const movie = appState.movies.find(m => m.id === movieId);
    if (!movie) return;

    const currentW = getStoredWeight(movie);
    const newW = clampWeight(currentW + 1);
    movie.weight = newW;
    if (!movie.boosters) movie.boosters = [];
    movie.boosters.push({
        name: name || 'Anonymous',
        timestamp: Date.now(),
        source: 'manual'
    });

    const statusMessage = elements.statusMessage || document.getElementById('status-message');
    if (statusMessage) {
        statusMessage.textContent = `Boosted "${movie.name}" to ${newW}x (Booster: ${name || 'Anonymous'})`;
    }

    debouncedSaveState();
    updateMovieListCallback();
    closeBoostStation();
}

export function handleBoostRemove() {
    const boostMovieSelect = elements.boostMovieSelect || document.getElementById('boost-movie-select');
    const movieId = boostMovieSelect ? boostMovieSelect.value : null;

    if (!movieId) return;

    const movie = appState.movies.find(m => m.id === movieId);
    if (!movie) return;

    const currentW = getStoredWeight(movie);
    const statusMessage = elements.statusMessage || document.getElementById('status-message');
    if (currentW <= 1) {
        if (statusMessage) {
            statusMessage.textContent = `Cannot remove boost: "${movie.name}" is already at 1x`;
        }
        return;
    }

    const newW = clampWeight(currentW - 1);
    movie.weight = newW;

    if (movie.boosters && movie.boosters.length > 0) {
        movie.boosters.pop();
    }

    if (statusMessage) {
        statusMessage.textContent = `Removed boost from "${movie.name}" (now ${newW}x)`;
    }

    debouncedSaveState();
    updateMovieListCallback();
    closeBoostStation();
}

export function handleBoostRandom() {
    const boostBoosterName = elements.boostBoosterName || document.getElementById('boost-booster-name');
    const name = boostBoosterName ? boostBoosterName.value.trim() : 'Anonymous';
    closeBoostStation();

    const wheelSection = document.querySelector('.wheel-section');
    if (wheelSection) {
        wheelSection.scrollIntoView({ behavior: 'smooth' });
    }
    spinWheel('random-boost', { booster: name || 'Anonymous' });
}

export function getBoosterColor(name) {
    if (appState.preferences.boosterColors && appState.preferences.boosterColors[name]) {
        return sanitizeColor(appState.preferences.boosterColors[name], stringToColor(name));
    }
    return stringToColor(name);
}

export function renderBoosterTags(container, movie) {
    if (!movie.boosters || !movie.boosters.length) return;

    const counts = {};
    movie.boosters.forEach(b => {
        const name = typeof b === 'string' ? b : b.name;
        counts[name] = (counts[name] || 0) + 1;
    });

    const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);

    sorted.forEach(([name, count]) => {
        const tag = document.createElement('span');
        tag.className = 'booster-tag';
        tag.title = `Manage boosts for ${name}`;

        const color = getBoosterColor(name);

        tag.style.backgroundColor = `${color}40`;
        tag.style.borderColor = color;
        tag.style.color = 'var(--text)';

        const dot = document.createElement('span');
        dot.style.backgroundColor = color;
        dot.style.borderRadius = '50%';
        dot.style.display = 'inline-block';
        dot.style.height = '10px';
        dot.style.marginRight = '4px';
        dot.style.width = '10px';
        tag.appendChild(dot);
        tag.appendChild(document.createTextNode(`${name} `));

        const countEl = document.createElement('span');
        countEl.className = 'booster-tag__count';
        countEl.textContent = `x${count}`;
        tag.appendChild(countEl);

        tag.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            handleBoosterTagClick(movie, name, count);
        });
        container.appendChild(tag);
    });
}

export function handleBoosterTagClick(movie, name, count) {
    const existingOverlay = document.getElementById('booster-action-overlay');
    if (existingOverlay) existingOverlay.remove();

    const history = movie.boosters
        .filter(b => (typeof b === 'string' ? b : b.name) === name)
        .map(b => {
            if (typeof b === 'string') return { timestamp: null, source: 'legacy' };
            return { timestamp: b.timestamp, source: b.source || 'manual' };
        })
        .sort((a, b) => {
            if (!a.timestamp) return 1;
            if (!b.timestamp) return -1;
            return b.timestamp - a.timestamp;
        });

    const overlay = document.createElement('div');
    overlay.id = 'booster-action-overlay';
    overlay.className = 'win-modal show';
    overlay.style.zIndex = '3000';

    const currentColor = getBoosterColor(name);
    const safeName = escapeHtml(name);
    const safeMovieName = escapeHtml(movie.name);

    const historyListHtml = history.length > 0
        ? `<div style="margin: 0 0 1rem 0; background: rgba(0,0,0,0.2); border-radius: 4px; border: 1px solid rgba(255,255,255,0.05);">
            <ul style="margin: 0; padding: 0; list-style: none; max-height: 120px; overflow-y: auto;">
            ${history.map(item => {
            const dateStr = item.timestamp ? new Date(item.timestamp).toLocaleString(undefined, {
                month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit'
            }) : 'Legacy boost';

            let label = 'Boost +1';
            if (item.source === 'random') label = '🎲 Random Boost';
            else if (item.source === 'manual') label = '➕ Manual Boost';

            return `<li style="padding: 0.35rem 0.75rem; font-size: 0.8rem; border-bottom: 1px solid rgba(255,255,255,0.05); color: var(--muted); display:flex; justify-content:space-between;">
                    <span style="color: var(--text);">${label}</span>
                    <span>${dateStr}</span>
                </li>`;
        }).join('')}
           </ul></div>`
        : '';

    overlay.innerHTML = `
        <div class="win-modal__content" style="max-width: 320px; text-align: left; padding: 1.5rem;">
            <button type="button" class="win-modal__close" style="top: 0.5rem; right: 0.5rem;">&times;</button>
            <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom: 0.25rem;">
                 <h3 class="win-modal__title" style="font-size: 1.2rem; margin:0;">${safeName}</h3>
                 <input type="color" id="booster-color-picker" value="${currentColor}" title="Change color for ${safeName}" style="background:none; border:none; width:30px; height:30px; cursor:pointer;">
            </div>
            
            <p style="color: var(--muted); margin-bottom: 0.75rem; font-size: 0.9rem;">
                Contributions to <strong>${safeMovieName}</strong>: <strong>${count}</strong>
            </p>
            
            ${historyListHtml}

            <div style="display: flex; flex-direction: column; gap: 0.75rem;">
                <button id="action-add-boost" class="btn" style="justify-content: center;">
                    ➕ Add Boost (+1)
                </button>
                <button id="action-remove-boost" class="btn" style="justify-content: center;">
                    ➖ Remove One (-1)
                </button>
                <button id="action-remove-all" class="btn btn--danger" style="justify-content: center;">
                    🗑️ Remove All
                </button>
                <button id="action-done" class="btn btn--primary" style="justify-content: center; margin-top: 0.25rem;">
                    Done
                </button>
            </div>
        </div>
    `;

    document.body.appendChild(overlay);

    const close = () => overlay.remove();

    overlay.querySelector('.win-modal__close').addEventListener('click', close);
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) close();
    });

    const debouncedUpdate = debounce(() => updateMovieListCallback(), 300);

    const colorPicker = overlay.querySelector('#booster-color-picker');
    const headerTitle = overlay.querySelector('.win-modal__title');

    colorPicker.addEventListener('input', (e) => {
        const newColor = e.target.value;
        if (!appState.preferences.boosterColors) {
            appState.preferences.boosterColors = {};
        }
        appState.preferences.boosterColors[name] = newColor;

        if (headerTitle) {
            headerTitle.style.backgroundImage = 'none';
            headerTitle.style.webkitTextFillColor = 'initial';
            headerTitle.style.color = newColor;
        }

        debouncedSaveState();
        debouncedUpdate();
    });

    overlay.querySelector('#action-done').addEventListener('click', close);

    overlay.querySelector('#action-add-boost').addEventListener('click', () => {
        modifyBooster(movie, name, 1);
        close();
    });

    overlay.querySelector('#action-remove-boost').addEventListener('click', () => {
        modifyBooster(movie, name, -1);
        close();
    });

    overlay.querySelector('#action-remove-all').addEventListener('click', () => {
        modifyBooster(movie, name, -count);
        close();
    });
}

export function modifyBooster(movie, name, delta) {
    const currentW = getStoredWeight(movie);

    if (delta > 0) {
        const newW = clampWeight(currentW + delta);
        if (newW === currentW) {
            alert('Max weight reached!');
            return;
        }
        movie.weight = newW;
        if (!movie.boosters) movie.boosters = [];
        for (let i = 0; i < delta; i++) {
            movie.boosters.push({
                name: name,
                timestamp: Date.now(),
                source: 'manual'
            });
        }
    } else if (delta < 0) {
        const removeCount = Math.abs(delta);
        const personIndices = movie.boosters.map((b, i) => {
            const bName = typeof b === 'string' ? b : b.name;
            return bName === name ? i : -1;
        }).filter(i => i !== -1);

        if (personIndices.length === 0) return;

        const toRemove = Math.min(removeCount, personIndices.length);

        for (let i = 0; i < toRemove; i++) {
            let lastIdx = -1;
            for (let j = movie.boosters.length - 1; j >= 0; j--) {
                const b = movie.boosters[j];
                const bName = typeof b === 'string' ? b : b.name;
                if (bName === name) {
                    lastIdx = j;
                    break;
                }
            }
            if (lastIdx > -1) {
                movie.boosters.splice(lastIdx, 1);
            }
        }

        const calculatedWeightFromBoosters = (movie.boosters ? movie.boosters.length : 0) + 1;
        const targetW = clampWeight(Math.max(1, currentW - toRemove));
        movie.weight = clampWeight(Math.max(calculatedWeightFromBoosters, targetW));
    }

    debouncedSaveState();
    updateMovieListCallback();
}

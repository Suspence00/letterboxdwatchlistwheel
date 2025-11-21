/**
 * UI management for the Letterboxd Watchlist Wheel
 */

import { appState, saveState, debouncedSaveState, clearHistory, addToHistory } from './state.js';
import {
    getDefaultColorForIndex,
    getStoredColor,
    getStoredWeight,
    clampWeight,
    sanitizeColor,
    escapeSelector,
    getMovieOriginalIndex
} from './utils.js';
import { drawWheel, drawEmptyWheel, spinWheel, getIsSpinning, getIsLastStandingInProgress, getWinnerId, setWinnerId } from './wheel.js';

// DOM Elements
const elements = {};

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

    if (elements.spinButton) {
        elements.spinButton.addEventListener('click', () => spinWheel(isOneSpinModeEnabled()));
    }

    if (elements.vetoButton) {
        elements.vetoButton.addEventListener('click', handleVeto);
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

    if (elements.searchInput) {
        elements.searchInput.addEventListener('input', (event) => {
            // Search logic handled in main or here?
            // Let's handle it here or in main.
            // Since we need debounce, we can import it.
            // But for now let's just expose updateMovieList and let main handle search input listener if complex.
            // Or just do it here.
        });
    }
}

export function getFilteredMovies() {
    const { movies, filter } = appState;
    if (filter.showCustoms && !filter.normalizedQuery) {
        return [...movies];
    }

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
        descriptions.push(`search “${appState.filter.query}”`);
    }
    if (!appState.filter.showCustoms) {
        descriptions.push('Custom entries hidden');
    }
    return descriptions;
}

export function updateMovieList() {
    if (!elements.movieListEl) return;

    elements.movieListEl.innerHTML = '';

    if (!appState.movies.length) {
        const emptyItem = document.createElement('li');
        emptyItem.className = 'empty';
        emptyItem.textContent = 'Upload a CSV to see your movies here.';
        elements.movieListEl.appendChild(emptyItem);
        if (elements.spinButton) elements.spinButton.disabled = true;
        drawEmptyWheel();
        closeWinnerPopup({ restoreFocus: false });
        updateVetoButtonState();
        updateSpinButtonLabel();
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
        const emptyItem = document.createElement('li');
        emptyItem.className = 'empty';
        const descriptions = getActiveFilterDescriptions();
        emptyItem.textContent = descriptions.length
            ? `No movies match your current filters (${descriptions.join(', ')}).`
            : 'No movies match your current filters.';
        elements.movieListEl.appendChild(emptyItem);
        if (elements.spinButton) elements.spinButton.disabled = true;
        drawEmptyWheel();
        updateVetoButtonState();
        return;
    }

    const weightsEnabled = isAdvancedOptionsEnabled();

    const displayMovies = [...filteredMovies];
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

    displayMovies.forEach((movie, index) => {
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
        const sanitizedColor = getStoredColor(movie, defaultColor);
        if (movie.color !== sanitizedColor) {
            movie.color = sanitizedColor;
        }

        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.checked = appState.selectedIds.has(movie.id);
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
            weightLabel.textContent = 'Slice weight';

            const weightSelect = document.createElement('select');
            weightSelect.id = weightSelectId;
            weightSelect.className = 'movie-weight__select';
            for (let value = 1; value <= 10; value += 1) {
                const option = document.createElement('option');
                option.value = String(value);
                option.textContent = `${value}×`;
                weightSelect.appendChild(option);
            }
            weightSelect.value = String(sanitizedWeight);
            weightSelect.addEventListener('change', (event) => {
                const selectedValue = Number(event.target.value);
                movie.weight = clampWeight(selectedValue);
                const selectedMoviesSnapshot = getFilteredSelectedMovies();
                drawWheel(selectedMoviesSnapshot);
            });

            weightWrapper.appendChild(weightLabel);
            weightWrapper.appendChild(weightSelect);
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
            colorInput.value = sanitizedColor;
            colorInput.addEventListener('input', (event) => {
                const selectedColor = sanitizeColor(event.target.value, defaultColor);
                movie.color = selectedColor;
                const selectedMoviesSnapshot = getFilteredSelectedMovies();
                drawWheel(selectedMoviesSnapshot);
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

        elements.movieListEl.appendChild(li);
    });

    const selectedMovies = filteredMovies.filter((movie) => appState.selectedIds.has(movie.id));
    if (elements.spinButton) {
        elements.spinButton.disabled = selectedMovies.length === 0 || getIsSpinning();
    }
    if (!selectedMovies.length) {
        closeWinnerPopup({ restoreFocus: false });
    }
    drawWheel(selectedMovies);
    updateVetoButtonState();
    updateSpinButtonLabel();
    debouncedSaveState();
}

export function updateSpinButtonLabel() {
    if (!elements.spinButton) return;
    if (getIsLastStandingInProgress()) {
        elements.spinButton.textContent = 'Eliminating…';
        return;
    }

    if (isOneSpinModeEnabled()) {
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

export function updateVetoButtonState() {
    if (!elements.vetoButton) return;
    const winnerId = getWinnerId();
    elements.vetoButton.disabled = !winnerId || getIsSpinning() || getIsLastStandingInProgress();
}

export function isAdvancedOptionsEnabled() {
    return elements.advancedOptionsToggle ? Boolean(elements.advancedOptionsToggle.checked) : true;
}

export function isOneSpinModeEnabled() {
    return Boolean(isAdvancedOptionsEnabled() && elements.oneSpinToggle && elements.oneSpinToggle.checked);
}

function handleVeto() {
    const winnerId = getWinnerId();
    if (!winnerId || getIsSpinning()) {
        return;
    }

    const vetoedMovie = appState.movies.find((movie) => movie.id === winnerId);
    if (!vetoedMovie) {
        return;
    }

    appState.selectedIds.delete(winnerId);
    if (elements.statusMessage) elements.statusMessage.textContent = `Vetoed “${vetoedMovie.name}”.`;
    updateMovieList();

    const remaining = getFilteredSelectedMovies();
    if (!remaining.length) {
        if (elements.statusMessage) elements.statusMessage.textContent += ' No more entries remain to spin with the current filters.';
        return;
    }

    spinWheel();
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

export function showWinnerPopup(movie) {
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
    populateWinnerModalMetadata(movie, metadataKey);

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
        applyWinnerModalFallback(movie);
        return;
    }

    const result = await fetchMovieMetadata(movie);
    if (metadataKey !== currentModalMetadataKey) {
        return;
    }

    if (!result || result.status !== 'success' || !result.data) {
        applyWinnerModalFallback(movie);
        return;
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

export function triggerConfetti() {
    if (!elements.confettiContainer) return;

    if (confettiTimeoutId) {
        clearTimeout(confettiTimeoutId);
        confettiTimeoutId = null;
    }

    elements.confettiContainer.classList.remove('show');
    elements.confettiContainer.innerHTML = '';

    const colors = ['#ff8600', '#ffd23f', '#06d6a0', '#00bbf9', '#f94144', '#9d4edd'];
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

        const date = new Date(entry.timestamp).toLocaleDateString(undefined, {
            month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
        });

        li.innerHTML = `
      <div class="history-item__info">
        <span class="history-item__name">${entry.name} ${entry.year ? `(${entry.year})` : ''}</span>
        <span class="history-item__date">${date}</span>
      </div>
      <div class="history-item__actions">
        ${entry.uri ? `<a href="${entry.uri}" target="_blank" class="btn btn--small" rel="noopener noreferrer">View</a>` : ''}
      </div>
    `;
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
    if (!elements.movieListEl || !appState.knockoutResults.size) {
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

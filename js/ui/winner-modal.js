/**
 * Winner Modal & Metadata Enrichment module
 */

import { appState } from '../state.js';
import { fetchMovieMetadata, buildMetadataKey } from '../movie-metadata.js';
import { createTapeViewer } from '../tape-viewer.js';
import { addMovieToRadarr, isRadarrConfigured } from '../radarr.js';
import { sendDiscordNotification } from '../discord.js';
import { triggerConfetti } from './confetti.js';
import { isVhsEnabled, clearVhsReveal } from '../vhs-wheel.js';
import { closeSpinTheater } from '../spin-theater.js';
import { getStoredWeight } from '../utils.js';
import { getWinnerId } from '../wheel.js';

// DOM Elements map with fallback to document.getElementById
const defaultElementIds = {
    winModal: 'win-modal',
    winModalCloseBtn: 'win-modal-close',
    winModalTitle: 'win-modal-title',
    winModalDetails: 'win-modal-details',
    winModalPosterWrapper: 'win-modal-poster-wrapper',
    winModalPoster: 'win-modal-poster',
    winModalTapeViewer: 'win-modal-tape-viewer',
    winModalSynopsis: 'win-modal-synopsis',
    winModalRuntime: 'win-modal-runtime',
    winModalTrailer: 'win-modal-trailer',
    winModalLink: 'win-modal-link',
    reshowWinnerBtn: 'reshow-winner-btn',
    winModalRadarrBtn: 'win-modal-radarr',
    winModalRadarrStatus: 'win-modal-radarr-status',
};

const elements = new Proxy({}, {
    get(target, prop) {
        if (prop in target) return target[prop];
        const id = defaultElementIds[prop];
        if (id && typeof document !== 'undefined') {
            return document.getElementById(id);
        }
        return undefined;
    },
    set(target, prop, value) {
        target[prop] = value;
        return true;
    }
});

export function initWinnerModal(domElements = {}) {
    Object.assign(elements, domElements);
}

// Internal State
let modalHideTimeoutId = null;
let lastFocusedBeforeModal = null;
let currentModalMetadataKey = null;
let radarrButtonHandler = null;
let tapeViewerController = null;

// Internal Helpers
function getSafeHttpUrl(value) {
    if (typeof value !== 'string' || !value.trim()) return '';
    try {
        const url = new URL(value, typeof window !== 'undefined' ? window.location.href : 'http://localhost');
        return url.protocol === 'http:' || url.protocol === 'https:' ? url.href : '';
    } catch {
        return '';
    }
}

function getSpinMode() {
    if (typeof document === 'undefined') return 'classic';
    const radios = document.querySelectorAll('input[name="spin-mode"]');
    for (const radio of radios) {
        if (radio.checked) {
            return radio.value;
        }
    }
    return 'classic';
}

function buildTrailerSearchUrl(name, year) {
    const terms = [name, year, 'trailer'].filter(Boolean).join(' ');
    const query = terms || 'movie trailer';
    return `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
}

function setWinnerModalLoadingState(movie, spinMode) {
    // Clean up any previous tape viewer
    if (tapeViewerController) {
        tapeViewerController.destroy();
        tapeViewerController = null;
    }

    // Decide whether to use the 3D tape viewer or the flat poster
    const useTapeViewer = isVhsEnabled() && elements.winModalTapeViewer && movie;

    if (useTapeViewer) {
        // Hide flat poster, show tape viewer
        if (elements.winModalPosterWrapper) {
            elements.winModalPosterWrapper.hidden = true;
        }
        if (elements.winModalPoster) {
            elements.winModalPoster.removeAttribute('src');
            elements.winModalPoster.alt = '';
        }
        elements.winModalTapeViewer.hidden = false;
        tapeViewerController = createTapeViewer(elements.winModalTapeViewer, movie);
        if (spinMode === 'knockout') {
            tapeViewerController.root.classList.add('tape-viewer--champion');
        }
    } else {
        // Classic flat poster path
        if (elements.winModalTapeViewer) {
            elements.winModalTapeViewer.hidden = true;
        }
        if (elements.winModalPosterWrapper) {
            elements.winModalPosterWrapper.hidden = true;
        }
        if (elements.winModalPoster) {
            elements.winModalPoster.removeAttribute('src');
            elements.winModalPoster.alt = '';
        }
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
        title: movie?.name || '',
        year: movie?.year || '',
        poster: ''
    };
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

    if (tapeViewerController && poster) {
        // Update the 3D tape's poster
        tapeViewerController.update(movie, poster);
    } else if (elements.winModalPosterWrapper && elements.winModalPoster) {
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

// Exported Functions

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
        details.push('One Spin Mode winner');
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
        const safeMovieUrl = getSafeHttpUrl(movie.uri);
        if (safeMovieUrl) {
            elements.winModalLink.href = safeMovieUrl;
            elements.winModalLink.classList.remove('hidden');
            elements.winModalLink.textContent = 'View on Letterboxd';
        } else {
            elements.winModalLink.classList.add('hidden');
            elements.winModalLink.removeAttribute('href');
        }
    }

    const metadataKey = buildMetadataKey(movie);
    currentModalMetadataKey = metadataKey;
    setWinnerModalLoadingState(movie, spinMode);
    populateWinnerModalMetadata(movie, metadataKey).then((metadata) => {
        if (!metadata) return;
        const posterUrl = metadata.poster && metadata.poster !== 'N/A' ? metadata.poster : '';

        // Calculate Odds
        const totalWeight = appState.movies.reduce((sum, m) => {
            return appState.selectedIds.has(m.id) ? sum + getStoredWeight(m) : sum;
        }, 0);
        const movieWeight = getStoredWeight(movie);
        const odds = Number.isFinite(context.selectionOdds)
            ? `${(context.selectionOdds * 100).toFixed(1)}%`
            : totalWeight > 0 ? ((movieWeight / totalWeight) * 100).toFixed(1) + '%' : 'N/A';

        if (!context.isRestore) {
            sendDiscordNotification(movie.name, posterUrl, {
                odds: odds,
                weight: movieWeight,
                link: movie.uri || null,
                spinMode: spinMode
            });
        }
    });

    elements.winModal.setAttribute('aria-hidden', 'false');
    const theater = document.querySelector('.spin-theater');
    if (theater) theater.inert = true;
    elements.winModal.removeAttribute('hidden');
    requestAnimationFrame(() => {
        elements.winModal.classList.add('show');
    });

    lastFocusedBeforeModal = document.activeElement;
    if (elements.winModalCloseBtn) {
        elements.winModalCloseBtn.focus();
    }

    // Radarr: show/hide the "Add to Radarr" button
    setupRadarrButton(movie);
    updateReshowWinnerButton();
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
        const closedTheater = closeSpinTheater({ restoreFocus });
        clearVhsReveal();
        currentModalMetadataKey = null;
        if (!closedTheater && restoreFocus && lastFocusedBeforeModal && typeof lastFocusedBeforeModal.focus === 'function') {
            lastFocusedBeforeModal.focus();
        }
        lastFocusedBeforeModal = null;
        modalHideTimeoutId = null;
        resetRadarrButton();
        if (tapeViewerController) {
            tapeViewerController.destroy();
            tapeViewerController = null;
        }
        if (elements.winModalTapeViewer) {
            elements.winModalTapeViewer.hidden = true;
        }
    }, 220);
}

export function updateReshowWinnerButton() {
    if (!elements.reshowWinnerBtn) return;
    const winnerId = getWinnerId();
    const movie = winnerId ? appState.movies.find(m => m.id === winnerId) : null;
    const isEnabled = movie && appState.selectedIds.has(movie.id);
    elements.reshowWinnerBtn.disabled = !isEnabled;
}

export function handleReshowWinner() {
    const winnerId = getWinnerId();
    if (!winnerId) return;
    const winningMovie = appState.movies.find(m => m.id === winnerId);
    if (winningMovie) {
        showWinnerPopup(winningMovie, { spinMode: appState.winnerSpinMode || getSpinMode(), isRestore: true });
    }
}

export function setupRadarrButton(movie) {
    const btn = elements.winModalRadarrBtn;
    const statusEl = elements.winModalRadarrStatus;

    if (!btn) return;

    // Clean up previous handler
    if (radarrButtonHandler) {
        btn.removeEventListener('click', radarrButtonHandler);
        radarrButtonHandler = null;
    }

    // Only show if Radarr is configured
    if (!isRadarrConfigured()) {
        btn.classList.add('hidden');
        if (statusEl) statusEl.hidden = true;
        return;
    }

    btn.classList.remove('hidden');
    btn.disabled = false;
    btn.textContent = 'Add to Radarr';
    if (statusEl) {
        statusEl.hidden = true;
        statusEl.textContent = '';
    }

    radarrButtonHandler = async () => {
        btn.disabled = true;
        btn.textContent = 'Adding…';
        if (statusEl) {
            statusEl.hidden = false;
            statusEl.textContent = 'Looking up movie in Radarr…';
            statusEl.className = 'status radarr-modal-status';
        }

        try {
            const result = await addMovieToRadarr(movie);
            if (statusEl) {
                statusEl.textContent = result.message;
                statusEl.className = result.success
                    ? 'status radarr-modal-status status--success'
                    : 'status radarr-modal-status status--error';
            }
            if (result.success) {
                btn.textContent = '✓ Added';
            } else {
                btn.textContent = 'Add to Radarr';
                btn.disabled = false;
            }
        } catch (error) {
            console.error('Radarr add failed:', error);
            if (statusEl) {
                statusEl.textContent = 'An unexpected error occurred.';
                statusEl.className = 'status radarr-modal-status status--error';
            }
            btn.textContent = 'Add to Radarr';
            btn.disabled = false;
        }
    };

    btn.addEventListener('click', radarrButtonHandler);
}

export function resetRadarrButton() {
    const btn = elements.winModalRadarrBtn;
    const statusEl = elements.winModalRadarrStatus;

    if (radarrButtonHandler && btn) {
        btn.removeEventListener('click', radarrButtonHandler);
        radarrButtonHandler = null;
    }

    if (btn) {
        btn.classList.add('hidden');
        btn.disabled = false;
        btn.textContent = 'Add to Radarr';
    }
    if (statusEl) {
        statusEl.hidden = true;
        statusEl.textContent = '';
    }
}

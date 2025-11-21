/**
 * Main entry point for the Letterboxd Watchlist Wheel
 */

import { loadState, appState, saveState } from './state.js';

import { initAudio } from './audio.js';
import { initWheel } from './wheel.js';
import {
    initUI,
    updateMovieList,
    showWinnerPopup,
    triggerConfetti,
    updateSpinButtonLabel,
    updateVetoButtonState,
    markMovieKnockedOut,
    markMovieChampion,
    updateKnockoutResultText,
    renderHistory,
    updateKnockoutRemainingBox,
    highlightKnockoutCandidate
} from './ui.js';
import { initImport } from './import.js';
import { debounce } from './utils.js';

document.addEventListener('DOMContentLoaded', () => {
    // Select all DOM elements
    const elements = {
        // Import Section
        letterboxdProxyForm: document.getElementById('letterboxd-proxy-form'),
        letterboxdProxyInput: document.getElementById('letterboxd-proxy-input'),
        letterboxdProxyStatus: document.getElementById('letterboxd-proxy-status'),
        csvInput: document.getElementById('csv-input'),
        importToggleBtn: document.getElementById('import-toggle'),
        importCard: document.getElementById('import-card'),
        importCardBody: document.getElementById('import-body'),

        // Main UI
        movieListEl: document.getElementById('movie-list'),
        spinButton: document.getElementById('spin-button'),
        vetoButton: document.getElementById('veto-button'),
        selectAllBtn: document.getElementById('select-all'),
        clearSelectionBtn: document.getElementById('clear-selection'),
        statusMessage: document.getElementById('status-message'),
        resultEl: document.getElementById('result'),
        confettiContainer: document.getElementById('confetti-container'),
        knockoutBox: document.getElementById('knockout-remaining'),
        knockoutList: document.getElementById('knockout-remaining-list'),

        // Selection Section
        selectionCard: document.getElementById('selection-card'),
        selectionBody: document.getElementById('selection-body'),
        selectionToggleBtn: document.getElementById('selection-toggle'),

        // Filters & Options
        searchInput: document.getElementById('movie-search'), // Check HTML
        advancedOptionsToggle: document.getElementById('advanced-options-toggle'),
        oneSpinToggle: document.getElementById('one-spin-toggle'),
        showCustomsToggle: document.getElementById('filter-show-customs'), // Check HTML
        customEntryForm: document.getElementById('custom-entry-form'),
        customEntryInput: document.getElementById('custom-entry-name'), // Check HTML

        // Winner Modal
        winModal: document.getElementById('win-modal'),
        winModalCloseBtn: document.getElementById('win-modal-close'),
        winModalTitle: document.getElementById('win-modal-title'),
        winModalDetails: document.getElementById('win-modal-details'),
        winModalPosterWrapper: document.getElementById('win-modal-poster-wrapper'),
        winModalPoster: document.getElementById('win-modal-poster'),
        winModalSynopsis: document.getElementById('win-modal-synopsis'),
        winModalRuntime: document.getElementById('win-modal-runtime'),
        winModalTrailer: document.getElementById('win-modal-trailer'),
        winModalLink: document.getElementById('win-modal-link'),

        // History Modal
        historyBtn: document.getElementById('history-btn'),
        historyModal: document.getElementById('history-modal'),
        historyModalCloseBtn: document.getElementById('history-modal-close'),
        historyListEl: document.getElementById('history-list'),
        historyEmptyMsg: document.getElementById('history-empty-msg'), // Check HTML
        clearHistoryBtn: document.getElementById('clear-history-btn'),

        // Audio / Wheel.FM
        wheelSoundToggleBtn: document.getElementById('wheel-sound-toggle'),
        wheelFmPlayBtn: document.getElementById('wheel-fm-play'),
        wheelFmNextBtn: document.getElementById('wheel-fm-next'),
        wheelFmPrevBtn: document.getElementById('wheel-fm-prev'),
        wheelFmStatus: document.getElementById('wheel-fm-status'),
        wheelFmTrackTitle: document.getElementById('wheel-fm-track-title'),
        wheelFmTrackArtist: document.getElementById('wheel-fm-track-artist'),
        wheelFmPlaylistSelect: document.getElementById('wheel-fm-playlist'),
        wheelFmPlaylistMeta: document.getElementById('wheel-fm-playlist-meta'),
        wheelFmVolumeSlider: document.getElementById('wheel-fm-volume'),
        wheelFmVolumeValue: document.getElementById('wheel-fm-volume-value'),
        wheelFmSeek: document.getElementById('wheel-fm-seek'),
        wheelFmCurrentTime: document.getElementById('wheel-fm-current-time'),
        wheelFmDuration: document.getElementById('wheel-fm-duration'),
        wheelFmAudio: document.getElementById('wheel-fm-audio'),
    };

    const canvas = document.getElementById('wheel');

    // Initialize Modules
    loadState();

    // Initialize Audio
    initAudio(elements);

    // Initialize Wheel with UI callbacks
    initWheel(canvas, {
        showWinnerPopup,
        triggerConfetti,
        updateSpinButtonLabel,
        updateVetoButtonState,
        markMovieKnockedOut,
        markMovieChampion,
        updateKnockoutResultText,
        updateKnockoutRemainingBox,
        highlightKnockoutCandidate
    });

    // Initialize UI
    initUI(elements);

    // Initialize Import
    initImport(elements);

    // Global Event Listeners for Search and Filters
    if (elements.searchInput) {
        elements.searchInput.addEventListener('input', debounce((event) => {
            const query = event.target.value;
            appState.filter.query = query;
            appState.filter.normalizedQuery = query.trim().toLowerCase();
            saveState();
            updateMovieList();
        }, 300));
        // Restore search value from state
        if (appState.filter.query) {
            elements.searchInput.value = appState.filter.query;
        }
    }

    if (elements.showCustomsToggle) {
        elements.showCustomsToggle.checked = appState.filter.showCustoms;
        elements.showCustomsToggle.addEventListener('change', (event) => {
            appState.filter.showCustoms = event.target.checked;
            saveState();
            updateMovieList();
        });
    }

    if (elements.advancedOptionsToggle) {
        // Toggle visibility function
        const toggleAdvancedOptions = (checked) => {
            const panel = document.getElementById('advanced-options-panel');
            const hint = document.getElementById('advanced-options-hint');
            if (panel) {
                panel.hidden = !checked;
            }
            if (hint) {
                hint.hidden = !checked;
            }
        };

        // Set initial state
        toggleAdvancedOptions(elements.advancedOptionsToggle.checked);

        elements.advancedOptionsToggle.addEventListener('change', (event) => {
            toggleAdvancedOptions(event.target.checked);
            updateMovieList();
            updateSpinButtonLabel();
        });
    }

    if (elements.oneSpinToggle) {
        elements.oneSpinToggle.addEventListener('change', () => {
            updateSpinButtonLabel();
        });
    }

    // Initial Render
    updateMovieList();
    renderHistory();
});

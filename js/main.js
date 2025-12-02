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
    markMovieKnockedOut,
    markMovieChampion,
    updateKnockoutResultText,
    renderHistory,
    updateKnockoutRemainingBox,
    refreshKnockoutBoxVisibility,
    highlightKnockoutCandidate,
    handleSliceSelection,
    updateDisplayedOdds
} from './ui.js';
import { initImport } from './import.js';
import { initBackup } from './backup.js';
import { debounce, getStoredWeight, clampWeight } from './utils.js';

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
        selectAllBtn: document.getElementById('select-all'),
        clearSelectionBtn: document.getElementById('clear-selection'),
        resetWeightsBtn: document.getElementById('reset-weights'),
        statusMessage: document.getElementById('status-message'),
        resultEl: document.getElementById('result'),
        confettiContainer: document.getElementById('confetti-container'),
        knockoutBox: document.getElementById('knockout-remaining'),
        knockoutList: document.getElementById('knockout-remaining-list'),
        wheelAside: document.getElementById('wheel-aside'),
        wheelLayout: document.getElementById('wheel-layout'),
        wheelStage: document.querySelector('.wheel-stage'),
        sliceEditor: document.getElementById('slice-editor'),
        sliceEditorBody: document.getElementById('slice-editor-body'),
        sliceEditorHint: document.getElementById('slice-editor-hint'),
        sliceEditorName: document.getElementById('slice-editor-name'),
        sliceEditorClearBtn: document.getElementById('slice-editor-clear'),
        sliceWeightLabel: document.getElementById('slice-weight-label'),
        sliceWeightHelp: document.getElementById('slice-weight-help'),
        sliceColorInput: document.getElementById('slice-color'),
        sliceColorSwatch: document.getElementById('slice-color-swatch'),
        sliceWeightInput: document.getElementById('slice-weight'),
        sliceWeightValue: document.getElementById('slice-weight-value'),
        sliceOddsLabelRisk: document.getElementById('slice-odds-label-risk'),
        sliceOddsValueRisk: document.getElementById('slice-odds-value-risk'),
        sliceOddsLabelWin: document.getElementById('slice-odds-label-win'),
        sliceOddsValueWin: document.getElementById('slice-odds-value-win'),

        // Selection Section
        selectionCard: document.getElementById('selection-card'),
        selectionBody: document.getElementById('selection-body'),
        selectionToggleBtn: document.getElementById('selection-toggle'),
        advancedCard: document.getElementById('advanced-card'),
        advancedBody: document.getElementById('advanced-body'),
        advancedCardToggleBtn: document.getElementById('advanced-card-toggle'),
        sortSelect: document.getElementById('movie-sort'),

        // Filters & Options
        searchInput: document.getElementById('movie-search'), // Check HTML
        oneSpinToggle: document.getElementById('one-spin-toggle'),
        randomBoostToggle: document.getElementById('random-boost-toggle'),
        finalistsAlwaysVisibleToggle: document.getElementById('finalists-always-visible'),
        finalistsHideToggle: document.getElementById('finalists-hide-box'),
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

        // Backup / Export
        backupExportBtn: document.getElementById('backup-export'),
        backupCopyBtn: document.getElementById('backup-copy'),
        backupImportBtn: document.getElementById('backup-import'),
        backupExportStatus: document.getElementById('backup-export-status'),
        backupImportStatus: document.getElementById('backup-import-status'),
        backupModal: document.getElementById('backup-modal'),
        backupModalCloseBtn: document.getElementById('backup-modal-close'),
        backupTextInput: document.getElementById('backup-text'),
        backupFileInput: document.getElementById('backup-file'),
        backupApplyWeightsBtn: document.getElementById('backup-apply'),
        backupRestoreBtn: document.getElementById('backup-restore'),
        backupImportHistoryToggle: document.getElementById('backup-import-history'),
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
        markMovieKnockedOut,
        markMovieChampion,
        updateKnockoutResultText,
        updateKnockoutRemainingBox,
        highlightKnockoutCandidate,
        handleSliceClick: handleSliceSelection,
        updateOdds: updateDisplayedOdds,
        refreshMovies: updateMovieList
    });

    // Initialize UI
    initUI(elements);

    // Initialize Import
    initImport(elements);

    const syncSpinModeToggles = () => {
        const { oneSpinToggle, randomBoostToggle, advancedBody } = elements;
        if (!oneSpinToggle || !randomBoostToggle) {
            return;
        }

        const advancedEnabled = advancedBody ? !advancedBody.hidden : true;

        if (randomBoostToggle.checked) {
            oneSpinToggle.checked = false;
            oneSpinToggle.disabled = true;
        } else {
            oneSpinToggle.disabled = false;
        }

        if (oneSpinToggle.checked) {
            randomBoostToggle.checked = false;
            randomBoostToggle.disabled = true;
        } else {
            randomBoostToggle.disabled = false;
        }
    };

    const randomBoostWeights = new Map();

    const handleSpinModeChange = () => {
        syncSpinModeToggles();
        if (elements.randomBoostToggle && elements.randomBoostToggle.checked) {
            randomBoostWeights.clear();
            appState.movies.forEach((movie) => {
                if (appState.selectedIds.has(movie.id)) {
                    randomBoostWeights.set(movie.id, getStoredWeight(movie));
                    movie.weight = 1;
                }
            });
        } else {
            if (randomBoostWeights.size) {
                appState.movies.forEach((movie) => {
                    if (randomBoostWeights.has(movie.id)) {
                        const baseline = clampWeight(randomBoostWeights.get(movie.id));
                        const current = clampWeight(getStoredWeight(movie));
                        const restored = Math.max(current, baseline);
                        movie.weight = restored;
                    }
                });
            }
            randomBoostWeights.clear();
        }
        updateMovieList();
        updateSpinButtonLabel();
    };

    const syncFinalistsToggles = () => {
        const hideBox = Boolean(appState.preferences?.hideFinalistsBox);
        const showFromStart = Boolean(appState.preferences?.showFinalistsFromStart);

        if (elements.finalistsHideToggle) {
            elements.finalistsHideToggle.checked = hideBox;
        }
        if (elements.finalistsAlwaysVisibleToggle) {
            elements.finalistsAlwaysVisibleToggle.checked = showFromStart;
            elements.finalistsAlwaysVisibleToggle.disabled = hideBox;
        }
    };

    const handleFinalistsPreferenceChange = () => {
        syncFinalistsToggles();
        saveState();
        refreshKnockoutBoxVisibility();
    };

    initBackup(elements, {
        refreshMovies: updateMovieList,
        renderHistory,
        refreshPreferences: syncFinalistsToggles,
        resetKnockoutUI: refreshKnockoutBoxVisibility
    });

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
    if (elements.sortSelect) {
        elements.sortSelect.value = appState.filter.sortMode || 'original';
        elements.sortSelect.addEventListener('change', (event) => {
            appState.filter.sortMode = event.target.value || 'original';
            saveState();
            updateMovieList();
        });
    }

    if (elements.finalistsAlwaysVisibleToggle) {
        elements.finalistsAlwaysVisibleToggle.addEventListener('change', (event) => {
            appState.preferences.showFinalistsFromStart = event.target.checked;
            handleFinalistsPreferenceChange();
        });
    }

    if (elements.finalistsHideToggle) {
        elements.finalistsHideToggle.addEventListener('change', (event) => {
            appState.preferences.hideFinalistsBox = event.target.checked;
            handleFinalistsPreferenceChange();
        });
    }

    syncFinalistsToggles();

    if (elements.oneSpinToggle) {
        elements.oneSpinToggle.addEventListener('change', handleSpinModeChange);
    }

    if (elements.randomBoostToggle) {
        elements.randomBoostToggle.addEventListener('change', handleSpinModeChange);
    }

    syncSpinModeToggles();

    // Example URL Click Handler
    const exampleUrlEl = document.getElementById('example-url');
    if (exampleUrlEl) {
        exampleUrlEl.addEventListener('click', () => {
            if (elements.letterboxdProxyInput) {
                elements.letterboxdProxyInput.value = exampleUrlEl.textContent;
                elements.letterboxdProxyInput.focus();
                // Optional: trigger input event if there's validation attached to it
                elements.letterboxdProxyInput.dispatchEvent(new Event('input'));
            }
        });
    }

    // Initial Render
    updateMovieList();
    renderHistory();
});

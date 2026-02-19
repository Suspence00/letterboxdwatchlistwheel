/**
 * Main entry point for the Letterboxd Watchlist Wheel
 */

import { loadState, appState, saveState, createWorkspace, switchWorkspace, renameWorkspace, deleteWorkspace } from './state.js';

import { initAudio } from './audio.js';
import { initWheel, spinWheel } from './wheel.js';
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
    updateDisplayedOdds,
    promptForInput
} from './ui.js';
import { initImport } from './import.js';
import { initBackup } from './backup.js';
import { initDiscord } from './discord.js';
import {
    basePalette,
    clampWeight,
    debounce,
    getMovieOriginalIndex,
    getPaletteColorForIndex,
    getStoredWeight,
    hanukkahPalette,
    holidayPalette,
    cyberPalette,
    modernPalette,
    alaskaPalette,
    chineseNewYearPalette
} from './utils.js';

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
        movieListWrapper: document.querySelector('.movie-list-wrapper'),
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
        sortSelect: document.getElementById('movie-sort'),

        // Settings Modal
        settingsModal: document.getElementById('settings-modal'),
        settingsOpenBtn: document.getElementById('settings-open'),
        settingsCloseBtn: document.getElementById('settings-modal-close'),
        settingsTabs: document.querySelectorAll('.settings-tab-btn'),
        settingsPanels: document.querySelectorAll('.settings-panel'),

        // Discord
        discordWebhookInput: document.getElementById('discord-webhook-url'),
        discordTestBtn: document.getElementById('discord-test-btn'),

        // Filters & Options
        searchInput: document.getElementById('movie-search'),
        randomBoostBtn: document.getElementById('random-boost-btn'),
        spinModeRadios: document.querySelectorAll('input[name="spin-mode"]'),
        finalistsAlwaysVisibleToggle: document.getElementById('finalists-always-visible'),
        finalistsHideToggle: document.getElementById('finalists-hide-box'),
        showCustomsToggle: document.getElementById('filter-show-customs'),
        themeSelect: document.getElementById('theme-select'),
        customEntryForm: document.getElementById('custom-entry-form'),
        customEntryInput: document.getElementById('custom-entry-name'),
        openCustomModalBtn: document.getElementById('open-custom-modal'),
        customEntryModal: document.getElementById('custom-entry-modal'),
        customModalCloseBtn: document.getElementById('custom-modal-close'),

        // Boost Station
        boostModal: document.getElementById('boost-modal'),
        boostModalCloseBtn: document.getElementById('boost-modal-close'),
        boostBoosterName: document.getElementById('boost-booster-name'),
        boostMovieFilter: document.getElementById('boost-movie-filter'),
        boostMovieSelect: document.getElementById('boost-movie-select'),
        btnBoostSpecific: document.getElementById('btn-boost-specific'),
        btnBoostRemove: document.getElementById('btn-boost-remove'),
        btnBoostRandom: document.getElementById('btn-boost-random'),

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
        wheelFmChannelSelect: document.getElementById('wheel-fm-channel'),
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
        backupRestoreBtn: document.getElementById('backup-restore'),
        backupImportHistoryToggle: document.getElementById('backup-import-history'),

        // Workspaces
        workspaceSelect: document.getElementById('workspace-select'),
        createBoardForm: document.getElementById('create-board-form'),
        newBoardName: document.getElementById('new-board-name'),
        boardsList: document.getElementById('boards-list'),
        tabBtnBoards: document.getElementById('tab-btn-boards'),
        tabBtnAdvanced: document.getElementById('tab-btn-advanced'),

        // Verification
        verifyFairnessBtn: document.getElementById('verify-fairness-btn'),
        verifyModal: document.getElementById('verify-modal'),
        verifyTableBody: document.querySelector('#verify-table tbody'),
        verifyCloseBtn: document.getElementById('verify-close'),
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

    // Initialize Discord
    initDiscord(elements);

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

    const normalizeTheme = (value) => {
        if (value === 'holiday') return 'holiday';
        if (value === 'hanukkah') return 'hanukkah';
        if (value === 'cyber') return 'cyber';
        if (value === 'modern') return 'modern';
        if (value === 'alaska') return 'alaska';
        if (value === 'cny') return 'cny';
        return 'default';
    };
    const getPaletteForTheme = (theme) => {
        if (theme === 'holiday') return holidayPalette;
        if (theme === 'hanukkah') return hanukkahPalette;
        if (theme === 'cyber') return cyberPalette;
        if (theme === 'modern') return modernPalette;
        if (theme === 'alaska') return alaskaPalette;
        if (theme === 'cny') return chineseNewYearPalette;
        return basePalette;
    };

    const applyThemePalette = (previousTheme, nextTheme, options = {}) => {
        const { force = false } = options;
        if (!force && previousTheme === nextTheme) return;

        const overrides = appState.preferences.themeColorOverrides || {};
        const nextPalette = getPaletteForTheme(nextTheme);
        const allowDynamic = nextTheme === 'default';

        if (nextTheme === 'default') {
            appState.movies.forEach((movie, index) => {
                const originalIndex = getMovieOriginalIndex(movie, appState.movies);
                const paletteIndex = Number.isFinite(originalIndex) && originalIndex >= 0 ? originalIndex : index;
                const override = typeof overrides[movie.id] === 'string' ? overrides[movie.id].trim() : '';
                if (override) {
                    movie.color = override;
                    return;
                }
                movie.color = getPaletteColorForIndex(paletteIndex, basePalette, { allowDynamic: true });
            });
            appState.preferences.themeColorOverrides = {};
            return;
        }

        appState.movies.forEach((movie, index) => {
            const originalIndex = getMovieOriginalIndex(movie, appState.movies);
            const paletteIndex = Number.isFinite(originalIndex) && originalIndex >= 0 ? originalIndex : index;
            const existingOverride = typeof overrides[movie.id] === 'string' ? overrides[movie.id].trim() : '';
            if (!existingOverride) {
                overrides[movie.id] = movie.color || getPaletteColorForIndex(paletteIndex, basePalette, { allowDynamic: true });
            }
            movie.color = getPaletteColorForIndex(paletteIndex, nextPalette, { allowDynamic });
        });

        appState.preferences.themeColorOverrides = overrides;
    };

    const applyTheme = (theme, options = {}) => {
        const { force = false } = options;
        const safeTheme = normalizeTheme(theme);
        const previousTheme = appState.preferences.theme || 'default';
        applyThemePalette(previousTheme, safeTheme, { force });
        document.body.classList.toggle('theme-holiday', safeTheme === 'holiday');
        document.body.classList.toggle('theme-hanukkah', safeTheme === 'hanukkah');
        document.body.classList.toggle('theme-cyber', safeTheme === 'cyber');
        document.body.classList.toggle('theme-modern', safeTheme === 'modern');
        document.body.classList.toggle('theme-alaska', safeTheme === 'alaska');
        document.body.classList.toggle('theme-cny', safeTheme === 'cny');
        if (elements.themeSelect) {
            elements.themeSelect.value = safeTheme;
        }
        appState.preferences.theme = safeTheme;
    };



    const initThemeSelector = () => {
        applyTheme(appState.preferences?.theme, { force: true });

        if (elements.themeSelect) {
            elements.themeSelect.addEventListener('change', (event) => {
                const nextTheme = normalizeTheme(event.target.value);
                applyTheme(nextTheme);
                saveState();
                updateMovieList();
            });
        }
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
    initThemeSelector();

    syncFinalistsToggles();
    initThemeSelector();

    if (elements.spinModeRadios) {
        elements.spinModeRadios.forEach(radio => {
            radio.addEventListener('change', () => {
                updateMovieList();
                updateSpinButtonLabel();
            });
        });
    }



    // Custom Entry Modal Logic
    if (elements.openCustomModalBtn && elements.customEntryModal) {
        elements.openCustomModalBtn.addEventListener('click', () => {
            elements.customEntryModal.hidden = false;
            // Add 'show' class for animation if needed, similar to other modals
            requestAnimationFrame(() => elements.customEntryModal.classList.add('show'));
            if (elements.customEntryInput) {
                elements.customEntryInput.focus();
            }
        });
    }

    const closeCustomModal = () => {
        if (!elements.customEntryModal) return;
        elements.customEntryModal.classList.remove('show');
        setTimeout(() => {
            elements.customEntryModal.hidden = true;
        }, 200);
    };

    if (elements.customModalCloseBtn) {
        elements.customModalCloseBtn.addEventListener('click', closeCustomModal);
    }

    if (elements.customEntryModal) {
        elements.customEntryModal.addEventListener('click', (event) => {
            if (event.target === elements.customEntryModal) {
                closeCustomModal();
            }
        });
        document.addEventListener('keydown', (event) => {
            if (event.key === 'Escape' && !elements.customEntryModal.hidden) {
                closeCustomModal();
            }
        });
    }

    // Intercept form submission to close modal (UI logic handles the adding)
    if (elements.customEntryForm) {
        elements.customEntryForm.addEventListener('submit', () => {
            if (elements.customEntryInput && elements.customEntryInput.value.trim()) {
                closeCustomModal();
                // Clear input is handled by UI likely, but safe to do here if needed
                // elements.customEntryInput.value = ''; 
            }
        });
    }

    // Settings Modal Logic
    if (elements.settingsOpenBtn && elements.settingsModal) {
        elements.settingsOpenBtn.addEventListener('click', () => {
            elements.settingsModal.hidden = false;
            // Also ensure correct tab is active (default to first if none)
            // Logic to animate or handle focus can go here
        });
    }

    if (elements.settingsCloseBtn && elements.settingsModal) {
        elements.settingsCloseBtn.addEventListener('click', () => {
            elements.settingsModal.hidden = true;
        });
    }

    // Close on backdrop click
    if (elements.settingsModal) {
        elements.settingsModal.addEventListener('click', (event) => {
            if (event.target === elements.settingsModal) {
                elements.settingsModal.hidden = true;
            }
        });
    }

    if (elements.settingsTabs) {
        elements.settingsTabs.forEach(tab => {
            tab.addEventListener('click', () => {
                const targetId = tab.getAttribute('aria-controls');

                // Update Tabs
                elements.settingsTabs.forEach(t => t.setAttribute('aria-selected', 'false'));
                tab.setAttribute('aria-selected', 'true');

                // Update Panels
                if (elements.settingsPanels) {
                    elements.settingsPanels.forEach(panel => {
                        panel.hidden = panel.id !== targetId;
                    });
                }
            });
        });
    }

    // Initial Render
    updateMovieList();
    renderHistory();

    // Deep Linking: Auto-import from URL parameter
    const urlParams = new URLSearchParams(window.location.search);
    const listParam = urlParams.get('list');
    if (listParam && elements.letterboxdProxyInput && elements.letterboxdProxyForm) {
        console.log('Deep link found:', listParam);
        elements.letterboxdProxyInput.value = listParam;

        // Short delay to ensure UI init is complete before triggering fetch
        setTimeout(() => {
            elements.letterboxdProxyForm.dispatchEvent(new Event('submit'));
        }, 500);
    }
});

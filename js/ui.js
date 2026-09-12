/**
 * UI management orchestrator and facade for Letterboxd Watchlist Wheel.
 * Preserves the public UI API while delegating feature behavior to js/ui/.
 */

import {
    appState,
    saveState
} from './state.js';
import {
    decodeHtmlEntities,
    getDefaultColorForIndex,
    debounce
} from './utils.js';
import {
    spinWheel,
    getIsSpinning,
    getIsLastStandingInProgress,
    setWeightMode,
    invalidateWheelCache
} from './wheel.js';

// Sub-module Imports
import {
    initKnockoutUI,
    handleSpinPrep,
    resetKnockoutLaunchEffects,
    knockoutLaunchPrimed,
    knockoutLaunchEngaged
} from './ui/knockout-ui.js';
import {
    initWinnerModal,
    closeWinnerPopup,
    handleReshowWinner
} from './ui/winner-modal.js';
import { initBoostStation } from './ui/boost-station.js';
import {
    initHistoryModal,
    renderHistory
} from './ui/history-modal.js';
import {
    initSliceEditor,
    resetSliceEditor
} from './ui/slice-editor.js';
import { initBoardsUI } from './ui/boards-ui.js';
import { initMovieList, updateMovieList, getFilteredSelectedMovies } from './ui/movie-list.js';

// Re-export public API from submodules
export { updateMovieList, getFilteredMovies, getFilteredSelectedMovies } from './ui/movie-list.js';
export { triggerConfetti, getConfettiPalette } from './ui/confetti.js';
export { showConfirmModal, promptForInput, showVerificationResults } from './ui/modals.js';
export { renderWorkspaceSwitcher, renderBoardsList, initBoardsUI } from './ui/boards-ui.js';
export { initThemePicker } from './ui/theme-picker.js';
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

    initMovieList(domElements, { getSpinMode, updateSpinButtonLabel });
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

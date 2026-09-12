/**
 * Spin History UI management
 */

import { appState, removeHistoryEntry, clearHistory } from '../state.js';

let elements = {};

export function initHistoryModal(domElements) {
    Object.assign(elements, domElements);
    const clearHistoryBtn = elements.clearHistoryBtn || document.getElementById('clear-history-btn');
    if (clearHistoryBtn) {
        clearHistoryBtn.addEventListener('click', () => {
            if (confirm('Clear all spin history for this board? This cannot be undone.')) {
                clearHistory();
                renderHistory();
            }
        });
    }
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

function getModeLabel(mode) {
    if (mode === 'random-boost') return 'Random Boost';
    if (mode === 'one-spin') return 'One Spin';
    if (mode === 'knockout') return 'Knockout';
    return '';
}

export function renderHistory() {
    const historyListEl = elements.historyListEl || document.getElementById('history-list');
    const historyEmptyMsg = elements.historyEmptyMsg || document.getElementById('history-empty-msg');
    if (!historyListEl) return;
    historyListEl.innerHTML = '';
    if (!appState.history || !appState.history.length) {
        if (historyEmptyMsg) historyEmptyMsg.hidden = false;
        return;
    }
    if (historyEmptyMsg) historyEmptyMsg.hidden = true;

    appState.history.forEach(entry => {
        const li = document.createElement('li');
        li.className = 'history-item';
        const modeLabel = getModeLabel(entry.mode);

        const date = new Date(entry.timestamp).toLocaleDateString(undefined, {
            month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
        });

        const info = document.createElement('div');
        info.className = 'history-item__info';

        const name = document.createElement('span');
        name.className = 'history-item__name';
        name.textContent = `${entry.name || 'Untitled entry'} ${entry.year ? `(${entry.year})` : ''}`.trim();
        info.appendChild(name);

        if (modeLabel) {
            const mode = document.createElement('span');
            mode.className = 'history-item__mode';
            mode.textContent = modeLabel;
            info.appendChild(mode);
        }

        const dateEl = document.createElement('span');
        dateEl.className = 'history-item__date';
        dateEl.textContent = date;
        info.appendChild(dateEl);

        const actions = document.createElement('div');
        actions.className = 'history-item__actions';
        const safeUri = getSafeHttpUrl(entry.uri);
        if (safeUri) {
            const viewLink = document.createElement('a');
            viewLink.href = safeUri;
            viewLink.target = '_blank';
            viewLink.className = 'btn btn--small';
            viewLink.rel = 'noopener noreferrer';
            viewLink.textContent = 'View';
            actions.appendChild(viewLink);
        }

        const removeBtn = document.createElement('button');
        removeBtn.type = 'button';
        removeBtn.className = 'btn btn--small btn--danger remove-history-btn';
        removeBtn.setAttribute('aria-label', 'Remove from history');
        removeBtn.textContent = '×';
        removeBtn.addEventListener('click', () => {
            if (confirm(`Remove “${entry.name}” from history?`)) {
                removeHistoryEntry(entry.id);
                renderHistory();
            }
        });
        actions.appendChild(removeBtn);

        li.appendChild(info);
        li.appendChild(actions);

        historyListEl.appendChild(li);
    });
}

/**
 * Workspace / Boards Management UI
 */

import {
    appState,
    switchWorkspace,
    createWorkspace,
    deleteWorkspace,
    renameWorkspace,
    saveState
} from '../state.js';
import {
    promptForInput,
    showConfirmModal
} from './modals.js';

export function escapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

export function initBoardsUI(domElements = {}, callbacks = {}) {
    const workspaceSelect = domElements.workspaceSelect || document.getElementById('workspace-select');
    const createBoardForm = domElements.createBoardForm || document.getElementById('create-board-form');
    const newBoardName = domElements.newBoardName || document.getElementById('new-board-name');
    const tabBtnBoards = domElements.tabBtnBoards || document.getElementById('tab-btn-boards');

    if (tabBtnBoards) {
        tabBtnBoards.addEventListener('click', () => {
            renderWorkspaceSwitcher();
            renderBoardsList();
        });
    }

    if (workspaceSelect) {
        workspaceSelect.addEventListener('change', (event) => {
            const val = event.target.value;
            if (val && switchWorkspace(val)) {
                renderWorkspaceSwitcher();
                renderBoardsList();
                if (callbacks.onBoardSwitch) {
                    callbacks.onBoardSwitch(val);
                }
            }
        });
    }

    if (createBoardForm) {
        createBoardForm.addEventListener('submit', (event) => {
            event.preventDefault();
            const name = newBoardName ? newBoardName.value.trim() : '';
            if (name) {
                const newId = createWorkspace(name);
                switchWorkspace(newId);
                if (newBoardName) newBoardName.value = '';
                renderWorkspaceSwitcher();
                renderBoardsList();
                if (callbacks.onBoardSwitch) {
                    callbacks.onBoardSwitch(newId);
                }
            }
        });
    }
}

export function renderWorkspaceSwitcher(workspaceSelect = (typeof document !== 'undefined' ? document.getElementById('workspace-select') : null)) {
    const select = workspaceSelect || (typeof document !== 'undefined' ? document.getElementById('workspace-select') : null);
    if (!select) return;

    select.innerHTML = '';

    appState.workspaces.forEach(ws => {
        const option = document.createElement('option');
        option.value = ws.id;
        option.textContent = ws.name;
        if (ws.id === appState.activeWorkspaceId) {
            option.selected = true;
        }
        select.appendChild(option);
    });
}

export function renderBoardsList(boardsList = (typeof document !== 'undefined' ? document.getElementById('boards-list') : null)) {
    const list = boardsList || (typeof document !== 'undefined' ? document.getElementById('boards-list') : null);
    if (!list) return;
    list.innerHTML = '';

    appState.workspaces.forEach(ws => {
        const li = document.createElement('li');
        li.className = 'board-item';
        if (ws.id === appState.activeWorkspaceId) {
            li.classList.add('active');
        }

        const info = document.createElement('div');
        info.className = 'board-item__info';

        const name = document.createElement('span');
        name.className = 'board-item__name';
        name.textContent = ws.name;

        const meta = document.createElement('span');
        meta.className = 'board-item__meta';
        const date = new Date(ws.lastModified || Date.now()).toLocaleDateString();
        let metaText = `Last used: ${date}`;
        if (ws.letterboxdUrl) {
            let urlDisplay = ws.letterboxdUrl;
            try {
                const parts = ws.letterboxdUrl.replace(/^https?:\/\/(www\.)?letterboxd\.com\//i, '').split('/');
                if (parts.length > 0 && parts[0]) {
                    urlDisplay = parts.filter(Boolean).join('/');
                }
            } catch (e) {}
            metaText += ` • 🔗 Tied to: ${urlDisplay}`;
        }
        meta.textContent = metaText;

        info.appendChild(name);
        info.appendChild(meta);

        const actions = document.createElement('div');
        actions.className = 'board-item__actions';

        const renameBtn = document.createElement('button');
        renameBtn.type = 'button';
        renameBtn.className = 'btn';
        renameBtn.textContent = 'Rename';
        renameBtn.addEventListener('click', () => {
            promptForInput('Rename Board', 'New Name', (newName) => {
                if (renameWorkspace(ws.id, newName)) {
                    renderWorkspaceSwitcher();
                    renderBoardsList();
                }
            });
        });

        const deleteBtn = document.createElement('button');
        deleteBtn.type = 'button';
        deleteBtn.className = 'btn danger';
        deleteBtn.textContent = 'Delete';
        if (ws.id === appState.activeWorkspaceId || appState.workspaces.length <= 1) {
            deleteBtn.disabled = true;
            deleteBtn.title = ws.id === appState.activeWorkspaceId ? 'Cannot delete active board' : 'Cannot delete last board';
        }
        deleteBtn.addEventListener('click', () => {
            if (confirm(`Delete board "${ws.name}"? This cannot be undone.`)) {
                if (deleteWorkspace(ws.id)) {
                    renderWorkspaceSwitcher();
                    renderBoardsList();
                }
            }
        });

        actions.appendChild(renameBtn);
        actions.appendChild(deleteBtn);

        li.appendChild(info);
        li.appendChild(actions);
        list.appendChild(li);
    });
}
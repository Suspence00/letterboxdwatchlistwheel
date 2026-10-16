/**
 * Saved wheels UI. Workspace IDs and storage remain compatible with existing saves.
 */

import {
    appState,
    switchWorkspace,
    createWorkspace,
    deleteWorkspace,
    renameWorkspace
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
    const quickSelect = document.getElementById('saved-wheel-select');
    const search = document.getElementById('saved-wheels-search');

    const refresh = () => {
        renderWorkspaceSwitcher(workspaceSelect);
        renderBoardsList(domElements.boardsList);
    };

    window.addEventListener('letterboxd:workspacechange', () => {
        refresh();
        callbacks.onBoardSwitch?.(appState.activeWorkspaceId);
    });
    search?.addEventListener('input', () => renderBoardsList(domElements.boardsList));
    document.getElementById('saved-wheels-new')?.addEventListener('click', () => {
        promptForInput('New wheel', 'Wheel name (e.g. Horror night)', (name) => {
            const newId = createWorkspace(name);
            switchWorkspace(newId);
        });
    });
    document.getElementById('saved-wheels-manage')?.addEventListener('click', () => {
        document.getElementById('settings-open')?.click();
        tabBtnBoards?.click();
        search?.focus();
    });

    renderWorkspaceSwitcher(workspaceSelect);
    renderBoardsList(domElements.boardsList);

    if (tabBtnBoards) {
        tabBtnBoards.addEventListener('click', () => {
            renderWorkspaceSwitcher();
            renderBoardsList();
        });
    }

    [workspaceSelect, quickSelect].filter(Boolean).forEach(select => {
        select.addEventListener('change', () => {
            switchWorkspace(select.value);
        });
    });

    if (createBoardForm) {
        createBoardForm.addEventListener('submit', (event) => {
            event.preventDefault();
            const name = newBoardName ? newBoardName.value.trim() : '';
            if (name) {
                if (search) search.value = '';
                const newId = createWorkspace(name);
                switchWorkspace(newId);
                if (newBoardName) newBoardName.value = '';
                renderWorkspaceSwitcher();
                renderBoardsList();
                listCurrentWheelButton()?.focus();
            }
        });
    }
}

function listCurrentWheelButton() {
    return document.querySelector('.board-item.active .board-item__open');
}

export function renderWorkspaceSwitcher(workspaceSelect = (typeof document !== 'undefined' ? document.getElementById('workspace-select') : null)) {
    if (typeof document === 'undefined') return;
    const select = workspaceSelect || (typeof document !== 'undefined' ? document.getElementById('workspace-select') : null);
    [select, document.getElementById('saved-wheel-select')].filter(Boolean).forEach(picker => {
        picker.replaceChildren();
        appState.workspaces.forEach(ws => {
            const option = document.createElement('option');
            option.value = ws.id;
            option.textContent = ws.name;
            option.selected = ws.id === appState.activeWorkspaceId;
            picker.appendChild(option);
        });
    });
}

export function renderBoardsList(boardsList = (typeof document !== 'undefined' ? document.getElementById('boards-list') : null)) {
    const list = boardsList || (typeof document !== 'undefined' ? document.getElementById('boards-list') : null);
    if (!list) return;
    list.innerHTML = '';

    const query = document.getElementById('saved-wheels-search')?.value.trim().toLocaleLowerCase() || '';
    const wheels = appState.workspaces.filter(ws =>
        `${ws.name} ${ws.letterboxdUrl || ''}`.toLocaleLowerCase().includes(query));
    const status = document.getElementById('saved-wheels-status');
    if (status) status.textContent = wheels.length
        ? `${wheels.length} saved ${wheels.length === 1 ? 'wheel' : 'wheels'}${query ? ' found' : ''}`
        : 'No wheels found. Try another name or clear your search.';

    wheels.forEach(ws => {
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
        let metaText = `Updated ${date}`;
        if (ws.letterboxdUrl) {
            let urlDisplay = ws.letterboxdUrl;
            try {
                const parts = ws.letterboxdUrl.replace(/^https?:\/\/(www\.)?letterboxd\.com\//i, '').split('/');
                if (parts.length > 0 && parts[0]) {
                    urlDisplay = parts.filter(Boolean).join('/');
                }
            } catch (e) {}
            metaText += ` • Letterboxd: ${urlDisplay}`;
        }
        meta.textContent = metaText;

        info.appendChild(name);
        info.appendChild(meta);

        const actions = document.createElement('div');
        actions.className = 'board-item__actions';

        const openBtn = document.createElement('button');
        openBtn.type = 'button';
        openBtn.className = 'btn board-item__open';
        const isCurrent = ws.id === appState.activeWorkspaceId;
        openBtn.textContent = isCurrent ? 'Current wheel' : 'Open wheel';
        openBtn.setAttribute('aria-label', `${isCurrent ? 'Current wheel:' : 'Open wheel:'} ${ws.name}`);
        if (isCurrent) openBtn.setAttribute('aria-current', 'true');
        openBtn.addEventListener('click', () => {
            if (switchWorkspace(ws.id)) listCurrentWheelButton()?.focus();
        });

        const renameBtn = document.createElement('button');
        renameBtn.type = 'button';
        renameBtn.className = 'btn';
        renameBtn.textContent = 'Rename';
        renameBtn.addEventListener('click', () => {
            promptForInput('Rename wheel', 'Wheel name', (newName) => {
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
            deleteBtn.title = ws.id === appState.activeWorkspaceId ? 'Open another wheel before deleting this one' : 'Keep at least one saved wheel';
        }
        deleteBtn.addEventListener('click', () => {
            showConfirmModal({
                title: 'Delete saved wheel',
                message: `Delete "${escapeHtml(ws.name)}" and its movies, boosts, and spin history? This cannot be undone.`,
                confirmText: 'Delete',
                onConfirm: () => {
                    if (deleteWorkspace(ws.id)) {
                        renderWorkspaceSwitcher();
                        renderBoardsList();
                    }
                }
            });
        });

        actions.appendChild(openBtn);
        actions.appendChild(renameBtn);
        actions.appendChild(deleteBtn);

        li.appendChild(info);
        li.appendChild(actions);
        list.appendChild(li);
    });
}

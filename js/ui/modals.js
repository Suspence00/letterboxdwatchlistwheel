/**
 * Dialog and modal components
 */

import { runFairnessAudit } from '../verify.js';

export function initVerificationModal({ verifyFairnessBtn, verifyModal, verifyCloseBtn }) {
    if (!verifyFairnessBtn || !verifyModal || !verifyCloseBtn) return;

    verifyFairnessBtn.addEventListener('click', () => {
        verifyFairnessBtn.focus();
        showVerificationResults(runFairnessAudit());
    });

    verifyCloseBtn.addEventListener('click', () => verifyModal.close());
    verifyModal.addEventListener('click', (event) => {
        if (event.target === verifyModal) verifyModal.close();
    });
}

/**
 * Shows the custom confirmation modal for Board Conflict
 * @param {Object} options
 */
export function showConfirmModal({ title, message, confirmText, secondaryText, cancelText, onConfirm, onSecondary, onCancel }) {
    const modal = document.getElementById('confirm-modal');
    const titleEl = document.getElementById('confirm-modal-title');
    const messageEl = document.getElementById('confirm-modal-message');
    const confirmBtn = document.getElementById('confirm-modal-confirm');
    const secondaryBtn = document.getElementById('confirm-modal-secondary');
    const cancelBtn = document.getElementById('confirm-modal-cancel');
    const closeBtn = document.getElementById('confirm-modal-close');

    if (!modal) return;

    titleEl.textContent = title || 'Confirm';
    messageEl.innerHTML = message || '';
    confirmBtn.textContent = confirmText || 'Confirm';

    if (secondaryText && secondaryBtn) {
        secondaryBtn.textContent = secondaryText;
        secondaryBtn.hidden = false;
    } else if (secondaryBtn) {
        secondaryBtn.hidden = true;
    }

    cancelBtn.textContent = cancelText || 'Cancel';

    const listeners = new AbortController();
    const options = { signal: listeners.signal };
    const finish = (callback) => {
        listeners.abort();
        modal.close();
        callback?.();
    };

    confirmBtn.addEventListener('click', () => finish(onConfirm), options);
    secondaryBtn?.addEventListener('click', () => finish(onSecondary), options);
    cancelBtn.addEventListener('click', () => finish(onCancel), options);
    closeBtn.addEventListener('click', () => finish(onCancel), options);
    modal.addEventListener('cancel', (event) => {
        event.preventDefault();
        finish(onCancel);
    }, options);
    modal.showModal();
}

export function promptForInput(title, label, callback) {
    const modal = document.getElementById('input-modal');
    const form = document.getElementById('input-modal-form');
    const input = document.getElementById('input-modal-field');
    const titleEl = document.getElementById('input-modal-title');
    const labelEl = document.getElementById('input-modal-label');
    const closeBtn = document.getElementById('input-modal-close');

    if (!modal || !form || !input) return;

    titleEl.textContent = title;
    labelEl.textContent = label;
    input.value = '';

    const listeners = new AbortController();
    const options = { signal: listeners.signal };
    form.addEventListener('submit', (event) => {
        event.preventDefault();
        const value = input.value.trim();
        if (!value) return;
        modal.close();
        callback(value);
    }, options);
    closeBtn.addEventListener('click', () => modal.close(), options);
    modal.addEventListener('close', () => {
        listeners.abort();
        input.value = '';
    }, { once: true });
    modal.showModal();
}

export function showVerificationResults(auditData) {
    if (auditData.error) {
        alert(auditData.error);
        return;
    }

    const modal = document.getElementById('verify-modal');
    const tableBody = document.querySelector('#verify-table tbody');
    const description = document.getElementById('verify-description');

    if (!tableBody) {
        console.error('Verify table body not found in DOM');
        return;
    }

    tableBody.innerHTML = '';
    if (description) {
        const trial = auditData.mode === 'knockout' ? 'Knockout tournaments' : 'single spins';
        description.textContent = `Simulated ${auditData.iterations.toLocaleString()} ${trial} with ${auditData.candidatesCount.toLocaleString()} eligible movies.`;
    }

    // Summary Stats
    let goodCount = 0;
    let okCount = 0;
    let badCount = 0;

    auditData.results.forEach(row => {
        const diffPct = Math.abs(row.diff * 100);
        if (diffPct < 0.5) goodCount++;
        else if (diffPct < 1.0) okCount++;
        else badCount++;
    });

    const summaryEl = document.getElementById('verify-summary');
    if (summaryEl) {
        let statusMsg = '';
        if (badCount === 0 && okCount === 0) {
            statusMsg = `<strong>Perfect!</strong> All ${auditData.results.length} items are within optimal variance.`;
        } else if (badCount === 0) {
            statusMsg = `<strong>Good.</strong> ${goodCount} perfect, ${okCount} with slight deviation.`;
        } else {
            statusMsg = `<strong>Review Needed.</strong> ${badCount} items showing significant deviation.`;
        }

        summaryEl.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px;">
                <div>${statusMsg}</div>
                <div style="font-size: 0.85rem; background: rgba(0,0,0,0.3); padding: 5px 10px; border-radius: 4px;">
                    <span style="color: #4cd964; margin-right: 10px;">✅ Good (${goodCount})</span>
                    <span style="color: #a0aec0; margin-right: 10px;">⬜ OK (${okCount})</span>
                    <span style="color: #ff3b30;">⚠️ High Diff (${badCount})</span>
                </div>
            </div>
        `;
    }

    auditData.results.forEach(row => {
        const tr = document.createElement('tr');

        // Movie Name
        const nameTd = document.createElement('td');
        nameTd.textContent = row.name;
        tr.appendChild(nameTd);

        // Weight
        const weightTd = document.createElement('td');
        weightTd.className = 'weight-cell';
        weightTd.textContent = Number(row.weight).toFixed(2);
        tr.appendChild(weightTd);

        // Expected %
        const expTd = document.createElement('td');
        expTd.textContent = (row.expectedRatio * 100).toFixed(2) + '%';
        tr.appendChild(expTd);

        // Actual %
        const actTd = document.createElement('td');
        actTd.textContent = (row.actualRatio * 100).toFixed(2) + '%';
        tr.appendChild(actTd);

        // Diff %
        const diffTd = document.createElement('td');
        const diffPct = row.diff * 100;
        const diffText = (diffPct > 0 ? '+' : '') + diffPct.toFixed(2) + '%';

        diffTd.textContent = diffText;
        if (Math.abs(diffPct) < 0.5) {
            diffTd.className = 'diff-good';
            diffTd.innerHTML += ' ✅';
        } else if (Math.abs(diffPct) < 1.0) {
            diffTd.className = 'diff-ok';
        } else {
            diffTd.className = 'diff-bad';
            diffTd.innerHTML += ' ⚠️';
        }
        tr.appendChild(diffTd);

        tableBody.appendChild(tr);
    });

    if (modal) {
        modal.showModal();
    }
}

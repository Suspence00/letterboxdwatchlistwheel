/**
 * Dialog and modal components
 */

let confirmModalTimeoutId = null;

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

    if (confirmModalTimeoutId) {
        clearTimeout(confirmModalTimeoutId);
        confirmModalTimeoutId = null;
    }

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

    modal.hidden = false;
    requestAnimationFrame(() => modal.classList.add('show'));

    const close = () => {
        modal.classList.remove('show');
        if (confirmModalTimeoutId) clearTimeout(confirmModalTimeoutId);
        confirmModalTimeoutId = setTimeout(() => {
            modal.hidden = true;
            confirmModalTimeoutId = null;
        }, 200);
        cleanup();
    };

    const confirmHandler = () => {
        if (onConfirm) onConfirm();
        close();
    };

    const secondaryHandler = () => {
        if (onSecondary) onSecondary();
        close();
    };

    const cancelHandler = () => {
        if (onCancel) onCancel();
        close();
    };

    const cleanup = () => {
        confirmBtn.removeEventListener('click', confirmHandler);
        if (secondaryBtn) secondaryBtn.removeEventListener('click', secondaryHandler);
        cancelBtn.removeEventListener('click', cancelHandler);
        closeBtn.removeEventListener('click', cancelHandler);
    };

    confirmBtn.addEventListener('click', confirmHandler);
    if (secondaryBtn) secondaryBtn.addEventListener('click', secondaryHandler);
    cancelBtn.addEventListener('click', cancelHandler);
    closeBtn.addEventListener('click', cancelHandler);
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

    const close = () => {
        modal.classList.remove('show');
        setTimeout(() => { modal.hidden = true; }, 200);
        input.value = ''; // Clear for security/cleanliness
    };

    const submitHandler = (e) => {
        e.preventDefault();
        const value = input.value.trim();
        if (value) {
            callback(value);
            close();
        }
        form.removeEventListener('submit', submitHandler);
        closeBtn.removeEventListener('click', closeHandler);
    };

    const closeHandler = () => {
        close();
        form.removeEventListener('submit', submitHandler);
        closeBtn.removeEventListener('click', closeHandler);
    };

    form.addEventListener('submit', submitHandler);
    closeBtn.addEventListener('click', closeHandler);

    modal.hidden = false;
    requestAnimationFrame(() => modal.classList.add('show'));
    input.focus();
}

export function showVerificationResults(auditData) {
    if (auditData.error) {
        alert(auditData.error);
        return;
    }

    const modal = document.getElementById('verify-modal');
    if (modal) {
        modal.hidden = false;
    }

    const tableBody = document.querySelector('#verify-table tbody');

    if (!tableBody) {
        console.error('Verify table body not found in DOM');
        return;
    }

    tableBody.innerHTML = '';

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
        modal.hidden = false;
    }
}
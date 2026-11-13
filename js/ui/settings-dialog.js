import { syncSettingsControls } from '../vhs-wheel.js';

export function initSettingsDialog({ settingsModal, settingsOpenBtn, settingsCloseBtn }) {
    if (!settingsModal || !settingsOpenBtn || !settingsCloseBtn) return;

    const tabs = Array.from(settingsModal.querySelectorAll('[role="tab"]'));
    const tablist = settingsModal.querySelector('[role="tablist"]');
    const panelContent = settingsModal.querySelector('.settings-tab-content');
    const manageWheels = document.getElementById('saved-wheels-manage');
    const savedWheelsTab = document.getElementById('tab-btn-boards');
    const savedWheelsSearch = document.getElementById('saved-wheels-search');

    function open(trigger) {
        syncSettingsControls();
        trigger.focus({ preventScroll: true });
        settingsModal.showModal();
    }

    settingsOpenBtn.addEventListener('click', () => open(settingsOpenBtn));
    settingsCloseBtn.addEventListener('click', () => settingsModal.close());
    settingsModal.addEventListener('click', (event) => {
        if (event.target === settingsModal) settingsModal.close();
    });

    manageWheels?.addEventListener('click', () => {
        open(manageWheels);
        savedWheelsTab.click();
        savedWheelsSearch.focus();
    });

    for (const tab of tabs) {
        tab.addEventListener('click', () => {
            for (const candidate of tabs) {
                const selected = candidate === tab;
                candidate.setAttribute('aria-selected', String(selected));
                candidate.tabIndex = selected ? 0 : -1;
                document.getElementById(candidate.getAttribute('aria-controls')).hidden = !selected;
            }
            panelContent.scrollTop = 0;
            tab.focus();
        });
    }

    tablist.addEventListener('keydown', (event) => {
        const currentIndex = tabs.indexOf(event.target);
        if (currentIndex < 0) return;
        let nextIndex;
        if (event.key === 'Home') nextIndex = 0;
        else if (event.key === 'End') nextIndex = tabs.length - 1;
        else if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
            const forward = event.key === 'ArrowRight';
            const rtl = getComputedStyle(tablist).direction === 'rtl';
            const direction = forward !== rtl ? 1 : -1;
            nextIndex = (currentIndex + direction + tabs.length) % tabs.length;
        } else return;

        event.preventDefault();
        tabs[nextIndex].click();
    });
}

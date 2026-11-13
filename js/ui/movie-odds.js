/** Keep compact row odds and their full accessible descriptions in sync. */
/**
 * @param {HTMLElement} element
 * @param {number|undefined} value
 * @param {string} inactiveReason
 * @param {string} shortLabel
 * @param {string} fullLabel
 */
function setMovieOddsLabel(element, value, inactiveReason, shortLabel, fullLabel) {
    const numeric = Number(value) * 100;
    const percent = Number.isFinite(numeric) ? Math.min(100, Math.max(0, numeric)) : 0;
    const formatted = percent === 0 || percent >= 10 ? `${Math.round(percent)}%` : `${percent.toFixed(1)}%`;
    const description = `${fullLabel}: ${formatted}${inactiveReason ? ` (${inactiveReason})` : ''}`;
    element.textContent = `${shortLabel} ${formatted}`;
    element.title = description;
    element.setAttribute('aria-label', description);
    element.classList.toggle('movie-odds--inactive', Boolean(inactiveReason));
}

export function getModeCopy(mode) {
    if (mode === 'knockout') {
        return {
            riskLabel: 'Pick risk this spin',
            winLabel: 'Odds to be final winner',
            weightHelp: 'Knockout mode: higher weight makes a movie harder to eliminate.',
            weightLabel: 'Knockout weight'
        };
    }
    return {
        riskLabel: 'Odds to win',
        winLabel: 'Final winner odds',
        weightHelp: mode === 'wheelchinko'
            ? 'This weight applies to wheel spins, including the Spinchinko finale.'
            : 'One Spin mode: higher weight increases the chance this movie is picked on the single spin.',
        weightLabel: 'Spin weight (more likely)'
    };
}

export function updateMovieOdds(row, id, isSelected, { oddsMap, winOddsMap, spinMode, weightCopy }) {
    const risk = row.querySelector('.movie-odds--risk');
    const win = row.querySelector('.movie-odds--win');
    risk.hidden = spinMode !== 'knockout';
    win.hidden = spinMode === 'wheelchinko';
    const reason = isSelected ? '' : 'not selected';
    const absent = spinMode === 'one-spin' ? 'outside the current lineup' : 'outside the current round';
    setMovieOddsLabel(risk, oddsMap.get(id), reason || (oddsMap.has(id) ? '' : absent), 'Risk', weightCopy.riskLabel);
    setMovieOddsLabel(win, winOddsMap.get(id), reason || (winOddsMap.has(id) ? '' : absent), 'Win', weightCopy.winLabel);
}

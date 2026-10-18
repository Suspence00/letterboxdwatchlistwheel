/** Keep compact row odds and their full accessible descriptions in sync. */
/**
 * @param {HTMLElement} element
 * @param {number} value
 * @param {boolean} active
 * @param {string} shortLabel
 * @param {string} fullLabel
 */
export function setMovieOddsLabel(element, value, active, shortLabel, fullLabel) {
    const numeric = Number(value) * 100;
    const percent = active && Number.isFinite(numeric) ? Math.min(100, Math.max(0, numeric)) : 0;
    const formatted = percent === 0 || percent >= 10 ? `${Math.round(percent)}%` : `${percent.toFixed(1)}%`;
    const description = `${fullLabel}: ${formatted}${active ? '' : ' (not selected)'}`;
    element.textContent = `${shortLabel} ${formatted}`;
    element.title = description;
    element.setAttribute('aria-label', description);
    element.classList.toggle('movie-odds--inactive', !active);
}

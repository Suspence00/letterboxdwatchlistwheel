/**
 * Confetti animation effects
 */

import { getActiveTheme } from '../utils.js';
import { themeEffects } from '../theme-effects.js';

let confettiTimeoutId = null;

export function getConfettiPalette() {
    const theme = getActiveTheme();
    const colors = themeEffects[theme]?.particles?.colors;
    if (colors) return colors;
    if (theme === 'birthday') {
        return ['#f59e0b', '#2563eb', '#059669', '#dc2626', '#d97706', '#94a3b8', '#3b82f6', '#fbbf24'];
    }
    return ['#ff8600', '#ffd23f', '#06d6a0', '#00bbf9', '#f94144', '#9d4edd'];
}

export function triggerConfetti(container = document.getElementById('confetti-container')) {
    if (!container) return;

    if (confettiTimeoutId) {
        clearTimeout(confettiTimeoutId);
        confettiTimeoutId = null;
    }

    container.classList.remove('show');
    container.innerHTML = '';

    const colors = getConfettiPalette();
    const { count = 140, size = 8, spread = 8 } = themeEffects[getActiveTheme()]?.particles || {};

    for (let i = 0; i < count; i += 1) {
        const piece = document.createElement('span');
        piece.className = 'confetti-piece';
        const diameter = size + Math.random() * spread;
        piece.style.width = `${diameter}px`;
        piece.style.height = `${diameter * 1.4}px`;
        piece.style.backgroundColor = colors[i % colors.length];
        piece.style.left = `${Math.random() * 100}%`;
        piece.style.animationDelay = `${Math.random() * 0.3}s`;
        const duration = 2.2 + Math.random() * 1.5;
        piece.style.animationDuration = `${duration}s`;
        const horizontalDrift = (Math.random() - 0.5) * 40;
        piece.style.setProperty('--confetti-x-move', `${horizontalDrift}vw`);
        container.appendChild(piece);
    }

    void container.offsetWidth;
    container.classList.add('show');

    confettiTimeoutId = setTimeout(() => {
        container.classList.remove('show');
        container.innerHTML = '';
        confettiTimeoutId = null;
    }, 4200);
}

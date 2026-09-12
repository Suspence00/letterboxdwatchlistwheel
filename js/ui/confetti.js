/**
 * Confetti animation effects
 */

let confettiTimeoutId = null;

export function getConfettiPalette() {
    if (typeof document !== 'undefined' && document.body && document.body.classList.contains('theme-hanukkah')) {
        return ['#1d4ed8', '#60a5fa', '#facc15', '#fde68a', '#93c5fd', '#2563eb'];
    }
    if (typeof document !== 'undefined' && document.body && document.body.classList.contains('theme-holiday')) {
        return ['#d1495b', '#2ea44f', '#f0c75e', '#f7e1a1', '#9b2f2f', '#4c956c'];
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
    const pieceCount = 140;

    for (let i = 0; i < pieceCount; i += 1) {
        const piece = document.createElement('span');
        piece.className = 'confetti-piece';
        const size = 8 + Math.random() * 8;
        piece.style.width = `${size}px`;
        piece.style.height = `${size * 1.4}px`;
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
import { DURATION, renderFrame } from './film.js';
import { loadAssets } from './assets.js';

const canvas = /** @type {HTMLCanvasElement} */ (document.querySelector('#promo-canvas'));
const audio = /** @type {HTMLAudioElement} */ (document.querySelector('#promo-audio'));
const playButton = /** @type {HTMLButtonElement} */ (document.querySelector('#promo-play'));
const replayButton = /** @type {HTMLButtonElement} */ (document.querySelector('#promo-replay'));
const soundButton = /** @type {HTMLButtonElement} */ (document.querySelector('#promo-sound'));
const seek = /** @type {HTMLInputElement} */ (document.querySelector('#promo-seek'));
const timeOutput = /** @type {HTMLOutputElement} */ (document.querySelector('#promo-time'));
const motionPreference = matchMedia('(prefers-reduced-motion: reduce)');

await loadAssets();
await document.fonts.ready;

seek.max = String(DURATION);
seek.disabled = playButton.disabled = replayButton.disabled = false;
document.querySelector('#promo-duration').textContent = `${DURATION} SECONDS`;

let position = motionPreference.matches ? DURATION - 2 : 0;
let playing = !motionPreference.matches;
let soundEnabled = false;
let startedAt = performance.now() - position * 1000;
let animationFrame = 0;
let lastUiUpdate = 0;
let audioRequest = 0;
let sourceRequest = 0;
let soundtrackUrl = '';
let soundtrackFailed = false;

function updateControls() {
    const seconds = Math.min(Math.floor(position), DURATION);
    seek.value = String(position);
    seek.setAttribute('aria-valuetext', `${seconds} of ${DURATION} seconds`);
    timeOutput.value = `00:${String(seconds).padStart(2, '0')} / 00:${DURATION}`;
    playButton.innerHTML = playing ? 'Pause <span aria-hidden="true">Ⅱ</span>' : 'Play <span aria-hidden="true">▶</span>';
    playButton.setAttribute('aria-label', playing ? 'Pause promo' : 'Play promo');
    soundButton.innerHTML = soundtrackFailed ? 'Sound unavailable' : `${soundEnabled ? 'Sound on' : 'Sound off'} <span aria-hidden="true">♪</span>`;
    soundButton.setAttribute('aria-pressed', String(soundEnabled));
}

function syncAudio() {
    const request = ++audioRequest;
    if (audio.readyState === 0) return;
    audio.currentTime = position;
    if (!soundEnabled || !playing) {
        audio.pause();
        return;
    }
    audio.play().then(() => {
        if (!soundEnabled || !playing) audio.pause();
    }).catch(error => {
        if (error.name === 'AbortError' || request !== audioRequest || !playing || !soundEnabled) return;
        soundEnabled = false;
        updateControls();
    });
}

async function prepareAudio() {
    const request = ++sourceRequest;
    soundButton.disabled = true;
    try {
        // A complete local source supports seeking even on basic static servers
        // that do not implement HTTP byte-range responses.
        const response = await fetch(audio.dataset.src);
        if (!response.ok) throw new Error('Soundtrack unavailable');
        const soundtrack = new Blob([await response.arrayBuffer()], { type: 'audio/mp4' });
        if (request !== sourceRequest) return;
        soundtrackUrl = URL.createObjectURL(soundtrack);
        audio.src = soundtrackUrl;
        audio.addEventListener('loadedmetadata', () => {
            if (request !== sourceRequest) return;
            soundButton.disabled = false;
            syncAudio();
        }, { once: true });
        audio.load();
    } catch {
        if (request !== sourceRequest) return;
        soundtrackFailed = true;
        updateControls();
    }
}

function tick(now) {
    if (!playing) return;
    position = Math.min((now - startedAt) / 1000, DURATION);
    renderFrame(canvas, position);
    if (position >= DURATION) {
        playing = false;
        audio.pause();
        updateControls();
        return;
    }
    if (now - lastUiUpdate > 100) {
        updateControls();
        lastUiUpdate = now;
    }
    animationFrame = requestAnimationFrame(tick);
}

function setPlaying(next) {
    playing = next;
    cancelAnimationFrame(animationFrame);
    if (playing) {
        if (position >= DURATION) position = 0;
        startedAt = performance.now() - position * 1000;
        animationFrame = requestAnimationFrame(tick);
    }
    syncAudio();
    updateControls();
}

playButton.addEventListener('click', () => setPlaying(!playing));
replayButton.addEventListener('click', () => {
    position = 0;
    renderFrame(canvas, position);
    setPlaying(true);
});
seek.addEventListener('input', () => {
    position = Number(seek.value);
    startedAt = performance.now() - position * 1000;
    renderFrame(canvas, position);
    syncAudio();
    updateControls();
});
soundButton.addEventListener('click', () => {
    soundEnabled = !soundEnabled;
    syncAudio();
    updateControls();
});
motionPreference.addEventListener('change', event => {
    if (event.matches) setPlaying(false);
});
window.addEventListener('pagehide', () => {
    sourceRequest++;
    setPlaying(false);
    if (soundtrackUrl) URL.revokeObjectURL(soundtrackUrl);
});
window.addEventListener('pageshow', event => {
    if (event.persisted) prepareAudio();
});

renderFrame(canvas, position);
updateControls();
prepareAudio();
if (playing) animationFrame = requestAnimationFrame(tick);

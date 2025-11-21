/**
 * Audio management for the Letterboxd Watchlist Wheel
 * Handles sound effects and Wheel.FM
 */

const WHEEL_FM_PLAYLIST_PATH = 'wheel-fm/playlist.json';
const DEFAULT_WHEEL_FM_VOLUME = 0.8;

let audioContext = null;
let wheelSoundsMuted = false;

const wheelFmState = {
    playlist: [],
    currentIndex: 0,
    isSeeking: false
};

// DOM Elements (to be initialized)
let elements = {};

export function initAudio(domElements) {
    elements = domElements;

    if (elements.wheelFmAudio && elements.wheelFmPlayBtn) {
        initWheelFm();
    }

    if (elements.wheelSoundToggleBtn) {
        elements.wheelSoundToggleBtn.addEventListener('click', handleWheelSoundToggle);
        updateWheelSoundToggle();
    }

    window.addEventListener('beforeunload', () => {
        if (audioContext) {
            audioContext.close();
        }
    });
}

function ensureAudioContext() {
    if (!audioContext) {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioContext.state === 'suspended') {
        audioContext.resume();
    }
}

export function playClickSound() {
    if (wheelSoundsMuted) return;

    ensureAudioContext();
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();
    oscillator.type = 'triangle';
    oscillator.frequency.value = 600;
    const now = audioContext.currentTime;
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.08, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.12);
    oscillator.connect(gain).connect(audioContext.destination);
    oscillator.start(now);
    oscillator.stop(now + 0.12);
}

export function playTickSound() {
    if (wheelSoundsMuted) return;

    ensureAudioContext();
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();
    oscillator.type = 'triangle';
    oscillator.frequency.value = 600;
    const now = audioContext.currentTime;
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.08, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.12);
    oscillator.connect(gain).connect(audioContext.destination);
    oscillator.start(now);
    oscillator.stop(now + 0.12);
}

export function playWinSound() {
    if (wheelSoundsMuted) return;

    ensureAudioContext();
    const now = audioContext.currentTime;

    const notes = [523.25, 659.25, 783.99];
    notes.forEach((frequency, index) => {
        const oscillator = audioContext.createOscillator();
        const gain = audioContext.createGain();
        oscillator.type = 'sine';
        oscillator.frequency.value = frequency;
        const startTime = now + index * 0.12;
        gain.gain.setValueAtTime(0.0001, startTime);
        gain.gain.exponentialRampToValueAtTime(0.12, startTime + 0.05);
        gain.gain.exponentialRampToValueAtTime(0.0001, startTime + 0.4);
        oscillator.connect(gain).connect(audioContext.destination);
        oscillator.start(startTime);
        oscillator.stop(startTime + 0.45);
    });
}

export function playKnockoutSound() {
    if (wheelSoundsMuted) return;

    ensureAudioContext();
    const now = audioContext.currentTime;
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();

    oscillator.type = 'sawtooth';
    oscillator.frequency.setValueAtTime(520, now);
    oscillator.frequency.exponentialRampToValueAtTime(220, now + 0.4);

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.12, now + 0.05);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.5);

    oscillator.connect(gain).connect(audioContext.destination);
    oscillator.start(now);
    oscillator.stop(now + 0.5);
}

function updateWheelSoundToggle() {
    if (!elements.wheelSoundToggleBtn) return;
    elements.wheelSoundToggleBtn.setAttribute('aria-pressed', String(wheelSoundsMuted));
    elements.wheelSoundToggleBtn.textContent = wheelSoundsMuted ? 'Unmute wheel sounds' : 'Mute wheel sounds';
}

function handleWheelSoundToggle() {
    wheelSoundsMuted = !wheelSoundsMuted;
    updateWheelSoundToggle();
}

// Wheel.FM Logic

function setWheelFmStatus(message) {
    if (elements.wheelFmStatus) elements.wheelFmStatus.textContent = message;
}

function setWheelFmPlaylistSummary(message) {
    if (elements.wheelFmPlaylistMeta) elements.wheelFmPlaylistMeta.textContent = message;
}

function showWheelFmPlaylistPlaceholder(message, optionLabel = 'No tracks available') {
    if (elements.wheelFmPlaylistSelect) {
        elements.wheelFmPlaylistSelect.disabled = true;
        elements.wheelFmPlaylistSelect.innerHTML = '';
        const placeholder = document.createElement('option');
        placeholder.value = '';
        placeholder.textContent = optionLabel;
        elements.wheelFmPlaylistSelect.append(placeholder);
    }
    setWheelFmPlaylistSummary(message);
}

function setWheelFmPlaylistSelection(index) {
    if (elements.wheelFmPlaylistSelect) {
        elements.wheelFmPlaylistSelect.value = String(index);
    }
}

function setWheelFmControlsDisabled(disabled) {
    [elements.wheelFmPlayBtn, elements.wheelFmNextBtn, elements.wheelFmPrevBtn, elements.wheelFmSeek]
        .filter(Boolean)
        .forEach((el) => {
            el.disabled = Boolean(disabled);
        });
}

function clampVolume(value) {
    if (!Number.isFinite(value)) return DEFAULT_WHEEL_FM_VOLUME;
    return Math.min(1, Math.max(0, value));
}

function setWheelFmVolume(value) {
    const safeVolume = clampVolume(value);
    if (elements.wheelFmAudio) {
        elements.wheelFmAudio.volume = safeVolume;
    }
    if (elements.wheelFmVolumeSlider) {
        const sliderValue = Math.round(safeVolume * 100);
        elements.wheelFmVolumeSlider.value = String(sliderValue);
        elements.wheelFmVolumeSlider.setAttribute('aria-valuenow', String(sliderValue));
    }
    if (elements.wheelFmVolumeValue) {
        elements.wheelFmVolumeValue.textContent = `${Math.round(safeVolume * 100)}%`;
    }
}

function normalizeWheelFmTrack(entry, index) {
    if (!entry || typeof entry.file !== 'string') return null;
    const file = entry.file.trim();
    if (!file) return null;
    const title = (entry.title || '').trim();
    const artist = (entry.artist || '').trim();
    const fallbackName = file.split('/').pop() || `Track ${index + 1}`;
    return {
        file,
        title: title || fallbackName,
        artist: artist || 'Wheel.FM'
    };
}

function updateWheelFmTrackDisplay(track) {
    if (elements.wheelFmTrackTitle) elements.wheelFmTrackTitle.textContent = track?.title || 'Wheel.FM';
    if (elements.wheelFmTrackArtist) elements.wheelFmTrackArtist.textContent = track?.artist || '';
}

function renderWheelFmPlaylist() {
    if (!elements.wheelFmPlaylistSelect) return;

    elements.wheelFmPlaylistSelect.innerHTML = '';

    if (!wheelFmState.playlist.length) {
        showWheelFmPlaylistPlaceholder('No tracks loaded for Wheel.FM.');
        return;
    }

    elements.wheelFmPlaylistSelect.disabled = false;

    wheelFmState.playlist.forEach((track, index) => {
        const option = document.createElement('option');
        option.value = String(index);
        option.textContent = `${index + 1}. ${track.title} — ${track.artist}`;
        elements.wheelFmPlaylistSelect.append(option);
    });

    setWheelFmPlaylistSelection(wheelFmState.currentIndex);
    const total = wheelFmState.playlist.length;
    setWheelFmPlaylistSummary(`${total} track${total === 1 ? '' : 's'} loaded`);
}

function formatWheelFmTime(seconds) {
    if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
    const rounded = Math.floor(seconds);
    const minutes = Math.floor(rounded / 60);
    const remaining = String(rounded % 60).padStart(2, '0');
    return `${minutes}:${remaining}`;
}

function updateWheelFmProgress() {
    if (!elements.wheelFmAudio || !elements.wheelFmSeek || !elements.wheelFmCurrentTime) return;

    if (!Number.isFinite(elements.wheelFmAudio.duration) || elements.wheelFmAudio.duration <= 0) {
        elements.wheelFmSeek.value = 0;
        elements.wheelFmCurrentTime.textContent = '0:00';
        return;
    }
    if (!wheelFmState.isSeeking) {
        const percent = (elements.wheelFmAudio.currentTime / elements.wheelFmAudio.duration) * 100;
        elements.wheelFmSeek.value = percent;
    }
    elements.wheelFmCurrentTime.textContent = formatWheelFmTime(elements.wheelFmAudio.currentTime);
}

function handleWheelFmLoadedMetadata() {
    if (!elements.wheelFmAudio || !elements.wheelFmSeek || !elements.wheelFmDuration) return;
    elements.wheelFmSeek.disabled = false;
    elements.wheelFmDuration.textContent = formatWheelFmTime(elements.wheelFmAudio.duration);
    updateWheelFmProgress();
}

function handleWheelFmSeekInput(event) {
    if (!elements.wheelFmAudio || !elements.wheelFmSeek || !elements.wheelFmDuration) return;
    wheelFmState.isSeeking = true;
    const value = Number(event.target.value);
    if (!Number.isFinite(value) || !Number.isFinite(elements.wheelFmAudio.duration)) return;
    const seconds = (value / 100) * elements.wheelFmAudio.duration;
    if (elements.wheelFmCurrentTime) {
        elements.wheelFmCurrentTime.textContent = formatWheelFmTime(seconds);
    }
}

function handleWheelFmSeekChange(event) {
    if (!elements.wheelFmAudio || !Number.isFinite(elements.wheelFmAudio.duration)) {
        wheelFmState.isSeeking = false;
        return;
    }
    const value = Number(event.target.value);
    const seconds = (value / 100) * elements.wheelFmAudio.duration;
    elements.wheelFmAudio.currentTime = seconds;
    wheelFmState.isSeeking = false;
}

async function loadWheelFmTrack(index, options = {}) {
    if (!elements.wheelFmAudio || !wheelFmState.playlist.length) return;

    const { autoplay = false } = options;
    const safeIndex = ((index % wheelFmState.playlist.length) + wheelFmState.playlist.length) % wheelFmState.playlist.length;
    const track = wheelFmState.playlist[safeIndex];
    wheelFmState.currentIndex = safeIndex;

    elements.wheelFmAudio.pause();
    elements.wheelFmAudio.src = track.file;
    elements.wheelFmAudio.currentTime = 0;

    if (elements.wheelFmSeek) {
        elements.wheelFmSeek.value = 0;
        elements.wheelFmSeek.disabled = true;
    }
    if (elements.wheelFmCurrentTime) elements.wheelFmCurrentTime.textContent = '0:00';
    if (elements.wheelFmDuration) elements.wheelFmDuration.textContent = '0:00';

    updateWheelFmTrackDisplay(track);
    setWheelFmPlaylistSelection(safeIndex);

    if (autoplay) {
        try {
            await elements.wheelFmAudio.play();
            setWheelFmStatus(`Now playing "${track.title}".`);
            return;
        } catch (error) {
            setWheelFmStatus(`Ready to play "${track.title}". Playback was blocked.`);
        }
    }
    setWheelFmStatus(`Ready to play "${track.title}".`);
}

async function handleWheelFmPlayToggle() {
    if (!elements.wheelFmAudio || !wheelFmState.playlist.length) return;

    if (elements.wheelFmAudio.paused) {
        try {
            await elements.wheelFmAudio.play();
            setWheelFmStatus(`Now playing "${wheelFmState.playlist[wheelFmState.currentIndex].title}".`);
        } catch (error) {
            setWheelFmStatus('Unable to start Wheel.FM — browser blocked playback.');
        }
    } else {
        elements.wheelFmAudio.pause();
        setWheelFmStatus('Paused Wheel.FM.');
    }
}

function handleWheelFmNext() {
    if (!wheelFmState.playlist.length) return;
    const nextIndex = (wheelFmState.currentIndex + 1) % wheelFmState.playlist.length;
    loadWheelFmTrack(nextIndex, { autoplay: true });
}

function handleWheelFmPrevious() {
    if (!wheelFmState.playlist.length) return;
    const prevIndex = (wheelFmState.currentIndex - 1 + wheelFmState.playlist.length) % wheelFmState.playlist.length;
    loadWheelFmTrack(prevIndex, { autoplay: true });
}

async function initWheelFm() {
    elements.wheelFmPlayBtn.addEventListener('click', handleWheelFmPlayToggle);
    if (elements.wheelFmNextBtn) elements.wheelFmNextBtn.addEventListener('click', handleWheelFmNext);
    if (elements.wheelFmPrevBtn) elements.wheelFmPrevBtn.addEventListener('click', handleWheelFmPrevious);

    elements.wheelFmSeek.addEventListener('input', handleWheelFmSeekInput);
    elements.wheelFmSeek.addEventListener('change', handleWheelFmSeekChange);

    if (elements.wheelFmVolumeSlider) {
        const initialVolume = clampVolume((Number(elements.wheelFmVolumeSlider.value) || DEFAULT_WHEEL_FM_VOLUME * 100) / 100);
        setWheelFmVolume(initialVolume);
        elements.wheelFmVolumeSlider.addEventListener('input', (event) => {
            const volume = Number(event.target.value) / 100;
            setWheelFmVolume(volume);
        });
    } else {
        setWheelFmVolume(DEFAULT_WHEEL_FM_VOLUME);
    }

    if (elements.wheelFmPlaylistSelect) {
        elements.wheelFmPlaylistSelect.addEventListener('change', (event) => {
            const targetIndex = Number(event.target.value);
            if (!Number.isFinite(targetIndex)) return;
            loadWheelFmTrack(targetIndex, { autoplay: true });
        });
    }

    elements.wheelFmAudio.addEventListener('timeupdate', updateWheelFmProgress);
    elements.wheelFmAudio.addEventListener('loadedmetadata', handleWheelFmLoadedMetadata);
    elements.wheelFmAudio.addEventListener('ended', handleWheelFmNext);
    elements.wheelFmAudio.addEventListener('error', () => {
        setWheelFmStatus('Could not load the current Wheel.FM track.');
    });
    elements.wheelFmAudio.addEventListener('play', () => {
        elements.wheelFmPlayBtn.classList.add('is-playing');
    });
    elements.wheelFmAudio.addEventListener('pause', () => {
        elements.wheelFmPlayBtn.classList.remove('is-playing');
    });

    setWheelFmControlsDisabled(true);
    setWheelFmStatus('Looking for Wheel.FM tracks…');
    showWheelFmPlaylistPlaceholder('Loading playlist…', 'Loading…');

    try {
        const response = await fetch(WHEEL_FM_PLAYLIST_PATH, { cache: 'no-store' });
        if (!response.ok) throw new Error('Playlist unavailable');
        const data = await response.json();
        const normalized = Array.isArray(data)
            ? data.map((entry, index) => normalizeWheelFmTrack(entry, index)).filter(Boolean)
            : [];

        if (!normalized.length) {
            setWheelFmStatus('Add MP3 files to wheel-fm/ and list them in playlist.json to start broadcasting.');
            showWheelFmPlaylistPlaceholder('Add tracks to wheel-fm/ to build your playlist.');
            return;
        }

        wheelFmState.playlist = normalized;
        setWheelFmControlsDisabled(false);
        renderWheelFmPlaylist();
        await loadWheelFmTrack(0);
    } catch (error) {
        setWheelFmStatus('Wheel.FM playlist missing or invalid.');
        showWheelFmPlaylistPlaceholder('Wheel.FM playlist missing or invalid.');
    }
}

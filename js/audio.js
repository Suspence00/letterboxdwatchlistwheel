/**
 * Audio management for the Letterboxd Watchlist Wheel
 * Handles sound effects and Wheel.FM
 */

const WHEEL_FM_PLAYLIST_PATH = 'wheel-fm/playlist.json';
const DEFAULT_WHEEL_FM_VOLUME = 0.8;

let audioContext = null;
let wheelSoundsMuted = false;

const wheelFmState = {
    playlist: [], // Current active playlist
    allPlaylists: {}, // Cache of all channels
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
    const label = wheelSoundsMuted ? 'Unmute wheel sounds' : 'Mute wheel sounds';
    elements.wheelSoundToggleBtn.setAttribute('aria-pressed', String(wheelSoundsMuted));
    elements.wheelSoundToggleBtn.setAttribute('aria-label', label);
    elements.wheelSoundToggleBtn.classList.toggle('is-muted', wheelSoundsMuted);
    const text = elements.wheelSoundToggleBtn.querySelector('.sound-toggle__text');
    if (text) {
        text.textContent = label;
    }
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
function savePlayerState(wheelFmContainer) {
    let state = 'expanded';
    if (wheelFmContainer.classList.contains('is-ultra-minimized')) {
        state = 'ultra-minimized';
    } else if (wheelFmContainer.classList.contains('is-minimized')) {
        state = 'minimized';
    }
    localStorage.setItem('wheel-fm-state', state);
}

async function initWheelFm() {
    const wheelFmContainer = document.querySelector('.wheel-fm');
    const minimizeBtn = document.getElementById('wheel-fm-minimize');

    // Restore layout and position
    if (wheelFmContainer) {
        const savedState = localStorage.getItem('wheel-fm-state');
        if (savedState === 'ultra-minimized') {
            wheelFmContainer.classList.add('is-ultra-minimized');
            if (minimizeBtn) {
                minimizeBtn.textContent = '═';
                minimizeBtn.setAttribute('aria-expanded', 'false');
                minimizeBtn.setAttribute('aria-label', 'Expand Wheel.FM');
            }
        } else if (savedState === 'minimized') {
            wheelFmContainer.classList.add('is-minimized');
            if (minimizeBtn) {
                minimizeBtn.textContent = '═';
                minimizeBtn.setAttribute('aria-expanded', 'false');
                minimizeBtn.setAttribute('aria-label', 'Expand Wheel.FM');
            }
        }

        const savedX = localStorage.getItem('wheel-fm-pos-x');
        const savedY = localStorage.getItem('wheel-fm-pos-y');
        if (savedX !== null && savedY !== null) {
            const viewportWidth = window.innerWidth;
            const viewportHeight = window.innerHeight;
            const targetX = Math.max(0, Math.min(Number(savedX), viewportWidth - 60));
            const targetY = Math.max(0, Math.min(Number(savedY), viewportHeight - 60));

            wheelFmContainer.style.bottom = 'auto';
            wheelFmContainer.style.right = 'auto';
            wheelFmContainer.style.left = `${targetX}px`;
            wheelFmContainer.style.top = `${targetY}px`;
        }

        // Draggable Logic
        let isDragging = false;
        let hasMoved = false;
        let startX = 0, startY = 0;
        let initialX = 0, initialY = 0;
        const heading = wheelFmContainer.querySelector('.wheel-fm__heading');

        wheelFmContainer.addEventListener('pointerdown', (e) => {
            if (e.button !== 0 && e.pointerType === 'mouse') return;
            if (e.target.closest('button, select, input, option')) return;

            const isFab = wheelFmContainer.classList.contains('is-ultra-minimized');
            if (!isFab && !e.target.closest('.wheel-fm__heading')) return;

            isDragging = true;
            hasMoved = false;

            const rect = wheelFmContainer.getBoundingClientRect();
            initialX = rect.left;
            initialY = rect.top;

            startX = e.clientX;
            startY = e.clientY;

            wheelFmContainer.setPointerCapture(e.pointerId);
            if (isFab) {
                wheelFmContainer.style.cursor = 'grabbing';
            } else if (heading) {
                heading.style.cursor = 'grabbing';
            }
        });

        wheelFmContainer.addEventListener('pointermove', (e) => {
            if (!isDragging) return;

            const dx = e.clientX - startX;
            const dy = e.clientY - startY;

            if (Math.abs(dx) > 4 || Math.abs(dy) > 4) {
                hasMoved = true;
            }

            let newX = initialX + dx;
            let newY = initialY + dy;

            const rect = wheelFmContainer.getBoundingClientRect();
            const viewportWidth = window.innerWidth;
            const viewportHeight = window.innerHeight;

            newX = Math.max(0, Math.min(newX, viewportWidth - rect.width));
            newY = Math.max(0, Math.min(newY, viewportHeight - rect.height));

            wheelFmContainer.style.bottom = 'auto';
            wheelFmContainer.style.right = 'auto';
            wheelFmContainer.style.left = `${newX}px`;
            wheelFmContainer.style.top = `${newY}px`;
        });

        const stopDragging = (e) => {
            if (!isDragging) return;
            isDragging = false;

            const isFab = wheelFmContainer.classList.contains('is-ultra-minimized');
            wheelFmContainer.style.cursor = '';
            if (heading) heading.style.cursor = 'grab';

            try {
                wheelFmContainer.releasePointerCapture(e.pointerId);
            } catch (err) {}

            const rect = wheelFmContainer.getBoundingClientRect();
            localStorage.setItem('wheel-fm-pos-x', String(rect.left));
            localStorage.setItem('wheel-fm-pos-y', String(rect.top));
        };

        wheelFmContainer.addEventListener('pointerup', stopDragging);
        wheelFmContainer.addEventListener('pointercancel', stopDragging);

        // Click to expand FAB
        wheelFmContainer.addEventListener('click', () => {
            if (wheelFmContainer.classList.contains('is-ultra-minimized') && !hasMoved) {
                wheelFmContainer.classList.remove('is-ultra-minimized');
                if (minimizeBtn) {
                    minimizeBtn.textContent = '_';
                    minimizeBtn.setAttribute('aria-expanded', 'true');
                    minimizeBtn.setAttribute('aria-label', 'Minimize Wheel.FM');
                }
                savePlayerState(wheelFmContainer);
            }
        });

        // Toggle Minimization
        if (minimizeBtn) {
            minimizeBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                if (wheelFmContainer.classList.contains('is-minimized')) {
                    wheelFmContainer.classList.remove('is-minimized');
                    wheelFmContainer.classList.add('is-ultra-minimized');
                    minimizeBtn.textContent = '═';
                    minimizeBtn.setAttribute('aria-expanded', 'false');
                    minimizeBtn.setAttribute('aria-label', 'Expand Wheel.FM');
                } else if (wheelFmContainer.classList.contains('is-ultra-minimized')) {
                    wheelFmContainer.classList.remove('is-ultra-minimized');
                    minimizeBtn.textContent = '_';
                    minimizeBtn.setAttribute('aria-expanded', 'true');
                    minimizeBtn.setAttribute('aria-label', 'Minimize Wheel.FM');
                } else {
                    wheelFmContainer.classList.add('is-minimized');
                    minimizeBtn.textContent = '═';
                    minimizeBtn.setAttribute('aria-expanded', 'false');
                    minimizeBtn.setAttribute('aria-label', 'Expand Wheel.FM');
                }
                savePlayerState(wheelFmContainer);
            });
        }

        // Viewport resize handling
        window.addEventListener('resize', () => {
            const rect = wheelFmContainer.getBoundingClientRect();
            const viewportWidth = window.innerWidth;
            const viewportHeight = window.innerHeight;

            let currentX = rect.left;
            let currentY = rect.top;

            if (wheelFmContainer.style.left) {
                let adjustedX = Math.max(0, Math.min(currentX, viewportWidth - rect.width));
                let adjustedY = Math.max(0, Math.min(currentY, viewportHeight - rect.height));

                if (adjustedX !== currentX || adjustedY !== currentY) {
                    wheelFmContainer.style.left = `${adjustedX}px`;
                    wheelFmContainer.style.top = `${adjustedY}px`;
                }
            }
        });
    }

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
        if (wheelFmContainer) wheelFmContainer.classList.add('is-playing');
    });
    elements.wheelFmAudio.addEventListener('pause', () => {
        elements.wheelFmPlayBtn.classList.remove('is-playing');
        if (wheelFmContainer) wheelFmContainer.classList.remove('is-playing');
    });

    setWheelFmControlsDisabled(true);
    setWheelFmStatus('Looking for Wheel.FM tracks…');
    showWheelFmPlaylistPlaceholder('Loading playlist…', 'Loading…');

    try {
        const response = await fetch(WHEEL_FM_PLAYLIST_PATH, { cache: 'no-store' });
        if (!response.ok) throw new Error('Playlist unavailable');

        const rawData = await response.json();

        // Handle Legacy Array format (Auto-convert to 'Default Mix')
        if (Array.isArray(rawData)) {
            wheelFmState.allPlaylists = { 'Default Mix': rawData };
        } else {
            wheelFmState.allPlaylists = rawData;
        }

        const channelNames = Object.keys(wheelFmState.allPlaylists);

        if (!channelNames.length) {
            setWheelFmStatus('Add MP3 files to wheel-fm/ and list them in playlist.json to start broadcasting.');
            showWheelFmPlaylistPlaceholder('Add tracks to wheel-fm/ to build your playlist.');
            return;
        }

        // Initialize Channel Selector
        if (elements.wheelFmChannelSelect) {
            elements.wheelFmChannelSelect.innerHTML = '';

            channelNames.forEach(name => {
                const option = document.createElement('option');
                option.value = name;
                option.textContent = name;
                elements.wheelFmChannelSelect.append(option);
            });

            elements.wheelFmChannelSelect.disabled = false;

            // Handle Channel Switching
            elements.wheelFmChannelSelect.addEventListener('change', (event) => {
                const newChannel = event.target.value;
                if (!wheelFmState.allPlaylists[newChannel]) return;

                loadChannel(newChannel);
            });
        }

        // Load Initial Channel (First one)
        loadChannel(channelNames[0]);

    } catch (error) {
        console.error(error);
        setWheelFmStatus('Wheel.FM playlist missing or invalid.');
        showWheelFmPlaylistPlaceholder('Wheel.FM playlist missing or invalid.');
    }
}

function loadChannel(channelName) {
    const rawTracks = wheelFmState.allPlaylists[channelName];
    if (!rawTracks || !Array.isArray(rawTracks)) return;

    const normalized = rawTracks
        .map((entry, index) => normalizeWheelFmTrack(entry, index))
        .filter(Boolean);

    wheelFmState.playlist = normalized;
    setWheelFmControlsDisabled(false);
    renderWheelFmPlaylist();
    // Reset to first track of new channel
    loadWheelFmTrack(0, { autoplay: false });

    setWheelFmStatus(`Tuned in to ${channelName}.`);
}

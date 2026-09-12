import { appState, saveState } from './state.js';
import { fetchMovieMetadata } from './movie-metadata.js';
import {
    setTheaterStatus, prepareEliminationStackSlot, commitEliminationStackSlot, addTapeToEliminationStack, setSpinTheaterCallbacks
} from './spin-theater.js';

export const DEFAULT_VHS_CAPACITY = 10;
export const VHS_CAPACITY = DEFAULT_VHS_CAPACITY;
let batchIds = [];
let eligibleKey = '';
let workspaceId;
const pinnedIds = new Set();
let scene;
let rotor;
let inspector;
let callbacks;
let renderedKey = '';
let inspectedMovie;
let displayedMovies = [];
let activeMode;

export function isVhsEnabled() {
    return appState.preferences?.wheelStyle !== 'classic';
}

export function getVhsCapacity() {
    return Number(appState.preferences?.vhsCapacity) || DEFAULT_VHS_CAPACITY;
}

export function getCurrentSpinMode() {
    return document.querySelector('input[name="spin-mode"]:checked')?.value || 'knockout';
}

export function useVhsForMovies(movies) {
    return isVhsEnabled() && movies.length > 0 && movies.length <= getVhsCapacity();
}

/** Uniform sampling without replacement. Pins only affect the next lineup. */
export function getVhsLineup(eligible, mode = activeMode || getCurrentSpinMode(), redraw = false) {
    if (!isVhsEnabled() || mode !== 'one-spin') return eligible;
    if (workspaceId !== appState.activeWorkspaceId) {
        workspaceId = appState.activeWorkspaceId;
        pinnedIds.clear();
        eligibleKey = '';
    }
    const capacity = getVhsCapacity();
    const key = `${capacity}:${eligible.map(movie => movie.id).join('\u001f')}`;
    if (key !== eligibleKey || redraw) {
        const eligibleIds = new Set(eligible.map(movie => movie.id));
        for (const id of pinnedIds) if (!eligibleIds.has(id)) pinnedIds.delete(id);
        const pinned = eligible.filter(movie => pinnedIds.has(movie.id)).slice(0, capacity);
        const remaining = eligible.filter(movie => !pinnedIds.has(movie.id));
        const count = Math.min(capacity - pinned.length, remaining.length);
        for (let index = 0; index < count; index += 1) {
            const other = index + Math.floor(Math.random() * (remaining.length - index));
            [remaining[index], remaining[other]] = [remaining[other], remaining[index]];
        }
        batchIds = [...pinned, ...remaining.slice(0, count)].map(movie => movie.id);
        eligibleKey = key;
    }
    const byId = new Map(eligible.map(movie => [movie.id, movie]));
    return batchIds.map(id => byId.get(id)).filter(Boolean);
}

export function setVhsSpinMode(mode) {
    activeMode = mode;
}

function syncCapacityInputs(value) {
    const capacityVal = String(value);
    const mainSelect = document.getElementById('vhs-capacity-select');
    if (mainSelect && mainSelect.value !== capacityVal) mainSelect.value = capacityVal;
    const settingsSelect = document.getElementById('settings-vhs-capacity');
    if (settingsSelect && settingsSelect.value !== capacityVal) settingsSelect.value = capacityVal;
}

function syncLabelsInputs(show) {
    const mainSelect = document.getElementById('vhs-labels-select');
    if (mainSelect && mainSelect.value !== (show ? 'show' : 'hide')) {
        mainSelect.value = show ? 'show' : 'hide';
    }
    const settingsCheckbox = document.getElementById('settings-vhs-labels');
    if (settingsCheckbox && settingsCheckbox.checked !== Boolean(show)) {
        settingsCheckbox.checked = Boolean(show);
    }
}

export function syncSettingsControls() {
    const style = document.getElementById('wheel-style');
    if (style) {
        style.value = isVhsEnabled() ? 'vhs' : 'classic';
    }
    syncCapacityInputs(getVhsCapacity());
    applyLabelsPreference(appState.preferences?.vhsShowLabels !== false);
}

export function applyLabelsPreference(show = appState.preferences?.vhsShowLabels !== false) {
    if (show) {
        document.body.classList.remove('hide-tape-labels');
    } else {
        document.body.classList.add('hide-tape-labels');
    }
    syncLabelsInputs(show);
}

export function initVhsWheel(handlers) {
    callbacks = handlers;
    setSpinTheaterCallbacks(callbacks);
    const stage = document.querySelector('.wheel-stage');
    scene = document.createElement('div');
    scene.className = 'vhs-scene';
    scene.hidden = true;
    scene.innerHTML = `<div class="vhs-rig"><div class="vhs-rotor">
        <div class="vhs-disc vhs-disc--back" aria-hidden="true"></div>
        <div class="vhs-disc vhs-disc--middle" aria-hidden="true"></div>
        <div class="vhs-disc vhs-disc--front" aria-hidden="true"></div>
        <div class="vhs-hub" aria-hidden="true"><span>PRAISE</span><strong>THE WHEEL!</strong></div>
        <div class="vhs-tapes"></div></div>
        <div class="vhs-flapper" aria-hidden="true"></div></div>`;
    inspector = document.createElement('div');
    inspector.className = 'vhs-inspector';
    inspector.hidden = true;
    inspector.innerHTML = `<div><strong class="vhs-inspector__title">Choose a tape to inspect it</strong>
        <span class="vhs-inspector__detail"></span></div>
        <button class="btn" type="button" id="vhs-pin" aria-pressed="false" disabled>Pin tape</button>
        <button class="btn" type="button" id="vhs-edit" disabled>Edit weight</button>`;
    stage.append(scene, inspector);
    rotor = scene.querySelector('.vhs-rotor');
    new ResizeObserver(entries => {
        const width = entries[0].contentRect.width;
        if (width) scene.style.setProperty('--rig-scale', width / 610);
    }).observe(scene);
    document.getElementById('wheel-style')?.addEventListener('change', event => {
        if (callbacks.isBusy()) return;
        appState.preferences.wheelStyle = event.target.value;
        saveState();
        callbacks.refresh();
    });
    const handleCapacityChange = event => {
        if (callbacks.isBusy()) return;
        const capacity = Math.max(4, Math.min(100, Number(event.target.value) || DEFAULT_VHS_CAPACITY));
        appState.preferences.vhsCapacity = capacity;
        saveState();
        syncCapacityInputs(capacity);
        getVhsLineup(callbacks.getEligible(), getCurrentSpinMode(), true);
        inspectedMovie = null;
        callbacks.clearWinner();
        callbacks.refresh();
    };
    document.getElementById('vhs-capacity-select')?.addEventListener('change', handleCapacityChange);
    document.getElementById('settings-vhs-capacity')?.addEventListener('change', handleCapacityChange);

    const handleLabelsChange = event => {
        const show = event.target.type === 'checkbox'
            ? event.target.checked
            : event.target.value !== 'hide';
        appState.preferences.vhsShowLabels = show;
        saveState();
        applyLabelsPreference(show);
    };
    document.getElementById('vhs-labels-select')?.addEventListener('change', handleLabelsChange);
    document.getElementById('settings-vhs-labels')?.addEventListener('change', handleLabelsChange);
    syncSettingsControls();

    document.getElementById('vhs-shuffle').addEventListener('click', () => {
        if (callbacks.isBusy()) return;
        getVhsLineup(callbacks.getEligible(), getCurrentSpinMode(), true);
        inspectedMovie = null;
        callbacks.clearWinner();
        callbacks.refresh();
    });
    inspector.querySelector('#vhs-pin').addEventListener('click', () => {
        if (!inspectedMovie || callbacks.isBusy()) return;
        const id = inspectedMovie.id;
        if (pinnedIds.has(id)) pinnedIds.delete(id);
        else pinnedIds.add(id);
        updateInspector();
        updateVhsControls(callbacks.getEligible());
    });
    inspector.querySelector('#vhs-edit').addEventListener('click', () => {
        if (inspectedMovie && !callbacks.isBusy()) callbacks.inspect(inspectedMovie);
    });
}

export function updateVhsControls(eligible) {
    if (!scene) return;
    const busy = callbacks.isBusy();
    const capacity = getVhsCapacity();
    syncSettingsControls();
    const style = document.getElementById('wheel-style');
    const shuffle = document.getElementById('vhs-shuffle');
    const note = document.getElementById('vhs-lineup-note');
    const capacityLabel = document.getElementById('vhs-capacity-label');
    const capacitySelect = document.getElementById('vhs-capacity-select') || document.getElementById('settings-vhs-capacity');
    const labelsLabel = document.getElementById('vhs-labels-label');
    const labelsSelect = document.getElementById('vhs-labels-select') || document.getElementById('settings-vhs-labels');
    const settingsGroup = document.getElementById('settings-vhs-group');
    const settingsCapacity = document.getElementById('settings-vhs-capacity');
    const settingsLabels = document.getElementById('settings-vhs-labels');
    const mode = activeMode || getCurrentSpinMode();
    if (style) {
        style.value = isVhsEnabled() ? 'vhs' : 'classic';
        style.disabled = busy;
    }
    if (capacityLabel) capacityLabel.hidden = !isVhsEnabled();
    if (capacitySelect) capacitySelect.disabled = busy;
    if (settingsCapacity) settingsCapacity.disabled = busy;
    if (labelsLabel) labelsLabel.hidden = !isVhsEnabled();
    if (labelsSelect) labelsSelect.disabled = busy;
    if (settingsLabels) settingsLabels.disabled = busy;
    if (settingsGroup) settingsGroup.hidden = false;
    const capacityRow = settingsCapacity?.closest('.settings-row');
    const labelsRow = settingsLabels?.closest('.filter-toggle');
    if (capacityRow) capacityRow.hidden = !isVhsEnabled();
    if (labelsRow) labelsRow.hidden = !isVhsEnabled();
    shuffle.hidden = !isVhsEnabled() || mode !== 'one-spin' || eligible.length <= capacity;
    shuffle.disabled = busy || pinnedIds.size >= capacity;
    shuffle.textContent = `Draw another ${capacity}`;
    if (!isVhsEnabled()) note.textContent = 'All eligible movies share the classic wheel.';
    else if (!eligible.length) note.textContent = 'Add movies to load the tapes.';
    else if (mode === 'one-spin') {
        const size = Math.min(eligible.length, capacity);
        note.textContent = `${size} ${size === 1 ? 'tape' : 'tapes'} from ${eligible.length.toLocaleString()} eligible ${eligible.length === 1 ? 'movie' : 'movies'}. ${eligible.length > capacity ? 'Random draw; weights apply only within this lineup.' : 'Weights apply to this spin.'}${pinnedIds.size ? ` ${pinnedIds.size} pinned.` : ''}`;
    } else if (mode === 'random-boost') note.textContent = 'Every eligible movie has an equal chance of a boost.';
    else note.textContent = eligible.length > capacity
        ? `All movies enter. Fast eliminations first; the final ${capacity} become VHS tapes.`
        : 'Last tape standing wins. Higher weights reduce the chance of elimination.';
}

function updateInspector() {
    const movie = inspectedMovie;
    inspector.querySelector('.vhs-inspector__title').textContent = movie?.name || 'Choose a tape to inspect it';
    const weight = movie?.weight || 1;
    const isKnockout = (activeMode || getCurrentSpinMode()) === 'knockout';
    const effectiveWeight = item => isKnockout ? 1 / (item.weight || 1) : item.weight || 1;
    const total = displayedMovies.reduce((sum, item) => sum + effectiveWeight(item), 0);
    inspector.querySelector('.vhs-inspector__detail').textContent = movie
        ? `${movie.year || 'Year unknown'} · ${weight}× weight · ${(effectiveWeight(movie) / total * 100).toFixed(1)}% ${isKnockout ? 'elimination risk' : 'chance in this lineup'}` : '';
    const pin = inspector.querySelector('#vhs-pin');
    pin.hidden = getCurrentSpinMode() !== 'one-spin' || callbacks.getEligible().length <= getVhsCapacity();
    pin.disabled = !movie;
    pin.setAttribute('aria-pressed', String(Boolean(movie && pinnedIds.has(movie.id))));
    pin.textContent = movie && pinnedIds.has(movie.id) ? 'Unpin tape' : 'Pin tape';
    inspector.querySelector('#vhs-edit').disabled = !movie;
}

function makeTape(movie, index, interactive = true) {
    const tape = document.createElement(interactive ? 'button' : 'div');
    tape.className = 'vhs-tape';
    tape.dataset.movieId = movie.id;
    if (interactive) {
        tape.type = 'button';
        tape.setAttribute('aria-label', `Inspect ${movie.name}${movie.year ? ` (${movie.year})` : ''}`);
        tape.addEventListener('click', () => {
            if (callbacks.isBusy()) return;
            inspectedMovie = displayedMovies.find(item => item.id === movie.id) || movie;
            updateInspector();
        });
    }
    tape.innerHTML = `<span class="vhs-face vhs-face--back"></span>
        <span class="vhs-face vhs-face--left"></span>
        <span class="vhs-face vhs-face--right"></span>
        <span class="vhs-face vhs-face--top"></span>
        <span class="vhs-face vhs-face--bottom"></span>
        <span class="vhs-face vhs-face--front"><span class="vhs-fallback"><small>VIDEO CASSETTE</small><strong></strong><em></em></span>
        <span class="vhs-rental"><b>VHS</b><span></span></span></span>`;
    tape.querySelector('.vhs-fallback strong').textContent = movie.name;
    tape.querySelector('.vhs-fallback em').textContent = movie.year || 'HOME VIDEO';
    tape.querySelector('.vhs-face--left').textContent = movie.name;
    tape.querySelector('.vhs-rental span').textContent = String(index + 1).padStart(2, '0');
    // Deterministic sleeve colors also distinguish tapes without artwork.
    tape.style.setProperty('--sleeve-hue', String((index * 43 + 15) % 360));
    fetchMovieMetadata(movie).then(result => {
        if (!result.data?.poster) return;
        const poster = new Image();
        poster.alt = '';
        poster.decoding = 'async';
        poster.referrerPolicy = 'no-referrer';
        poster.className = 'vhs-poster';
        poster.addEventListener('load', () => {
            tape.querySelector('.vhs-face--front').prepend(poster);
            tape.classList.add('has-poster');
        }, { once: true });
        poster.src = result.data.poster;
    });
    return tape;
}

/** Only the rotor transform changes per frame; posters and cuboids are reused. */
export function renderVhsWheel(movies, angle, { spinning = false, winnerId = null } = {}) {
    if (!scene) return false;
    const visible = useVhsForMovies(movies);
    scene.hidden = !visible;
    inspector.hidden = !visible;
    scene.closest('.wheel-stage').classList.toggle('has-vhs', visible);
    document.getElementById('wheel').hidden = visible;
    if (!visible) return false;
    const key = movies.map(movie => `${movie.id}:${movie.name}:${movie.year}`).join('|');
    if (key !== renderedKey) {
        renderedKey = key;
        const tapes = scene.querySelector('.vhs-tapes');
        tapes.replaceChildren();
        const tapeScale = movies.length > 10 ? Math.min(1, (12 / movies.length) * 1.05) : 1;
        const tapeRadius = 271 - 66 * tapeScale;
        scene.style.setProperty('--tape-scale', tapeScale.toFixed(3));
        movies.forEach((movie, index) => {
            const midpoint = (index + 0.5) * 2 * Math.PI / movies.length;
            const tape = makeTape(movie, index);
            tape.style.left = `${300 + Math.cos(midpoint) * tapeRadius}px`;
            tape.style.top = `${300 + Math.sin(midpoint) * tapeRadius}px`;
            tape.style.setProperty('--tape-angle', `${midpoint + Math.PI / 2}rad`);
            tapes.append(tape);
        });
    }
    displayedMovies = movies;
    if (inspectedMovie) inspectedMovie = movies.find(movie => movie.id === inspectedMovie.id);
    rotor.style.transform = `rotateZ(${angle}rad)`;
    scene.classList.toggle('is-spinning', spinning);
    for (const tape of scene.querySelectorAll('button.vhs-tape')) {
        tape.disabled = spinning || callbacks.isBusy();
        tape.classList.toggle('is-winner', tape.dataset.movieId === winnerId);
    }
    if (!spinning) updateInspector();
    return true;
}

export function tickVhsPointer() {
    // Static no-op: flapper remains completely static and never flaps
}

export async function animateVhsKnockout(movie, order) {
    if (!scene || scene.hidden || !movie) return;
    const theater = document.querySelector('.spin-theater');
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reducedMotion) {
        if (theater) {
            addTapeToEliminationStack(movie, order);
        }
        setTheaterStatus(`Eliminated: ${movie.name}`);
        await new Promise(resolve => setTimeout(resolve, 60));
        return;
    }

    const tape = scene.querySelector(`.vhs-tapes .vhs-tape[data-movie-id="${CSS.escape(String(movie.id))}"]`);
    if (!tape) return;

    const stack = theater?.querySelector('#spin-theater-stack');
    const stackAvailable = Boolean(theater && stack && window.getComputedStyle(stack).display !== 'none');

    if (theater && stackAvailable) {
        setTheaterStatus(`Eliminated: ${movie.name}`);
        const tapeRect = tape.getBoundingClientRect();
        const targetRect = prepareEliminationStackSlot(movie, order);

        const proxy = tape.cloneNode(true);
        proxy.className = `${tape.className} vhs-flight-proxy is-knocked-out`;
        if (tape.classList.contains('has-poster')) {
            proxy.classList.add('has-poster');
        }

        const sourcePoster = tape.querySelector('.vhs-poster');
        if (sourcePoster) {
            const proxyPoster = proxy.querySelector('.vhs-poster');
            if (proxyPoster) {
                proxyPoster.src = sourcePoster.src;
                proxyPoster.style.visibility = 'visible';
            } else {
                const frontFace = proxy.querySelector('.vhs-face--front');
                if (frontFace) {
                    const img = new Image();
                    img.className = 'vhs-poster';
                    img.alt = '';
                    img.src = sourcePoster.src;
                    img.style.visibility = 'visible';
                    frontFace.prepend(img);
                }
            }
            proxy.classList.add('has-poster');
        }

        proxy.removeAttribute('id');
        proxy.setAttribute('aria-hidden', 'true');
        proxy.setAttribute('tabindex', '-1');
        if ('disabled' in proxy) proxy.disabled = true;
        proxy.style.animation = 'none';
        proxy.style.position = 'fixed';
        proxy.style.left = tapeRect.left + 'px';
        proxy.style.top = tapeRect.top + 'px';
        proxy.style.width = tapeRect.width + 'px';
        proxy.style.height = tapeRect.height + 'px';
        proxy.style.margin = '0';
        proxy.style.pointerEvents = 'none';

        const stamp = document.createElement('span');
        stamp.className = 'vhs-stamp';
        stamp.setAttribute('aria-hidden', 'true');
        stamp.textContent = 'ELIMINATED';
        proxy.append(stamp);

        tape.style.visibility = 'hidden';
        theater.append(proxy);

        const dx = targetRect.left - tapeRect.left;
        const dy = targetRect.top - tapeRect.top;
        const scaleX = tapeRect.width ? targetRect.width / tapeRect.width : 1;
        const scaleY = tapeRect.height ? targetRect.height / tapeRect.height : 1;
        const targetScale = tapeRect.width ? targetRect.width / tapeRect.width : 1;

        const animation = proxy.animate([
            { transform: 'translate3d(0, 0, 80px) scale(1)' },
            { transform: `translate3d(${dx * 0.4}px, ${dy * 0.4 - 35}px, 120px) rotateY(-6deg) scale(1.04)` },
            { transform: `translate3d(${dx}px, ${dy}px, 0px) rotateY(0deg) scale(${targetScale})` }
        ], {
            duration: 750,
            easing: 'cubic-bezier(0.2, 0.85, 0.32, 1)'
        });

        if (animation?.finished) {
            try {
                await animation.finished;
            } catch {
                // Ignore if animation is cancelled
            }
        } else {
            await new Promise(resolve => setTimeout(resolve, 750));
        }

        commitEliminationStackSlot(movie, order);
        proxy.remove();
    } else {
        if (theater) {
            addTapeToEliminationStack(movie, order);
        }
        tape.classList.add('is-knocked-out');
        setTheaterStatus(`Eliminated: ${movie.name}`);
        await new Promise(resolve => setTimeout(resolve, 750));
    }
}

export async function revealVhsWinner(movie) {
    if (!scene || scene.hidden) return;
    clearVhsReveal();
    const reveal = document.createElement('div');
    reveal.className = 'vhs-reveal';
    reveal.setAttribute('aria-hidden', 'true');
    reveal.append(makeTape(movie, 0, false));
    scene.append(reveal);
    scene.classList.add('has-reveal');
    setTheaterStatus(`Tonight’s pick: ${movie.name}`);
    await new Promise(resolve => setTimeout(resolve,
        window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 150 : 1400));
}

export function clearVhsReveal() {
    scene?.querySelector('.vhs-reveal')?.remove();
    scene?.classList.remove('has-reveal');
}

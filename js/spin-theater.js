import { appState } from './state.js';
import { getMovieOriginalIndex } from './utils.js';
import { fetchMovieMetadata } from './movie-metadata.js';

/** Move the live wheel into a focused stage, preserving its place and page focus. */
let theater;
let stageSlot;
let knockoutSlot;
let previousFocus;
let previousScroll = 0;
let inertStates = [];
let lockedControls = [];
let callbacks = null;
let totalEliminationPool = 0;

export function setSpinTheaterCallbacks(userCallbacks) {
    callbacks = userCallbacks;
}

export function setEliminationTotal(total) {
    totalEliminationPool = total;
    updateEliminationCount();
}

export function lockSpinControls(locked) {
    if (locked) {
        lockedControls = Array.from(document.querySelectorAll(
            '#import-card, #selection-card, #wheel-aside, .spin-mode-selector, .vhs-controls, #settings-open, #history-btn, #reshow-winner-btn'
        ))
        .filter(element => element.id !== 'wheel-theater-btn')
        .map(element => [element, element.inert]);
        lockedControls.forEach(([element]) => { element.inert = true; });
        const theaterBtn = document.getElementById('wheel-theater-btn');
        if (theaterBtn) {
            theaterBtn.inert = false;
            theaterBtn.disabled = false;
        }
    } else {
        lockedControls.forEach(([element, wasInert]) => { element.inert = wasInert; });
        lockedControls = [];
        updateTheaterButtonState(false);
    }
}

export function openSpinTheater(mode, total = 0) {
    if (theater) return;
    const stage = document.querySelector('.wheel-stage');
    if (!stage) return;
    previousFocus = document.activeElement;
    previousScroll = window.scrollY;
    stageSlot = document.createComment('wheel stage');
    stage.before(stageSlot);
    theater = document.createElement('section');
    theater.className = 'spin-theater';
    if (mode === 'knockout') {
        totalEliminationPool = total || appState.selectedIds?.size || appState.movies?.length || 0;
        theater.classList.add('has-stack');
    }
    theater.setAttribute('role', 'dialog');
    theater.setAttribute('aria-modal', 'true');
    theater.setAttribute('aria-labelledby', 'spin-theater-title');
    theater.innerHTML = `<header class="spin-theater__header">
        <h2 id="spin-theater-title" class="visually-hidden">Wheel spin</h2>
        <div class="spin-theater__status-group visually-hidden">
            <p class="spin-theater__hint" aria-live="polite"></p>
        </div>
        <button type="button" class="btn spin-theater__exit">Exit focus <span aria-hidden="true">↗</span></button>
        </header><div class="spin-theater__stage"></div>`;
    const theaterStage = theater.querySelector('.spin-theater__stage');

    const knockoutBox = document.getElementById('knockout-remaining');
    if (mode === 'knockout' && knockoutBox) {
        knockoutSlot = document.createComment('knockout remaining slot');
        knockoutBox.before(knockoutSlot);

        const contendersAside = document.createElement('aside');
        contendersAside.className = 'spin-theater__contenders';
        contendersAside.id = 'spin-theater-contenders';
        contendersAside.setAttribute('aria-label', 'Final Contenders');
        contendersAside.hidden = Boolean(knockoutBox.hidden);
        contendersAside.append(knockoutBox);

        theaterStage.append(contendersAside);
        theater.classList.toggle('has-contenders', !contendersAside.hidden);
    }

    theaterStage.append(stage);
    if (mode === 'knockout') {
        const stackAside = document.createElement('aside');
        stackAside.className = 'spin-theater__stack';
        stackAside.id = 'spin-theater-stack';
        stackAside.setAttribute('aria-label', 'Eliminated tapes');
        stackAside.innerHTML = `<div class="spin-theater__stack-header">
            <span class="spin-theater__stack-title">Eliminated:</span>
            <span class="spin-theater__stack-count" id="spin-theater-stack-count">${totalEliminationPool > 0 ? `0/${totalEliminationPool}` : '0'}</span>
        </div>
        <div class="spin-theater__stack-list" id="spin-theater-stack-list" role="list"></div>`;
        theaterStage.append(stackAside);

        if (appState.knockoutResults && appState.knockoutResults.size > 0) {
            const eliminated = Array.from(appState.knockoutResults.entries())
                .filter(([, res]) => res.status !== 'champion')
                .sort((a, b) => (a[1].order ?? 0) - (b[1].order ?? 0));

            for (const [movieId, res] of eliminated) {
                const movie = appState.movies.find(m => m.id === movieId);
                if (movie) {
                    commitEliminationStackSlot(movie, res.order);
                }
            }
        }
    }
    theater.querySelector('button').addEventListener('click', () => closeSpinTheater());
    theater.addEventListener('keydown', handleTheaterKeys);
    document.body.append(theater);
    inertStates = Array.from(document.body.children)
        .filter(element => element !== theater && element.id !== 'win-modal' && element.id !== 'confetti-container')
        .map(element => [element, element.inert]);
    inertStates.forEach(([element]) => { element.inert = true; });
    document.body.classList.add('is-spin-focused');
    updateTheaterButtonState(false);
    theater.querySelector('button').focus({ preventScroll: true });
}

function handleTheaterKeys(event) {
    if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        closeSpinTheater();
    } else if (event.key === 'Tab') {
        // Tapes are display-only while spinning; the exit is the sole control.
        event.preventDefault();
        theater?.querySelector('button').focus();
    }
}

export function closeSpinTheater({ restoreFocus = true } = {}) {
    if (!theater) return false;
    document.querySelectorAll('.vhs-flight-proxy').forEach(element => element.remove());
    const stage = theater.querySelector('.wheel-stage');
    if (stage && stageSlot) {
        stageSlot.replaceWith(stage);
        stageSlot = null;
    }
    const knockoutBox = document.getElementById('knockout-remaining');
    if (knockoutBox && knockoutSlot) {
        knockoutSlot.replaceWith(knockoutBox);
        knockoutSlot = null;
    }
    inertStates.forEach(([element, wasInert]) => { element.inert = wasInert; });
    inertStates = [];
    theater.remove();
    theater = null;
    document.body.classList.remove('is-spin-focused');
    window.scrollTo({ top: previousScroll, behavior: 'instant' });
    updateTheaterButtonState();
    if (restoreFocus && previousFocus?.isConnected) previousFocus.focus({ preventScroll: true });
    return true;
}

export function updateTheaterButtonState(isBusy) {
    const btn = document.getElementById('wheel-theater-btn');
    if (!btn) return;

    const busy = typeof isBusy === 'boolean'
        ? isBusy
        : Boolean(
            callbacks?.isBusy?.() ||
            document.querySelector('.is-spinning') ||
            document.body.classList.contains('is-spinning')
        );

    if (busy) {
        btn.classList.add('is-active');
        btn.setAttribute('aria-label', 'Return to Theater Mode');
        btn.innerHTML = 'Return to Theater Mode <span aria-hidden="true">⛶</span>';
    } else {
        btn.classList.remove('is-active');
        btn.setAttribute('aria-label', 'Enter Theater Mode');
        btn.innerHTML = 'Theater Mode <span aria-hidden="true">⛶</span>';
    }
}

export function setTheaterStatus(text) {
    const hint = theater?.querySelector('.spin-theater__hint');
    if (hint) hint.textContent = text;
}

export function prepareEliminationStackSlot(movie, order) {
    const list = theater?.querySelector('#spin-theater-stack-list') || document.getElementById('spin-theater-stack-list');
    if (!list) return { left: 0, top: 0, width: 0, height: 0 };

    let slot = list.querySelector(`.vhs-stack-tape[data-movie-id="${CSS.escape(String(movie.id))}"]`);
    const wheelTape = document.querySelector(`.vhs-tapes .vhs-tape[data-movie-id="${CSS.escape(String(movie.id))}"]`);
    const sleeveHue = wheelTape?.style.getPropertyValue('--sleeve-hue')
        || String((getMovieOriginalIndex(movie, appState.movies) * 43 + 15) % 360);
    const posterUrl = wheelTape?.querySelector('.vhs-poster')?.src || movie.poster || '';

    if (!slot) {
        slot = document.createElement('div');
        slot.className = `vhs-stack-tape is-placeholder${posterUrl ? ' has-poster' : ''}`;
        slot.dataset.movieId = movie.id;
        if (order !== undefined) slot.dataset.order = String(order);
        slot.setAttribute('role', 'listitem');
        slot.style.visibility = 'hidden';
        slot.style.setProperty('--sleeve-hue', sleeveHue);

        slot.innerHTML = `<div class="vhs-stack-tape__cover">
            ${posterUrl ? `<img class="vhs-stack-tape__poster" src="${posterUrl}" alt="" />` : ''}
            <div class="vhs-stack-tape__fallback">
                <small>VIDEO CASSETTE</small>
                <strong></strong>
                <em></em>
            </div>
            <span class="vhs-stack-tape__stamp" aria-hidden="true">ELIMINATED #${order ?? ''}</span>
        </div>
        <div class="vhs-stack-tape__rental">
            <b>VHS</b>
            <span>#${order ?? ''}</span>
        </div>`;
        setStackMovieLabels(slot, movie);
        if (posterUrl) {
            const img = slot.querySelector('.vhs-stack-tape__poster');
            if (img) {
                img.addEventListener('error', () => {
                    slot.classList.remove('has-poster');
                }, { once: true });
            }
        }
        list.append(slot);
    } else {
        if (order !== undefined) slot.dataset.order = String(order);
        slot.style.setProperty('--sleeve-hue', sleeveHue);
        const stamp = slot.querySelector('.vhs-stack-tape__stamp');
        if (stamp) stamp.textContent = `ELIMINATED #${order ?? ''}`;
        const rental = slot.querySelector('.vhs-stack-tape__rental span');
        if (rental) rental.textContent = `#${order ?? ''}`;
        if (posterUrl) {
            slot.classList.add('has-poster');
            const cover = slot.querySelector('.vhs-stack-tape__cover');
            if (cover && !cover.querySelector('.vhs-stack-tape__poster')) {
                const img = document.createElement('img');
                img.className = 'vhs-stack-tape__poster';
                img.alt = '';
                img.src = posterUrl;
                img.addEventListener('error', () => slot.classList.remove('has-poster'), { once: true });
                cover.prepend(img);
            }
        }
    }
    slot.scrollIntoView({ block: 'nearest', behavior: 'instant' });
    return slot.getBoundingClientRect();
}

export function commitEliminationStackSlot(movie, order) {
    const list = theater?.querySelector('#spin-theater-stack-list') || document.getElementById('spin-theater-stack-list');
    if (!list) return null;

    let slot = list.querySelector(`.vhs-stack-tape[data-movie-id="${CSS.escape(String(movie.id))}"]`);
    const wheelTape = document.querySelector(`.vhs-tapes .vhs-tape[data-movie-id="${CSS.escape(String(movie.id))}"]`);
    const sleeveHue = wheelTape?.style.getPropertyValue('--sleeve-hue')
        || String((getMovieOriginalIndex(movie, appState.movies) * 43 + 15) % 360);
    const posterUrl = wheelTape?.querySelector('.vhs-poster')?.src || movie.poster || '';

    if (!slot) {
        slot = document.createElement('div');
        slot.dataset.movieId = movie.id;
        slot.className = `vhs-stack-tape${posterUrl ? ' has-poster' : ''}`;
        slot.setAttribute('role', 'listitem');
        slot.style.setProperty('--sleeve-hue', sleeveHue);
        slot.innerHTML = `<div class="vhs-stack-tape__cover">
            ${posterUrl ? `<img class="vhs-stack-tape__poster" src="${posterUrl}" alt="" />` : ''}
            <div class="vhs-stack-tape__fallback">
                <small>VIDEO CASSETTE</small>
                <strong></strong>
                <em></em>
            </div>
            <span class="vhs-stack-tape__stamp" aria-hidden="true">ELIMINATED #${order ?? ''}</span>
        </div>
        <div class="vhs-stack-tape__rental">
            <b>VHS</b>
            <span>#${order ?? ''}</span>
        </div>`;
        setStackMovieLabels(slot, movie);
        if (posterUrl) {
            const img = slot.querySelector('.vhs-stack-tape__poster');
            if (img) {
                img.addEventListener('error', () => {
                    slot.classList.remove('has-poster');
                }, { once: true });
            }
        }
        list.append(slot);
    } else {
        slot.classList.remove('is-placeholder');
        slot.style.setProperty('--sleeve-hue', sleeveHue);
        const stamp = slot.querySelector('.vhs-stack-tape__stamp');
        if (stamp) stamp.textContent = `ELIMINATED #${order ?? ''}`;
        const rental = slot.querySelector('.vhs-stack-tape__rental span');
        if (rental) rental.textContent = `#${order ?? ''}`;

        const cover = slot.querySelector('.vhs-stack-tape__cover');
        if (posterUrl) {
            slot.classList.add('has-poster');
            let img = cover?.querySelector('.vhs-stack-tape__poster');
            if (!img && cover) {
                img = document.createElement('img');
                img.className = 'vhs-stack-tape__poster';
                img.alt = '';
                img.src = posterUrl;
                img.addEventListener('error', () => slot.classList.remove('has-poster'), { once: true });
                cover.prepend(img);
            } else if (img && img.src !== posterUrl) {
                img.src = posterUrl;
            }
        }
    }

    slot.dataset.movieId = movie.id;
    if (order !== undefined) slot.dataset.order = String(order);
    slot.style.visibility = 'visible';
    slot.title = `${movie.name}${movie.year ? ` (${movie.year})` : ''} · Eliminated #${order ?? ''}`;

    if (!posterUrl) {
        fetchMovieMetadata(movie).then(result => {
            if (!result?.data?.poster) return;
            const resolvedUrl = result.data.poster;
            const currentCover = slot.querySelector('.vhs-stack-tape__cover');
            if (currentCover && !currentCover.querySelector('.vhs-stack-tape__poster')) {
                const img = document.createElement('img');
                img.className = 'vhs-stack-tape__poster';
                img.src = resolvedUrl;
                img.alt = '';
                img.loading = 'eager';
                img.addEventListener('error', () => slot.classList.remove('has-poster'), { once: true });
                currentCover.prepend(img);
                slot.classList.add('has-poster');
            }
        });
    }

    updateEliminationCount();
    return slot;
}

function updateEliminationCount() {
    const countEl = theater?.querySelector('#spin-theater-stack-count') || document.getElementById('spin-theater-stack-count');
    if (!countEl) return;
    const list = theater?.querySelector('#spin-theater-stack-list') || document.getElementById('spin-theater-stack-list');
    const count = list ? list.querySelectorAll('.vhs-stack-tape:not(.is-placeholder)').length : 0;
    const total = totalEliminationPool || appState.selectedIds?.size || appState.movies?.length || 0;
    countEl.textContent = total > 0 ? `${count}/${total}` : String(count);
}

function setStackMovieLabels(slot, movie) {
    slot.querySelector('.vhs-stack-tape__fallback strong').textContent = movie.name;
    slot.querySelector('.vhs-stack-tape__fallback em').textContent = movie.year || 'HOME VIDEO';
}

export function addTapeToEliminationStack(movie, order) {
    prepareEliminationStackSlot(movie, order);
    return commitEliminationStackSlot(movie, order);
}

export function clearEliminationStack() {
    const list = theater?.querySelector('#spin-theater-stack-list') || document.getElementById('spin-theater-stack-list');
    if (list) {
        list.replaceChildren();
    }
    updateEliminationCount();
}

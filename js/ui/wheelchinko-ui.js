/**
 * Wheelchinko UI Coordinator
 * Manages game styles (Lineup, Dynamic, Elimination), top drop aim bar, slot rendering with movie posters,
 * full-title hover tooltips, and a fair round/heat tournament elimination engine supporting up to 100 movies.
 */

import { appState, addToHistory } from '../state.js';
import { isVhsEnabled } from '../vhs-wheel.js';
import { playWinSound, playKnockoutSound } from '../audio.js';
import { fetchMovieMetadata } from '../movie-metadata.js';
import {
    initWheelchinkoCanvas,
    updateWheelchinkoSlots,
    setAimX,
    resetAimX,
    launchPuck,
    getIsDropping,
    cancelDrop,
    getBoardWidth
} from '../wheelchinko.js';
import { openSpinTheater } from '../spin-theater.js';

const DEFAULT_LINEUP_CAPACITY = 10;
const MAX_BATTLE_ROYALE_CAPACITY = 100;
let uiCallbacks = {};
let activeStyle = 'lineup';
let currentLineup = [];
let multiPuckCount = 3;
let isRapidRunning = false;
let rapidTimer = null;
let dom = {};

// Unified Battle Royale State (up to 100 movies on board)
let tourney = {
    active: false,
    contenders: [],
    eliminatedInWave: new Set()
};

export function initWheelchinkoUI(domElements, callbacks = {}) {
    uiCallbacks = callbacks;
    dom = {
        canvas: document.getElementById('wheelchinko-canvas'),
        aimBar: document.getElementById('wheelchinko-aim-bar'),
        aimMarker: document.getElementById('wheelchinko-aim-marker'),
        dropBtn: document.getElementById('wheelchinko-drop-btn'),
        randomBtn: document.getElementById('wheelchinko-random-btn'),
        redrawBtn: document.getElementById('wheelchinko-redraw-btn'),
        resetTourneyBtn: document.getElementById('wheelchinko-reset-tourney-btn'),
        tourneyStatus: document.getElementById('wheelchinko-tourney-status'),
        tourneyText: document.getElementById('wheelchinko-tourney-text'),
        puckSelector: document.getElementById('wheelchinko-puck-selector'),
        puckButtons: document.querySelectorAll('.wheelchinko-puck-btn'),
        slots: document.getElementById('wheelchinko-slots'),
        tooltip: document.getElementById('wheelchinko-tooltip')
    };

    if (dom.canvas) {
        initWheelchinkoCanvas(dom.canvas, { onSettled: handlePuckSettled, onBatchComplete: handleBatchComplete });
    }

    const setAimFromClientX = (clientX, targetRect) => {
        if (getIsDropping() || activeStyle === 'elimination') return;
        const frac = Math.max(0, Math.min(1, (clientX - targetRect.left) / targetRect.width));
        if (dom.aimMarker) dom.aimMarker.style.left = `${(frac * 100).toFixed(1)}%`;
        setAimX(frac);
    };

    if (dom.aimBar) {
        const onAim = (e) => setAimFromClientX(e.touches ? e.touches[0].clientX : e.clientX, dom.aimBar.getBoundingClientRect());
        dom.aimBar.addEventListener('mousemove', onAim);
        dom.aimBar.addEventListener('touchmove', onAim, { passive: true });
        dom.aimBar.addEventListener('click', onAim);
    }

    const canvasWrap = document.getElementById('wheelchinko-canvas-wrap');
    if (canvasWrap) {
        canvasWrap.addEventListener('click', (e) => {
            const rect = canvasWrap.getBoundingClientRect();
            if (e.clientY - rect.top <= rect.height * 0.65) setAimFromClientX(e.clientX, rect);
        });
    }

    dom.dropBtn?.addEventListener('click', () => triggerDrop());
    dom.randomBtn?.addEventListener('click', () => triggerRandomDrop());
    dom.redrawBtn?.addEventListener('click', () => { if (!getIsDropping() && !isRapidRunning) redrawLineup(); });
    dom.resetTourneyBtn?.addEventListener('click', () => resetTournament());
    document.getElementById('wheelchinko-theater-btn')?.addEventListener('click', () => openSpinTheater('wheelchinko'));

    dom.puckButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            if (btn.disabled || isRapidRunning) return;
            const count = parseInt(btn.dataset.count, 10);
            if (count >= 1 && count <= 5) {
                multiPuckCount = count;
                updateTourneyStatusUI();
            }
        });
    });

    document.querySelectorAll('.wheelchinko-style-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            if (getIsDropping() || isRapidRunning) { stopRapidElimination(); cancelDrop(); }
            const nextStyle = btn.dataset.style;
            if (nextStyle && nextStyle !== activeStyle) setWheelchinkoStyle(nextStyle);
        });
    });
}

export function setWheelchinkoStyle(style) {
    if (isRapidRunning) stopRapidElimination();
    cancelDrop();
    hideTooltip();
    activeStyle = style;
    document.querySelectorAll('.wheelchinko-style-btn').forEach(btn => btn.classList.toggle('is-active', btn.dataset.style === style));
    resetAimX();
    if (style === 'elimination') resetTournament();
    else tourney.active = false;
    syncWheelchinko();
}

export function getWheelchinkoStyle() { return activeStyle; }
export function getIsRapidEliminating() { return isRapidRunning; }

export function getActivePuckCount() {
    if (activeStyle !== 'elimination') return 1;
    const total = tourney.contenders.length;
    return total <= 10 ? 1 : Math.min(multiPuckCount, Math.max(1, currentLineup.length - 1));
}

function getEligibleMovies() {
    if (typeof uiCallbacks.getEligibleMovies === 'function') return uiCallbacks.getEligibleMovies();
    return appState.movies.filter(m => appState.selectedIds.has(m.id));
}

export function syncWheelchinko() {
    const eligible = getEligibleMovies();
    const stage = document.getElementById('wheelchinko-stage');
    if (!stage || stage.hidden) return;

    let slotMovies = [];
    const isElim = activeStyle === 'elimination';
    const isDyn = activeStyle === 'dynamic';

    if (dom.redrawBtn) dom.redrawBtn.hidden = isElim || isDyn || eligible.length <= DEFAULT_LINEUP_CAPACITY;
    [dom.resetTourneyBtn, dom.tourneyStatus].forEach(el => { if (el) el.hidden = !isElim; });
    [dom.aimBar, dom.randomBtn].forEach(el => { if (el) el.hidden = isElim; });

    if (activeStyle === 'lineup') {
        if (!currentLineup.length || currentLineup.some(m => !eligible.some(e => e.id === m.id))) {
            currentLineup = sampleLineup(eligible, DEFAULT_LINEUP_CAPACITY);
        }
        slotMovies = [...currentLineup];
        if (dom.dropBtn) { dom.dropBtn.hidden = false; dom.dropBtn.textContent = 'Drop Puck'; dom.dropBtn.disabled = false; }
    } else if (isDyn) {
        const weightedPool = [];
        eligible.forEach(m => {
            const w = Math.min(3, Math.max(1, Number(m.weight) || 1));
            for (let i = 0; i < w; i += 1) weightedPool.push(m);
        });
        slotMovies = weightedPool.length <= 25 ? weightedPool : eligible.slice(0, 25);
        if (dom.dropBtn) { dom.dropBtn.hidden = false; dom.dropBtn.textContent = 'Drop Puck'; dom.dropBtn.disabled = false; }
    } else {
        if (!tourney.contenders.length || (!tourney.active && tourney.contenders.some(m => !eligible.some(e => e.id === m.id)))) {
            setupTournament(eligible);
        }
        currentLineup = getEndgameSlotMovies(tourney.contenders);
        slotMovies = [...currentLineup];
        if (dom.dropBtn) {
            dom.dropBtn.hidden = false;
            dom.dropBtn.textContent = isRapidRunning ? 'Stop Elimination' : 'Start Elimination';
            dom.dropBtn.disabled = tourney.contenders.length <= 1 && !isRapidRunning;
        }
        updateTourneyStatusUI();
    }

    updateWheelchinkoSlots(slotMovies);
    renderSlotCards(slotMovies);
    uiCallbacks.updateSpinButtonLabel?.();
}

function setupTournament(movies) {
    tourney.active = false;
    tourney.contenders = sampleLineup(movies, Math.min(MAX_BATTLE_ROYALE_CAPACITY, movies.length));
    tourney.eliminatedInWave.clear();
    currentLineup = getEndgameSlotMovies(tourney.contenders);
}

function updateTourneyStatusUI() {
    const total = tourney.contenders.length;
    const isFinal10 = total <= 10;

    if (dom.tourneyText) {
        if (total === 2) dom.tourneyText.textContent = 'Elimination tournament · Final 2 showdown! (Single puck)';
        else if (isFinal10) dom.tourneyText.textContent = `Elimination tournament · Final ${total}! (Single puck)`;
        else dom.tourneyText.textContent = `Elimination Battle Royale · ${total} contenders on board`;
    }

    if (dom.puckSelector) {
        dom.puckSelector.classList.toggle('is-final-10', isFinal10);
        dom.puckButtons?.forEach(btn => {
            const count = parseInt(btn.dataset.count, 10);
            btn.disabled = isFinal10 ? count !== 1 : isRapidRunning;
            btn.classList.toggle('is-active', isFinal10 ? count === 1 : count === multiPuckCount);
            btn.title = isFinal10 ? 'Final 10 showdown: single puck active' : `${count} simultaneous pucks`;
        });
    }
}

function sampleLineup(movies, capacity) {
    if (movies.length <= capacity) return [...movies];
    const copy = [...movies];
    for (let i = 0; i < capacity; i += 1) {
        const rand = i + Math.floor(Math.random() * (copy.length - i));
        [copy[i], copy[rand]] = [copy[rand], copy[i]];
    }
    return copy.slice(0, capacity);
}

function getEndgameSlotMovies(contenders) {
    const count = contenders.length;
    if (count <= 1) return [...contenders];
    if (count === 2) {
        const slots = [];
        for (let i = 0; i < 5; i += 1) slots.push(contenders[0], contenders[1]);
        return slots;
    }
    if (count === 3) {
        const slots = [];
        for (let i = 0; i < 3; i += 1) slots.push(...contenders);
        return slots;
    }
    if (count === 4 || count === 5) return [...contenders, ...contenders];
    return [...contenders];
}

function redrawLineup() {
    currentLineup = sampleLineup(getEligibleMovies(), DEFAULT_LINEUP_CAPACITY);
    syncWheelchinko();
}

function resetTournament() {
    stopRapidElimination(); cancelDrop(); hideTooltip();
    setupTournament(getEligibleMovies());
    syncWheelchinko();
}

function showTooltip(card, movie) {
    const stage = document.getElementById('wheelchinko-stage');
    if (!dom.tooltip || !stage) return;
    const cr = card.getBoundingClientRect();
    const sr = stage.getBoundingClientRect();
    dom.tooltip.innerHTML = `<strong class="wheelchinko-tooltip-title">${movie.name}</strong><span class="wheelchinko-tooltip-meta">${movie.year || ''}${movie.weight > 1 ? ` · ${movie.weight}x weight` : ''}</span>`;
    dom.tooltip.hidden = false;
    dom.tooltip.style.left = `${cr.left - sr.left + cr.width / 2}px`;
    dom.tooltip.style.top = `${cr.top - sr.top}px`;
    dom.tooltip.classList.add('is-visible');
}

function hideTooltip() {
    if (!dom.tooltip) return;
    dom.tooltip.classList.remove('is-visible'); dom.tooltip.hidden = true;
}

function renderSlotCards(movies) {
    const container = dom.slots || document.getElementById('wheelchinko-slots');
    if (!container) return;
    container.style.gridTemplateColumns = `repeat(${movies.length}, minmax(0, 1fr))`;
    container.classList.toggle('is-compact-slots', movies.length > 30);
    container.classList.toggle('is-ultra-compact', movies.length > 60);
    container.innerHTML = '';
    const vhs = isVhsEnabled();

    movies.forEach((movie, index) => {
        const card = document.createElement('div');
        card.className = `wheelchinko-slot ${vhs ? 'wheelchinko-slot--vhs' : ''}`;
        card.dataset.slotIndex = String(index);
        card.dataset.movieId = movie.id;
        card.title = `${movie.name}${movie.year ? ` (${movie.year})` : ''}`;
        if (vhs) card.style.setProperty('--sleeve-color', movie.color || `hsl(${(index * 37) % 360}, 70%, 50%)`);
        card.innerHTML = `
            <div class="wheelchinko-slot-poster-wrap">
                <span class="wheelchinko-slot-num">${index + 1}</span>
                <img class="wheelchinko-slot-poster" alt="${movie.name}" loading="lazy">
                <div class="wheelchinko-slot-poster-fallback" aria-hidden="true"><span class="wheelchinko-slot-fallback-title">${movie.name}</span></div>
                ${movie.weight > 1 ? `<span class="wheelchinko-slot-weight">${movie.weight}x</span>` : ''}
            </div>`;
        const img = card.querySelector('.wheelchinko-slot-poster');
        const applyPoster = (url) => { if (url && img) { img.onload = () => card.classList.add('has-poster'); img.src = url; } };
        if (movie.poster) applyPoster(movie.poster);
        else fetchMovieMetadata(movie).then(res => { if (res?.data?.poster) applyPoster(res.data.poster); }).catch(() => {});
        card.addEventListener('mouseenter', () => showTooltip(card, movie));
        card.addEventListener('mouseleave', hideTooltip);
        card.addEventListener('focus', () => showTooltip(card, movie));
        card.addEventListener('blur', hideTooltip);
        card.addEventListener('click', () => { if (typeof uiCallbacks.onInspectMovie === 'function') uiCallbacks.onInspectMovie(movie); });
        container.append(card);
    });
}

export function triggerDrop() {
    if (activeStyle === 'elimination') { toggleRapidElimination(); return; }
    if (!getIsDropping()) { lockButtons(true); launchPuck(); }
}

export function triggerRandomDrop() {
    if (activeStyle === 'elimination') { toggleRapidElimination(); return; }
    if (getIsDropping()) return;
    const w = getBoardWidth();
    const randX = 70 + Math.random() * (w - 140);
    setAimX((randX - 70) / (w - 140));
    if (dom.aimMarker) dom.aimMarker.style.left = `${(((randX - 70) / (w - 140)) * 100).toFixed(1)}%`;
    lockButtons(true);
    launchPuck(randX);
}

export function toggleRapidElimination() {
    if (isRapidRunning) stopRapidElimination();
    else startRapidElimination();
}

export function startRapidElimination() {
    if (tourney.contenders.length <= 1) return;
    tourney.active = true; isRapidRunning = true;
    updateEliminationButtonLabels(); updateTourneyStatusUI();
    runNextEliminationDrop();
}

export function stopRapidElimination() {
    isRapidRunning = false;
    if (rapidTimer) { clearTimeout(rapidTimer); rapidTimer = null; }
    updateEliminationButtonLabels(); updateTourneyStatusUI();
}

function updateEliminationButtonLabels() {
    if (dom.dropBtn && activeStyle === 'elimination') {
        dom.dropBtn.textContent = isRapidRunning ? 'Stop Elimination' : 'Start Elimination';
        dom.dropBtn.disabled = tourney.contenders.length <= 1 && !isRapidRunning;
    }
    uiCallbacks.updateSpinButtonLabel?.();
}

function runNextEliminationDrop() {
    if (!isRapidRunning || tourney.contenders.length <= 1) { stopRapidElimination(); return; }
    if (getIsDropping()) return;
    tourney.eliminatedInWave.clear();
    lockButtons(true);
    const count = getActivePuckCount();
    const boardW = getBoardWidth();
    const numSlots = currentLineup.length;
    const slotW = (boardW - 80) / Math.max(1, numSlots);

    let targetXs;
    if (tourney.contenders.length <= 5) {
        if (tourney.contenders.length === 2) {
            const centerSeam = Math.floor(numSlots / 2);
            const seam = Math.random() < 0.65 ? centerSeam : (1 + Math.floor(Math.random() * (numSlots - 1)));
            const targetX = 40 + seam * slotW + (Math.random() - 0.5) * 6;
            targetXs = [Math.max(70, Math.min(boardW - 70, targetX))];
        } else {
            const seam = 1 + Math.floor(Math.random() * (numSlots - 1));
            const targetX = 40 + seam * slotW + (Math.random() - 0.5) * 6;
            targetXs = [Math.max(70, Math.min(boardW - 70, targetX))];
        }
    } else {
        const activeIndices = currentLineup.map((_, i) => i);
        const shuffled = [...activeIndices].sort(() => Math.random() - 0.5);
        const chosenTargets = shuffled.slice(0, count);
        targetXs = chosenTargets.map(idx => {
            const targetCenter = 40 + (idx + 0.5) * slotW;
            const jitter = (Math.random() - 0.5) * Math.min(60, Math.max(10, slotW * 1.2));
            return Math.max(70, Math.min(boardW - 70, targetCenter + jitter));
        });
    }

    launchPuck(null, { speed: 1.35, count, targets: targetXs });
}

function lockButtons(locked) {
    const mainSpin = document.getElementById('spin-button');
    if (activeStyle === 'elimination') {
        if (dom.dropBtn) { dom.dropBtn.disabled = false; dom.dropBtn.textContent = isRapidRunning ? 'Stop Elimination' : 'Start Elimination'; }
        if (mainSpin) { mainSpin.disabled = false; mainSpin.textContent = isRapidRunning ? 'Stop Wheelchinko Elimination' : 'Start Wheelchinko Elimination'; }
        if (dom.randomBtn) dom.randomBtn.disabled = locked;
    } else {
        [dom.dropBtn, dom.randomBtn, mainSpin].forEach(b => { if (b) b.disabled = locked; });
    }
}

function handlePuckSettled(winningSlot) {
    if (!winningSlot || !winningSlot.movie) return;
    const movie = winningSlot.movie;

    if (activeStyle === 'elimination') {
        let targetIndex = winningSlot.index;
        if (tourney.eliminatedInWave.has(targetIndex)) {
            let closest = -1;
            let minDiff = Infinity;
            for (let i = 0; i < currentLineup.length; i += 1) {
                if (!tourney.eliminatedInWave.has(i) && Math.abs(i - targetIndex) < minDiff) {
                    minDiff = Math.abs(i - targetIndex);
                    closest = i;
                }
            }
            if (closest !== -1) targetIndex = closest;
        }

        tourney.eliminatedInWave.add(targetIndex);
        const eliminatedMovie = currentLineup[targetIndex] || movie;
        playKnockoutSound();
        const card = document.querySelector(`.wheelchinko-slot[data-slot-index="${targetIndex}"]`);
        if (card) card.classList.add('is-eliminated');
        if (eliminatedMovie?.id) {
            document.querySelectorAll(`.wheelchinko-slot[data-movie-id="${eliminatedMovie.id}"]`).forEach(c => c.classList.add('is-eliminated'));
        }
        const result = document.getElementById('result');
        if (result && eliminatedMovie) {
            result.className = 'result';
            result.textContent = `Eliminated: ${eliminatedMovie.name}`;
        }
    } else {
        lockButtons(false);
        document.querySelectorAll('.wheelchinko-slot').forEach(el => el.classList.remove('is-winner'));
        const matchedCard = document.querySelector(`.wheelchinko-slot[data-slot-index="${winningSlot.index}"]`);
        if (matchedCard) matchedCard.classList.add('is-winner');
        handleWinnerLanding(movie);
    }
}

function handleBatchComplete() {
    lockButtons(false);
    if (activeStyle !== 'elimination' || tourney.eliminatedInWave.size === 0) return;

    // Eliminate all hit contenders in this wave
    const eliminatedIds = new Set();
    for (const idx of tourney.eliminatedInWave) {
        const removed = currentLineup[idx];
        if (removed?.id) eliminatedIds.add(removed.id);
    }
    tourney.contenders = tourney.contenders.filter(m => !eliminatedIds.has(m.id));
    tourney.eliminatedInWave.clear();
    currentLineup = getEndgameSlotMovies(tourney.contenders);
    updateTourneyStatusUI();

    if (tourney.contenders.length <= 1) {
        stopRapidElimination();
        syncWheelchinko();
        const champion = tourney.contenders[0] || currentLineup[0];
        if (champion) rapidTimer = setTimeout(() => handleWinnerLanding(champion), 500);
        return;
    }

    // Brief pause showing red knockout flash, then expand remaining slots and drop next wave!
    rapidTimer = setTimeout(() => {
        syncWheelchinko();
        if (isRapidRunning) rapidTimer = setTimeout(() => runNextEliminationDrop(), 360);
    }, 400);
}

function handleWinnerLanding(winningMovie) {
    playWinSound();
    addToHistory(winningMovie, 'wheelchinko');
    const result = document.getElementById('result');
    if (result) {
        result.className = 'result result--winner';
        result.textContent = `Winner: ${winningMovie.name}${winningMovie.year ? ` (${winningMovie.year})` : ''}`;
    }
    uiCallbacks.triggerConfetti?.();
    uiCallbacks.showWinnerPopup?.(winningMovie, { spinMode: 'wheelchinko' });
}

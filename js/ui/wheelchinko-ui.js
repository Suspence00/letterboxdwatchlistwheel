/**
 * Wheelchinko UI Coordinator
 * Manages game styles (Random 10, Elimination, Spinchinko), top drop aim bar, slot rendering with movie posters,
 * full-title hover tooltips, and tournament / qualifier engines supporting up to 100 movies.
 */

import { appState, addToHistory } from '../state.js';
import { isVhsEnabled } from '../vhs-wheel.js';
import { playWinSound, playKnockoutSound } from '../audio.js';
import { fetchMovieMetadata } from '../movie-metadata.js';
import {
    initWheelchinkoCanvas, updateWheelchinkoSlots, setAimX, resetAimX,
    launchPuck, getIsDropping, cancelDrop, getBoardWidth
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

let spinchinko = { wheelType: 'one-spin', qualifiers: [], contenders: [], slotMovies: [], isDropping: false };
let tourney = { active: false, contenders: [], eliminatedInWave: new Set() };

export function initWheelchinkoUI(domElements, callbacks = {}) {
    uiCallbacks = callbacks;
    const getEl = id => document.getElementById(id);
    dom = {
        canvas: getEl('wheelchinko-canvas'), aimBar: getEl('wheelchinko-aim-bar'),
        aimMarker: getEl('wheelchinko-aim-marker'), dropBtn: getEl('wheelchinko-drop-btn'),
        randomBtn: getEl('wheelchinko-random-btn'), redrawBtn: getEl('wheelchinko-redraw-btn'),
        resetTourneyBtn: getEl('wheelchinko-reset-tourney-btn'), tourneyStatus: getEl('wheelchinko-tourney-status'),
        tourneyText: getEl('wheelchinko-tourney-text'), puckSelector: getEl('wheelchinko-puck-selector'),
        puckButtons: document.querySelectorAll('.wheelchinko-puck-btn'),
        spinchinkoBar: getEl('wheelchinko-spinchinko-bar'), spinchinkoDesc: getEl('wheelchinko-spinchinko-desc'),
        spinchinkoRedropBtn: getEl('wheelchinko-spinchinko-redrop-btn'),
        spinchinkoWheelTypeBtns: document.querySelectorAll('.spinchinko-wheel-type-btn'),
        slots: getEl('wheelchinko-slots'), tooltip: getEl('wheelchinko-tooltip')
    };

    if (dom.canvas) initWheelchinkoCanvas(dom.canvas, { onSettled: handlePuckSettled, onBatchComplete: handleBatchComplete });

    const setAimFromClientX = (clientX, targetRect) => {
        if (getIsDropping() || activeStyle === 'elimination' || activeStyle === 'spinchinko') return;
        const frac = Math.max(0, Math.min(1, (clientX - targetRect.left) / targetRect.width));
        if (dom.aimMarker) dom.aimMarker.style.left = `${(frac * 100).toFixed(1)}%`;
        setAimX(frac);
    };

    if (dom.aimBar) {
        const onAim = e => setAimFromClientX(e.touches ? e.touches[0].clientX : e.clientX, dom.aimBar.getBoundingClientRect());
        ['mousemove', 'touchmove', 'click'].forEach(ev => dom.aimBar.addEventListener(ev, onAim, { passive: true }));
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
    dom.spinchinkoRedropBtn?.addEventListener('click', () => { if (!getIsDropping() && !spinchinko.isDropping) startSpinchinkoDrop(); });
    document.getElementById('wheelchinko-theater-btn')?.addEventListener('click', () => openSpinTheater('wheelchinko'));

    dom.spinchinkoWheelTypeBtns?.forEach(btn => {
        btn.addEventListener('click', () => {
            const type = btn.dataset.wheelType;
            if (type && type !== spinchinko.wheelType) {
                spinchinko.wheelType = type;
                dom.spinchinkoWheelTypeBtns.forEach(b => b.classList.toggle('is-active', b.dataset.wheelType === type));
                updateSpinchinkoStatusUI();
                uiCallbacks.updateSpinButtonLabel?.();
            }
        });
    });

    dom.puckButtons?.forEach(btn => {
        btn.addEventListener('click', () => {
            if (btn.disabled || isRapidRunning) return;
            const count = parseInt(btn.dataset.count, 10);
            if (count >= 1 && count <= 5) { multiPuckCount = count; updateTourneyStatusUI(); }
        });
    });

    document.querySelectorAll('.wheelchinko-style-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            if (getIsDropping() || isRapidRunning || spinchinko.isDropping) { stopRapidElimination(); cancelDrop(); }
            const nextStyle = btn.dataset.style;
            if (nextStyle && nextStyle !== activeStyle) setWheelchinkoStyle(nextStyle);
        });
    });
}

export function setWheelchinkoStyle(style) {
    if (isRapidRunning) stopRapidElimination();
    cancelDrop(); hideTooltip(); activeStyle = style;
    document.querySelectorAll('.wheelchinko-style-btn').forEach(btn => btn.classList.toggle('is-active', btn.dataset.style === style));
    resetAimX();
    if (style === 'elimination') resetTournament();
    else if (style === 'spinchinko') resetSpinchinko();
    else { tourney.active = false; spinchinko.isDropping = false; }
    syncWheelchinko();
}

export function getWheelchinkoStyle() { return activeStyle; }
export function getIsRapidEliminating() { return isRapidRunning; }
export function getActivePuckCount() {
    if (activeStyle !== 'elimination') return 1;
    return tourney.contenders.length <= 10 ? 1 : Math.min(multiPuckCount, Math.max(1, currentLineup.length - 1));
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
    const isSpin = activeStyle === 'spinchinko';

    if (dom.redrawBtn) dom.redrawBtn.hidden = isElim || isSpin || eligible.length <= DEFAULT_LINEUP_CAPACITY;
    [dom.resetTourneyBtn, dom.tourneyStatus].forEach(el => { if (el) el.hidden = !isElim; });
    [dom.aimBar, dom.randomBtn].forEach(el => { if (el) el.hidden = isElim || isSpin; });
    if (dom.spinchinkoBar) dom.spinchinkoBar.hidden = !isSpin;

    if (activeStyle === 'lineup') {
        if (!currentLineup.length || currentLineup.some(m => !eligible.some(e => e.id === m.id))) {
            currentLineup = sampleLineup(eligible, DEFAULT_LINEUP_CAPACITY);
        }
        slotMovies = [...currentLineup];
        if (dom.dropBtn) { dom.dropBtn.hidden = false; dom.dropBtn.textContent = 'Drop Puck'; dom.dropBtn.disabled = false; }
    } else if (isSpin) {
        if (!spinchinko.contenders.length || spinchinko.contenders.some(m => !eligible.some(e => e.id === m.id))) {
            setupSpinchinkoContenders(eligible);
        }
        slotMovies = [...spinchinko.slotMovies];
        updateSpinchinkoStatusUI();
    } else {
        if (!tourney.contenders.length || (!tourney.active && tourney.contenders.some(m => !eligible.some(e => e.id === m.id)))) {
            setupTournament(eligible);
        }
        currentLineup = getEndgameSlotMovies(tourney.contenders);
        slotMovies = [...currentLineup];
        if (dom.dropBtn) { dom.dropBtn.hidden = false; dom.dropBtn.textContent = isRapidRunning ? 'Stop Elimination' : 'Start Elimination'; dom.dropBtn.disabled = tourney.contenders.length <= 1 && !isRapidRunning; }
        updateTourneyStatusUI();
    }

    updateWheelchinkoSlots(slotMovies);
    renderSlotCards(slotMovies);
    if (isSpin && spinchinko.qualifiers.length > 0) {
        const qIndices = new Set(spinchinko.qualifiers.map(q => q.slotIndex));
        document.querySelectorAll('.wheelchinko-slot').forEach(card => {
            if (qIndices.has(parseInt(card.dataset.slotIndex, 10))) card.classList.add('is-qualified');
        });
    }
    uiCallbacks.updateSpinButtonLabel?.();
}

function resetSpinchinko() { spinchinko.qualifiers = []; spinchinko.isDropping = false; setupSpinchinkoContenders(getEligibleMovies()); }
function setupSpinchinkoContenders(movies) {
    spinchinko.contenders = sampleLineup(movies, Math.min(MAX_BATTLE_ROYALE_CAPACITY, movies.length));
    spinchinko.slotMovies = getEndgameSlotMovies(spinchinko.contenders);
    spinchinko.qualifiers = []; spinchinko.isDropping = false;
}

export function getSpinchinkoButtonLabel() {
    const targetCount = Math.min(10, spinchinko.contenders.length || getEligibleMovies().length);
    if (getIsDropping() || spinchinko.isDropping) return 'Dropping Golden Pucks...';
    if (spinchinko.qualifiers.length >= targetCount && targetCount > 0) {
        return spinchinko.wheelType === 'knockout'
            ? `Spin Knockout Wheel (${spinchinko.qualifiers.length} Finalists)`
            : `Spin Wheel (${spinchinko.qualifiers.length} Finalists)`;
    }
    return 'Drop 10 Golden Pucks';
}

function updateSpinchinkoStatusUI() {
    const targetCount = Math.min(10, spinchinko.contenders.length), hasFinalists = spinchinko.qualifiers.length >= targetCount && targetCount > 0;
    if (dom.spinchinkoDesc) {
        const modeName = spinchinko.wheelType === 'knockout' ? 'Knockout Elimination' : '1 Spin Mode';
        dom.spinchinkoDesc.textContent = spinchinko.isDropping
            ? `Dropping golden pucks... (${spinchinko.qualifiers.length}/${targetCount} finalists locked)`
            : (hasFinalists ? `${spinchinko.qualifiers.length} finalists qualified! Ready for ${modeName} wheel showdown.`
                : `Drop 10 golden pucks to qualify ${targetCount} finalists for the wheel showdown!`);
    }
    if (dom.spinchinkoRedropBtn) dom.spinchinkoRedropBtn.hidden = !hasFinalists || spinchinko.isDropping;
    if (dom.dropBtn && activeStyle === 'spinchinko') {
        dom.dropBtn.textContent = getSpinchinkoButtonLabel(); dom.dropBtn.disabled = spinchinko.isDropping;
    }
}

function setupTournament(movies) {
    tourney.active = false;
    tourney.contenders = sampleLineup(movies, Math.min(MAX_BATTLE_ROYALE_CAPACITY, movies.length));
    tourney.eliminatedInWave.clear();
    currentLineup = getEndgameSlotMovies(tourney.contenders);
}

function updateTourneyStatusUI() {
    const total = tourney.contenders.length, isFinal10 = total <= 10;
    if (dom.tourneyText) {
        dom.tourneyText.textContent = total === 2 ? 'Elimination tournament · Final 2 showdown! (Single puck)'
            : isFinal10 ? `Elimination tournament · Final ${total}! (Single puck)`
            : `Elimination Battle Royale · ${total} contenders on board`;
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
    if (count === 2) return Array.from({ length: 10 }, (_, i) => contenders[i % 2]);
    if (count === 3) return [...contenders, ...contenders, ...contenders];
    return (count === 4 || count === 5) ? [...contenders, ...contenders] : [...contenders];
}

function redrawLineup() {
    currentLineup = sampleLineup(getEligibleMovies(), DEFAULT_LINEUP_CAPACITY);
    syncWheelchinko();
}

function resetTournament() {
    stopRapidElimination(); cancelDrop(); hideTooltip();
    setupTournament(getEligibleMovies()); syncWheelchinko();
}

function showTooltip(card, movie) {
    const stage = document.getElementById('wheelchinko-stage');
    if (!dom.tooltip || !stage) return;
    const cr = card.getBoundingClientRect(), sr = stage.getBoundingClientRect();
    dom.tooltip.innerHTML = `<strong class="wheelchinko-tooltip-title">${movie.name}</strong><span class="wheelchinko-tooltip-meta">${movie.year || ''}${movie.weight > 1 ? ` · ${movie.weight}x weight` : ''}</span>`;
    dom.tooltip.hidden = false;
    dom.tooltip.style.left = `${cr.left - sr.left + cr.width / 2}px`;
    dom.tooltip.style.top = `${cr.top - sr.top}px`;
    dom.tooltip.classList.add('is-visible');
}
function hideTooltip() { if (dom.tooltip) { dom.tooltip.classList.remove('is-visible'); dom.tooltip.hidden = true; } }

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
        card.innerHTML = `<div class="wheelchinko-slot-poster-wrap"><span class="wheelchinko-slot-num">${index + 1}</span><img class="wheelchinko-slot-poster" alt="${movie.name}" loading="lazy"><div class="wheelchinko-slot-poster-fallback" aria-hidden="true"><span class="wheelchinko-slot-fallback-title">${movie.name}</span></div>${movie.weight > 1 ? `<span class="wheelchinko-slot-weight">${movie.weight}x</span>` : ''}</div>`;
        const img = card.querySelector('.wheelchinko-slot-poster');
        const applyPoster = (url) => { if (url && img) { img.onload = () => card.classList.add('has-poster'); img.src = url; } };
        if (movie.poster) applyPoster(movie.poster);
        else fetchMovieMetadata(movie).then(res => { if (res?.data?.poster) applyPoster(res.data.poster); }).catch(() => {});
        ['mouseenter', 'focus'].forEach(ev => card.addEventListener(ev, () => showTooltip(card, movie)));
        ['mouseleave', 'blur'].forEach(ev => card.addEventListener(ev, hideTooltip));
        card.addEventListener('click', () => { if (typeof uiCallbacks.onInspectMovie === 'function') uiCallbacks.onInspectMovie(movie); });
        container.append(card);
    });
}

export function triggerDrop() {
    if (activeStyle === 'elimination') { toggleRapidElimination(); return; }
    if (activeStyle === 'spinchinko') {
        const targetCount = Math.min(10, spinchinko.contenders.length);
        if (spinchinko.qualifiers.length >= targetCount && targetCount > 0) {
            const finalistMovies = spinchinko.qualifiers.map(q => q.movie);
            spinchinko.qualifiers = [];
            uiCallbacks.spinWheel?.(spinchinko.wheelType, null, finalistMovies);
            return;
        }
        startSpinchinkoDrop();
        return;
    }
    if (!getIsDropping()) { lockButtons(true); launchPuck(); }
}

export function triggerRandomDrop() {
    if (activeStyle === 'elimination') { toggleRapidElimination(); return; }
    if (activeStyle === 'spinchinko') { triggerDrop(); return; }
    if (getIsDropping()) return;
    const w = getBoardWidth(), randX = 70 + Math.random() * (w - 140);
    setAimX((randX - 70) / (w - 140));
    if (dom.aimMarker) dom.aimMarker.style.left = `${(((randX - 70) / (w - 140)) * 100).toFixed(1)}%`;
    lockButtons(true); launchPuck(randX);
}

export function startSpinchinkoDrop() {
    if (getIsDropping() || spinchinko.isDropping) return;
    const eligible = getEligibleMovies();
    if (!spinchinko.contenders.length) setupSpinchinkoContenders(eligible);
    const targetCount = Math.min(10, spinchinko.contenders.length);
    if (targetCount === 0) return;

    spinchinko.qualifiers = [];
    spinchinko.isDropping = true;
    document.querySelectorAll('.wheelchinko-slot').forEach(el => el.classList.remove('is-qualified', 'is-winner'));

    const boardW = getBoardWidth(), span = (boardW - 160) / Math.max(1, targetCount);
    const targets = Array.from({ length: targetCount }, (_, i) => {
        const tx = 80 + span * (i + 0.5) + (Math.random() - 0.5) * (span * 0.6);
        return Math.max(70, Math.min(boardW - 70, tx));
    });

    lockButtons(true); updateSpinchinkoStatusUI(); uiCallbacks.updateSpinButtonLabel?.();
    launchPuck(null, { speed: 1.25, count: targetCount, targets, golden: true });
}

export function toggleRapidElimination() { if (isRapidRunning) stopRapidElimination(); else startRapidElimination(); }
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
    const boardW = getBoardWidth(), numSlots = currentLineup.length, slotW = (boardW - 80) / Math.max(1, numSlots);

    let targetXs;
    if (tourney.contenders.length <= 5) {
        const seam = 1 + Math.floor(Math.random() * (numSlots - 1));
        targetXs = [Math.max(70, Math.min(boardW - 70, 40 + seam * slotW + (Math.random() - 0.5) * 6))];
    } else {
        const shuffled = currentLineup.map((_, i) => i).sort(() => Math.random() - 0.5);
        targetXs = shuffled.slice(0, count).map(idx => {
            const jitter = (Math.random() - 0.5) * Math.min(60, Math.max(10, slotW * 1.2));
            return Math.max(70, Math.min(boardW - 70, 40 + (idx + 0.5) * slotW + jitter));
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
        [dom.dropBtn, dom.randomBtn, mainSpin, dom.spinchinkoRedropBtn].forEach(b => { if (b) b.disabled = locked; });
    }
}

function findClosestAvailableSlot(targetIndex, totalSlots, isUnavailable) {
    let closest = -1, minDiff = Infinity;
    for (let i = 0; i < totalSlots; i += 1) {
        if (!isUnavailable(i) && Math.abs(i - targetIndex) < minDiff) {
            minDiff = Math.abs(i - targetIndex); closest = i;
        }
    }
    return closest !== -1 ? closest : targetIndex;
}

function handlePuckSettled(winningSlot) {
    if (!winningSlot?.movie) return;
    const movie = winningSlot.movie;

    if (activeStyle === 'elimination') {
        const targetIndex = tourney.eliminatedInWave.has(winningSlot.index)
            ? findClosestAvailableSlot(winningSlot.index, currentLineup.length, i => tourney.eliminatedInWave.has(i))
            : winningSlot.index;
        tourney.eliminatedInWave.add(targetIndex);
        const eliminatedMovie = currentLineup[targetIndex] || movie;
        playKnockoutSound();
        document.querySelectorAll(`.wheelchinko-slot[data-slot-index="${targetIndex}"], .wheelchinko-slot[data-movie-id="${eliminatedMovie?.id}"]`).forEach(c => c.classList.add('is-eliminated'));
        const result = document.getElementById('result');
        if (result && eliminatedMovie) {
            result.className = 'result'; result.textContent = `Eliminated: ${eliminatedMovie.name}`;
        }
    } else if (activeStyle === 'spinchinko') {
        const targetCount = Math.min(10, spinchinko.contenders.length);
        const qSlots = new Set(spinchinko.qualifiers.map(q => q.slotIndex));
        const qIds = new Set(spinchinko.qualifiers.map(q => q.movie.id));
        const isUnavailable = i => qSlots.has(i) || qIds.has(spinchinko.slotMovies[i]?.id);
        const targetIndex = isUnavailable(winningSlot.index)
            ? findClosestAvailableSlot(winningSlot.index, spinchinko.slotMovies.length, isUnavailable)
            : winningSlot.index;
        const candidate = spinchinko.slotMovies[targetIndex] || movie;
        if (candidate && !qIds.has(candidate.id) && spinchinko.qualifiers.length < targetCount) {
            spinchinko.qualifiers.push({ slotIndex: targetIndex, movie: candidate });
            playWinSound();
            document.querySelector(`.wheelchinko-slot[data-slot-index="${targetIndex}"]`)?.classList.add('is-qualified');
        }
        updateSpinchinkoStatusUI();
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
    if (activeStyle === 'spinchinko') {
        spinchinko.isDropping = false;
        const targetCount = Math.min(10, spinchinko.contenders.length);
        const qIds = new Set(spinchinko.qualifiers.map(q => q.movie.id));
        for (let i = 0; i < spinchinko.slotMovies.length && spinchinko.qualifiers.length < targetCount; i += 1) {
            const m = spinchinko.slotMovies[i];
            if (m && !qIds.has(m.id)) {
                qIds.add(m.id); spinchinko.qualifiers.push({ slotIndex: i, movie: m });
                document.querySelector(`.wheelchinko-slot[data-slot-index="${i}"]`)?.classList.add('is-qualified');
            }
        }
        updateSpinchinkoStatusUI();
        uiCallbacks.updateSpinButtonLabel?.();
        return;
    }

    if (activeStyle !== 'elimination' || tourney.eliminatedInWave.size === 0) return;

    const eliminatedIds = new Set(Array.from(tourney.eliminatedInWave, idx => currentLineup[idx]?.id).filter(Boolean));
    tourney.contenders = tourney.contenders.filter(m => !eliminatedIds.has(m.id));
    tourney.eliminatedInWave.clear();
    currentLineup = getEndgameSlotMovies(tourney.contenders);
    updateTourneyStatusUI();

    if (tourney.contenders.length <= 1) {
        stopRapidElimination(); syncWheelchinko();
        const champion = tourney.contenders[0] || currentLineup[0];
        if (champion) rapidTimer = setTimeout(() => handleWinnerLanding(champion), 500);
        return;
    }

    rapidTimer = setTimeout(() => {
        syncWheelchinko();
        if (isRapidRunning) rapidTimer = setTimeout(() => runNextEliminationDrop(), 360);
    }, 400);
}

function handleWinnerLanding(winningMovie) {
    playWinSound(); addToHistory(winningMovie, 'wheelchinko');
    const result = document.getElementById('result');
    if (result) {
        result.className = 'result result--winner';
        result.textContent = `Winner: ${winningMovie.name}${winningMovie.year ? ` (${winningMovie.year})` : ''}`;
    }
    uiCallbacks.triggerConfetti?.(); uiCallbacks.showWinnerPopup?.(winningMovie, { spinMode: 'wheelchinko' });
}

/**
 * Wheel logic and animation
 */

import { appState, addToHistory, saveState } from './state.js';
import { getDefaultColorForIndex, clampWeight, isThemePaletteLocked, getMovieOriginalIndex, sanitizeColor } from './utils.js';
import { playTickSound, playWinSound, playKnockoutSound } from './audio.js';
import {
    DEFAULT_VHS_CAPACITY, getVhsCapacity, initVhsWheel, isVhsEnabled, getVhsLineup, useVhsForMovies,
    renderVhsWheel, updateVhsControls, setVhsSpinMode, tickVhsPointer,
    revealVhsWinner, clearVhsReveal, getCurrentSpinMode, animateVhsKnockout
} from './vhs-wheel.js';
import { openSpinTheater, closeSpinTheater, setTheaterStatus, lockSpinControls, clearEliminationStack } from './spin-theater.js';

const TAU = 2 * Math.PI;
const POINTER_DIRECTION = (3 * Math.PI) / 2;

const DEFAULT_SPIN_SETTINGS = {
    minSpins: 8,
    maxSpins: 12,
    minDuration: 5200,
    maxDuration: 7800
};

const DRAMATIC_SPIN_SETTINGS = {
    minSpins: 14,
    maxSpins: 18,
    minDuration: 9800,
    maxDuration: 14000
};

const MOVIE_KNOCKOUT_SPEEDS = [
    {
        minCount: 13,
        config: {
            eliminationSpin: { minSpins: 1, maxSpins: 2, minDuration: 900, maxDuration: 1300 },
            finalSpin: { minSpins: 18, maxSpins: 24, minDuration: 12000, maxDuration: 18000 },
            interRoundDelay: 350,
            knockoutRevealDelay: 450,
            finalRevealDelay: 900,
            winnerRevealDelay: 600
        }
    },
    {
        minCount: 7,
        config: {
            eliminationSpin: { minSpins: 2, maxSpins: 3, minDuration: 1300, maxDuration: 1900 },
            finalSpin: { minSpins: 18, maxSpins: 24, minDuration: 11500, maxDuration: 17000 },
            interRoundDelay: 500,
            knockoutRevealDelay: 650,
            finalRevealDelay: 1100,
            winnerRevealDelay: 650
        }
    },
    {
        minCount: 4,
        config: {
            eliminationSpin: { minSpins: 3, maxSpins: 4, minDuration: 1900, maxDuration: 2600 },
            finalSpin: { minSpins: 19, maxSpins: 25, minDuration: 12500, maxDuration: 18500 },
            interRoundDelay: 720,
            knockoutRevealDelay: 900,
            finalRevealDelay: 1300,
            winnerRevealDelay: 700
        }
    },
    {
        minCount: 3,
        config: {
            eliminationSpin: { minSpins: 3, maxSpins: 4, minDuration: 2200, maxDuration: 3000 },
            finalSpin: { minSpins: 20, maxSpins: 26, minDuration: 13000, maxDuration: 19000 },
            interRoundDelay: 850,
            knockoutRevealDelay: 1100,
            finalRevealDelay: 1400,
            winnerRevealDelay: 750
        }
    },
    {
        minCount: 2,
        config: {
            eliminationSpin: { minSpins: 4, maxSpins: 5, minDuration: 2600, maxDuration: 3400 },
            finalSpin: { minSpins: 22, maxSpins: 28, minDuration: 14000, maxDuration: 20000 },
            interRoundDelay: 1000,
            knockoutRevealDelay: 1300,
            finalRevealDelay: 1600,
            winnerRevealDelay: 800
        }
    }
];

const BASE_CANVAS_SIZE = 1080;
const LABEL_ANGLE_THRESHOLD = 0.06; // radians (approx 3.4 degrees)

let canvas = null;
let ctx = null;
let rotationAngle = 0;
let isSpinning = false;
let isLastStandingInProgress = false;
let useInverseWeights = false;
let animationFrameId = null;
let targetRotation = 0;
let spinDuration = 0;
let spinStartTimestamp = null;
let lastTickIndex = null;
let spinSessionActive = false;
let spinPool = null;

const textLayoutCache = new Map();
let lastCacheKeyString = '';

let ui = {
    highlightKnockoutCandidate: () => { },
    updateKnockoutRemainingBox: () => { },
    updateKnockoutResultText: () => { },
    updateOdds: () => { },
    updateSpinButtonLabel: () => { },
    showWinnerPopup: () => { },
    handleSliceClick: () => { },
    triggerConfetti: () => { },
    updateReshowWinnerButton: () => { },
    refreshMovies: () => { }
};

export function initWheel(canvasElement, callbacks = {}) {
    canvas = canvasElement;
    ctx = canvas.getContext('2d');
    ui = { ...ui, ...callbacks };
    initVhsWheel({
        isBusy: getIsSpinning,
        getEligible: getFilteredSelectedMovies,
        refresh: () => { drawWheel(); ui.refreshMovies(); },
        inspect: movie => ui.handleSliceClick(movie),
        clearWinner: () => {
            setWinnerId(null);
            clearVhsReveal();
            const result = document.getElementById('result');
            if (result) {
                result.textContent = '';
                result.className = 'result';
            }
        }
    });
    if (canvas) {
        setupCanvasResolution();
        canvas.addEventListener('click', handleCanvasClick);
        window.addEventListener('resize', () => {
            setupCanvasResolution();
            drawWheel();
        });
    }
}

export function getIsSpinning() {
    return isSpinning || spinSessionActive;
}

export function getIsLastStandingInProgress() {
    return isLastStandingInProgress;
}

export function getWinnerId() {
    return appState.winnerId || null;
}

export function setWinnerId(id, spinMode = null) {
    appState.winnerId = id;
    appState.winnerSpinMode = spinMode;
    saveState();
    if (typeof ui.updateReshowWinnerButton === 'function') {
        ui.updateReshowWinnerButton();
    }
}

export function setWeightMode(mode) {
    useInverseWeights = mode === 'inverse';
}

function getFilteredSelectedMovies() {
    const { movies, selectedIds, filter } = appState;
    return movies.filter((movie) => {
        if (!selectedIds.has(movie.id)) return false;
        if (!filter.showCustoms && movie.isCustom) return false;
        if (filter.normalizedQuery) {
            const haystack = [movie.name, movie.year]
                .filter(Boolean)
                .join(' ')
                .toLowerCase();
            if (!haystack.includes(filter.normalizedQuery)) return false;
        }
        return true;
    });
}

function getEffectiveWeight(movie, inverseOverride = null) {
    const weight = Number.isFinite(movie.weight) && movie.weight > 0 ? movie.weight : 1;
    const useInverse = typeof inverseOverride === 'boolean'
        ? inverseOverride
        : isLastStandingInProgress || useInverseWeights;
    if (useInverse) {
        return 1 / weight;
    }
    return weight;
}

function getEffectiveSliceColor(movie, fallbackIndex) {
    const originalIndex = getMovieOriginalIndex(movie, appState.movies);
    const paletteIndex = Number.isFinite(originalIndex) && originalIndex >= 0 ? originalIndex : fallbackIndex;
    const defaultColor = getDefaultColorForIndex(paletteIndex);
    if (isThemePaletteLocked()) {
        return defaultColor;
    }
    return (movie && movie.color) ? sanitizeColor(movie.color, defaultColor) : defaultColor;
}

export function computeWheelModel(selectedMovies, options = {}) {
    const { inverseModeOverride = null } = options;
    if (!selectedMovies.length) {
        return { segments: [], totalWeight: 0 };
    }

    const weights = selectedMovies.map((movie) => getEffectiveWeight(movie, inverseModeOverride));
    const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
    if (!totalWeight) {
        return { segments: [], totalWeight: 0 };
    }

    let currentAngle = 0;
    const segments = selectedMovies.map((movie, index) => {
        const weight = weights[index];
        const fraction = weight / totalWeight;
        const startAngle = currentAngle;
        let endAngle = startAngle + fraction * 2 * Math.PI;
        if (index === selectedMovies.length - 1) {
            endAngle = 2 * Math.PI;
        }
        currentAngle = endAngle;
        return { movie, startAngle, endAngle, weight, index };
    });

    return { segments, totalWeight };
}

export function getSelectionOdds(selectedMovies = null, options = {}) {
    const movies = selectedMovies || (isVhsEnabled() ? getVhsLineup(getFilteredSelectedMovies()) : getFilteredSelectedMovies());
    const { inverseModeOverride = null } = options;
    const { segments, totalWeight } = computeWheelModel(movies, { inverseModeOverride });
    if (!segments.length || totalWeight <= 0) {
        return new Map();
    }
    return new Map(segments.map((segment) => [segment.movie.id, segment.weight / totalWeight]));
}

export function drawWheel(movies = null, segments = null) {
    const eligible = getFilteredSelectedMovies();
    let selectedMovies;
    if (spinPool) {
        selectedMovies = spinPool;
    } else if (isVhsEnabled() && getCurrentSpinMode() === 'one-spin') {
        selectedMovies = getVhsLineup(eligible, 'one-spin');
    } else {
        selectedMovies = movies || eligible;
    }
    updateVhsControls(eligible);
    if (renderVhsWheel(selectedMovies, rotationAngle, { spinning: isSpinning, winnerId: appState.winnerId })) return;
    if (!ctx) return;

    setupCanvasResolution();
    const dpr = Math.max(1, window.devicePixelRatio || 1);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const radius = BASE_CANVAS_SIZE / 2.1;
    ctx.clearRect(0, 0, BASE_CANVAS_SIZE, BASE_CANVAS_SIZE);

    if (!selectedMovies.length) {
        drawEmptyWheel();
        return;
    }

    if (!isSpinning) {
        const cacheKeyString = `${BASE_CANVAS_SIZE}x${BASE_CANVAS_SIZE}_${selectedMovies.length}_` + 
            (selectedMovies[0]?.id || '') + '_' + (selectedMovies[selectedMovies.length - 1]?.id || '');
        if (cacheKeyString !== lastCacheKeyString) {
            textLayoutCache.clear();
            lastCacheKeyString = cacheKeyString;
        }
    }

    const wheelSegments = segments || computeWheelModel(selectedMovies).segments;
    if (!wheelSegments.length) {
        drawEmptyWheel();
        return;
    }

    const winnerId = getWinnerId();
    const highlightId = !isSpinning && winnerId ? winnerId : null;
    ctx.save();
    ctx.translate(BASE_CANVAS_SIZE / 2, BASE_CANVAS_SIZE / 2);
    ctx.rotate(rotationAngle);

    wheelSegments.forEach((segment) => {
        const { movie, startAngle, endAngle, index } = segment;
        const angleSpan = endAngle - startAngle;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        const fillColor = getEffectiveSliceColor(movie, index);
        ctx.fillStyle = fillColor;
        ctx.arc(0, 0, radius, startAngle, endAngle);
        ctx.closePath();
        ctx.fill();

        if (highlightId === movie.id) {
            ctx.save();
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.arc(0, 0, radius, startAngle, endAngle);
            ctx.closePath();
            const gradient = ctx.createRadialGradient(0, 0, radius * 0.1, 0, 0, radius);
            gradient.addColorStop(0, 'rgba(255, 255, 255, 0.55)');
            gradient.addColorStop(0.65, 'rgba(255, 255, 255, 0.18)');
            gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
            ctx.fillStyle = gradient;
            ctx.fill();
            ctx.lineWidth = 6;
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
            ctx.shadowColor = 'rgba(255, 255, 255, 0.55)';
            ctx.shadowBlur = 18;
            ctx.stroke();
            ctx.restore();
        }

        if (angleSpan >= LABEL_ANGLE_THRESHOLD) {
            ctx.save();
            ctx.rotate(startAngle + angleSpan / 2);
            ctx.textAlign = 'right';
            const maxArcLength = Math.max(radius * 0.7 * angleSpan, 18);
            wrapText(ctx, movie.name, radius - 40, maxArcLength, movie.id);
            ctx.restore();
        }
    });

    ctx.beginPath();
    ctx.fillStyle = '#07121f';
    ctx.arc(0, 0, radius * 0.2, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
}

export function drawEmptyWheel() {
    if (!ctx) return;
    setupCanvasResolution();
    const dpr = Math.max(1, window.devicePixelRatio || 1);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, BASE_CANVAS_SIZE, BASE_CANVAS_SIZE);
    ctx.save();
    ctx.translate(BASE_CANVAS_SIZE / 2, BASE_CANVAS_SIZE / 2);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.12)';
    ctx.beginPath();
    ctx.arc(0, 0, BASE_CANVAS_SIZE / 2.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.font = '700 22px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('Upload a CSV to spin', 0, 0);
    ctx.restore();
}

function setupCanvasResolution() {
    if (!canvas || !ctx) return;
    const dpr = Math.max(1, window.devicePixelRatio || 1);
    const targetPx = Math.round(BASE_CANVAS_SIZE * dpr);
    if (canvas.width !== targetPx || canvas.height !== targetPx) {
        canvas.width = targetPx;
        canvas.height = targetPx;
    }
}

function getPointerAngle() {
    const rawAngle = (POINTER_DIRECTION - rotationAngle) % TAU;
    return (rawAngle + TAU) % TAU;
}

function findSegmentIndexForAngle(segments, angle) {
    if (!segments.length) return -1;
    const target = ((angle % TAU) + TAU) % TAU;
    for (let i = 0; i < segments.length; i++) {
        const { startAngle, endAngle } = segments[i];
        if (target >= startAngle && target < endAngle) {
            return i;
        }
    }
    return segments.length - 1;
}

function easeOutCubic(t) {
    return 1 - Math.pow(1 - t, 3);
}

function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function wrapText(context, text, maxWidth, maxArcLength, movieId) {
    if (!text) return;

    let layout = null;
    if (movieId && textLayoutCache.has(movieId)) {
        layout = textLayoutCache.get(movieId);
    } else {
        const maxFontSize = 24;
        const minFontSize = 13;

        let fontSize = maxFontSize;
        let tempLayout = layoutText(context, text, maxWidth, fontSize);

        while (fontSize > minFontSize && !textLayoutFits(tempLayout, maxArcLength)) {
            fontSize -= 1;
            tempLayout = layoutText(context, text, maxWidth, fontSize);
        }

        if (!textLayoutFits(tempLayout, maxArcLength)) {
            fontSize = minFontSize;
            tempLayout = layoutText(context, text, maxWidth, fontSize);
        }

        layout = {
            lines: tempLayout.lines,
            fontSize,
            lineHeight: tempLayout.lineHeight,
            blockHeight: tempLayout.blockHeight
        };

        if (movieId) {
            textLayoutCache.set(movieId, layout);
        }
    }

    context.font = `600 ${layout.fontSize}px Inter, sans-serif`;
    context.textBaseline = 'middle';

    context.fillStyle = '#ffffff';
    const totalHeight = layout.lineHeight * (layout.lines.length - 1);

    if (!isSpinning) {
        context.strokeStyle = '#000000';
        context.lineWidth = 3;
        context.lineJoin = 'round';
        layout.lines.forEach((line, index) => {
            const y = -totalHeight / 2 + index * layout.lineHeight;
            context.strokeText(line, maxWidth, y);
            context.fillText(line, maxWidth, y);
        });
    } else {
        layout.lines.forEach((line, index) => {
            const y = -totalHeight / 2 + index * layout.lineHeight;
            context.fillText(line, maxWidth, y);
        });
    }
}

function layoutText(context, text, maxWidth, fontSize) {
    context.font = `600 ${fontSize}px Inter, sans-serif`;
    const lineHeight = fontSize * 1.2;
    const words = text.split(' ').filter((word) => word.length);

    if (!words.length) {
        return { lines: [''], lineHeight, blockHeight: lineHeight };
    }

    const lines = [];
    let line = '';

    words.forEach((word) => {
        const testLine = line ? `${line} ${word}` : word;
        if (context.measureText(testLine).width <= maxWidth) {
            line = testLine;
            return;
        }

        if (line) {
            lines.push(line);
            line = '';
        }

        if (context.measureText(word).width <= maxWidth) {
            line = word;
            return;
        }

        const segments = breakLongWord(word, context, maxWidth);
        segments.forEach((segment, index) => {
            if (index === segments.length - 1) {
                line = segment;
            } else {
                lines.push(segment);
            }
        });
    });

    if (line) {
        lines.push(line);
    }

    return { lines, lineHeight, blockHeight: lines.length * lineHeight };
}

function breakLongWord(word, context, maxWidth) {
    const segments = [];
    let current = '';
    word.split('').forEach((char) => {
        const test = current ? `${current}${char}` : char;
        if (context.measureText(test).width <= maxWidth || !current) {
            current = test;
        } else {
            segments.push(current);
            current = char;
        }
    });

    if (current) {
        segments.push(current);
    }

    return segments;
}

function textLayoutFits(layout, maxArcLength) {
    if (!layout) {
        return false;
    }

    const availableHeight = Math.max(maxArcLength, layout.lineHeight);
    return layout.blockHeight <= availableHeight + layout.lineHeight * 0.2;
}

function handleCanvasClick(event) {
    if (!canvas || isSpinning || isLastStandingInProgress) {
        return;
    }

    const selectedMovies = getFilteredSelectedMovies();
    const { segments } = computeWheelModel(selectedMovies);
    if (!segments.length) {
        return;
    }

    const rect = canvas.getBoundingClientRect();
    const scaleX = BASE_CANVAS_SIZE / rect.width;
    const scaleY = BASE_CANVAS_SIZE / rect.height;

    const offsetX = (event.clientX - rect.left) * scaleX - BASE_CANVAS_SIZE / 2;
    const offsetY = (event.clientY - rect.top) * scaleY - BASE_CANVAS_SIZE / 2;
    const radius = BASE_CANVAS_SIZE / 2.1;
    const distance = Math.hypot(offsetX, offsetY);
    if (distance > radius) {
        return;
    }

    const clickAngle = Math.atan2(offsetY, offsetX);
    const normalized = ((clickAngle - rotationAngle) % TAU + TAU) % TAU;
    const segmentIndex = findSegmentIndexForAngle(segments, normalized);
    if (segmentIndex === -1) {
        return;
    }

    const segment = segments[segmentIndex];
    if (segment && segment.movie) {
        ui.handleSliceClick(segment.movie);
    }
}

function tick(segments) {
    if (!segments.length) return;

    const pointerAngle = getPointerAngle();
    const index = findSegmentIndexForAngle(segments, pointerAngle);
    if (index !== lastTickIndex) {
        playTickSound();
        tickVhsPointer();
        lastTickIndex = index;
        const focusedSegment = segments[index];
        const focusedMovie = focusedSegment?.movie;
        if (focusedMovie) {
            if (isLastStandingInProgress && typeof ui.highlightKnockoutCandidate === 'function') {
                ui.highlightKnockoutCandidate(focusedMovie.id);
            }
            const result = document.getElementById('result');
            if (result) {
                let label = result.querySelector('.result__label');
                let name = result.querySelector('.result__name');
                const targetLabel = isLastStandingInProgress ? 'Knocking out:' : 'Selecting:';
                if (!label || !name || !result.classList.contains('result--spinning')) {
                    result.className = 'result result--spinning';
                    label = document.createElement('span');
                    label.className = 'result__label';
                    label.textContent = targetLabel;
                    name = document.createElement('strong');
                    name.className = 'result__name';
                    result.replaceChildren(label, name);
                } else if (label.textContent !== targetLabel) {
                    label.textContent = targetLabel;
                }
                if (name.textContent !== focusedMovie.name) {
                    name.textContent = focusedMovie.name;
                }
            }
            setTheaterStatus(`${isLastStandingInProgress ? 'Knocking Out' : 'Selecting'}: ${focusedMovie.name}`);
        }
    }
}

function performSpin(selectedMovies, options = {}) {
    const {
        minSpins = DEFAULT_SPIN_SETTINGS.minSpins,
        maxSpins = DEFAULT_SPIN_SETTINGS.maxSpins,
        minDuration = DEFAULT_SPIN_SETTINGS.minDuration,
        maxDuration = DEFAULT_SPIN_SETTINGS.maxDuration
    } = options;

    const parsedMinSpins = Number(minSpins);
    const parsedMaxSpins = Number(maxSpins);
    const parsedMinDuration = Number(minDuration);
    const parsedMaxDuration = Number(maxDuration);
    const normalizedMinSpins = Math.max(2, Number.isFinite(parsedMinSpins) ? parsedMinSpins : 2);
    const normalizedMaxSpins = Math.max(
        normalizedMinSpins,
        Number.isFinite(parsedMaxSpins) ? parsedMaxSpins : normalizedMinSpins
    );
    const safeMinDuration = Math.max(800, Number.isFinite(parsedMinDuration) ? parsedMinDuration : 800);
    const safeMaxDuration = Math.max(
        safeMinDuration,
        Number.isFinite(parsedMaxDuration) ? parsedMaxDuration : safeMinDuration
    );

    return new Promise((resolve) => {
        const model = computeWheelModel(selectedMovies);
        const totalWeight = model.totalWeight;
        const vhs = useVhsForMovies(selectedMovies);
        const segments = vhs ? model.segments.map((segment, index) => ({
            ...segment,
            startAngle: index * TAU / selectedMovies.length,
            endAngle: (index + 1) * TAU / selectedMovies.length
        })) : model.segments;
        if (!segments.length || totalWeight <= 0) {
            isSpinning = false;
            resolve({ winningMovie: null, segments: [] });
            return;
        }

        isSpinning = true;
        lastTickIndex = null;
        if (typeof ui.updateOdds === 'function') {
            ui.updateOdds();
        }
        if (typeof ui.updateSpinButtonLabel === 'function') {
            ui.updateSpinButtonLabel();
        }

        const targetWeight = Math.random() * totalWeight;
        let chosenSegment = segments[segments.length - 1];
        let cumulative = 0;
        for (const segment of segments) {
            cumulative += segment.weight;
            if (targetWeight <= cumulative) {
                chosenSegment = segment;
                break;
            }
        }

        const segmentSpan = chosenSegment.endAngle - chosenSegment.startAngle;
        const randomOffset = vhs ? segmentSpan / 2 : (0.15 + Math.random() * 0.7) * segmentSpan;
        const finalAngle = chosenSegment.startAngle + randomOffset;
        const turns = normalizedMinSpins + Math.random() * (normalizedMaxSpins - normalizedMinSpins);
        const currentPointerAngle = getPointerAngle();
        const minimumRotation = normalizedMinSpins * TAU;
        // The pointer moves backwards through local wheel angles as rotation increases.
        let neededRotation = Math.ceil(turns) * TAU + currentPointerAngle - finalAngle;
        while (neededRotation < minimumRotation) {
            neededRotation += TAU;
        }
        targetRotation = rotationAngle + neededRotation;
        spinDuration = safeMinDuration + Math.random() * (safeMaxDuration - safeMinDuration);
        const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        if (reducedMotion) spinDuration = 200;
        spinStartTimestamp = null;
        const startRotation = rotationAngle;

        const animate = (timestamp) => {
            if (!spinStartTimestamp) {
                spinStartTimestamp = timestamp;
            }
            const elapsed = timestamp - spinStartTimestamp;
            const progress = Math.min(elapsed / spinDuration, 1);
            const eased = easeOutCubic(progress);
            rotationAngle = reducedMotion && progress < 1 ? startRotation
                : startRotation + (targetRotation - startRotation) * eased;

            drawWheel(selectedMovies, segments);
            tick(segments);

            if (progress < 1) {
                animationFrameId = requestAnimationFrame(animate);
            } else {
                cancelAnimationFrame(animationFrameId);
                isSpinning = false;
                if (typeof ui.updateSpinButtonLabel === 'function') {
                    ui.updateSpinButtonLabel();
                }
                const pointerAngle = getPointerAngle();
                const winningIndex = findSegmentIndexForAngle(segments, pointerAngle);
                const winningSegment = winningIndex >= 0 ? segments[winningIndex] : null;
                const winningMovie = winningSegment ? winningSegment.movie : selectedMovies[0];
                resolve({ winningMovie, segments });
            }
        };

        animationFrameId = requestAnimationFrame(animate);
    });
}

export async function spinWheel(spinMode = 'knockout', booster = null) {
    if (isSpinning || isLastStandingInProgress || spinSessionActive) return;
    const eligible = getFilteredSelectedMovies();
    if (!eligible.length) return;

    spinSessionActive = true;
    const isSingleSpin = spinMode === 'one-spin';
    const isRandomBoost = spinMode === 'random-boost';
    const selectedMovies = isSingleSpin ? getVhsLineup(eligible, spinMode) : [...eligible];
    let completed = false;
    const weightBackup = new Map();

    spinPool = selectedMovies;
    setVhsSpinMode(spinMode);
    setWeightMode(spinMode === 'knockout' ? 'inverse' : 'normal');
    clearVhsReveal();
    setWinnerId(null);
    appState.knockoutResults.clear();
    lockSpinControls(true);
    openSpinTheater(spinMode, selectedMovies.length);
    if (spinMode === 'knockout') {
        clearEliminationStack();
    }
    setTheaterStatus(isSingleSpin || isRandomBoost
        ? `${selectedMovies.length} ${useVhsForMovies(selectedMovies) ? 'tapes' : 'movies'} in this spin${eligible.length > selectedMovies.length ? ` · drawn from ${eligible.length.toLocaleString()} movies` : ''}`
        : `${eligible.length.toLocaleString()} movies enter. One remains.`);
    const result = document.getElementById('result');
    if (result) { result.textContent = ''; result.className = 'result'; }

    try {
        ui.highlightKnockoutCandidate(null);
        ui.updateKnockoutRemainingBox([]);
        ui.updateSpinButtonLabel();
        // The mode callback follows the selected radio; a Random Boost always uses equal weights.
        if (isRandomBoost) {
            selectedMovies.forEach(movie => {
                weightBackup.set(movie.id, movie.weight);
                movie.weight = 1;
            });
        }
        drawWheel(selectedMovies);
        await delay(window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 450);
        if (spinMode === 'knockout' && selectedMovies.length > 1) {
            await runLastStandingMode(selectedMovies);
            completed = true;
            return;
        }

        const selectionOdds = getSelectionOdds(selectedMovies, { inverseModeOverride: false });
        const { winningMovie } = await performSpin(selectedMovies,
            isSingleSpin ? DRAMATIC_SPIN_SETTINGS : DEFAULT_SPIN_SETTINGS);
        for (const movie of selectedMovies) {
            if (weightBackup.has(movie.id)) movie.weight = weightBackup.get(movie.id);
        }
        weightBackup.clear();
        if (!winningMovie) return;
        setWinnerId(winningMovie.id, spinMode);
        if (isRandomBoost) {
            const boostedWeight = clampWeight((Number(winningMovie.weight) || 1) + 1);
            winningMovie.weight = boostedWeight;
            const boosterName = typeof booster === 'object' && booster !== null ? booster.booster : booster;
            if (boosterName) {
                if (!winningMovie.boosters) winningMovie.boosters = [];
                winningMovie.boosters.push({ name: boosterName, timestamp: Date.now(), source: 'random' });
            }
        }
        playWinSound();
        drawWheel(selectedMovies);
        if (result) {
            result.className = 'result result--winner';
            const label = document.createElement('span');
            label.className = 'result__label';
            label.textContent = isRandomBoost ? 'Boosted' : 'Winner';
            const name = document.createElement('strong');
            name.className = 'result__name';
            name.textContent = winningMovie.name + (winningMovie.year ? ` (${winningMovie.year})` : '');
            result.replaceChildren(label, name);
        }
        await revealVhsWinner(winningMovie);
        ui.triggerConfetti();
        // Record while the session is locked, so double clicks cannot create extra winners.
        addToHistory(winningMovie, spinMode);
        ui.showWinnerPopup(winningMovie, { spinMode, selectionOdds: selectionOdds.get(winningMovie.id) });
        completed = true;
    } finally {
        for (const movie of selectedMovies) {
            if (weightBackup.has(movie.id)) movie.weight = weightBackup.get(movie.id);
        }
        isSpinning = false;
        isLastStandingInProgress = false;
        spinSessionActive = false;
        spinPool = null;
        lockSpinControls(false);
        setVhsSpinMode(null);
        ui.refreshMovies();
        ui.updateSpinButtonLabel();
        if (!completed) {
            closeSpinTheater();
            clearVhsReveal();
        }
    }
}

function getLastStandingSpeedConfig(remainingCount) {
    const matched = MOVIE_KNOCKOUT_SPEEDS.find(tier => remainingCount >= tier.minCount);
    return matched ? matched.config : MOVIE_KNOCKOUT_SPEEDS[MOVIE_KNOCKOUT_SPEEDS.length - 1].config;
}

async function runLastStandingMode(selectedMovies) {
    const eliminationPool = [...selectedMovies];
    spinPool = eliminationPool;
    let eliminationOrder = 1;
    isLastStandingInProgress = true;
    ui.updateSpinButtonLabel();
    ui.updateOdds?.(eliminationPool);
    ui.updateKnockoutRemainingBox(eliminationPool);
    ui.updateKnockoutResultText('start', eliminationPool.length);

    const vhsCap = getVhsCapacity();
    if (isVhsEnabled() && eliminationPool.length > vhsCap) {
        const batchSize = Math.max(1, Math.ceil((eliminationPool.length - vhsCap) / 45));
        while (eliminationPool.length > vhsCap) {
            for (let index = 0; index < batchSize && eliminationPool.length > vhsCap; index += 1) {
                const total = eliminationPool.reduce((sum, movie) => sum + getEffectiveWeight(movie, true), 0);
                let pick = Math.random() * total;
                let removalIndex = eliminationPool.length - 1;
                for (let candidate = 0; candidate < eliminationPool.length; candidate += 1) {
                    pick -= getEffectiveWeight(eliminationPool[candidate], true);
                    if (pick <= 0) { removalIndex = candidate; break; }
                }
                const [removed] = eliminationPool.splice(removalIndex, 1);
                appState.knockoutResults.set(removed.id, { order: eliminationOrder++, status: 'knocked-out' });
            }
            setTheaterStatus(`${eliminationPool.length.toLocaleString()} remaining · drawing the final ${vhsCap}`);
            ui.updateKnockoutResultText('start', eliminationPool.length);
            drawWheel(eliminationPool);
            await delay(65);
        }
        ui.refreshMovies();
        ui.updateKnockoutRemainingBox(eliminationPool);
        setTheaterStatus(`The final ${vhsCap}. Last tape standing wins.`);
        await delay(window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 900);
    }

    while (eliminationPool.length > 1) {
        const remainingBeforeSpin = eliminationPool.length;
        const speedConfig = getLastStandingSpeedConfig(remainingBeforeSpin);
        const isFinalShowdown = remainingBeforeSpin === 2;
        const currentSpinSettings = isFinalShowdown
            ? speedConfig.finalSpin
            : speedConfig.eliminationSpin;

        setWeightMode('inverse');

        const { winningMovie: eliminatedMovie } = await performSpin(
            eliminationPool,
            currentSpinSettings
        );

        if (!eliminatedMovie) {
            break;
        }

        const remainingCount = eliminationPool.length - 1;
        appState.knockoutResults.set(eliminatedMovie.id, {
            order: eliminationOrder,
            status: 'knocked-out'
        });

        playKnockoutSound();
        if (isVhsEnabled()) {
            await animateVhsKnockout(eliminatedMovie, eliminationOrder);
        }
        eliminationOrder++;

        const eliminatedIndex = eliminationPool.findIndex(m => m.id === eliminatedMovie.id);
        if (eliminatedIndex !== -1) {
            eliminationPool.splice(eliminatedIndex, 1);
        }

        ui.updateKnockoutRemainingBox(eliminationPool);
        ui.updateKnockoutResultText('eliminated', remainingCount, eliminatedMovie);
        setTheaterStatus(`${remainingCount} ${remainingCount === 1 ? 'tape' : 'tapes'} remaining`);
        ui.updateOdds?.(eliminationPool);

        drawWheel(eliminationPool);
        ui.refreshMovies();

        const baseRevealDelay = isFinalShowdown
            ? speedConfig.finalRevealDelay
            : speedConfig.knockoutRevealDelay;
        const revealDelay = isVhsEnabled()
            ? Math.max(150, baseRevealDelay - 600)
            : baseRevealDelay;
        await delay(revealDelay);

        if (eliminationPool.length > 1) {
            await delay(speedConfig.interRoundDelay);
        }
    }

    if (eliminationPool.length === 1) {
        const finalMovie = eliminationPool[0];
        setWinnerId(finalMovie.id, 'knockout');
        appState.knockoutResults.set(finalMovie.id, {
            order: eliminationOrder,
            status: 'champion'
        });
        ui.updateKnockoutRemainingBox(eliminationPool);
        ui.updateKnockoutResultText('winner', 0, finalMovie);
        setWeightMode('normal');

        playWinSound();
        drawWheel(eliminationPool);
        await revealVhsWinner(finalMovie);
        ui.triggerConfetti();
        ui.showWinnerPopup(finalMovie, { spinMode: 'knockout' });
        addToHistory(finalMovie, 'knockout');
        ui.refreshMovies();
    }
}

export function invalidateWheelCache() {
    textLayoutCache.clear();
    lastCacheKeyString = '';
}

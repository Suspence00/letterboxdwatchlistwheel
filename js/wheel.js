/**
 * Wheel logic and animation
 */

import { appState, addToHistory } from './state.js';
import { getDefaultColorForIndex, clampWeight } from './utils.js';
import { playTickSound, playWinSound, playKnockoutSound } from './audio.js';

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
        minCount: 2,
        config: {
            eliminationSpin: { minSpins: 4, maxSpins: 5, minDuration: 2500, maxDuration: 3400 },
            finalSpin: { minSpins: 20, maxSpins: 26, minDuration: 13500, maxDuration: 19500 },
            interRoundDelay: 900,
            knockoutRevealDelay: 1100,
            finalRevealDelay: 1700,
            winnerRevealDelay: 800
        }
    },
    {
        minCount: 1,
        config: {
            eliminationSpin: { minSpins: 4, maxSpins: 5, minDuration: 2500, maxDuration: 3400 },
            finalSpin: { minSpins: 20, maxSpins: 26, minDuration: 13500, maxDuration: 19500 },
            interRoundDelay: 900,
            knockoutRevealDelay: 1100,
            finalRevealDelay: 1700,
            winnerRevealDelay: 900
        }
    }
];

let canvas;
let ctx;
let isSpinning = false;
let isLastStandingInProgress = false;
let rotationAngle = 0;
let useInverseWeights = false;
let animationFrameId = null;
let spinStartTimestamp = null;
let spinDuration = 0;
let targetRotation = 0;
let lastTickIndex = null;
let winnerId = null;

// UI Callbacks
let ui = {
    showWinnerPopup: () => { },
    triggerConfetti: () => { },
    updateSpinButtonLabel: () => { },
    handleSliceClick: () => { },
    markMovieKnockedOut: () => { },
    markMovieChampion: () => { },
    updateKnockoutResultText: () => { },
    updateKnockoutRemainingBox: () => { },
    highlightKnockoutCandidate: () => { },
    updateOdds: () => { },
    refreshMovies: () => { }
};

export function initWheel(canvasElement, callbacks = {}) {
    canvas = canvasElement;
    ctx = canvas.getContext('2d');
    ui = { ...ui, ...callbacks };
    if (canvas) {
        canvas.addEventListener('click', handleCanvasClick);
    }
}

export function getIsSpinning() {
    return isSpinning;
}

export function getIsLastStandingInProgress() {
    return isLastStandingInProgress;
}

export function getWinnerId() {
    return winnerId;
}

export function setWinnerId(id) {
    winnerId = id;
}

export function setWeightMode(mode) {
    useInverseWeights = mode === 'inverse';
}

function getFilteredSelectedMovies() {
    const { movies, selectedIds, filter } = appState;
    return movies.filter(movie => {
        if (!selectedIds.has(movie.id)) return false;
        if (!filter.showCustoms && movie.isCustom) return false;
        if (filter.normalizedQuery) {
            const haystack = [movie.name, movie.year, movie.date]
                .filter(part => typeof part === 'string' && part.trim())
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

function getStoredColor(movie, fallback) {
    return movie.color || fallback;
}

function computeWheelModel(selectedMovies, options = {}) {
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

export function getSelectionOdds(selectedMovies = getFilteredSelectedMovies(), options = {}) {
    const { inverseModeOverride = null } = options;
    const { segments, totalWeight } = computeWheelModel(selectedMovies, { inverseModeOverride });
    if (!segments.length || totalWeight <= 0) {
        return new Map();
    }
    return new Map(segments.map((segment) => [segment.movie.id, segment.weight / totalWeight]));
}

export function drawWheel(selectedMovies = getFilteredSelectedMovies()) {
    if (!ctx) return;

    const radius = canvas.width / 2.1;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (!selectedMovies.length) {
        drawEmptyWheel();
        return;
    }

    const { segments } = computeWheelModel(selectedMovies);
    if (!segments.length) {
        drawEmptyWheel();
        return;
    }

    const highlightId = !isSpinning && winnerId ? winnerId : null;
    ctx.save();
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.rotate(rotationAngle);

    segments.forEach((segment) => {
        const { movie, startAngle, endAngle, index } = segment;
        const angleSpan = endAngle - startAngle;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        const fillColor = getStoredColor(movie, getDefaultColorForIndex(index));
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

        ctx.save();
        ctx.fillStyle = '#04121f';
        ctx.rotate(startAngle + angleSpan / 2);
        ctx.textAlign = 'right';
        wrapText(ctx, movie.name, radius - 20, angleSpan * radius * 0.6);
        ctx.restore();
    });

    ctx.beginPath();
    ctx.fillStyle = '#07121f';
    ctx.arc(0, 0, radius * 0.2, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
}

export function drawEmptyWheel() {
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.12)';
    ctx.beginPath();
    ctx.arc(0, 0, canvas.width / 2.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.font = '700 22px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('Upload a CSV to spin', 0, 0);
    ctx.restore();
}

function wrapText(context, text, maxWidth, maxArcLength) {
    if (!text) return;

    const maxFontSize = 16;
    const minFontSize = 9;

    let fontSize = maxFontSize;
    let layout = layoutText(context, text, maxWidth, fontSize);

    while (fontSize > minFontSize && !textLayoutFits(layout, maxArcLength)) {
        fontSize -= 1;
        layout = layoutText(context, text, maxWidth, fontSize);
    }

    if (!textLayoutFits(layout, maxArcLength)) {
        fontSize = minFontSize;
        layout = layoutText(context, text, maxWidth, fontSize);
    }

    context.font = `600 ${fontSize}px Inter, sans-serif`;
    context.textBaseline = 'middle';

    const totalHeight = layout.lineHeight * (layout.lines.length - 1);
    layout.lines.forEach((line, index) => {
        context.fillText(line, maxWidth, -totalHeight / 2 + index * layout.lineHeight);
    });
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

function getPointerAngle() {
    const normalized = ((rotationAngle % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
    return (POINTER_DIRECTION - normalized + 2 * Math.PI) % (2 * Math.PI);
}

function findSegmentIndexForAngle(segments, angle) {
    if (!segments.length) {
        return -1;
    }

    const normalized = ((angle % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
    for (let index = 0; index < segments.length; index += 1) {
        const segment = segments[index];
        if (normalized >= segment.startAngle && normalized < segment.endAngle) {
            return index;
        }
    }
    return segments.length - 1;
}

function easeOutCubic(x) {
    return 1 - Math.pow(1 - x, 3);
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
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    const offsetX = (event.clientX - rect.left) * scaleX - canvas.width / 2;
    const offsetY = (event.clientY - rect.top) * scaleY - canvas.height / 2;
    const radius = canvas.width / 2.1;
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
    if (segment?.movie && typeof ui.handleSliceClick === 'function') {
        ui.handleSliceClick(segment.movie);
    }
}

function tick(segments) {
    if (!segments.length) return;

    const pointerAngle = getPointerAngle();
    const index = findSegmentIndexForAngle(segments, pointerAngle);
    if (index !== lastTickIndex) {
        playTickSound();
        lastTickIndex = index;
        if (isLastStandingInProgress && typeof ui.highlightKnockoutCandidate === 'function') {
            const focusedSegment = segments[index];
            if (focusedSegment?.movie?.id) {
                ui.highlightKnockoutCandidate(focusedSegment.movie.id);
            }
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
        const { segments, totalWeight } = computeWheelModel(selectedMovies);
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
        const randomOffset = Math.random() * segmentSpan;
        const finalAngle = chosenSegment.startAngle + randomOffset;
        const turns = normalizedMinSpins + Math.random() * (normalizedMaxSpins - normalizedMinSpins);
        const currentPointerAngle = getPointerAngle();
        const minimumRotation = normalizedMinSpins * TAU;
        let neededRotation = turns * TAU + finalAngle - currentPointerAngle;
        while (neededRotation < minimumRotation) {
            neededRotation += TAU;
        }
        targetRotation = rotationAngle + neededRotation;
        spinDuration = safeMinDuration + Math.random() * (safeMaxDuration - safeMinDuration);
        spinStartTimestamp = null;
        const startRotation = rotationAngle;

        const animate = (timestamp) => {
            if (!spinStartTimestamp) {
                spinStartTimestamp = timestamp;
            }
            const elapsed = timestamp - spinStartTimestamp;
            const progress = Math.min(elapsed / spinDuration, 1);
            const eased = easeOutCubic(progress);
            rotationAngle = startRotation + (targetRotation - startRotation) * eased;

            drawWheel(selectedMovies);
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

export async function spinWheel(spinMode = 'knockout') {
    if (isSpinning || isLastStandingInProgress) return;

    const selectedMovies = getFilteredSelectedMovies();
    if (!selectedMovies.length) {
        return;
    }

    const isRandomBoost = spinMode === 'random-boost';
    const isSingleSpin = isRandomBoost || spinMode === 'one-spin';

    winnerId = null;
    if (typeof ui.highlightKnockoutCandidate === 'function') {
        ui.highlightKnockoutCandidate(null);
    }
    if (typeof ui.updateKnockoutRemainingBox === 'function') {
        ui.updateKnockoutRemainingBox([]);
    }
    ui.updateSpinButtonLabel();

    if (!isSingleSpin && selectedMovies.length > 1) {
        await runLastStandingMode(selectedMovies);
        return;
    }

    const weightBackup = new Map();
    if (isRandomBoost) {
        selectedMovies.forEach((movie) => {
            weightBackup.set(movie.id, movie.weight);
            movie.weight = clampWeight(1);
        });
        if (typeof ui.refreshMovies === 'function') {
            ui.refreshMovies();
        }
    }

    const spinSettings = isSingleSpin ? DRAMATIC_SPIN_SETTINGS : DEFAULT_SPIN_SETTINGS;

    const { winningMovie } = await performSpin(selectedMovies, spinSettings);

    if (isRandomBoost) {
        selectedMovies.forEach((movie) => {
            if (weightBackup.has(movie.id)) {
                movie.weight = weightBackup.get(movie.id);
            }
        });
    }

    if (!winningMovie) {
        ui.updateSpinButtonLabel();
        return;
    }

    winnerId = winningMovie.id;
    if (isRandomBoost) {
        const boostedWeight = clampWeight((Number(winningMovie.weight) || 1) + 1);
        if (boostedWeight !== winningMovie.weight) {
            winningMovie.weight = boostedWeight;
        }
    }
    playWinSound();
    drawWheel(selectedMovies);
    ui.triggerConfetti();
    ui.showWinnerPopup(winningMovie, { spinMode });
    addToHistory(winningMovie, spinMode);
    if (isRandomBoost && typeof ui.refreshMovies === 'function') {
        ui.refreshMovies();
    } else {
        ui.updateSpinButtonLabel();
    }
}

function delay(ms) {
    return new Promise((resolve) => {
        window.setTimeout(resolve, Math.max(0, ms));
    });
}

function getLastStandingSpeedConfig(remainingCount) {
    for (const stage of MOVIE_KNOCKOUT_SPEEDS) {
        if (remainingCount >= stage.minCount) {
            return stage.config;
        }
    }
    return MOVIE_KNOCKOUT_SPEEDS[MOVIE_KNOCKOUT_SPEEDS.length - 1].config;
}

async function runLastStandingMode(selectedMovies) {
    const eliminationPool = [...selectedMovies];
    let eliminationOrder = 1;
    isLastStandingInProgress = true;
    ui.updateSpinButtonLabel();
    ui.updateOdds?.(eliminationPool);

    ui.updateKnockoutRemainingBox(eliminationPool);
    ui.updateKnockoutResultText('start', eliminationPool.length);

    while (eliminationPool.length > 1) {
        const remainingBeforeSpin = eliminationPool.length;
        const speedConfig = getLastStandingSpeedConfig(remainingBeforeSpin);
        const isFinalElimination = remainingBeforeSpin === 2;
        const spinSettings = isFinalElimination
            ? speedConfig.finalSpin
            : speedConfig.eliminationSpin;
        const spinResult = await performSpin(eliminationPool, spinSettings);

        const eliminatedMovie = spinResult.winningMovie;
        if (!eliminatedMovie) {
            break;
        }

        const removalIndex = eliminationPool.findIndex((movie) => movie.id === eliminatedMovie.id);
        if (removalIndex === -1) {
            break;
        }

        ui.markMovieKnockedOut(eliminatedMovie.id, eliminationOrder);
        eliminationOrder += 1;
        playKnockoutSound();

        eliminationPool.splice(removalIndex, 1);
        const remainingCount = eliminationPool.length;

        ui.updateKnockoutRemainingBox(eliminationPool);
        ui.updateKnockoutResultText('eliminated', remainingCount, eliminatedMovie);
        ui.updateOdds?.(eliminationPool);

        drawWheel(eliminationPool);

        if (remainingCount <= 1) {
            const revealDelay = isFinalElimination ? speedConfig.finalRevealDelay : speedConfig.knockoutRevealDelay;
            await delay(revealDelay);
            break;
        }

        ui.updateSpinButtonLabel();
        await delay(speedConfig.interRoundDelay);
    }

    const finalMovie = eliminationPool[0];
    if (finalMovie) {
        winnerId = finalMovie.id;
        ui.markMovieChampion(finalMovie.id, eliminationOrder);
        const finalTiming = getLastStandingSpeedConfig(1);
        await delay(finalTiming.winnerRevealDelay);

        ui.updateKnockoutResultText('winner', 0, finalMovie);

        playWinSound();
        drawWheel(eliminationPool);
        ui.triggerConfetti();
        ui.showWinnerPopup(finalMovie, { spinMode: 'knockout' });
        addToHistory(finalMovie, 'knockout');
    }

    ui.highlightKnockoutCandidate(null);
    ui.updateKnockoutRemainingBox([]);
    isLastStandingInProgress = false;
    ui.updateOdds?.();
    ui.updateSpinButtonLabel();
}

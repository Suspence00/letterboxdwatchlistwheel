/**
 * Wheelchinko Physics Engine & Canvas Renderer
 * Simulates a vertical gravity pegboard with elastic collisions, side deflectors,
 * taller box art slots, grounded bottom floor tray, and multi-puck simulation.
 */

import { playPegBounceSound, playSlotLandSound } from './audio.js';

const WIDTH = 1400;
const HEIGHT = 1040;
const PEG_RADIUS = 5.0;
const PUCK_RADIUS = 12;
const GRAVITY = 1380;
const RESTITUTION = 0.66;
const FRICTION = 0.985;
const SUBSTEPS = 4;
const DIVIDER_TOP_Y = 680;
const FLOOR_Y = 1000;
const LEFT_WALL = 42;
const RIGHT_WALL = WIDTH - 42;
const WHEEL_COLORS = ['#ff8600', '#3b82f6', '#10b981', '#ec4899', '#8b5cf6', '#f59e0b'];

let canvas = null;
let ctx = null;
let animId = null;
let isSimulating = false;
let pucks = [];
let pegs = [];
let deflectors = [];
let slots = [];
let slotDividers = [];
let aimX = WIDTH / 2;
let showAimGuide = true;
let lastSoundTime = 0;
let onSettledCallback = null;
let onBatchCompleteCallback = null;

export function getBoardWidth() { return WIDTH; }

export function initWheelchinkoCanvas(canvasEl, callbacks = {}) {
    canvas = canvasEl;
    ctx = canvas.getContext('2d');
    onSettledCallback = callbacks.onSettled || null;
    onBatchCompleteCallback = callbacks.onBatchComplete || null;
    buildBoardGeometry();
    setupCanvasDPI();
    window.addEventListener('resize', setupCanvasDPI);
    renderStaticBoard();
}

function setupCanvasDPI() {
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = WIDTH * dpr;
    canvas.height = HEIGHT * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    renderStaticBoard();
}

function buildBoardGeometry() {
    pegs = [];
    deflectors = [];
    const rows = 14;
    const startY = 95;
    const rowGap = 42;
    const playWidth = RIGHT_WALL - LEFT_WALL;
    const colGap = (playWidth - 32) / 23;

    for (let r = 0; r < rows; r += 1) {
        const isOdd = r % 2 === 1;
        const count = isOdd ? 23 : 24;
        const y = startY + r * rowGap;
        const startX = LEFT_WALL + 16 + (isOdd ? colGap * 0.5 : 0);

        for (let c = 0; c < count; c += 1) {
            pegs.push({ x: startX + c * colGap, y, r: PEG_RADIUS, glow: 0 });
        }
        if (isOdd) {
            deflectors.push({ x: LEFT_WALL, y, isLeft: true, w: 14, h: 18 });
            deflectors.push({ x: RIGHT_WALL, y, isLeft: false, w: 14, h: 18 });
        }
    }
}

function getActivePuckRadius() {
    const count = slots.length || 10;
    if (count <= 10) return 12;
    if (count <= 20) return 10;
    if (count <= 35) return 8;
    if (count <= 55) return 6;
    return count <= 75 ? 4.5 : 3.5;
}

export function updateWheelchinkoSlots(movieSlots) {
    slots = [];
    slotDividers = [];
    const margin = 40;
    const count = Math.max(1, movieSlots.length);
    const slotWidth = (WIDTH - margin * 2) / count;
    const capR = Math.max(0.8, Math.min(2.5, slotWidth * 0.08));

    for (let i = 0; i < count; i += 1) {
        const xStart = margin + i * slotWidth;
        const xEnd = xStart + slotWidth;
        slots.push({ index: i, xStart, xEnd, centerX: (xStart + xEnd) / 2, movie: movieSlots[i] || null });
        if (i > 0) slotDividers.push({ x: xStart, topY: DIVIDER_TOP_Y, botY: FLOOR_Y, capR, slotW: slotWidth });
    }
    renderStaticBoard();
}

export function setAimX(normalizedFraction) {
    aimX = Math.max(70, Math.min(WIDTH - 70, 70 + normalizedFraction * (WIDTH - 140)));
    if (!isSimulating) renderStaticBoard();
}
export function resetAimX() { aimX = WIDTH / 2; if (!isSimulating) renderStaticBoard(); }
export function getIsDropping() { return isSimulating; }

function createPuck(x, vyMultiplier, y = 45) {
    return {
        x, y,
        vx: (Math.random() - 0.5) * 50,
        vy: 70 * vyMultiplier,
        r: getActivePuckRadius(),
        angle: 0,
        spin: (Math.random() - 0.5) * 4,
        settled: false,
        settledReported: false,
        trail: []
    };
}

export function launchPuck(customX = null, { speed = 1.0, count = 1, targets = null } = {}) {
    if (isSimulating) return false;
    const puckCount = Math.max(1, Math.min(5, Number(count) || 1));
    pucks = [];

    if (Array.isArray(targets) && targets.length > 0) {
        const delays = Array.from({ length: targets.length }, (_, i) => i).sort(() => Math.random() - 0.5);
        for (let i = 0; i < targets.length; i += 1) {
            const px = Math.max(70, Math.min(WIDTH - 70, targets[i]));
            pucks.push(createPuck(px, speed, 45 - delays[i] * 32));
        }
    } else if (puckCount === 1) {
        const clampedX = Math.max(70, Math.min(WIDTH - 70, typeof customX === 'number' ? customX : aimX));
        pucks.push(createPuck(clampedX, speed, 45));
    } else {
        const span = (WIDTH - 200) / puckCount;
        const delays = Array.from({ length: puckCount }, (_, i) => i).sort(() => Math.random() - 0.5);
        for (let i = 0; i < puckCount; i += 1) {
            const px = typeof customX === 'number'
                ? Math.max(70, Math.min(WIDTH - 70, customX + (i - (puckCount - 1) / 2) * 38))
                : 100 + span * (i + 0.5) + (Math.random() - 0.5) * (span * 0.4);
            pucks.push(createPuck(px, speed, 45 - delays[i] * 32));
        }
    }

    isSimulating = true;
    let lastTime = performance.now();
    const startTime = lastTime;

    function step(now) {
        if (!isSimulating) return;
        const dt = Math.min((now - lastTime) / 1000, 0.033) * speed;
        lastTime = now;
        updatePhysics(dt);
        drawSimulation();

        if (now - startTime > 7000) {
            pucks.forEach(p => { if (!p.settled) { p.y = FLOOR_Y - p.r; p.settled = true; } });
        }

        if (pucks.every(p => p.settled)) {
            isSimulating = false;
            pucks.forEach(p => {
                if (!p.settledReported) {
                    p.settledReported = true;
                    resolveLanding(p);
                }
            });
            if (typeof onBatchCompleteCallback === 'function') onBatchCompleteCallback();
            return;
        }
        animId = requestAnimationFrame(step);
    }

    cancelAnimationFrame(animId);
    animId = requestAnimationFrame(step);
    return true;
}

export function cancelDrop() {
    if (animId) cancelAnimationFrame(animId);
    animId = null;
    isSimulating = false;
    pucks = [];
    renderStaticBoard();
}

function updatePhysics(dt) {
    if (!pucks.length) return;
    const subDt = dt / SUBSTEPS;

    for (let step = 0; step < SUBSTEPS; step += 1) {
        for (let i = 0; i < pucks.length; i += 1) {
            for (let j = i + 1; j < pucks.length; j += 1) {
                const p1 = pucks[i];
                const p2 = pucks[j];
                if (p1.settled && p2.settled) continue;
                const dx = p2.x - p1.x;
                const dy = p2.y - p1.y;
                const dist = Math.hypot(dx, dy);
                const minDist = p1.r + p2.r;
                if (dist < minDist && dist > 0.001) {
                    const nx = dx / dist;
                    const ny = dy / dist;
                    const overlap = minDist - dist;
                    if (p1.settled) {
                        p2.x += nx * overlap; p2.y += ny * overlap;
                        p2.vy = -p2.vy * 0.35; p2.vx *= 0.65;
                        if (Math.abs(p2.vy) < 25 && Math.abs(p2.vx) < 25) {
                            p2.settled = true; p2.vy = 0; p2.vx = 0;
                            if (!p2.settledReported) { p2.settledReported = true; resolveLanding(p2); }
                        }
                    } else if (p2.settled) {
                        p1.x -= nx * overlap; p1.y -= ny * overlap;
                        p1.vy = -p1.vy * 0.35; p1.vx *= 0.65;
                        if (Math.abs(p1.vy) < 25 && Math.abs(p1.vx) < 25) {
                            p1.settled = true; p1.vy = 0; p1.vx = 0;
                            if (!p1.settledReported) { p1.settledReported = true; resolveLanding(p1); }
                        }
                    } else {
                        p1.x -= nx * overlap * 0.5; p1.y -= ny * overlap * 0.5;
                        p2.x += nx * overlap * 0.5; p2.y += ny * overlap * 0.5;
                        const vn = (p1.vx - p2.vx) * nx + (p1.vy - p2.vy) * ny;
                        if (vn < 0) {
                            const impulse = -vn * 0.7;
                            p1.vx += nx * impulse; p1.vy += ny * impulse;
                            p2.vx -= nx * impulse; p2.vy -= ny * impulse;
                            triggerPegSound(Math.abs(vn));
                        }
                    }
                }
            }
        }

        for (const p of pucks) {
            if (p.settled) continue;
            p.vy += GRAVITY * subDt;
            p.x += p.vx * subDt;
            p.y += p.vy * subDt;
            p.angle += (p.vx * 0.08 + p.spin) * subDt;
            p.spin *= 0.992;

            if (p.x - p.r < LEFT_WALL) {
                p.x = LEFT_WALL + p.r;
                p.vx = Math.abs(p.vx) * RESTITUTION;
                triggerPegSound(p.vx);
            } else if (p.x + p.r > RIGHT_WALL) {
                p.x = RIGHT_WALL - p.r;
                p.vx = -Math.abs(p.vx) * RESTITUTION;
                triggerPegSound(p.vx);
            }

            for (const def of deflectors) {
                if (def.isLeft && p.x - p.r < def.x + def.w && Math.abs(p.y - def.y) < def.h) {
                    p.x = def.x + def.w + p.r;
                    p.vx = (Math.abs(p.vx) + 60) * RESTITUTION;
                    p.vy = Math.max(p.vy, 75);
                    triggerPegSound(p.vx);
                } else if (!def.isLeft && p.x + p.r > def.x - def.w && Math.abs(p.y - def.y) < def.h) {
                    p.x = def.x - def.w - p.r;
                    p.vx = -(Math.abs(p.vx) + 60) * RESTITUTION;
                    p.vy = Math.max(p.vy, 75);
                    triggerPegSound(p.vx);
                }
            }

            for (const peg of pegs) {
                const dx = p.x - peg.x;
                const dy = p.y - peg.y;
                const dist = Math.hypot(dx, dy);
                const minDist = p.r + peg.r;
                if (dist < minDist && dist > 0.001) {
                    const nx = dx / dist;
                    const ny = dy / dist;
                    p.x = peg.x + nx * minDist;
                    p.y = peg.y + ny * minDist;
                    const vn = p.vx * nx + p.vy * ny;
                    if (vn < 0) {
                        const tx = -ny;
                        const ty = nx;
                        const vt = (p.vx * tx + p.vy * ty) * FRICTION;
                        const vnNew = -vn * RESTITUTION;
                        const jitter = (Math.random() - 0.5) * 0.14;
                        p.vx = (nx * Math.cos(jitter) - ny * Math.sin(jitter)) * vnNew + tx * vt;
                        p.vy = (nx * Math.sin(jitter) + ny * Math.cos(jitter)) * vnNew + ty * vt;
                        peg.glow = 1.0;
                        triggerPegSound(Math.abs(vn));
                    }
                }
            }

            if (p.y < DIVIDER_TOP_Y && Math.hypot(p.vx, p.vy) < 22) {
                p.vx += (Math.random() < 0.5 ? -1 : 1) * 45;
                p.vy = Math.max(p.vy + 35, 70);
            }

            for (const div of slotDividers) {
                if (Math.abs(p.y - div.topY) < p.r + 4 && Math.abs(p.x - div.x) < p.r + 2) {
                    const dir = p.x < div.x ? -1 : 1;
                    p.x = div.x + dir * (p.r + 1.2);
                    p.vx = dir * Math.max(Math.abs(p.vx), 25);
                    p.vy = Math.max(p.vy, 85);
                }
                if (p.y >= div.topY && p.y <= div.botY && Math.abs(p.x - div.x) < p.r) {
                    const dir = p.x < div.x ? -1 : 1;
                    p.x = div.x + dir * p.r;
                    p.vx = -p.vx * 0.35;
                }
            }

            if (p.y + p.r >= FLOOR_Y) {
                p.y = FLOOR_Y - p.r;
                p.vy = -p.vy * 0.35;
                p.vx *= 0.65;
                if (Math.abs(p.vy) < 18 && Math.abs(p.vx) < 18) {
                    p.settled = true; p.vy = 0; p.vx = 0;
                    if (!p.settledReported) { p.settledReported = true; resolveLanding(p); }
                }
            } else if (p.y > DIVIDER_TOP_Y + 30 && Math.abs(p.vy) < 15 && Math.abs(p.vx) < 15) {
                p.settled = true; p.vy = 0; p.vx = 0;
                if (!p.settledReported) { p.settledReported = true; resolveLanding(p); }
            }
        }
    }

    pegs.forEach(peg => { if (peg.glow > 0) peg.glow = Math.max(0, peg.glow - 0.04); });
    pucks.forEach(p => {
        p.trail.push({ x: p.x, y: p.y });
        if (p.trail.length > 8) p.trail.shift();
    });
}

function triggerPegSound(speed) {
    const now = performance.now();
    if (now - lastSoundTime < 40 || speed < 40) return;
    lastSoundTime = now;
    playPegBounceSound(0.85 + Math.random() * 0.35);
}

function resolveLanding(settledPuck) {
    playSlotLandSound();
    let winningSlot = slots.find(s => settledPuck.x >= s.xStart && settledPuck.x < s.xEnd);
    if (!winningSlot && slots.length > 0) {
        winningSlot = slots.reduce((closest, s) => {
            const d1 = Math.abs(s.centerX - settledPuck.x);
            const d2 = Math.abs(closest.centerX - settledPuck.x);
            return d1 < d2 ? s : closest;
        }, slots[0]);
    }
    if (winningSlot && onSettledCallback) onSettledCallback(winningSlot, settledPuck);
}

function renderStaticBoard() {
    if (!ctx) return;
    drawBoardBackground();
    drawPegsAndDividers();
    if (showAimGuide && !isSimulating) drawAimGuide();
}

function drawSimulation() {
    if (!ctx) return;
    drawBoardBackground();
    drawPegsAndDividers();
    drawPucks();
}

function drawBoardBackground() {
    ctx.clearRect(0, 0, WIDTH, HEIGHT);
    const grad = ctx.createLinearGradient(0, 0, 0, HEIGHT);
    grad.addColorStop(0, '#101726'); grad.addColorStop(0.7, '#0b101a'); grad.addColorStop(1, '#070a10');
    ctx.fillStyle = grad; ctx.fillRect(0, 0, WIDTH, HEIGHT);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)'; ctx.lineWidth = 2; ctx.strokeRect(1, 1, WIDTH - 2, HEIGHT - 2);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.025)'; ctx.fillRect(40, 15, WIDTH - 80, 55);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)'; ctx.strokeRect(40, 15, WIDTH - 80, 55);
    ctx.clearRect(40, DIVIDER_TOP_Y, WIDTH - 80, FLOOR_Y - DIVIDER_TOP_Y);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.28)'; ctx.fillRect(40, DIVIDER_TOP_Y, WIDTH - 80, FLOOR_Y - DIVIDER_TOP_Y);
    const trayGrad = ctx.createLinearGradient(0, FLOOR_Y, 0, HEIGHT);
    trayGrad.addColorStop(0, '#131b2c'); trayGrad.addColorStop(0.35, '#0b101b'); trayGrad.addColorStop(1, '#060910');
    ctx.fillStyle = trayGrad; ctx.fillRect(38, FLOOR_Y, WIDTH - 76, HEIGHT - FLOOR_Y - 2);
}

function drawPegsAndDividers() {
    for (const def of deflectors) {
        ctx.fillStyle = 'rgba(245, 158, 11, 0.12)';
        ctx.strokeStyle = 'rgba(245, 158, 11, 0.45)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        const tipX = def.isLeft ? def.x + def.w : def.x - def.w;
        ctx.moveTo(def.x, def.y - def.h);
        ctx.lineTo(tipX, def.y);
        ctx.lineTo(def.x, def.y + def.h);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
    }
    for (const peg of pegs) {
        ctx.beginPath();
        ctx.arc(peg.x, peg.y, peg.r, 0, Math.PI * 2);
        ctx.fillStyle = peg.glow > 0 ? `rgba(255, 180, 50, ${0.4 + peg.glow * 0.6})` : '#d1d5db';
        ctx.shadowColor = peg.glow > 0 ? '#ff8600' : 'transparent';
        ctx.shadowBlur = peg.glow > 0 ? 12 * peg.glow : 0;
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.beginPath();
        ctx.arc(peg.x - 1.5, peg.y - 1.5, 1.5, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
        ctx.fill();
    }

    const slotW = slots.length ? (WIDTH - 80) / slots.length : 60;
    const divWidth = Math.max(1, Math.min(2.5, slotW * 0.08));
    for (const div of slotDividers) {
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.22)'; ctx.lineWidth = divWidth;
        ctx.beginPath(); ctx.moveTo(div.x, div.topY); ctx.lineTo(div.x, div.botY); ctx.stroke();
        ctx.fillStyle = '#f59e0b'; ctx.beginPath(); ctx.arc(div.x, div.topY, div.capR, 0, Math.PI * 2); ctx.fill();
    }

    // Heavy grounded bottom ledge and floor trim
    ctx.strokeStyle = '#f59e0b'; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.moveTo(38, FLOOR_Y); ctx.lineTo(WIDTH - 38, FLOOR_Y); ctx.stroke();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(38, FLOOR_Y + 4); ctx.lineTo(WIDTH - 38, FLOOR_Y + 4); ctx.stroke();
}

function drawAimGuide() {
    ctx.save();
    ctx.strokeStyle = 'rgba(255, 134, 0, 0.35)';
    ctx.setLineDash([4, 6]);
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(aimX, 45);
    ctx.lineTo(aimX, 120);
    ctx.stroke();
    ctx.restore();
    drawMiniWheel(aimX, 45, getActivePuckRadius(), 0, 0.65);
}

function drawMiniWheel(centerX, centerY, radius, angle = 0, alpha = 1) {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(centerX, centerY);
    ctx.rotate(angle);
    const sliceAngle = (Math.PI * 2) / 6;
    for (let i = 0; i < 6; i += 1) {
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.arc(0, 0, radius, i * sliceAngle, (i + 1) * sliceAngle);
        ctx.fillStyle = WHEEL_COLORS[i];
        ctx.fill();
    }
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = Math.max(1, radius * 0.12);
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = '#0f172a';
    ctx.beginPath();
    ctx.arc(0, 0, radius * 0.64, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = Math.max(0.8, radius * 0.1);
    ctx.stroke();
    const fontSize = Math.round(radius * 0.54);
    if (fontSize >= 4.5) {
        ctx.fillStyle = '#ffffff';
        ctx.font = `900 ${fontSize}px system-ui, -apple-system, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('PTW!', 0, 0.5);
    }
    ctx.restore();
}

function drawPucks() {
    for (const p of pucks) {
        if (p.y < 20) continue;
        if (p.trail && p.trail.length > 1) {
            for (let i = 0; i < p.trail.length - 1; i += 1) {
                const pt = p.trail[i];
                ctx.fillStyle = `rgba(255, 134, 0, ${(i / p.trail.length) * 0.22})`;
                ctx.beginPath();
                ctx.arc(pt.x, pt.y, p.r * 0.7, 0, Math.PI * 2);
                ctx.fill();
            }
        }
        drawMiniWheel(p.x, p.y, p.r, p.angle, 1);
    }
}

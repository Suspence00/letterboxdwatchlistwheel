/** Self-contained, deterministic previews of the promo's two physical formats. */
import { C, FILMS, TAU, clamp, mix, text, line, roundRect, tape } from './graphics.js';

/** @param {CanvasRenderingContext2D} ctx */
function ellipse(ctx, x, y, rx, ry, fill, stroke, width = 1) {
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, TAU);
  if (fill) {
    ctx.fillStyle = fill;
    ctx.fill();
  }
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = width;
    ctx.stroke();
  }
}

/**
 * A tilted 2.5D VHS rotor carousel. Rotation 0 puts film 0 beside the right pointer.
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} x
 * @param {number} y
 * @param {number} r Outer cassette radius; allow another 35px for the pointer.
 * @param {number} [rotation]
 * @param {{activeFilms?: number[], selected?: number, cards?: Array<{index: number, angle: number, radiusScale?: number, scale?: number}>, championProgress?: number, pointer?: 'right' | 'top', pointerStrike?: number}} [options]
 */
export function boxWheel(ctx, x, y, r, rotation = 0, options = {}) {
  const active = (options.activeFilms || FILMS.map((_, i) => i))
    .filter(index => FILMS[index]);
  const tilt = 0.81;
  const orbit = r * 0.73;
  const baseCount = options.cards ? options.cards.length : active.length;
  const cardWidth = r * (baseCount > 7 ? 0.36 : 0.41);
  const cardHeight = cardWidth * 1.56;
  const surface = C.surface || '#222823';
  const border = C.border || '#394139';
  const champP = options.championProgress ?? (active.length === 1 && !options.cards ? 1 : 0);
  const topPointer = options.pointer === 'top';
  ctx.save();
  ctx.translate(x, y);

  // The depth of the continuous rotor keeps this recognizably a physical wheel.
  ellipse(ctx, 0, 24, r * 1.015, r * tilt, '#00000032');
  ellipse(ctx, 0, 14, r, r * tilt, '#111612', border, 3);
  const metal = ctx.createLinearGradient(0, -r, 0, r);
  metal.addColorStop(0, '#3c473c');
  metal.addColorStop(0.46, '#303a30');
  metal.addColorStop(1, '#202820');
  ellipse(ctx, 0, 0, r, r * tilt, metal, C.mint, 2);
  ellipse(ctx, 0, 0, r * 0.94, r * tilt * 0.94, null, border, 2);
  ellipse(ctx, 0, 0, r * 0.46, r * tilt * 0.46, surface, border, 2);

  const rawCards = options.cards || active.map((index, slot) => ({
    index,
    angle: rotation + slot * TAU / active.length,
    radiusScale: 1 - champP,
    scale: 1 + champP * 0.58,
  }));

  const cards = rawCards.map(item => {
    const { index, angle, radiusScale = 1, scale = 1 } = item;
    const depth = Math.sin(angle);
    const gate = Math.max(0, topPointer ? -Math.sin(angle) : Math.cos(angle)) ** 3;
    const zOrder = depth * (topPointer ? 0.45 : 0.72) + gate * 0.95 + (options.selected === index ? 1.5 : 0);
    const perspective = (1 + depth * (topPointer ? 0.04 : 0.08) + gate * 0.05) * scale;
    return { index, angle, depth, zOrder, perspective, radiusScale };
  }).sort((a, b) => a.zOrder - b.zOrder);

  // Spokes and center hub sit on the platter beneath the upright 3D VHS sleeves.
  for (const card of cards) {
    const a = card.angle;
    const spokeR = orbit * card.radiusScale;
    if (spokeR > r * 0.22) {
      line(ctx, Math.cos(a) * r * 0.2, Math.sin(a) * r * 0.2 * tilt,
        Math.cos(a) * spokeR, Math.sin(a) * spokeR * tilt, '#9daa8d33', 3);
    }
  }
  ellipse(ctx, 0, 7, r * 0.22, r * 0.22 * tilt, '#101611', '#46533f', 2);
  ellipse(ctx, 0, 0, r * 0.22, r * 0.22 * tilt, surface, C.mint, 2);
  text(ctx, 'W', 0, r * 0.06, r * 0.16, C.cream,
    { align: 'center', weight: 900 });
  for (let i = 0; i < 4; i++) {
    const a = i * Math.PI / 2 + Math.PI / 4;
    ellipse(ctx, Math.cos(a) * r * 0.17, Math.sin(a) * r * 0.17 * tilt,
      2.2, 2.2, C.mint);
  }

  for (const card of cards) {
    const { index, angle, depth, perspective, radiusScale } = card;
    const selected = options.selected === index;
    const w = cardWidth * perspective;
    const h = cardHeight * perspective;
    const dist = orbit * radiusScale;
    const lean = (Math.sin(angle) * 0.085 - Math.cos(angle) * 0.03) * radiusScale
      - 0.045 * (1 - radiusScale);
    ctx.save();
    ctx.translate(Math.cos(angle) * dist, Math.sin(angle) * dist * tilt);
    ctx.rotate(lean);

    // A shaded 3D spine and lower edge expose the cassette's physical thickness.
    ctx.shadowColor = '#00000075';
    ctx.shadowBlur = 14;
    ctx.shadowOffsetY = 9;
    roundRect(ctx, -w / 2 + 6, -h / 2 + 5, w, h, 3, '#0e120f');
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;
    roundRect(ctx, w / 2 - 3, -h / 2 + 4, 9, h - 1, 2, border);
    line(ctx, w / 2 + 3, -h / 2 + 9, w / 2 + 3, h / 2 - 4, '#9daa8d70', 1);
    tape(ctx, FILMS[index], 0, 0, w, h, 0, index + 1);
    if (depth < 0 && !topPointer && radiusScale > 0.5 && !selected) {
      roundRect(ctx, -w / 2 + 3, -h / 2 + 3, w - 6, h - 6, 3,
        `rgba(16,22,17,${-depth * 0.18})`);
    }
    if (selected) {
      ctx.beginPath();
      ctx.roundRect(-w / 2 - 3, -h / 2 - 3, w + 6, h + 6, 5);
      ctx.lineWidth = 3;
      ctx.strokeStyle = C.mint;
      ctx.stroke();
    }
    ctx.restore();
  }

  if (champP > 0.05) {
    ctx.save();
    ctx.globalAlpha *= champP;
    roundRect(ctx, -64, r * 0.56, 128, 28, 14, C.navy);
    ctx.beginPath();
    ctx.roundRect(-64, r * 0.56, 128, 28, 14);
    ctx.strokeStyle = C.mint;
    ctx.lineWidth = 1.5;
    ctx.stroke();
    text(ctx, 'CHAMPION', 0, r * 0.56 + 19, 12, C.mint,
      { align: 'center', tracking: 2, weight: 800 });
    ctx.restore();
  }

  ctx.beginPath();
  if (topPointer) {
    const strike = (options.pointerStrike || 0) * 12;
    const tipY = -r * 0.94 + strike;
    ctx.moveTo(0, tipY);
    ctx.lineTo(-18, tipY - 30);
    ctx.lineTo(18, tipY - 30);
  } else {
    ctx.moveTo(r + 7, 0);
    ctx.lineTo(r + 34, -16);
    ctx.lineTo(r + 34, 16);
  }
  ctx.closePath();
  ctx.fillStyle = (options.pointerStrike || 0) > 0.2 || options.selected >= 0 ? C.cream : C.orange;
  ctx.fill();
  ctx.restore();
}

/**
 * Every turning point touches a visible peg at the combined puck/peg radius.
 * Quadratic falling segments give each impact a short upward rebound before
 * gravity carries the puck to the next staggered row and finally Arrival.
 */
function puckAt(time, left, top, width, slotTop) {
  const columns = [5, 5, 6, 5, 5, 4, 5, 5, 6];
  const pegs = columns.map((column, row) => ({
    x: left + (column + (row % 2 ? 0.5 : 0)) * width / 11,
    y: mix(top + 102, slotTop - 28, row / 8),
  }));
  const contacts = pegs.map((peg, index) => {
    const nextX = pegs[index + 1]?.x ?? left + width * 0.56;
    const side = nextX > peg.x ? 1 : -1;
    return { x: peg.x + side * 12.5, y: peg.y - 12.67 };
  });
  const points = [{ x: left + width * 0.5, y: top + 62 }, ...contacts,
    { x: left + width * 0.55, y: slotTop + 8 }];
  const p = clamp((time - 0.25) / 3.55);
  const step = p * (points.length - 1);
  const i = Math.min(points.length - 2, Math.floor(step));
  const local = step - i;
  const start = points[i];
  const end = points[i + 1];
  const rebound = i > 0 ? (end.y - start.y) * 1.45 : 0;
  const side = i > 0 ? Math.sign(start.x - pegs[i - 1].x) : 0;
  return {
    x: mix(start.x, end.x, local) + side * Math.sin(local * Math.PI) * 14,
    y: mix(start.y, end.y, local) - rebound * local * (1 - local),
    impact: i > 0 && i <= pegs.length && local < 0.3 ? pegs[i - 1] : null,
    impactAge: local / 0.3,
    p,
  };
}

/**
 * Wheelchinko board with real poster slots and a deterministic ~4s puck drop.
 * Intended bounds: x=1010, y=245, width=785, height=650 in a 1920×1080 film.
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} x
 * @param {number} y
 * @param {number} w
 * @param {number} h
 * @param {number} time Scene-local seconds; time >= 3.8 holds the winning slot.
 */
export function pegboard(ctx, x, y, w, h, time) {
  const border = C.border || '#394139';
  const surface = C.surface || '#222823';
  const innerLeft = x + 34;
  const innerWidth = w - 68;
  const slotWidth = innerWidth / 10;
  const slotTop = y + h - 167;
  const floor = y + h - 38;
  const landed = time >= 3.8;
  const order = [1, 2, 3, 4, 5, 0, 6, 7, 8, 9];
  ctx.save();
  roundRect(ctx, x, y + 8, w, h, 25, '#0e140f');
  roundRect(ctx, x, y, w, h, 25, surface);
  ctx.beginPath();
  ctx.roundRect(x + 0.5, y + 0.5, w - 1, h - 1, 25);
  ctx.strokeStyle = border;
  ctx.lineWidth = 1.5;
  ctx.stroke();
  line(ctx, x + 24, y + 66, x + w - 24, y + 66, border);
  roundRect(ctx, x + 26, y + 19, 114, 28, 14, C.mint);
  text(ctx, 'RANDOM 10', x + 83, y + 37, 11, C.navy, { align: 'center', tracking: 1.4, weight: 800 });
  roundRect(ctx, x + 148, y + 19, 122, 28, 14, '#29322b');
  text(ctx, 'ELIMINATION', x + 209, y + 37, 11, C.muted, { align: 'center', tracking: 1.4, weight: 600 });
  roundRect(ctx, x + 278, y + 19, 118, 28, 14, '#29322b');
  text(ctx, 'SPINCHINKO', x + 337, y + 37, 11, C.muted, { align: 'center', tracking: 1.4, weight: 600 });
  text(ctx, landed ? 'ONE GREAT PICK' : 'FOLLOW THE PUCK', x + w - 28, y + 38,
    12, C.muted, { align: 'right', tracking: 1.5, weight: 500 });

  // Staggered rows and small metallic caps make the motion legible at a glance.
  const pegTop = y + 102;
  const pegBottom = slotTop - 28;
  for (let row = 0; row < 9; row++) {
    const py = mix(pegTop, pegBottom, row / 8);
    for (let col = 0; col < (row % 2 ? 11 : 12); col++) {
      const px = innerLeft + (col + (row % 2 ? 0.5 : 0)) * innerWidth / 11;
      ellipse(ctx, px, py + 2, 4.5, 4.5, '#101710');
      ellipse(ctx, px, py, 3.8, 3.8, C.mint);
      ellipse(ctx, px - 0.7, py - 0.9, 1.1, 1.1, '#eeefe480');
    }
  }

  // Every slot is rooted in one shared catcher floor, with Arrival at center-right.
  roundRect(ctx, innerLeft - 8, slotTop - 8, innerWidth + 16, floor - slotTop + 14,
    8, C.navy);
  order.forEach((filmIndex, slot) => {
    const left = innerLeft + slot * slotWidth;
    const selected = landed && filmIndex === 0;
    if (selected) roundRect(ctx, left + 1, slotTop - 5, slotWidth - 2,
      floor - slotTop + 6, 5, '#b4bba122');
    line(ctx, left, slotTop - 11, left, floor, selected ? C.mint : border, 2);
    text(ctx, String(slot + 1).padStart(2, '0'), left + slotWidth / 2,
      slotTop + 13, 9, selected ? C.cream : C.muted, { align: 'center', weight: 500 });
    tape(ctx, FILMS[filmIndex], left + slotWidth / 2, slotTop + 74,
      slotWidth - 11, 95, 0, filmIndex + 1);
    if (selected) {
      ctx.beginPath();
      ctx.roundRect(left + 3, slotTop - 3, slotWidth - 6, floor - slotTop + 2, 4);
      ctx.strokeStyle = C.mint;
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  });
  line(ctx, innerLeft + innerWidth, slotTop - 11, innerLeft + innerWidth, floor, border, 2);
  roundRect(ctx, innerLeft - 10, floor, innerWidth + 20, 7, 3, border);
  line(ctx, innerLeft - 8, floor, innerLeft + innerWidth + 8, floor, C.mint, 1);

  const puck = puckAt(time, innerLeft, y, innerWidth, slotTop);
  if (puck.impact) {
    ctx.save();
    ctx.globalAlpha *= (1 - puck.impactAge) * 0.45;
    ellipse(ctx, puck.impact.x, puck.impact.y, 7 + puck.impactAge * 10,
      7 + puck.impactAge * 10, null, C.mint, 1.5);
    ctx.restore();
  }
  if (time > 0.25 && !landed) {
    for (let i = 5; i > 0; i--) {
      const trail = puckAt(Math.max(0.25, time - i * 0.045), innerLeft, y,
        innerWidth, slotTop);
      ctx.save();
      ctx.globalAlpha *= 0.2;
      ellipse(ctx, trail.x, trail.y, 8 - i * 0.8, 8 - i * 0.8, C.mint);
      ctx.restore();
    }
  }
  ellipse(ctx, puck.x + 2, puck.y + 4, 14, 14, '#00000050');
  ellipse(ctx, puck.x, puck.y, 14, 14, C.navy, C.orange, 3);
  text(ctx, 'W', puck.x, puck.y + 4, 12, C.cream, { align: 'center', weight: 900 });
  text(ctx, landed ? 'TONIGHT’S PICK: ARRIVAL' : '10 FILMS. EVERY BOUNCE COUNTS.',
    x + w / 2, y + h - 13, 12, landed ? C.cream : C.muted,
    { align: 'center', tracking: 1.4, weight: 500 });
  ctx.restore();
}

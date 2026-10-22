import { getPoster } from './assets.js';

/** Omni dark tokens mirror css/components/omni-theme.css. */
export const C = {
  navy: '#181c19', ink: '#20271f', cream: '#eeefe4', muted: '#b2b9a8',
  orange: '#df936f', coral: '#bd775c', mint: '#b4bba1', lavender: '#8c9f7a',
  surface: '#222823', border: '#394139', raised: '#29322b',
};
export const FILMS = [
  ['ARRIVAL', '2016', C.orange], ['PAPRIKA', '2006', C.lavender],
  ['PARASITE', '2019', C.mint], ['THE WITCH', '2015', C.coral],
  ['INTERSTELLAR', '2014', C.cream], ['MIDSOMMAR', '2019', C.orange],
  ['SPIRITED AWAY', '2001', C.mint], ['CHOCOLATE', '2008', C.lavender],
  ['BLADE RUNNER 2049', '2017', C.coral], ['SINNERS', '2025', C.cream],
];
export const clamp = (n, a = 0, b = 1) => Math.min(b, Math.max(a, n));
export const ease = n => 1 - (1 - clamp(n)) ** 3;
export const mix = (a, b, n) => a + (b - a) * n;
export const TAU = Math.PI * 2;

export function text(ctx, words, x, y, size, color = C.cream, options = {}) {
  ctx.save();
  ctx.fillStyle = color;
  ctx.font = `${options.weight || 700} ${size}px ${options.serif ? 'Georgia, serif' : 'Manrope, Arial, sans-serif'}`;
  ctx.textAlign = options.align || 'left';
  ctx.textBaseline = 'alphabetic';
  if (options.italic) ctx.font = `italic ${ctx.font}`;
  if (options.tracking) ctx.letterSpacing = `${options.tracking}px`;
  if (options.width) {
    ctx.translate(x, y);
    ctx.scale(Math.min(1, options.width / ctx.measureText(words).width), 1);
    ctx.fillText(words, 0, 0);
  } else ctx.fillText(words, x, y);
  ctx.restore();
}

export function label(ctx, words, x, y, color = C.muted, size = 18) {
  text(ctx, words, x, y, size, color, { tracking: 3, weight: 500 });
}

export function line(ctx, x1, y1, x2, y2, color = '#ffffff24', width = 1) {
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.stroke();
}

export function roundRect(ctx, x, y, w, h, r, color) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  ctx.fillStyle = color;
  ctx.fill();
}

export function pill(ctx, words, x, y, color = C.orange) {
  ctx.save();
  ctx.font = '600 18px Manrope, Arial, sans-serif';
  const w = ctx.measureText(words).width + 38;
  roundRect(ctx, x, y, w, 42, 21, color);
  text(ctx, words, x + 19, y + 27, 18, C.navy);
  ctx.restore();
  return w;
}

export function arrow(ctx, x, y, length = 75, color = C.orange) {
  line(ctx, x, y, x + length, y, color, 3);
  line(ctx, x + length - 12, y - 12, x + length, y, color, 3);
  line(ctx, x + length - 12, y + 12, x + length, y, color, 3);
}

/** Physical box-art sleeves, with a typographic fallback when artwork is absent. */
export function tape(ctx, film, x, y, w, h, angle = 0, serial = 1) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.shadowColor = '#00000055';
  ctx.shadowBlur = 30;
  ctx.shadowOffsetY = 22;
  roundRect(ctx, -w / 2, -h / 2, w, h, 7, '#050b11');
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;
  roundRect(ctx, -w / 2 + 9, -h / 2 + 5, w - 16, h - 10, 3, film[2]);
  const poster = getPoster(FILMS.indexOf(film));
  if (poster) {
    const padding = Math.max(5, w * 0.025);
    const labelHeight = h * 0.11;
    const frameX = -w / 2 + padding + w * 0.035;
    const frameY = -h / 2 + padding;
    const frameW = w - padding * 2 - w * 0.035;
    const frameH = h - padding * 2 - labelHeight;
    roundRect(ctx, frameX, frameY, frameW, frameH, 1, '#0e130f');
    const scale = Math.min(frameW / poster.naturalWidth, frameH / poster.naturalHeight);
    const imageW = poster.naturalWidth * scale;
    const imageH = poster.naturalHeight * scale;
    ctx.drawImage(poster, frameX + (frameW - imageW) / 2, frameY + (frameH - imageH) / 2, imageW, imageH);
    roundRect(ctx, frameX, h / 2 - labelHeight - padding, frameW, labelHeight, 1, C.cream);
    text(ctx, film[0], frameX + padding, h / 2 - labelHeight * 0.51, w * 0.059, C.ink, { width: frameW - padding * 2, weight: 800 });
    text(ctx, `${film[1]} / VHS ${String(serial).padStart(2, '0')}`, frameX + padding, h / 2 - labelHeight * 0.16, w * 0.035, C.ink, { width: frameW - padding * 2, weight: 500 });
    line(ctx, -w / 2 + w * 0.04, -h / 2 + padding, -w / 2 + w * 0.04, h / 2 - padding, '#ffffff30', 1);
    ctx.restore();
    return;
  }
  const left = -w / 2 + 24;
  const top = -h / 2 + 30;
  label(ctx, 'W / W', left, top, C.navy, w * 0.06);
  text(ctx, `${String(serial).padStart(2, '0')}`, w / 2 - 24, top, w * 0.065, C.navy, { align: 'right' });
  ctx.save();
  ctx.beginPath();
  ctx.rect(-w / 2 + 10, -h / 2 + h * 0.18, w - 18, h * 0.54);
  ctx.clip();
  ctx.strokeStyle = C.navy;
  ctx.lineWidth = w * 0.012;
  for (let i = 0; i < 13; i++) {
    ctx.beginPath();
    const r = w * (0.13 + i * 0.067);
    ctx.ellipse(w * 0.18, -h * 0.03, r, r * 0.85, -0.7, 0, TAU);
    ctx.stroke();
  }
  ctx.restore();
  roundRect(ctx, -w / 2 + 9, h * 0.22, w - 16, h * 0.26, 0, C.cream);
  const words = film[0].split(' ');
  const split = film[0].length > 12 ? Math.ceil(words.length / 2) : words.length;
  const first = words.slice(0, split).join(' ');
  const second = words.slice(split).join(' ');
  text(ctx, first, left, h * 0.32, w * 0.105, C.navy, { width: w - 48, weight: 900 });
  if (second) text(ctx, second, left, h * 0.39, w * 0.105, C.navy, { width: w - 48, weight: 900 });
  text(ctx, `${film[1]}    /    VHS`, left, h * 0.45, w * 0.052, C.navy, { tracking: 1 });
  ctx.restore();
}

/** A deliberately graphic version of the classic wheel and its mechanical pointer. */
export function wheel(ctx, x, y, r, rotation = 0, winner = false, showBoost = false) {
  ctx.save();
  ctx.translate(x, y);
  ctx.strokeStyle = '#ffffff1f';
  ctx.lineWidth = 1;
  for (const extra of [28, 48]) {
    ctx.beginPath();
    ctx.arc(0, 0, r + extra, 0, TAU);
    ctx.stroke();
  }
  for (let i = 0; i < 80; i++) {
    const a = i * TAU / 80;
    line(ctx, Math.cos(a) * (r + 32), Math.sin(a) * (r + 32),
      Math.cos(a) * (r + (i % 5 ? 38 : 46)), Math.sin(a) * (r + (i % 5 ? 38 : 46)), '#b2b9a866', 2);
  }
  ctx.save();
  ctx.rotate(rotation);
  const span = TAU / FILMS.length;
  FILMS.forEach((film, i) => {
    const a = i * span;
    const mid = a + span / 2;
    const flipped = Math.cos(rotation + mid) < -0.01;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, r, a, a + span);
    ctx.closePath();
    ctx.fillStyle = film[2];
    ctx.fill();
    if (winner && i === 0) {
      ctx.save();
      const glow = ctx.createRadialGradient(0, 0, r * 0.18, 0, 0, r);
      glow.addColorStop(0, '#eeefe466');
      glow.addColorStop(1, '#eeefe400');
      ctx.fillStyle = glow;
      ctx.fill();
      ctx.strokeStyle = C.cream;
      ctx.lineWidth = 5;
      ctx.stroke();
      ctx.restore();
    } else {
      ctx.strokeStyle = C.navy;
      ctx.lineWidth = 4;
      ctx.stroke();
    }
    ctx.save();
    ctx.rotate(flipped ? mid + Math.PI : mid);
    const dir = flipped ? -1 : 1;
    const align = flipped ? 'left' : 'right';
    text(ctx, film[0], dir * (r - 26), 7, r * 0.054, C.navy, { align, width: r * 0.58, weight: 700 });
    const tag = showBoost && i === 0 ? '2× BOOST' : String(i + 1).padStart(2, '0');
    text(ctx, tag, dir * (r * (showBoost && i === 0 ? 0.55 : 0.42)), -11, r * 0.033,
      showBoost && i === 0 ? C.navy : '#20271f88', { align, weight: showBoost && i === 0 ? 800 : 700 });
    ctx.restore();
  });
  ctx.restore();
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.21, 0, TAU);
  ctx.fillStyle = C.navy;
  ctx.fill();
  ctx.strokeStyle = C.cream;
  ctx.lineWidth = 2;
  ctx.stroke();
  text(ctx, 'W', 0, r * 0.063, r * 0.18, C.cream, { align: 'center', weight: 900 });
  ctx.beginPath();
  ctx.moveTo(r + 7, 0);
  ctx.lineTo(r + 65, -25);
  ctx.lineTo(r + 65, 25);
  ctx.closePath();
  ctx.fillStyle = winner ? C.cream : C.orange;
  ctx.fill();
  ctx.restore();
}

export function enter(ctx, time, delay, draw, distance = 65) {
  const p = ease((time - delay) / 0.7);
  ctx.save();
  ctx.globalAlpha *= p;
  ctx.translate(0, (1 - p) * distance);
  draw();
  ctx.restore();
}

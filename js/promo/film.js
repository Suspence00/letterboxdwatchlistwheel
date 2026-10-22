import { C, clamp, ease, label, line, text } from './graphics.js';
import { indecision, presentations, spinning, knockout, wheelchinko, winner, finale } from './scenes.js';

export const DURATION = 30;
export const CHAPTERS = [
  { start: 0, end: 3, name: 'The dilemma', draw: indecision },
  { start: 3, end: 8, name: 'Box art and classic slices', draw: presentations },
  { start: 8, end: 13, name: 'One Spin', draw: spinning },
  { start: 13, end: 18, name: 'Knockout', draw: knockout },
  { start: 18, end: 23, name: 'Wheelchinko', draw: wheelchinko },
  { start: 23, end: 26, name: 'Movie night, decided', draw: winner },
  { start: 26, end: 30, name: 'Praise the wheel', draw: finale },
];
const grain = new WeakMap();

function background(ctx, canvas, time) {
  ctx.fillStyle = C.navy;
  ctx.fillRect(0, 0, 1920, 1080);
  ctx.fillStyle = '#b4bba108';
  for (let y = 150; y < 1000; y += 40) {
    for (let x = 1050; x < 1900; x += 40) ctx.fillRect(x, y, 2, 2);
  }
  // A fixed noise tile adds fine film texture without nondeterministic frame jitter.
  if (!grain.has(canvas)) {
    const tile = document.createElement('canvas');
    tile.width = tile.height = 128;
    const tileCtx = tile.getContext('2d');
    const pixels = tileCtx.createImageData(128, 128);
    let seed = 743;
    for (let i = 0; i < pixels.data.length; i += 4) {
      seed = (seed * 16807) % 2147483647;
      pixels.data[i] = pixels.data[i + 1] = pixels.data[i + 2] = seed % 256;
      pixels.data[i + 3] = 13;
    }
    tileCtx.putImageData(pixels, 0, 0);
    grain.set(canvas, ctx.createPattern(tile, 'repeat'));
  }
  ctx.fillStyle = grain.get(canvas);
  ctx.fillRect(0, 0, 1920, 1080);
  // A slowly moving registration line keeps the empty space alive.
  line(ctx, 1850, 170, 1850, 930, '#ffffff10');
  line(ctx, 1843, 200 + (time * 45) % 650, 1857, 200 + (time * 45) % 650, C.orange, 2);
}

function furniture(ctx, time, chapter) {
  ctx.save();
  ctx.translate(100, 86);
  ctx.fillStyle = C.mint;
  ctx.beginPath();
  ctx.arc(0, 0, 21, 0, Math.PI * 2);
  ctx.fill();
  text(ctx, 'W', 0, 8, 24, C.navy, { align: 'center', weight: 900 });
  ctx.restore();
  label(ctx, 'THE WATCHLIST WHEEL', 142, 94, C.cream, 18);
  label(ctx, 'OMNI DARK / THE MOVIE NIGHT EDIT', 1300, 94, C.muted, 14);
  line(ctx, 100, 131, 1820, 131);
  line(ctx, 100, 985, 1820, 985);
  label(ctx, 'LETTERBOXD WATCHLIST WHEEL', 100, 1033, C.muted, 14);
  label(ctx, `${String(chapter + 1).padStart(2, '0')} / ${String(CHAPTERS.length).padStart(2, '0')}`, 1730, 1033, C.cream, 17);
  for (let i = 0; i < CHAPTERS.length; i++) {
    const scene = CHAPTERS[i];
    const x = 683 + i * 80;
    line(ctx, x, 1026, x + 64, 1026, '#ffffff25', 3);
    line(ctx, x, 1026, x + 64 * clamp((time - scene.start) / (scene.end - scene.start)), 1026, C.orange, 3);
  }
}

/** Render a frame at any timestamp; shared by the player and offline video export. */
export function renderFrame(canvas, seconds) {
  const ctx = canvas.getContext('2d', { alpha: false });
  const time = clamp(seconds, 0, DURATION - 0.001);
  const index = CHAPTERS.findIndex(scene => time >= scene.start && time < scene.end);
  const chapter = CHAPTERS[Math.max(0, index)];
  ctx.save();
  ctx.setTransform(canvas.width / 1920, 0, 0, canvas.height / 1080, 0, 0);
  background(ctx, canvas, time);
  const local = time - chapter.start;
  // A shared dark backdrop and short dissolves avoid full-frame color flashes.
  const transition = index > 0 ? ease(local / 0.36) : 1;
  if (transition < 1) {
    const previous = CHAPTERS[index - 1];
    ctx.save();
    ctx.globalAlpha = 1 - transition;
    previous.draw(ctx, previous.end - previous.start - 0.001);
    ctx.restore();
  }
  ctx.save();
  ctx.globalAlpha = transition;
  chapter.draw(ctx, local);
  ctx.restore();
  furniture(ctx, time, Math.max(0, index));
  ctx.restore();
}

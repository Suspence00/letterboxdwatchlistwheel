import { C, FILMS, TAU, clamp, ease, mix, text, label, roundRect, pill, arrow, tape, wheel, enter } from './graphics.js';
import { boxWheel, pegboard } from './formats.js';

function title(ctx, time, lines, x = 98, y = 405, size = 136) {
  lines.forEach((word, i) => enter(ctx, time, i * 0.12, () => {
    text(ctx, word.replace('~', ''), x, y + i * size * 1.07, size,
      word.startsWith('~') ? C.mint : C.cream, { weight: 800, width: 1040, tracking: -5 });
  }, 35));
}

function caption(ctx, words, x, y, color = C.muted, size = 17) {
  text(ctx, words, x, y, size, color, { align: 'center', tracking: 2, weight: 500 });
}

function panel(ctx, x, y, w, h) {
  roundRect(ctx, x, y, w, h, 18, C.surface);
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 18);
  ctx.strokeStyle = C.border;
  ctx.lineWidth = 1;
  ctx.stroke();
}

export function indecision(ctx, t) {
  label(ctx, 'YOUR MOVIE NIGHT, BEFORE THE WHEEL', 100, 223);
  title(ctx, t, ['SO MANY', '~GOOD FILMS.'], 90, 417, 151);
  enter(ctx, t, 0.35, () => text(ctx, 'Still can’t pick?', 100, 738, 60, C.orange, { weight: 500, tracking: -2 }));
  enter(ctx, t, 0.6, () => label(ctx, 'MAKE THE CHOOSING PART OF THE FUN.', 104, 822, C.cream, 17));
  [4, 3, 1, 2, 0].forEach((n, i) => {
    const p = ease((t - i * 0.09) / 0.85);
    const offset = (i - 2) * 88;
    tape(ctx, FILMS[n], 1430 + offset + (1 - p) * 620,
      535 + Math.abs(i - 2) * 26 + Math.sin(t * 1.2 + i) * 6,
      270, 425, (i - 2) * 0.12, n + 1);
  });
  enter(ctx, t, 0.8, () => caption(ctx, 'YOUR WATCHLIST. YOUR NEXT GREAT WATCH.', 1440, 880, C.muted, 16));
}

export function presentations(ctx, t) {
  label(ctx, 'YOUR WATCHLIST / TWO WAYS TO PLAY', 100, 214, C.orange);
  enter(ctx, t, 0, () => text(ctx, 'Your wheel. Your way.', 95, 322, 92, C.cream, { weight: 700, tracking: -4 }));
  enter(ctx, t, 0.2, () => text(ctx, 'Import from Letterboxd or CSV. Tune weights, boost favorites, and make it yours.', 101, 364, 24, C.muted, { weight: 400 }));
  panel(ctx, 100, 398, 820, 527);
  panel(ctx, 1000, 398, 820, 527);
  boxWheel(ctx, 510, 636, 194, t * 0.16 - 0.3, { selected: 0 });
  wheel(ctx, 1400, 636, 192, t * 0.16 - Math.PI / 10, false, true);
  caption(ctx, 'BOX ART / 3D VHS SLEEVES', 510, 895, C.cream, 19);
  caption(ctx, 'CLASSIC SLICES / WEIGHTS & BOOSTS', 1400, 895, C.cream, 19);
  arrow(ctx, 944, 643, 32, C.muted);
}

export function spinning(ctx, t) {
  label(ctx, '01 / ONE SPIN', 100, 223, C.orange, 22);
  title(ctx, t, ['ONE SPIN.', '~ALL SET.'], 91, 420, 140);
  enter(ctx, t, 0.35, () => {
    text(ctx, 'One click. One movie night.', 100, 701, 32, C.cream, { weight: 400 });
    text(ctx, 'Let the wheel make the call.', 100, 749, 28, C.muted, { weight: 400 });
    pill(ctx, 'CLASSIC SLICES', 100, 836, C.mint);
  });
  const progress = clamp(t / 4.35);
  const rotation = -Math.PI / 10 + 12 * TAU * (1 - (1 - progress) ** 3.6);
  wheel(ctx, 1385, 551, 330, rotation, progress === 1, true);
  caption(ctx, progress === 1 ? 'ARRIVAL / TONIGHT’S PICK' : 'THE SUSPENSE IS PART OF IT.', 1385, 953,
    progress === 1 ? C.orange : C.muted, 17);
}

export function knockout(ctx, t) {
  label(ctx, '02 / KNOCKOUT', 100, 223, C.orange, 22);
  title(ctx, t, ['LAST FILM', '~STANDING.'], 91, 420, 131);
  enter(ctx, t, 0.35, () => {
    text(ctx, 'Every round raises the stakes.', 100, 701, 30, C.cream, { weight: 400 });
    text(ctx, 'Six contenders. One champion.', 100, 749, 28, C.muted, { weight: 400 });
    pill(ctx, 'BOX ART', 100, 836, C.mint);
  });
  const elimTimes = [0.65, 1.4, 2.15, 2.9, 3.65];
  const order = [3, 1, 5, 2, 4];
  const step = elimTimes.filter(time => t >= time).length;
  const survivorsAt = k => [0, 1, 2, 3, 4, 5].filter(n => !order.slice(0, k).includes(n));
  const curr = survivorsAt(step);
  const prev = survivorsAt(Math.max(0, step - 1));
  const since = step > 0 ? t - elimTimes[step - 1] : 1;
  const repack = ease(since / 0.45);
  const champ = step === 5 ? ease((t - 3.65) / 0.55) : 0;
  const baseRot = (1 - champ) * (t * 0.55);
  const cards = curr.map((index, slot) => {
    const prevSlot = Math.max(0, prev.indexOf(index));
    const prevAngle = prevSlot * TAU / prev.length;
    const currAngle = slot * TAU / curr.length;
    return {
      index,
      angle: baseRot + mix(prevAngle, currAngle, repack),
      radiusScale: 1 - champ,
      scale: 1 + champ * 0.58,
    };
  });
  boxWheel(ctx, 1415, 530, 236, baseRot, {
    cards,
    selected: step === 5 ? 0 : -1,
    championProgress: champ,
  });
  // Eliminated tape ejects down-left clear of the right-side contenders readout.
  if (step > 0) {
    const removed = order[step - 1];
    const drop = ease(since / 0.65);
    if (drop < 1) {
      ctx.save();
      ctx.globalAlpha = 1 - drop;
      const scale = 1 - drop * 0.18;
      tape(ctx, FILMS[removed], 1215 - drop * 110, 610 + drop * 195,
        134 * scale, 210 * scale, -0.1 - drop * 0.42, removed + 1);
      ctx.restore();
    }
  }
  const count = 6 - step;
  text(ctx, String(count).padStart(2, '0'), 1775, 889, 76, C.orange, { align: 'right', weight: 700 });
  text(ctx, count === 1 ? 'CHAMPION' : 'CONTENDERS', 1775, 926, 15, C.muted, { align: 'right', tracking: 2, weight: 500 });
}

export function wheelchinko(ctx, t) {
  label(ctx, '03 / WHEELCHINKO', 100, 223, C.orange, 22);
  title(ctx, t, ['DROP IN.', '~FIND OUT.'], 91, 420, 137);
  enter(ctx, t, 0.35, () => {
    text(ctx, 'A pegboard. Your watchlist.', 100, 701, 30, C.cream, { weight: 400 });
    text(ctx, 'One gravity-powered pick.', 100, 749, 28, C.muted, { weight: 400 });
    pill(ctx, 'A WHOLE NEW WAY TO PICK', 100, 836, C.mint);
  });
  pegboard(ctx, 1010, 245, 785, 650, t);
  caption(ctx, t > 4 ? 'ARRIVAL / A PERFECT LANDING' : 'DROP. BOUNCE. MOVIE NIGHT.', 1402, 951, t > 4 ? C.orange : C.muted, 17);
}

export function winner(ctx, t) {
  label(ctx, 'TONIGHT’S FEATURE PRESENTATION', 100, 223, C.orange);
  title(ctx, t, ['MOVIE NIGHT.', '~DECIDED.'], 91, 418, 130);
  enter(ctx, t, 0.3, () => {
    text(ctx, 'Arrival', 101, 705, 64, C.cream, { weight: 500, tracking: -2 });
    label(ctx, '2016 / YOUR NEXT WATCH', 105, 756, C.muted, 18);
    pill(ctx, 'PRAISE THE WHEEL!', 100, 837, C.mint);
  });
  const p = ease(t / 0.85);
  ctx.save();
  ctx.translate(1430, 550);
  ctx.rotate(-0.06 + (1 - p) * 0.2);
  ctx.scale(0.85 + p * 0.15, 0.85 + p * 0.15);
  ctx.strokeStyle = C.border;
  for (const radius of [305, 335]) {
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, TAU);
    ctx.stroke();
  }
  tape(ctx, FILMS[0], 0, Math.sin(t * 1.3) * 6, 337, 530, 0, 1);
  ctx.restore();
}

export function finale(ctx, t) {
  enter(ctx, t, 0, () => label(ctx, 'LESS SCROLLING. MORE CINEMA.', 100, 233, C.orange, 21));
  title(ctx, t, ['PRAISE', '~THE WHEEL.'], 89, 422, 148);
  enter(ctx, t, 0.2, () => {
    text(ctx, 'Letterboxd', 101, 737, 38, C.cream, { weight: 400 });
    text(ctx, 'Watchlist Wheel', 101, 790, 38, C.cream, { weight: 700 });
  });
  enter(ctx, t, 0.5, () => {
    roundRect(ctx, 100, 847, 540, 75, 8, C.mint);
    text(ctx, 'wheel.sensei.lol', 134, 896, 31, C.ink, { weight: 600 });
    arrow(ctx, 532, 885, 66, C.ink);
  });
  boxWheel(ctx, 1450, 550, 253, Math.sin(t * 0.5) * 0.12, { selected: 0 });
  caption(ctx, 'ONE SPIN / KNOCKOUT / WHEELCHINKO', 1430, 945, C.muted, 16);
}

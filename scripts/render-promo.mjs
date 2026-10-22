/** Development-only export: node scripts/render-promo.mjs [--stills]. Requires FFmpeg. */
import { chromium } from '@playwright/test';
import { createServer } from 'node:http';
import { existsSync } from 'node:fs';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { once } from 'node:events';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const output = resolve(root, 'media/promo');
const stillsOnly = process.argv.includes('--stills');
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.m4a': 'audio/mp4', '.webp': 'image/webp', '.ttf': 'font/ttf' };
const server = createServer(async (request, response) => {
  try {
    const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    if (pathname === '/__promo-export') {
      response.setHeader('Content-Type', 'text/html');
      response.end('<!doctype html><html lang="en"><title>Promo export</title><canvas id="export" width="1920" height="1080"></canvas></html>');
      return;
    }
    const file = resolve(root, `.${pathname}`);
    if (!file.startsWith(root + sep)) throw new Error('Invalid path');
    response.setHeader('Content-Type', mime[extname(file)] || 'application/octet-stream');
    response.end(await readFile(file));
  } catch {
    response.writeHead(404).end();
  }
});
await mkdir(output, { recursive: true });
await mkdir(resolve(root, 'test-results/promo'), { recursive: true });
server.listen(0, '127.0.0.1');
await once(server, 'listening');
let browser;
let encoder;
let completed = false;
try {
  browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(`http://127.0.0.1:${server.address().port}/__promo-export`);
  await page.evaluate(async () => {
    const film = await import('/js/promo/film.js');
    const { loadAssets } = await import('/js/promo/assets.js');
    await loadAssets();
    // This isolated page exists only during development export.
    globalThis.promoExport = { ...film, canvas: document.getElementById('export') };
    await document.fonts.ready;
  });
  const duration = await page.evaluate(() => globalThis.promoExport.DURATION);
  const timestamps = await page.evaluate(() => globalThis.promoExport.CHAPTERS.map(scene => scene.start + (scene.end - scene.start) * 0.65));
  for (const [i, time] of timestamps.entries()) {
    const data = await page.evaluate(time => {
      const { canvas, renderFrame } = globalThis.promoExport;
      renderFrame(canvas, time);
      return canvas.toDataURL('image/jpeg', 0.96).split(',')[1];
    }, time);
    await writeFile(resolve(root, `test-results/promo/scene-${i + 1}.jpg`), Buffer.from(data, 'base64'));
    if (i === timestamps.length - 1) await writeFile(resolve(output, 'wheel-promo-poster.jpg'), Buffer.from(data, 'base64'));
  }
  if (stillsOnly) {
    console.log(`${timestamps.length} full-resolution review frames and the poster exported.`);
  } else {
    const fps = 30;
    const frames = duration * fps;
    const audioInput = existsSync(resolve(output, 'wheel-promo.wav'))
      ? resolve(output, 'wheel-promo.wav')
      : resolve(output, 'wheel-promo.m4a');
    encoder = spawn('ffmpeg', [
      '-hide_banner', '-loglevel', 'error', '-y',
      '-f', 'image2pipe', '-vcodec', 'mjpeg', '-framerate', String(fps), '-i', 'pipe:0',
      '-i', audioInput,
      '-map', '0:v:0', '-map', '1:a:0', '-c:v', 'libx264', '-preset', 'medium',
      '-crf', '18', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '192k',
      '-t', String(duration), '-movflags', '+faststart',
      '-metadata', 'title=Letterboxd Watchlist Wheel — Omni Dark',
      '-metadata', 'comment=Original motion design and synthesized score.',
      resolve(output, 'wheel-promo-omni-dark.mp4'),
    ], { stdio: ['pipe', 'inherit', 'inherit'], windowsHide: true });
    const encoderResult = once(encoder, 'close');
    encoder.stdin.on('error', () => {});
    for (let i = 0; i < frames; i++) {
      const data = await page.evaluate(time => {
        const { canvas, renderFrame } = globalThis.promoExport;
        renderFrame(canvas, time);
        return canvas.toDataURL('image/jpeg', 0.96).split(',')[1];
      }, i / fps);
      if (!encoder.stdin.write(Buffer.from(data, 'base64'))) await once(encoder.stdin, 'drain');
      if (i % 90 === 0) console.log(`Rendering ${Math.round(i / frames * 100)}% (${i}/${frames} frames)`);
    }
    encoder.stdin.end();
    const [code] = await encoderResult;
    if (code !== 0) throw new Error(`FFmpeg exited with ${code}`);
    console.log(`Exported ${duration}s, 1920×1080, ${fps}fps MP4 with original audio.`);
    completed = true;
  }
  if (errors.length) throw new Error(errors.join('\n'));
} finally {
  if (encoder && !completed) encoder.kill();
  await browser?.close();
  server.close();
}

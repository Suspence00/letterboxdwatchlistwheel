# Promo Assets

30-second Omni Dark promo (`1920×1080`, 30 fps) for `/promo.html` and social embeds.

## Regenerating

```sh
python scripts/promo-audio.py
ffmpeg -y -i media/promo/wheel-promo.wav -c:a aac -b:a 192k -movflags +faststart media/promo/wheel-promo.m4a
node scripts/render-promo.mjs
```

Use `node scripts/render-promo.mjs --stills` to export review frames to `test-results/promo/` without encoding video.

## Attribution

- Poster sources: [`posters/SOURCES.md`](posters/SOURCES.md)
- Font (`Manrope`): [`fonts/SOURCES.md`](fonts/SOURCES.md) · [`fonts/OFL.txt`](fonts/OFL.txt)

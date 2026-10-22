/** Local poster and font assets shared by the browser player and film exporter. */
const POSTER_FILES = [
  '00-arrival.webp', '01-paprika.webp', '02-parasite.webp', '03-the-witch.webp',
  '04-interstellar.webp', '05-midsommar.webp', '06-spirited-away.webp',
  '07-chocolate.webp', '08-blade-runner-2049.webp', '09-sinners.webp',
];
/** @type {Array<HTMLImageElement | null>} */
const posters = POSTER_FILES.map(() => null);
let loading;

/** Preload every local image and the Omni heading font before drawing a frame. */
export function loadAssets() {
  if (loading) return loading;
  loading = Promise.all([
    ...POSTER_FILES.map((file, index) => new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => {
        posters[index] = image;
        resolve(image);
      };
      image.onerror = () => reject(new Error(`Unable to load promo poster: ${file}`));
      image.src = new URL(`../../media/promo/posters/${file}`, import.meta.url).href;
    })),
    loadFont(),
  ]).then(() => ({ posters: posters.length, font: 'Manrope' }));
  return loading;
}

async function loadFont() {
  const url = new URL('../../media/promo/fonts/Manrope-Variable.ttf', import.meta.url);
  const font = new FontFace('Manrope', `url("${url.href}")`, { weight: '200 800' });
  await font.load();
  document.fonts.add(font);
}

/** @returns {HTMLImageElement | null} */
export function getPoster(index) {
  return posters[index] || null;
}

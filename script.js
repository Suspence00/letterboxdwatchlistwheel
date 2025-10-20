const csvInput = document.getElementById('csv-input');
const statusMessage = document.getElementById('status-message');
const movieListEl = document.getElementById('movie-list');
const spinButton = document.getElementById('spin-button');
const selectAllBtn = document.getElementById('select-all');
const clearSelectionBtn = document.getElementById('clear-selection');
const letterboxdUrlInput = document.getElementById('letterboxd-url');
const importListButton = document.getElementById('import-list-button');
const resultEl = document.getElementById('result');
const canvas = document.getElementById('wheel');
const ctx = canvas.getContext('2d');
const confettiContainer = document.getElementById('confetti-container');
const winModal = document.getElementById('win-modal');
const winModalTitle = document.getElementById('win-modal-title');
const winModalDetails = document.getElementById('win-modal-details');
const winModalLink = document.getElementById('win-modal-link');
const winModalCloseBtn = document.getElementById('win-modal-close');

let allMovies = [];
let selectedIds = new Set();
let isSpinning = false;
let rotationAngle = 0;
let animationFrameId = null;
let spinStartTimestamp = null;
let spinDuration = 0;
let targetRotation = 0;
let lastTickIndex = null;
let winnerId = null;
let audioContext = null;
let confettiTimeoutId = null;
let modalHideTimeoutId = null;
let lastFocusedBeforeModal = null;
let isFetchingLetterboxdList = false;
const importListButtonDefaultLabel = importListButton ? importListButton.textContent : '';

// Angle (in radians) representing the pointer direction (straight down from the top).
const POINTER_DIRECTION = (3 * Math.PI) / 2;

const palette = [
  '#ff8600',
  '#3ab0ff',
  '#f25f5c',
  '#70e000',
  '#9d4edd',
  '#f9844a',
  '#00bbf9',
  '#ffd23f',
  '#06d6a0',
  '#ff70a6'
];

csvInput.addEventListener('change', handleFileUpload);
selectAllBtn.addEventListener('click', () => {
  allMovies.forEach((movie) => selectedIds.add(movie.id));
  updateMovieList();
});
clearSelectionBtn.addEventListener('click', () => {
  selectedIds.clear();
  updateMovieList();
});
spinButton.addEventListener('click', spinWheel);

if (importListButton && letterboxdUrlInput) {
  importListButton.addEventListener('click', () => handleLetterboxdImport());
  letterboxdUrlInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      handleLetterboxdImport();
    }
  });
}

if (winModalCloseBtn) {
  winModalCloseBtn.addEventListener('click', () => closeWinnerPopup());
}

if (winModal) {
  winModal.addEventListener('click', (event) => {
    if (event.target === winModal) {
      closeWinnerPopup();
    }
  });
}

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') {
    closeWinnerPopup();
  }
});

drawEmptyWheel();

function handleFileUpload(event) {
  const file = event.target.files && event.target.files[0];
  if (!file) {
    return;
  }

  closeWinnerPopup({ restoreFocus: false });

  if (!file.name.toLowerCase().endsWith('.csv')) {
    statusMessage.textContent = 'Please choose a CSV file exported from Letterboxd.';
    return;
  }

  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const text = e.target.result;
      const rows = parseCSV(text).filter((row) => row.length > 0 && row.some((cell) => cell.trim() !== ''));
      if (rows.length <= 1) {
        statusMessage.textContent = 'The CSV appears to be empty.';
        return;
      }

      const header = rows[0].map((h) => h.trim().toLowerCase());
      const dateIndex = header.indexOf('date');
      const nameIndex = header.indexOf('name');
      const yearIndex = header.indexOf('year');
      const uriIndex = header.findIndex((h) => h.includes('letterboxd'));

      if (nameIndex === -1) {
        statusMessage.textContent = 'Could not find a “Name” column in this CSV.';
        return;
      }

      const movies = rows.slice(1).map((row, index) => {
        return {
          id: `${index}-${row[nameIndex]}`,
          name: row[nameIndex] ? row[nameIndex].trim() : 'Unknown title',
          year: yearIndex >= 0 && row[yearIndex] ? row[yearIndex].trim() : '',
          date: dateIndex >= 0 && row[dateIndex] ? row[dateIndex].trim() : '',
          uri: uriIndex >= 0 && row[uriIndex] ? row[uriIndex].trim() : ''
        };
      }).filter((movie) => movie.name);

      if (!movies.length) {
        statusMessage.textContent = 'No movies found in the CSV file.';
        return;
      }

      applyImportedMovies(movies, `${movies.length} movies imported. Ready to spin!`);
    } catch (error) {
      console.error(error);
      statusMessage.textContent = 'Something went wrong while reading the CSV.';
    }
  };
  reader.onerror = () => {
    statusMessage.textContent = 'Failed to read the file. Please try again.';
  };
  reader.readAsText(file);
}

async function handleLetterboxdImport() {
  if (!letterboxdUrlInput) {
    return;
  }

  const rawUrl = letterboxdUrlInput.value.trim();
  if (!rawUrl) {
    statusMessage.textContent = 'Paste a Letterboxd list URL to import.';
    letterboxdUrlInput.focus();
    return;
  }

  if (isFetchingLetterboxdList) {
    return;
  }

  try {
    const listInfo = normalizeLetterboxdListUrl(rawUrl);
    isFetchingLetterboxdList = true;
    setImportingState(true);
    statusMessage.textContent = 'Fetching list from Letterboxd…';
    const movies = await fetchLetterboxdList(listInfo);

    if (!movies.length) {
      statusMessage.textContent = 'No movies found on that Letterboxd list.';
      return;
    }

    applyImportedMovies(movies, `${movies.length} movies imported from Letterboxd. Ready to spin!`);
    letterboxdUrlInput.value = '';
  } catch (error) {
    console.error(error);
    if (error && error.name === 'TypeError') {
      statusMessage.textContent = 'Could not reach Letterboxd. Try again later or use the CSV export.';
    } else if (error && error.code === 'LETTERBOXD_CORS') {
      statusMessage.textContent =
        'Letterboxd blocked the request. Configure a CORS-friendly proxy (see README) or use the CSV export.';
    } else if (error && error.message) {
      statusMessage.textContent = error.message;
    } else {
      statusMessage.textContent = 'Could not import that Letterboxd list. Try again or use the CSV export.';
    }
  } finally {
    isFetchingLetterboxdList = false;
    setImportingState(false);
  }
}

function setImportingState(isLoading) {
  if (!importListButton || !letterboxdUrlInput) {
    return;
  }

  importListButton.disabled = isLoading;
  letterboxdUrlInput.disabled = isLoading;
  importListButton.textContent = isLoading ? 'Importing…' : importListButtonDefaultLabel || 'Import list';
}

function normalizeLetterboxdListUrl(rawUrl) {
  let parsedUrl;
  try {
    parsedUrl = new URL(rawUrl);
  } catch (error) {
    try {
      parsedUrl = new URL(`https://${rawUrl}`);
    } catch (error2) {
      throw new Error('Enter a valid Letterboxd list URL.');
    }
  }

  if (!parsedUrl.hostname.toLowerCase().endsWith('letterboxd.com')) {
    throw new Error('Enter a valid Letterboxd list URL from letterboxd.com.');
  }

  parsedUrl.protocol = 'https:';
  parsedUrl.search = '';
  parsedUrl.hash = '';

  const segments = parsedUrl.pathname.split('/').filter(Boolean);
  const listIndex = segments.indexOf('list');
  if (listIndex === -1 || !segments[listIndex + 1]) {
    throw new Error('That does not look like a Letterboxd list URL.');
  }

  const normalizedSegments = segments.slice(0, listIndex + 2);
  parsedUrl.pathname = `/${normalizedSegments.join('/')}/`;

  const owner = listIndex > 0 ? segments[listIndex - 1] : '';
  const slug = segments[listIndex + 1] || '';

  return {
    normalizedUrl: parsedUrl.toString(),
    origin: parsedUrl.origin,
    owner,
    slug
  };
}

async function fetchLetterboxdList(listInfo) {
  const { normalizedUrl, origin, owner, slug } = listInfo;
  const movies = [];
  const seenIds = new Set();
  const fetchStrategies = getLetterboxdFetchStrategies();

  let apiAttempted = false;
  if (owner && slug) {
    try {
      apiAttempted = true;
      const apiMovies = await fetchLetterboxdListViaApi({ origin, owner, slug });
      if (Array.isArray(apiMovies)) {
        apiMovies.forEach((movie) => {
          if (!movie || !movie.name) {
            return;
          }
          const key = movie.id || movie.slug || `${movie.name.toLowerCase()}-${movie.year || 'unknown'}`;
          if (seenIds.has(key)) {
            return;
          }
          seenIds.add(key);
          movies.push({
            id: key,
            name: movie.name,
            year: movie.year || '',
            date: '',
            uri: movie.uri || ''
          });
        });

        if (movies.length) {
          return movies;
        }

        if (apiMovies.length === 0) {
          return [];
        }
      }
    } catch (error) {
      if (error && error.code === 'LETTERBOXD_NOT_FOUND') {
        throw new Error('Could not find that Letterboxd list. Check the URL and make sure it is public.');
      }

      if (error && error.code === 'LETTERBOXD_CORS') {
        // Fall back to HTML scraping with proxy support below.
      } else if (error && error.code === 'LETTERBOXD_EMPTY') {
        return [];
      } else if (!apiAttempted || !(error && error.name === 'TypeError')) {
        console.warn('Letterboxd API fetch failed, trying HTML fallback.', error);
      }
    }
  }

  let chosenStrategy = null;
  let encounteredCorsError = false;

  for (let page = 1; page <= 30; page += 1) {
    const pageUrl = page === 1 ? normalizedUrl : `${normalizedUrl}page/${page}/`;
    let html;

    try {
      const result = await fetchLetterboxdHtml(pageUrl, fetchStrategies, chosenStrategy);
      html = result.html;
      if (!chosenStrategy) {
        chosenStrategy = result.strategy;
      }
    } catch (error) {
      if (error && error.code === 'LETTERBOXD_NOT_FOUND') {
        throw new Error('Could not find that Letterboxd list. Check the URL and make sure it is public.');
      }
      if (error && error.code === 'LETTERBOXD_CORS') {
        encounteredCorsError = true;
        break;
      }
      throw error instanceof Error
        ? error
        : new Error('Could not fetch that Letterboxd list. Make sure it is public.');
    }

    const { movies: pageMovies, hasNextPage } = parseLetterboxdPage(html);

    if (!pageMovies.length && page === 1) {
      return [];
    }

    pageMovies.forEach((movie, index) => {
      const key = movie.slug
        ? movie.slug
        : `${movie.name.toLowerCase()}-${movie.year || 'unknown'}-${page}-${index}`;
      if (seenIds.has(key)) {
        return;
      }
      seenIds.add(key);
      const slugPath = movie.slug ? `${movie.slug}/` : '';
      movies.push({
        id: key,
        name: movie.name,
        year: movie.year,
        date: '',
        uri: movie.slug ? `${origin}${slugPath}` : ''
      });
    });

    if (!hasNextPage) {
      break;
    }
  }

  if (!movies.length && encounteredCorsError) {
    const corsError = new Error('Letterboxd blocked the request.');
    corsError.code = 'LETTERBOXD_CORS';
    throw corsError;
  }

  return movies;
}

async function fetchLetterboxdListViaApi({ origin, owner, slug }) {
  const movies = [];
  let encounteredCors = false;

  for (let page = 1; page <= 30; page += 1) {
    const apiUrl = `${origin}/api-data/list/${owner}/${slug}/entries?page=${page}`;
    let response;

    try {
      response = await fetch(apiUrl, {
        credentials: 'omit',
        headers: {
          'x-requested-with': 'XMLHttpRequest'
        }
      });
    } catch (error) {
      if (error && error.name === 'TypeError') {
        encounteredCors = true;
        break;
      }
      throw error;
    }

    if (response.status === 404) {
      const notFound = new Error('Letterboxd list not found.');
      notFound.code = 'LETTERBOXD_NOT_FOUND';
      throw notFound;
    }

    if (response.type === 'opaque') {
      encounteredCors = true;
      break;
    }

    if (!response.ok) {
      throw new Error('Could not fetch that Letterboxd list. Make sure it is public.');
    }

    let data;
    try {
      data = await response.json();
    } catch (error) {
      break;
    }

    const items = extractLetterboxdListItems(data);

    if (!items.length) {
      if (page === 1) {
        if (typeof data?.itemCount === 'number' && data.itemCount === 0) {
          const emptyError = new Error('Letterboxd list is empty.');
          emptyError.code = 'LETTERBOXD_EMPTY';
          throw emptyError;
        }
        return [];
      }
      break;
    }

    items.forEach((item, index) => {
      const formatted = normalizeLetterboxdApiItem(item, origin, page, index);
      if (formatted) {
        movies.push(formatted);
      }
    });

    const nextPage = getLetterboxdNextPage(data, page);
    if (!nextPage) {
      break;
    }

    if (nextPage === page) {
      break;
    }

    page = nextPage - 1;
  }

  if (!movies.length && encounteredCors) {
    const corsError = new Error('Letterboxd blocked the request.');
    corsError.code = 'LETTERBOXD_CORS';
    throw corsError;
  }

  return movies;
}

function extractLetterboxdListItems(data) {
  if (!data) {
    return [];
  }

  if (Array.isArray(data.items)) {
    return data.items;
  }

  if (Array.isArray(data.entries)) {
    return data.entries;
  }

  if (Array.isArray(data?.data?.items)) {
    return data.data.items;
  }

  if (Array.isArray(data?.listEntries)) {
    return data.listEntries;
  }

  return [];
}

function normalizeLetterboxdApiItem(item, origin, page, index) {
  if (!item) {
    return null;
  }

  const film = typeof item.film === 'object' && item.film ? item.film : item;
  const name =
    (typeof film.name === 'string' && film.name) ||
    (typeof film.title === 'string' && film.title) ||
    (typeof item.name === 'string' && item.name) ||
    '';

  if (!name) {
    return null;
  }

  const yearValue =
    film.releaseYear ||
    film.year ||
    item.releaseYear ||
    item.year ||
    (film.__typename === 'Film' && film.firstReleaseYear);
  const year = typeof yearValue === 'number' || typeof yearValue === 'string' ? String(yearValue).trim() : '';

  const slugSource =
    item.filmSlug ||
    film.slug ||
    film.uri ||
    film.path ||
    item.slug ||
    '';
  const slug = normalizeLetterboxdFilmSlug(slugSource);

  const urlSource =
    item.filmUrl ||
    film.webUrl ||
    film.url ||
    (slug ? `${origin}${slug}` : '');
  const uri = typeof urlSource === 'string' ? normalizeLetterboxdFilmUrl(urlSource, origin, slug) : '';

  const id = slug || `${name.toLowerCase()}-${year || 'unknown'}-${page}-${index}`;

  return {
    id,
    name,
    year,
    uri
  };
}

function getLetterboxdNextPage(data, currentPage) {
  const possible = [data?.next, data?.nextPage, data?.pagination?.next, data?.meta?.nextPage];

  for (let i = 0; i < possible.length; i += 1) {
    const value = possible[i];
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }
    if (typeof value === 'string') {
      const match = value.match(/page=(\d+)/i);
      if (match && match[1]) {
        const parsed = Number.parseInt(match[1], 10);
        if (Number.isFinite(parsed)) {
          return parsed;
        }
      }
    }
  }

  if (typeof data?.totalPages === 'number' && data.totalPages > currentPage) {
    return currentPage + 1;
  }

  return null;
}

async function fetchLetterboxdHtml(pageUrl, strategies, preferredStrategy) {
  const attempts = Array.isArray(strategies) ? strategies.slice() : [];
  if (!attempts.length) {
    attempts.push(...getLetterboxdFetchStrategies());
  }

  if (preferredStrategy) {
    const hasPreferred = attempts.includes(preferredStrategy);
    if (hasPreferred) {
      attempts.splice(attempts.indexOf(preferredStrategy), 1);
    }
    attempts.unshift(preferredStrategy);
  }

  let lastError = null;
  let encounteredCors = false;

  for (let i = 0; i < attempts.length; i += 1) {
    const strategy = attempts[i];
    if (!strategy || typeof strategy.buildUrl !== 'function') {
      continue;
    }

    const targetUrl = strategy.buildUrl(pageUrl);

    try {
      const response = await fetch(targetUrl, {
        credentials: 'omit'
      });

      if (response.status === 404) {
        const notFound = new Error('Letterboxd list not found.');
        notFound.code = 'LETTERBOXD_NOT_FOUND';
        throw notFound;
      }

      if (response.type === 'opaque') {
        encounteredCors = true;
        continue;
      }

      if (!response.ok) {
        lastError = new Error(`Letterboxd request failed with status ${response.status}.`);
        continue;
      }

      const html = await response.text();
      if (!html || !html.trim()) {
        lastError = new Error('Letterboxd returned an empty response.');
        continue;
      }

      return { html, strategy };
    } catch (error) {
      if (error && error.code === 'LETTERBOXD_NOT_FOUND') {
        throw error;
      }
      if (error && error.name === 'TypeError') {
        encounteredCors = true;
        lastError = error;
        continue;
      }
      lastError = error;
    }
  }

  if (encounteredCors) {
    const corsError = new Error('Letterboxd blocked the request.');
    corsError.code = 'LETTERBOXD_CORS';
    throw corsError;
  }

  if (lastError) {
    throw lastError;
  }

  const genericError = new Error('Could not fetch that Letterboxd list. Make sure it is public.');
  throw genericError;
}

function getLetterboxdFetchStrategies() {
  const templates = [];

  const directTemplate = '{{URL}}';
  templates.push(directTemplate);

  if (typeof window !== 'undefined') {
    if (typeof window.LETTERBOXD_LIST_PROXY === 'string') {
      templates.push(window.LETTERBOXD_LIST_PROXY.trim());
    }

    if (Array.isArray(window.LETTERBOXD_LIST_PROXIES)) {
      window.LETTERBOXD_LIST_PROXIES.forEach((template) => {
        if (typeof template === 'string') {
          templates.push(template.trim());
        }
      });
    }
  }

  templates.push('https://r.jina.ai/https://{{HOST_AND_PATH}}');
  templates.push('https://r.jina.ai/http://{{HOST_AND_PATH}}');

  const uniqueTemplates = templates.filter((template, index, array) => {
    return template && array.indexOf(template) === index;
  });

  return uniqueTemplates.map((template) => ({
    buildUrl: (url) => buildLetterboxdProxyUrl(template, url),
    template
  }));
}

function buildLetterboxdProxyUrl(template, url) {
  if (!template || template === '{{URL}}') {
    return url;
  }

  const hostAndPath = stripProtocol(url);
  return template.replace(/{{URL}}/g, url).replace(/{{HOST_AND_PATH}}/g, hostAndPath);
}

function stripProtocol(url) {
  if (typeof url !== 'string') {
    return '';
  }
  return url.replace(/^https?:\/\//i, '');
}

function normalizeLetterboxdFilmSlug(slug) {
  if (typeof slug !== 'string') {
    return '';
  }

  let value = slug.trim();
  if (!value) {
    return '';
  }

  if (/^https?:\/\//i.test(value)) {
    try {
      const parsed = new URL(value);
      value = parsed.pathname || '';
    } catch (error) {
      return '';
    }
  }

  value = value.replace(/^letterboxd\.com/i, '');
  value = value.replace(/\/+/g, '/');
  value = value.replace(/^\/+/, '/');

  if (!value.startsWith('/')) {
    value = `/${value}`;
  }

  if (!value.startsWith('/film/')) {
    value = value.replace(/^\/film\//, '/film/');
    if (!value.startsWith('/film/')) {
      value = `/film/${value.replace(/^\/+/, '').replace(/^film\//, '')}`;
    }
  }

  return value.replace(/\/+$/, '');
}

function normalizeLetterboxdFilmUrl(url, origin, slug) {
  if (typeof url !== 'string' || !url) {
    if (slug) {
      return `${origin}${slug}`;
    }
    return '';
  }

  if (/^https?:\/\//i.test(url)) {
    return url;
  }

  if (url.startsWith('//')) {
    return `https:${url}`;
  }

  if (slug) {
    return `${origin}${slug}`;
  }

  if (!url.startsWith('/')) {
    return `${origin}/${url}`;
  }

  return `${origin}${url}`;
}

function parseLetterboxdPage(html) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  const elements = Array.from(doc.querySelectorAll('[data-film-slug]'));
  const seenOnPage = new Set();
  const movies = [];

  elements.forEach((element, index) => {
    const source = element.matches('[data-film-name]') ? element : element.querySelector('[data-film-name]');
    const nameSource = source || element.querySelector('.film-title, .film-title-wrapper a');

    let name = '';
    if (source) {
      name = source.getAttribute('data-film-name') || source.dataset?.filmName || '';
    }
    if (!name && nameSource) {
      name = nameSource.textContent ? nameSource.textContent.trim() : '';
    }

    if (!name) {
      return;
    }

    let year = '';
    if (source) {
      year = source.getAttribute('data-film-year') || source.dataset?.filmYear || '';
    }
    if (!year) {
      const yearEl = element.querySelector('[data-film-year], .film-year');
      if (yearEl) {
        year = yearEl.getAttribute('data-film-year') || yearEl.textContent.trim();
      }
    }

    let slug = element.getAttribute('data-film-slug') || element.dataset?.filmSlug || '';
    if (!slug) {
      const slugEl = element.querySelector('[data-film-slug]');
      if (slugEl) {
        slug = slugEl.getAttribute('data-film-slug') || slugEl.dataset?.filmSlug || '';
      }
    }

    if (slug) {
      slug = slug.trim();
      slug = slug.replace(/^https?:\/\/[^/]+/i, '');
      const cleanedSlug = slug.replace(/^\/+/, '').replace(/\/+$/, '');
      slug = cleanedSlug ? `/${cleanedSlug}` : '';
    }

    const dedupeKey = slug || `${name.toLowerCase()}-${year || 'unknown'}-${index}`;
    if (seenOnPage.has(dedupeKey)) {
      return;
    }
    seenOnPage.add(dedupeKey);

    movies.push({
      name,
      year: year || '',
      slug
    });
  });

  const nextLinkEl = doc.querySelector('link[rel="next"]');
  const nextButtonEl = doc.querySelector('.paginate-nextprev .next, .paginate .next a, .pagination .next a, a.next, button[rel="next"]');
  const dataNextEl = doc.querySelector('[data-next-page]');
  const hasNextPage = Boolean(
    nextLinkEl ||
      nextButtonEl ||
      (dataNextEl && dataNextEl.getAttribute('data-next-page') && dataNextEl.getAttribute('data-next-page') !== 'false')
  );

  return { movies, hasNextPage };
}

function applyImportedMovies(movies, statusText) {
  closeWinnerPopup({ restoreFocus: false });
  allMovies = movies.slice();
  selectedIds = new Set(allMovies.map((movie) => movie.id));
  winnerId = null;
  resultEl.textContent = '';
  updateMovieList();
  if (typeof statusText === 'string') {
    statusMessage.textContent = statusText;
  }
  if (movieListEl) {
    movieListEl.scrollTop = 0;
  }
}

function parseCSV(text) {
  const rows = [];
  let current = '';
  let insideQuotes = false;
  const addCell = () => {
    current = current.replace(/\r/g, '');
    cells.push(current);
    current = '';
  };
  let cells = [];

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];

    if (char === '"') {
      if (insideQuotes && text[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        insideQuotes = !insideQuotes;
      }
    } else if (char === ',' && !insideQuotes) {
      addCell();
    } else if ((char === '\n' || char === '\r') && !insideQuotes) {
      addCell();
      if (cells.length) {
        rows.push(cells);
      }
      cells = [];
    } else {
      current += char;
    }
  }

  if (current.length > 0 || insideQuotes || cells.length) {
    addCell();
    if (cells.length) {
      rows.push(cells);
    }
  }

  return rows;
}

function updateMovieList() {
  movieListEl.innerHTML = '';
  if (winnerId && !selectedIds.has(winnerId)) {
    winnerId = null;
    resultEl.textContent = '';
    closeWinnerPopup({ restoreFocus: false });
  }

  if (!allMovies.length) {
    movieListEl.innerHTML = '<li class="empty">Upload a CSV or import a Letterboxd list to see your movies here.</li>';
    spinButton.disabled = true;
    drawEmptyWheel();
    closeWinnerPopup({ restoreFocus: false });
    return;
  }

  allMovies.forEach((movie) => {
    const li = document.createElement('li');
    li.dataset.id = movie.id;
    if (winnerId === movie.id) {
      li.classList.add('highlight');
    }

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = selectedIds.has(movie.id);
    checkbox.id = `movie-${movie.id}`;
    checkbox.addEventListener('change', (event) => {
      if (event.target.checked) {
        selectedIds.add(movie.id);
      } else {
        selectedIds.delete(movie.id);
      }
      updateMovieList();
    });

    const label = document.createElement('label');
    label.setAttribute('for', checkbox.id);

    const nameEl = document.createElement('span');
    nameEl.className = 'movie-name';
    nameEl.textContent = movie.name;

    const metaEl = document.createElement('span');
    metaEl.className = 'movie-meta';
    const parts = [];
    if (movie.year) parts.push(movie.year);
    if (movie.date) parts.push(`Added ${movie.date}`);
    metaEl.textContent = parts.join(' • ');

    label.appendChild(nameEl);
    if (parts.length) {
      label.appendChild(metaEl);
    }

    if (movie.uri) {
      const link = document.createElement('a');
      link.href = movie.uri;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.className = 'movie-link';
      link.textContent = 'Open on Letterboxd';
      label.appendChild(link);
    }

    li.appendChild(checkbox);
    li.appendChild(label);
    movieListEl.appendChild(li);
  });

  const selectedMovies = allMovies.filter((movie) => selectedIds.has(movie.id));
  spinButton.disabled = selectedMovies.length === 0 || isSpinning;
  if (!selectedMovies.length) {
    closeWinnerPopup({ restoreFocus: false });
  }
  drawWheel(selectedMovies);
}

function drawEmptyWheel() {
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
  ctx.fillText('Add movies to spin', 0, 0);
  ctx.restore();
}

function drawWheel(selectedMovies) {
  const radius = canvas.width / 2.1;
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  if (!selectedMovies.length) {
    drawEmptyWheel();
    return;
  }

  const arc = (2 * Math.PI) / selectedMovies.length;
  const shouldHighlight = !isSpinning && winnerId;
  const pointerAngle = shouldHighlight ? getPointerAngle() : 0;
  const highlightIndex = shouldHighlight
    ? Math.floor((((pointerAngle + 2 * Math.PI) % (2 * Math.PI)) + 1e-6) / arc) % selectedMovies.length
    : null;
  ctx.save();
  ctx.translate(canvas.width / 2, canvas.height / 2);
  ctx.rotate(rotationAngle);

  selectedMovies.forEach((movie, index) => {
    const angle = index * arc;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.fillStyle = palette[index % palette.length];
    ctx.arc(0, 0, radius, angle, angle + arc);
    ctx.closePath();
    ctx.fill();

    if (highlightIndex === index) {
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, radius, angle, angle + arc);
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
    ctx.rotate(angle + arc / 2);
    ctx.textAlign = 'right';
    ctx.font = '600 16px Inter, sans-serif';
    wrapText(ctx, movie.name, radius - 20, arc * radius * 0.6);
    ctx.restore();
  });

  ctx.beginPath();
  ctx.fillStyle = '#07121f';
  ctx.arc(0, 0, radius * 0.2, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

function wrapText(context, text, maxWidth, maxArcLength) {
  const words = text.split(' ');
  let line = '';
  const lines = [];

  words.forEach((word) => {
    const testLine = line ? `${line} ${word}` : word;
    const metrics = context.measureText(testLine);
    if (metrics.width > maxWidth || lines.length * 20 > maxArcLength) {
      if (line) {
        lines.push(line);
      }
      line = word;
    } else {
      line = testLine;
    }
  });

  if (line) {
    lines.push(line);
  }

  const lineHeight = 18;
  context.textBaseline = 'middle';

  const totalHeight = (lines.length - 1) * lineHeight;
  for (let i = 0; i < lines.length; i += 1) {
    context.fillText(lines[i], maxWidth, -totalHeight / 2 + i * lineHeight);
  }
}

function spinWheel() {
  if (isSpinning) return;

  const selectedMovies = allMovies.filter((movie) => selectedIds.has(movie.id));
  if (!selectedMovies.length) {
    statusMessage.textContent = 'Select at least one movie to spin the wheel.';
    return;
  }

  closeWinnerPopup({ restoreFocus: false });
  isSpinning = true;
  spinButton.disabled = true;
  resultEl.textContent = '';
  winnerId = null;
  lastTickIndex = null;
  ensureAudioContext();

  const arc = (2 * Math.PI) / selectedMovies.length;
  const randomIndex = Math.floor(Math.random() * selectedMovies.length);
  const randomOffset = Math.random() * arc;
  const spins = 6 + Math.random() * 3;
  const finalAngle = randomIndex * arc + randomOffset;
  const currentPointerAngle = getPointerAngle();
  const neededRotation = (spins * 2 * Math.PI) + finalAngle - currentPointerAngle;
  targetRotation = rotationAngle + neededRotation;
  spinDuration = 4500 + Math.random() * 2000;
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
    tick(selectedMovies, arc);

    if (progress < 1) {
      animationFrameId = requestAnimationFrame(animate);
    } else {
      finishSpin(selectedMovies, arc);
    }
  };

  animationFrameId = requestAnimationFrame(animate);
}

function tick(selectedMovies, arc) {
  const pointerAngle = getPointerAngle();
  const index = Math.floor(pointerAngle / arc) % selectedMovies.length;
  if (index !== lastTickIndex) {
    playTickSound();
    lastTickIndex = index;
  }
}

function finishSpin(selectedMovies, arc) {
  cancelAnimationFrame(animationFrameId);
  isSpinning = false;
  spinButton.disabled = selectedMovies.length === 0;

  const pointerAngle = getPointerAngle();
  const normalizedPointer = ((pointerAngle % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
  const winningIndex = Math.floor((normalizedPointer + 1e-6) / arc) % selectedMovies.length;
  const winningMovie = selectedMovies[winningIndex];
  winnerId = winningMovie.id;
  highlightWinner();
  resultEl.innerHTML = `🎉 Next up: <strong>${winningMovie.name}</strong>${winningMovie.year ? ` (${winningMovie.year})` : ''}`;
  playWinSound();
  drawWheel(selectedMovies);
  triggerConfetti();
  showWinnerPopup(winningMovie);
}

function highlightWinner() {
  movieListEl.querySelectorAll('li').forEach((item) => {
    if (item.dataset.id === winnerId) {
      item.classList.add('highlight');
      item.scrollIntoView({ behavior: 'smooth', block: 'center' });
    } else {
      item.classList.remove('highlight');
    }
  });
}

function getPointerAngle() {
  const normalized = ((rotationAngle % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
  return (POINTER_DIRECTION - normalized + 2 * Math.PI) % (2 * Math.PI);
}

function easeOutCubic(x) {
  return 1 - Math.pow(1 - x, 3);
}

function lerp(start, end, amount) {
  return start + (end - start) * amount;
}

function ensureAudioContext() {
  if (!audioContext) {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (audioContext.state === 'suspended') {
    audioContext.resume();
  }
}

function playTickSound() {
  ensureAudioContext();
  const oscillator = audioContext.createOscillator();
  const gain = audioContext.createGain();
  oscillator.type = 'triangle';
  oscillator.frequency.value = 600;
  const now = audioContext.currentTime;
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(0.08, now + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.12);
  oscillator.connect(gain).connect(audioContext.destination);
  oscillator.start(now);
  oscillator.stop(now + 0.12);
}

function playWinSound() {
  ensureAudioContext();
  const now = audioContext.currentTime;

  const notes = [523.25, 659.25, 783.99];
  notes.forEach((frequency, index) => {
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();
    oscillator.type = 'sine';
    oscillator.frequency.value = frequency;
    const startTime = now + index * 0.12;
    gain.gain.setValueAtTime(0.0001, startTime);
    gain.gain.exponentialRampToValueAtTime(0.12, startTime + 0.05);
    gain.gain.exponentialRampToValueAtTime(0.0001, startTime + 0.4);
    oscillator.connect(gain).connect(audioContext.destination);
    oscillator.start(startTime);
    oscillator.stop(startTime + 0.45);
  });
}

function triggerConfetti() {
  if (!confettiContainer) return;

  if (confettiTimeoutId) {
    clearTimeout(confettiTimeoutId);
    confettiTimeoutId = null;
  }

  confettiContainer.classList.remove('show');
  confettiContainer.innerHTML = '';

  const colors = ['#ff8600', '#ffd23f', '#06d6a0', '#00bbf9', '#f94144', '#9d4edd'];
  const pieceCount = 140;

  for (let i = 0; i < pieceCount; i += 1) {
    const piece = document.createElement('span');
    piece.className = 'confetti-piece';
    const size = 8 + Math.random() * 8;
    piece.style.width = `${size}px`;
    piece.style.height = `${size * 1.4}px`;
    piece.style.backgroundColor = colors[i % colors.length];
    piece.style.left = `${Math.random() * 100}%`;
    piece.style.animationDelay = `${Math.random() * 0.3}s`;
    const duration = 2.2 + Math.random() * 1.5;
    piece.style.animationDuration = `${duration}s`;
    const horizontalDrift = (Math.random() - 0.5) * 40;
    piece.style.setProperty('--confetti-x-move', `${horizontalDrift}vw`);
    confettiContainer.appendChild(piece);
  }

  void confettiContainer.offsetWidth;
  confettiContainer.classList.add('show');

  confettiTimeoutId = window.setTimeout(() => {
    confettiContainer.classList.remove('show');
    confettiContainer.innerHTML = '';
    confettiTimeoutId = null;
  }, 4200);
}

function showWinnerPopup(movie) {
  if (!winModal) return;

  if (modalHideTimeoutId) {
    clearTimeout(modalHideTimeoutId);
    modalHideTimeoutId = null;
  }

  const details = [];
  if (movie.year) {
    details.push(`Released ${movie.year}`);
  }
  if (movie.date) {
    details.push(`Added to your watchlist ${movie.date}`);
  }

  if (winModalTitle) {
    winModalTitle.textContent = `The movie selected was ${movie.name}!`;
  }
  if (winModalDetails) {
    winModalDetails.textContent = details.length
      ? details.join(' • ')
      : 'Get comfy, cue it up, and enjoy the show!';
  }

  if (winModalLink) {
    if (movie.uri) {
      winModalLink.href = movie.uri;
      winModalLink.classList.remove('hidden');
      winModalLink.textContent = 'View on Letterboxd';
    } else {
      winModalLink.classList.add('hidden');
      winModalLink.removeAttribute('href');
    }
  }

  winModal.setAttribute('aria-hidden', 'false');
  winModal.removeAttribute('hidden');
  requestAnimationFrame(() => {
    winModal.classList.add('show');
  });

  lastFocusedBeforeModal = document.activeElement;
  if (winModalCloseBtn) {
    winModalCloseBtn.focus();
  }
}

function closeWinnerPopup({ restoreFocus = true } = {}) {
  if (!winModal || winModal.hasAttribute('hidden')) {
    return;
  }

  if (modalHideTimeoutId) {
    clearTimeout(modalHideTimeoutId);
    modalHideTimeoutId = null;
  }

  winModal.classList.remove('show');
  winModal.setAttribute('aria-hidden', 'true');

  modalHideTimeoutId = window.setTimeout(() => {
    winModal.setAttribute('hidden', '');
    if (restoreFocus && lastFocusedBeforeModal && typeof lastFocusedBeforeModal.focus === 'function') {
      lastFocusedBeforeModal.focus();
    }
    lastFocusedBeforeModal = null;
    modalHideTimeoutId = null;
  }, 220);
}

window.addEventListener('beforeunload', () => {
  if (audioContext) {
    audioContext.close();
  }
});

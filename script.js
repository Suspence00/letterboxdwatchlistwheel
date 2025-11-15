const csvInput = document.getElementById('csv-input');
const statusMessage = document.getElementById('status-message');
const movieListEl = document.getElementById('movie-list');
const spinButton = document.getElementById('spin-button');
const selectAllBtn = document.getElementById('select-all');
const clearSelectionBtn = document.getElementById('clear-selection');
const resultEl = document.getElementById('result');
const customEntryForm = document.getElementById('custom-entry-form');
const customEntryInput = document.getElementById('custom-entry-name');
const vetoButton = document.getElementById('veto-button');
const canvas = document.getElementById('wheel');
const ctx = canvas.getContext('2d');
const confettiContainer = document.getElementById('confetti-container');
const winModal = document.getElementById('win-modal');
const winModalTitle = document.getElementById('win-modal-title');
const winModalDetails = document.getElementById('win-modal-details');
const winModalLink = document.getElementById('win-modal-link');
const winModalPosterWrapper = document.getElementById('win-modal-poster-wrapper');
const winModalPoster = document.getElementById('win-modal-poster');
const winModalRuntime = document.getElementById('win-modal-runtime');
const winModalSynopsis = document.getElementById('win-modal-synopsis');
const winModalTrailer = document.getElementById('win-modal-trailer');
const winModalCloseBtn = document.getElementById('win-modal-close');
const letterboxdProxyForm = document.getElementById('letterboxd-proxy-form');
const importCard = document.getElementById('import-card');
const importCardBody = document.getElementById('import-body');
const importToggleBtn = document.getElementById('import-toggle');
const advancedOptionsToggle = document.getElementById('advanced-options-toggle');
const advancedOptionsHint = document.getElementById('advanced-options-hint');
const advancedOptionsPanel = document.getElementById('advanced-options-panel');
const searchInput = document.getElementById('movie-search');
const showCustomsToggle = document.getElementById('filter-show-customs');
const oneSpinToggle = document.getElementById('one-spin-toggle');
const wheelFmAudio = document.getElementById('wheel-fm-audio');
const wheelFmPlayBtn = document.getElementById('wheel-fm-play');
const wheelFmPrevBtn = document.getElementById('wheel-fm-prev');
const wheelFmNextBtn = document.getElementById('wheel-fm-next');
const wheelFmSeek = document.getElementById('wheel-fm-seek');
const wheelFmTrackTitle = document.getElementById('wheel-fm-track-title');
const wheelFmTrackArtist = document.getElementById('wheel-fm-track-artist');
const wheelFmCurrentTime = document.getElementById('wheel-fm-current-time');
const wheelFmDuration = document.getElementById('wheel-fm-duration');
const wheelFmStatus = document.getElementById('wheel-fm-status');

const METADATA_API_URL = 'https://www.omdbapi.com/';
const METADATA_API_KEY = 'trilogy';
const WHEEL_FM_PLAYLIST_PATH = 'wheel-fm/playlist.json';

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
let customEntryCounter = 0;
let currentModalMetadataKey = null;
let isLastStandingInProgress = false;
const wheelFmState = {
  playlist: [],
  currentIndex: 0,
  isSeeking: false
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

const metadataCache = new Map();
const knockoutResults = new Map();

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

const filterState = {
  query: '',
  normalizedQuery: '',
  showCustoms: showCustomsToggle ? Boolean(showCustomsToggle.checked) : true
};

// Angle (in radians) representing the pointer direction (straight down from the top).
const POINTER_DIRECTION = (3 * Math.PI) / 2;
const TAU = 2 * Math.PI;

const basePalette = [
  '#ff8600',
  '#3ab0ff',
  '#f25f5c',
  '#70e000',
  '#9d4edd',
  '#f9844a',
  '#00bbf9',
  '#ffd23f',
  '#06d6a0',
  '#ff70a6',
  '#f896d8',
  '#1fab89',
  '#ffbe0b',
  '#577590',
  '#ff5d8f'
];

const DEFAULT_SLICE_COLOR = basePalette[0];

function hslToHex(h, s, l) {
  const hue = ((Number(h) % 360) + 360) % 360;
  const saturation = Math.max(0, Math.min(100, Number.isFinite(s) ? s : 0)) / 100;
  const lightness = Math.max(0, Math.min(100, Number.isFinite(l) ? l : 0)) / 100;
  const a = saturation * Math.min(lightness, 1 - lightness);
  const convert = (n) => {
    const k = (n + hue / 30) % 12;
    const color = lightness - a * Math.max(-1, Math.min(k - 3, Math.min(9 - k, 1)));
    return Math.round(255 * color)
      .toString(16)
      .padStart(2, '0');
  };
  return `#${convert(0)}${convert(8)}${convert(4)}`;
}

function generateDynamicColor(index) {
  const goldenAngle = 137.508;
  const hue = (index * goldenAngle) % 360;
  const saturation = 65 + ((index * 7) % 18);
  const lightness = 48 + ((index * 11) % 12);
  return hslToHex(hue, saturation, lightness);
}

function debounce(fn, delay = 200) {
  let timeoutId;
  return (...args) => {
    if (timeoutId) {
      window.clearTimeout(timeoutId);
    }
    timeoutId = window.setTimeout(() => {
      timeoutId = null;
      fn(...args);
    }, delay);
  };
}

function getDefaultColorForIndex(index) {
  if (!Number.isFinite(index)) {
    return DEFAULT_SLICE_COLOR;
  }
  const normalizedIndex = Math.max(0, Math.floor(index));
  if (normalizedIndex < basePalette.length) {
    return basePalette[normalizedIndex];
  }
  return generateDynamicColor(normalizedIndex);
}

if (letterboxdProxyForm) {
  letterboxdProxyForm.addEventListener('submit', handleLetterboxdProxyImport);
}

const setImportCardCollapsed = (collapsed) => {
  if (!importToggleBtn || !importCard || !importCardBody) {
    return;
  }

  importCard.classList.toggle('card--collapsed', collapsed);
  importCardBody.hidden = collapsed;
  importToggleBtn.setAttribute('aria-expanded', String(!collapsed));
  importToggleBtn.textContent = collapsed ? 'Show steps' : 'Hide steps';
};

if (importToggleBtn && importCard && importCardBody) {
  importToggleBtn.addEventListener('click', () => {
    const willCollapse = !importCard.classList.contains('card--collapsed');
    setImportCardCollapsed(willCollapse);
  });
}

if (advancedOptionsToggle) {
  const syncAdvancedOptions = () => {
    const enabled = Boolean(advancedOptionsToggle.checked);
    if (advancedOptionsHint) {
      advancedOptionsHint.hidden = !enabled;
    }
    if (advancedOptionsPanel) {
      advancedOptionsPanel.hidden = !enabled;
    }
    if (!enabled) {
      if (oneSpinToggle && oneSpinToggle.checked) {
        oneSpinToggle.checked = false;
        clearKnockoutStyles();
      }

      if (showCustomsToggle && !showCustomsToggle.checked) {
        showCustomsToggle.checked = true;
      }

      if (!filterState.showCustoms) {
        filterState.showCustoms = true;
      }

      if (filterState.query) {
        filterState.query = '';
        filterState.normalizedQuery = '';
      }

      if (searchInput && searchInput.value) {
        searchInput.value = '';
      }
    }
    updateMovieList();
    updateSpinButtonLabel();
    updateVetoButtonState();
  };

  syncAdvancedOptions();

  advancedOptionsToggle.addEventListener('change', () => {
    syncAdvancedOptions();
  });
} else {
  if (advancedOptionsHint) {
    advancedOptionsHint.hidden = true;
  }
  if (advancedOptionsPanel) {
    advancedOptionsPanel.hidden = false;
  }
}

if (searchInput) {
  const initialValue = searchInput.value || '';
  const applyQuery = (value) => {
    const trimmed = typeof value === 'string' ? value.trim() : '';
    filterState.query = trimmed;
    filterState.normalizedQuery = trimmed.toLowerCase();
    updateMovieList();
  };
  if (initialValue.trim()) {
    applyQuery(initialValue);
  }
  const debouncedSearch = debounce(applyQuery, 200);
  searchInput.addEventListener('input', (event) => {
    debouncedSearch(event.target.value || '');
  });
}

if (showCustomsToggle) {
  showCustomsToggle.addEventListener('change', (event) => {
    filterState.showCustoms = Boolean(event.target.checked);
    updateMovieList();
  });
}

if (oneSpinToggle) {
  oneSpinToggle.addEventListener('change', () => {
    clearKnockoutStyles();
    updateSpinButtonLabel();
    updateVetoButtonState();
  });
}

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

if (customEntryForm) {
  customEntryForm.addEventListener('submit', (event) => {
    event.preventDefault();
    addCustomEntry();
  });
}

if (vetoButton) {
  vetoButton.addEventListener('click', handleVeto);
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
updateVetoButtonState();
updateSpinButtonLabel();

async function handleLetterboxdProxyImport(event) {
  event.preventDefault();

  const input = document.getElementById('letterboxd-proxy-input');
  const status = document.getElementById('letterboxd-proxy-status');
  if (!input || !status) return;

  const rawValue = input.value.trim();
  if (!rawValue) {
    status.textContent = 'Please enter a Letterboxd list URL.';
    status.classList.add('status--error');
    return;
  }

  // Normalize the entered URL
  let listUrl = rawValue;
  if (!/^https?:\/\//i.test(listUrl)) {
    listUrl = `https://letterboxd.com/${listUrl.replace(/^\/+/, '')}/`;
  }

  const proxyUrl = `https://letterboxd-proxy.cwbcode.workers.dev/?url=${encodeURIComponent(listUrl)}`;

  status.textContent = 'Fetching list from Letterboxd…';
  status.classList.remove('status--error', 'status--success');

  try {
    const res = await fetch(proxyUrl);
    if (!res.ok) throw new Error(`Worker returned ${res.status}`);
    const csvText = await res.text();

    // Parse CSV text using your custom parser
    const rows = parseCSV(csvText, ',').filter(
      (row) => row.length && row.some((cell) => cell.trim() !== '')
    );

    if (rows.length <= 1) {
      status.textContent = 'The imported CSV appears to be empty.';
      status.classList.add('status--error');
      return;
    }

    // Identify header indices
    const header = rows[0].map((h) => h.trim().toLowerCase());
    const findColumn = (names) => {
      for (const n of names) {
        const idx = header.indexOf(n);
        if (idx !== -1) return idx;
      }
      return -1;
    };

    const titleIndex = findColumn(['title', 'name']);
    const uriIndex = findColumn(['letterboxduri', 'url', 'uri']);

    if (titleIndex === -1) {
      status.textContent = 'Could not find a title column in the CSV.';
      status.classList.add('status--error');
      return;
    }

    // Map rows into your app’s expected movie structure
    allMovies = rows.slice(1).map((row, i) => {
      const title = row[titleIndex]?.trim() || '';
      if (!title) return null;
      const uri = uriIndex >= 0 ? row[uriIndex]?.trim() : '';
      return {
        id: `${i}-${title}`,
        name: title,
        uri,
        year: '',
        date: '',
        weight: 1,
        color: getDefaultColorForIndex(i),
        initialIndex: i,
      };
    }).filter(Boolean);

    selectedIds = new Set(allMovies.map((m) => m.id));
    updateMovieList();
    updateVetoButtonState();
    setImportCardCollapsed(true);

    status.textContent = `Imported ${allMovies.length} movies successfully!`;
    status.classList.add('status--success');
  } catch (err) {
    console.error(err);
    status.textContent = 'Failed to import list.';
    status.classList.add('status--error');
  }
}


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
      const delimiter = detectDelimiter(text);
      const rows = parseCSV(text, delimiter).filter(
        (row) => row.length > 0 && row.some((cell) => cell.trim() !== '')
      );
      if (rows.length <= 1) {
        statusMessage.textContent = 'The CSV appears to be empty.';
        return;
      }

      const header = rows[0].map((h) => h.trim().toLowerCase());
      const findColumn = (candidates) => {
        for (const candidate of candidates) {
          const index = header.indexOf(candidate);
          if (index !== -1) {
            return index;
          }
        }
        return -1;
      };

      const dateIndex = findColumn(['date', 'watched date', 'watcheddate', 'added', 'added date']);
      const nameIndex = findColumn(['name', 'title', 'film title', 'movie', 'film']);
      const yearIndex = findColumn(['year', 'release year', 'film year']);
      const uriIndex = header.findIndex((h) => h.includes('letterboxd') || h === 'url' || h === 'uri');

      if (nameIndex === -1) {
        statusMessage.textContent = 'Could not find a title column in this CSV.';
        return;
      }

      const isLikelyLizardExport = header.some((h) => h.includes('letterboxduri'));

      customEntryCounter = 0;

      allMovies = rows
        .slice(1)
        .map((row, index) => {
          const rawName = nameIndex >= 0 && row[nameIndex] ? row[nameIndex].trim() : '';
          if (!rawName) {
            return null;
          }

          const uri = uriIndex >= 0 && row[uriIndex] ? row[uriIndex].trim() : '';
          const idBase = uri || rawName || index;

          return {
            id: `${index}-${idBase}`,
            initialIndex: index,
            name: rawName,
            year: yearIndex >= 0 && row[yearIndex] ? row[yearIndex].trim() : '',
            date: dateIndex >= 0 && row[dateIndex] ? row[dateIndex].trim() : '',
            uri,
            fromLizard: isLikelyLizardExport,
            weight: 1,
            color: getDefaultColorForIndex(index)
          };
        })
        .filter(Boolean);

      if (!allMovies.length) {
        statusMessage.textContent = 'No movies found in the CSV file.';
        return;
      }

      knockoutResults.clear();
      selectedIds = new Set(allMovies.map((movie) => movie.id));
      winnerId = null;
      resultEl.textContent = '';
      statusMessage.textContent = `${allMovies.length} movies imported. Ready to spin!`;
      updateMovieList();
      updateVetoButtonState();
      setImportCardCollapsed(true);
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

function detectDelimiter(text) {
  const lines = text.split(/\r?\n/);
  const firstContentLine = lines.find((line) => line.trim().length);
  if (!firstContentLine) {
    return ',';
  }

  const candidates = [',', '\t', ';', '|'];
  let bestDelimiter = ',';
  let bestSegmentCount = 1;

  candidates.forEach((candidate) => {
    const segments = firstContentLine.split(candidate);
    if (segments.length > bestSegmentCount) {
      bestSegmentCount = segments.length;
      bestDelimiter = candidate;
    }
  });

  return bestDelimiter;
}

function parseCSV(text, delimiter = ',') {
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
    } else if (char === delimiter && !insideQuotes) {
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

function movieMatchesFilters(movie) {
  if (!movie || typeof movie !== 'object') {
    return false;
  }

  if (!filterState.showCustoms && movie.isCustom) {
    return false;
  }

  if (filterState.normalizedQuery) {
    const haystack = [movie.name, movie.year, movie.date]
      .filter((part) => typeof part === 'string' && part.trim())
      .join(' ')
      .toLowerCase();
    if (!haystack.includes(filterState.normalizedQuery)) {
      return false;
    }
  }

  return true;
}

function getFilteredMovies() {
  if (filterState.showCustoms && !filterState.normalizedQuery) {
    return [...allMovies];
  }

  return allMovies.filter((movie) => movieMatchesFilters(movie));
}

function getFilteredSelectedMovies() {
  return getFilteredMovies().filter((movie) => selectedIds.has(movie.id));
}

function getActiveFilterDescriptions() {
  const descriptions = [];
  if (filterState.query) {
    descriptions.push(`search “${filterState.query}”`);
  }
  if (!filterState.showCustoms) {
    descriptions.push('Custom entries hidden');
  }
  return descriptions;
}

function updateMovieList() {
  movieListEl.innerHTML = '';

  if (!allMovies.length) {
    const emptyItem = document.createElement('li');
    emptyItem.className = 'empty';
    emptyItem.textContent = 'Upload a CSV to see your movies here.';
    movieListEl.appendChild(emptyItem);
    spinButton.disabled = true;
    drawEmptyWheel();
    closeWinnerPopup({ restoreFocus: false });
    updateVetoButtonState();
    updateSpinButtonLabel();
    return;
  }

  const filteredMovies = getFilteredMovies();

  const winnerVisible = filteredMovies.some((movie) => movie.id === winnerId && selectedIds.has(movie.id));
  if (winnerId && !winnerVisible) {
    winnerId = null;
    resultEl.textContent = '';
    closeWinnerPopup({ restoreFocus: false });
  }

  if (!filteredMovies.length) {
    const emptyItem = document.createElement('li');
    emptyItem.className = 'empty';
    const descriptions = getActiveFilterDescriptions();
    emptyItem.textContent = descriptions.length
      ? `No movies match your current filters (${descriptions.join(', ')}).`
      : 'No movies match your current filters.';
    movieListEl.appendChild(emptyItem);
    spinButton.disabled = true;
    drawEmptyWheel();
    updateVetoButtonState();
    return;
  }

  const weightsEnabled = isAdvancedOptionsEnabled();

  const displayMovies = [...filteredMovies];
  if (knockoutResults.size) {
    displayMovies.sort((a, b) => {
      const aStatus = knockoutResults.get(a.id);
      const bStatus = knockoutResults.get(b.id);
      const aOrder = aStatus && Number.isFinite(aStatus.order) ? aStatus.order : null;
      const bOrder = bStatus && Number.isFinite(bStatus.order) ? bStatus.order : null;

      if (aOrder !== null && bOrder !== null) {
        if (aOrder !== bOrder) {
          return aOrder - bOrder;
        }
        if (aStatus?.status === 'champion' && bStatus?.status !== 'champion') {
          return 1;
        }
        if (aStatus?.status !== 'champion' && bStatus?.status === 'champion') {
          return -1;
        }
        return 0;
      }

      if (aOrder !== null) return -1;
      if (bOrder !== null) return 1;

      const aIndex = getMovieOriginalIndex(a);
      const bIndex = getMovieOriginalIndex(b);
      if (aIndex === bIndex) {
        return 0;
      }
      if (!Number.isFinite(aIndex)) return 1;
      if (!Number.isFinite(bIndex)) return -1;
      return aIndex - bIndex;
    });
  }

  displayMovies.forEach((movie, index) => {
    const li = document.createElement('li');
    li.dataset.id = movie.id;
    if (winnerId === movie.id) {
      li.classList.add('highlight');
    }
    if (weightsEnabled) {
      li.classList.add('show-weights');
    }

    const originalIndex = getMovieOriginalIndex(movie);
    if (Number.isFinite(originalIndex) && originalIndex >= 0) {
      li.dataset.originalIndex = String(originalIndex);
    } else {
      li.removeAttribute('data-original-index');
    }

    const sanitizedWeight = getStoredWeight(movie);
    if (movie.weight !== sanitizedWeight) {
      movie.weight = sanitizedWeight;
    }

    let colorIndex = originalIndex;
    if (!Number.isFinite(colorIndex) || colorIndex < 0) {
      colorIndex = allMovies.indexOf(movie);
    }
    const defaultColor = getDefaultColorForIndex(colorIndex);
    const sanitizedColor = getStoredColor(movie, defaultColor);
    if (movie.color !== sanitizedColor) {
      movie.color = sanitizedColor;
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
    if (movie.isCustom) parts.push('Custom entry');
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

    if (weightsEnabled) {
      const weightWrapper = document.createElement('div');
      weightWrapper.className = 'movie-weight';

      const weightSelectId = `weight-${index}`;
      const weightLabel = document.createElement('label');
      weightLabel.setAttribute('for', weightSelectId);
      weightLabel.textContent = 'Slice weight';

      const weightSelect = document.createElement('select');
      weightSelect.id = weightSelectId;
      weightSelect.className = 'movie-weight__select';
      for (let value = 1; value <= 10; value += 1) {
        const option = document.createElement('option');
        option.value = String(value);
        option.textContent = `${value}×`;
        weightSelect.appendChild(option);
      }
      weightSelect.value = String(sanitizedWeight);
      weightSelect.addEventListener('change', (event) => {
        const selectedValue = Number(event.target.value);
        movie.weight = clampWeight(selectedValue);
        const selectedMoviesSnapshot = getFilteredSelectedMovies();
        drawWheel(selectedMoviesSnapshot);
      });

      weightWrapper.appendChild(weightLabel);
      weightWrapper.appendChild(weightSelect);
      li.appendChild(weightWrapper);

      const colorWrapper = document.createElement('div');
      colorWrapper.className = 'movie-color';

      const colorInputId = `color-${index}`;
      const colorLabel = document.createElement('label');
      colorLabel.setAttribute('for', colorInputId);
      colorLabel.textContent = 'Slice color';

      const colorInput = document.createElement('input');
      colorInput.type = 'color';
      colorInput.id = colorInputId;
      colorInput.className = 'movie-color__input';
      colorInput.value = sanitizedColor;
      colorInput.addEventListener('input', (event) => {
        const selectedColor = sanitizeColor(event.target.value, defaultColor);
        movie.color = selectedColor;
        const selectedMoviesSnapshot = getFilteredSelectedMovies();
        drawWheel(selectedMoviesSnapshot);
      });

      colorWrapper.appendChild(colorLabel);
      colorWrapper.appendChild(colorInput);
      li.appendChild(colorWrapper);
    }

    if (movie.isCustom) {
      const removeButton = document.createElement('button');
      removeButton.type = 'button';
      removeButton.className = 'btn remove-custom';
      removeButton.textContent = 'Remove';
      removeButton.addEventListener('click', () => removeCustomEntry(movie.id));
      li.appendChild(removeButton);
    }

    const knockoutStatus = knockoutResults.get(movie.id);
    applyKnockoutStatusToElement(li, knockoutStatus);

    movieListEl.appendChild(li);
  });

  const selectedMovies = filteredMovies.filter((movie) => selectedIds.has(movie.id));
  spinButton.disabled = selectedMovies.length === 0 || isSpinning;
  if (!selectedMovies.length) {
    closeWinnerPopup({ restoreFocus: false });
  }
  drawWheel(selectedMovies);
  updateVetoButtonState();
  updateSpinButtonLabel();
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
  ctx.fillText('Upload a CSV to spin', 0, 0);
  ctx.restore();
}

function updateSpinButtonLabel() {
  if (!spinButton) return;
  if (isLastStandingInProgress) {
    spinButton.textContent = 'Eliminating…';
    return;
  }

  if (isOneSpinModeEnabled()) {
    spinButton.textContent = 'Spin the One Spin to Rule them all';
    return;
  }

  const remaining = getFilteredSelectedMovies();
  if (remaining.length > 1) {
    spinButton.textContent = 'Start Movie Knockout mode';
    return;
  }

  spinButton.textContent = 'Spin the wheel';
}

function clearKnockoutStyles() {
  if (resultEl) {
    resultEl.classList.remove('result--champion', 'result--knockout');
  }
  knockoutResults.clear();
  if (!movieListEl) return;
  movieListEl.querySelectorAll('li').forEach((item) => {
    item.classList.remove('is-champion', 'is-knocked-out');
    item.removeAttribute('data-knockout-order');
    item.removeAttribute('data-knockout-status');
    const badge = item.querySelector('.knockout-badge');
    if (badge) {
      badge.remove();
    }
  });
}

function escapeSelector(value) {
  if (window.CSS && typeof window.CSS.escape === 'function') {
    return window.CSS.escape(value);
  }
  return String(value).replace(/["\\]/g, '\\$&');
}

function getMovieOriginalIndex(movie) {
  if (!movie || typeof movie !== 'object') {
    return -1;
  }
  if (Number.isFinite(movie.initialIndex)) {
    return movie.initialIndex;
  }
  const index = allMovies.indexOf(movie);
  return index >= 0 ? index : -1;
}

function applyKnockoutStatusToElement(element, status) {
  if (!element) return;

  if (!status) {
    element.classList.remove('is-champion', 'is-knocked-out');
    element.removeAttribute('data-knockout-order');
    element.removeAttribute('data-knockout-status');
    const existing = element.querySelector('.knockout-badge');
    if (existing) {
      existing.remove();
    }
    return;
  }

  element.dataset.knockoutOrder = String(status.order);
  element.dataset.knockoutStatus = status.status;

  element.classList.toggle('is-knocked-out', status.status === 'knocked-out');
  element.classList.toggle('is-champion', status.status === 'champion');

  let badge = element.querySelector('.knockout-badge');
  if (!badge) {
    badge = document.createElement('span');
    badge.className = 'knockout-badge';
    const removeButton = element.querySelector('.remove-custom');
    if (removeButton && removeButton.parentElement === element) {
      element.insertBefore(badge, removeButton);
    } else {
      element.appendChild(badge);
    }
  } else {
    const removeButton = element.querySelector('.remove-custom');
    if (removeButton && removeButton.parentElement === element && badge.nextSibling !== removeButton) {
      element.insertBefore(badge, removeButton);
    }
  }

  if (status.status === 'champion') {
    badge.textContent = 'Knockout champion';
  } else {
    badge.textContent = status.order ? `Knocked out #${status.order}` : 'Knocked out';
  }
}

function applyKnockoutStatusToItem(movieId) {
  if (!movieListEl) return;
  const safeId = escapeSelector(movieId);
  const item = movieListEl.querySelector(`li[data-id="${safeId}"]`);
  if (!item) return;
  const status = knockoutResults.get(movieId);
  applyKnockoutStatusToElement(item, status);
}

function reorderMovieListForKnockout() {
  if (!movieListEl || !knockoutResults.size) {
    return;
  }

  const items = Array.from(movieListEl.children).filter((item) => !item.classList.contains('empty'));
  if (!items.length) {
    return;
  }

  const sorted = items.sort((a, b) => {
    const aOrder = Number.parseInt(a.dataset.knockoutOrder, 10);
    const bOrder = Number.parseInt(b.dataset.knockoutOrder, 10);
    const aHasOrder = Number.isFinite(aOrder);
    const bHasOrder = Number.isFinite(bOrder);

    if (aHasOrder && bHasOrder) {
      return aOrder - bOrder;
    }
    if (aHasOrder) {
      return -1;
    }
    if (bHasOrder) {
      return 1;
    }

    const aIndex = Number.parseInt(a.dataset.originalIndex, 10);
    const bIndex = Number.parseInt(b.dataset.originalIndex, 10);
    if (Number.isFinite(aIndex) && Number.isFinite(bIndex)) {
      return aIndex - bIndex;
    }
    return 0;
  });

  sorted.forEach((item) => {
    movieListEl.appendChild(item);
  });
}

function markMovieKnockedOut(movieId, order) {
  knockoutResults.set(movieId, { order, status: 'knocked-out' });
  applyKnockoutStatusToItem(movieId);
  reorderMovieListForKnockout();
}

function markMovieChampion(movieId, order) {
  knockoutResults.set(movieId, { order, status: 'champion' });
  applyKnockoutStatusToItem(movieId);
  reorderMovieListForKnockout();
}

function isAdvancedOptionsEnabled() {
  return advancedOptionsToggle ? Boolean(advancedOptionsToggle.checked) : true;
}

function isOneSpinModeEnabled() {
  return Boolean(isAdvancedOptionsEnabled() && oneSpinToggle && oneSpinToggle.checked);
}

function isKnockoutModeEnabled() {
  return !isOneSpinModeEnabled();
}

function getLastStandingSpeedConfig(remainingCount) {
  for (const stage of MOVIE_KNOCKOUT_SPEEDS) {
    if (remainingCount >= stage.minCount) {
      return stage.config;
    }
  }
  return MOVIE_KNOCKOUT_SPEEDS[MOVIE_KNOCKOUT_SPEEDS.length - 1].config;
}

function clampWeight(value) {
  if (!Number.isFinite(value)) {
    return 1;
  }
  return Math.min(10, Math.max(1, Math.round(value)));
}

function getStoredWeight(movie) {
  if (!movie || typeof movie !== 'object') {
    return 1;
  }
  return clampWeight(Number(movie.weight));
}

function sanitizeColor(value, fallback) {
  if (typeof value === 'string') {
    const trimmed = value.trim().toLowerCase();
    if (/^#([0-9a-f]{6})$/i.test(trimmed)) {
      return trimmed;
    }
  }
  if (typeof fallback === 'string' && /^#([0-9a-f]{6})$/i.test(fallback.trim())) {
    return fallback.trim().toLowerCase();
  }
  return DEFAULT_SLICE_COLOR;
}

function getStoredColor(movie, fallback) {
  if (!movie || typeof movie !== 'object') {
    return sanitizeColor('', fallback);
  }
  return sanitizeColor(movie.color, fallback);
}

function getEffectiveWeight(movie) {
  return isAdvancedOptionsEnabled() ? getStoredWeight(movie) : 1;
}

function computeWheelModel(selectedMovies) {
  if (!selectedMovies.length) {
    return { segments: [], totalWeight: 0 };
  }

  const weights = selectedMovies.map((movie) => getEffectiveWeight(movie));
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

function drawWheel(selectedMovies) {
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
    if (movie.color !== fillColor) {
      movie.color = fillColor;
    }
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

async function spinWheel() {
  if (isSpinning || isLastStandingInProgress) return;

  const selectedMovies = getFilteredSelectedMovies();
  if (!selectedMovies.length) {
    statusMessage.textContent = 'Select at least one movie that matches your filters to spin the wheel.';
    return;
  }

  clearKnockoutStyles();
  closeWinnerPopup({ restoreFocus: false });
  resultEl.textContent = '';
  winnerId = null;
  highlightWinner();
  updateVetoButtonState();
  updateSpinButtonLabel();
  ensureAudioContext();

  if (isKnockoutModeEnabled() && selectedMovies.length > 1) {
    await runLastStandingMode(selectedMovies);
    return;
  }

  const spinSettings = isOneSpinModeEnabled() ? DRAMATIC_SPIN_SETTINGS : DEFAULT_SPIN_SETTINGS;

  const { winningMovie } = await performSpin(selectedMovies, spinSettings);

  if (!winningMovie) {
    updateVetoButtonState();
    updateSpinButtonLabel();
    return;
  }

  winnerId = winningMovie.id;
  highlightWinner();
  resultEl.innerHTML = `🎉 Next up: <strong>${winningMovie.name}</strong>${winningMovie.year ? ` (${winningMovie.year})` : ''}`;
  playWinSound();
  drawWheel(selectedMovies);
  triggerConfetti();
  showWinnerPopup(winningMovie);
  updateVetoButtonState();
  updateSpinButtonLabel();
}

function tick(segments) {
  if (!segments.length) {
    return;
  }

  const pointerAngle = getPointerAngle();
  const index = findSegmentIndexForAngle(segments, pointerAngle);
  if (index !== lastTickIndex) {
    playTickSound();
    lastTickIndex = index;
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
      spinButton.disabled = selectedMovies.length === 0;
      resolve({ winningMovie: null, segments: [] });
      return;
    }

    ensureAudioContext();
    isSpinning = true;
    spinButton.disabled = true;
    lastTickIndex = null;

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
        spinButton.disabled = selectedMovies.length === 0;
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

async function runLastStandingMode(selectedMovies) {
  const eliminationPool = [...selectedMovies];
  let eliminationOrder = 1;
  isLastStandingInProgress = true;
  spinButton.disabled = true;
  updateSpinButtonLabel();
  updateVetoButtonState();

  if (resultEl) {
    resultEl.classList.add('result--knockout');
    resultEl.classList.remove('result--champion');
    const startingCount = eliminationPool.length;
    resultEl.innerHTML = `🔥 Movie Knockout begins! <strong>${startingCount}</strong> movie${
      startingCount === 1 ? '' : 's'
    } enter the arena.`;
  }

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

    markMovieKnockedOut(eliminatedMovie.id, eliminationOrder);
    eliminationOrder += 1;
    playKnockoutSound();

    eliminationPool.splice(removalIndex, 1);
    const remainingCount = eliminationPool.length;
    const remainText = remainingCount === 1 ? 'Final showdown! One movie remains.' : `${remainingCount} movies remain.`;
    const eliminatedLabel = `${eliminatedMovie.name}${eliminatedMovie.year ? ` (${eliminatedMovie.year})` : ''}`;
    resultEl.innerHTML = `💥 Knocked out: <strong>${eliminatedLabel}</strong> ${remainText}`;
    drawWheel(eliminationPool);

    if (remainingCount <= 1) {
      const revealDelay = isFinalElimination ? speedConfig.finalRevealDelay : speedConfig.knockoutRevealDelay;
      await delay(revealDelay);
      break;
    }

    spinButton.disabled = true;
    updateSpinButtonLabel();
    await delay(speedConfig.interRoundDelay);
  }

  const finalMovie = eliminationPool[0];
  if (finalMovie) {
    winnerId = finalMovie.id;
    markMovieChampion(finalMovie.id, eliminationOrder);
    highlightWinner();
    const finalTiming = getLastStandingSpeedConfig(1);
    await delay(finalTiming.winnerRevealDelay);
    resultEl.classList.add('result--champion');
    resultEl.innerHTML = `🏆 Movie Knockout winner: <strong>${finalMovie.name}</strong>${
      finalMovie.year ? ` (${finalMovie.year})` : ''
    }`;
    playWinSound();
    drawWheel(eliminationPool);
    triggerConfetti();
    showWinnerPopup(finalMovie);
  }

  isLastStandingInProgress = false;
  spinButton.disabled = getFilteredSelectedMovies().length === 0;
  updateVetoButtonState();
  updateSpinButtonLabel();
}

function delay(ms) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, Math.max(0, ms));
  });
}

function playKnockoutSound() {
  ensureAudioContext();
  const now = audioContext.currentTime;
  const oscillator = audioContext.createOscillator();
  const gain = audioContext.createGain();
  oscillator.type = 'sawtooth';
  oscillator.frequency.setValueAtTime(520, now);
  oscillator.frequency.exponentialRampToValueAtTime(220, now + 0.4);
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(0.12, now + 0.05);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.5);
  oscillator.connect(gain).connect(audioContext.destination);
  oscillator.start(now);
  oscillator.stop(now + 0.5);
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

  const metadataKey = buildMetadataKey(movie);
  currentModalMetadataKey = metadataKey;
  setWinnerModalLoadingState(movie);
  populateWinnerModalMetadata(movie, metadataKey);

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

function setWinnerModalLoadingState(movie) {
  if (winModalPosterWrapper) {
    winModalPosterWrapper.hidden = true;
  }
  if (winModalPoster) {
    winModalPoster.removeAttribute('src');
    winModalPoster.alt = '';
  }
  if (winModalRuntime) {
    winModalRuntime.textContent = 'Looking up runtime…';
    winModalRuntime.classList.add('is-loading');
  }
  if (winModalSynopsis) {
    winModalSynopsis.textContent = 'Fetching synopsis…';
    winModalSynopsis.classList.add('is-loading');
  }
  if (winModalTrailer) {
    const trailerUrl = buildTrailerSearchUrl(movie?.name, movie?.year);
    winModalTrailer.href = trailerUrl;
    winModalTrailer.textContent = 'Find a trailer';
    winModalTrailer.classList.remove('hidden');
    if (movie?.name) {
      winModalTrailer.setAttribute('aria-label', `Find a trailer for ${movie.name}`);
    } else {
      winModalTrailer.removeAttribute('aria-label');
    }
  }
}

async function populateWinnerModalMetadata(movie, metadataKey) {
  if (!movie || !movie.name) {
    applyWinnerModalFallback(movie);
    return;
  }

  const result = await fetchMovieMetadata(movie);
  if (metadataKey !== currentModalMetadataKey) {
    return;
  }

  if (!result || result.status !== 'success' || !result.data) {
    applyWinnerModalFallback(movie);
    return;
  }

  const { title, runtime, plot, poster, year } = result.data;

  if (winModalRuntime) {
    winModalRuntime.textContent = runtime || 'Runtime unavailable.';
    winModalRuntime.classList.toggle('is-loading', false);
  }

  if (winModalSynopsis) {
    winModalSynopsis.textContent = plot || 'Synopsis unavailable. Check the movie page for more.';
    winModalSynopsis.classList.toggle('is-loading', false);
  }

  if (winModalPosterWrapper && winModalPoster) {
    if (poster) {
      winModalPoster.src = poster;
      winModalPoster.alt = title ? `Poster for ${title}` : 'Movie poster';
      winModalPosterWrapper.hidden = false;
    } else {
      winModalPosterWrapper.hidden = true;
      winModalPoster.removeAttribute('src');
      winModalPoster.alt = '';
    }
  }

  if (winModalTrailer) {
    const trailerUrl = buildTrailerSearchUrl(title || movie.name, year || movie.year);
    winModalTrailer.href = trailerUrl;
    winModalTrailer.textContent = 'Watch trailer';
    if (title || movie.name) {
      winModalTrailer.setAttribute('aria-label', `Watch trailer for ${title || movie.name}`);
    } else {
      winModalTrailer.removeAttribute('aria-label');
    }
    winModalTrailer.classList.remove('hidden');
  }
}

function applyWinnerModalFallback(movie) {
  if (winModalRuntime) {
    winModalRuntime.textContent = 'Runtime unavailable.';
    winModalRuntime.classList.toggle('is-loading', false);
  }

  if (winModalSynopsis) {
    winModalSynopsis.textContent = 'Synopsis unavailable. Check the movie page for more.';
    winModalSynopsis.classList.toggle('is-loading', false);
  }

  if (winModalPosterWrapper) {
    winModalPosterWrapper.hidden = true;
  }
  if (winModalPoster) {
    winModalPoster.removeAttribute('src');
    winModalPoster.alt = '';
  }

  if (winModalTrailer) {
    const trailerUrl = buildTrailerSearchUrl(movie?.name, movie?.year);
    winModalTrailer.href = trailerUrl;
    winModalTrailer.textContent = 'Find a trailer';
    if (movie?.name) {
      winModalTrailer.setAttribute('aria-label', `Find a trailer for ${movie.name}`);
    } else {
      winModalTrailer.removeAttribute('aria-label');
    }
    winModalTrailer.classList.remove('hidden');
  }
}

function buildMetadataKey(movie) {
  if (!movie) {
    return 'unknown';
  }
  const name = (movie.name || '').toLowerCase();
  const year = movie.year || '';
  return `${name}__${year}`;
}

async function fetchMovieMetadata(movie) {
  const key = buildMetadataKey(movie);
  if (metadataCache.has(key)) {
    return metadataCache.get(key);
  }

  if (!movie || !movie.name) {
    const value = { status: 'invalid', data: null };
    metadataCache.set(key, value);
    return value;
  }

  try {
    const params = new URLSearchParams({
      apikey: METADATA_API_KEY,
      t: movie.name
    });
    if (movie.year) {
      params.set('y', movie.year);
    }
    const response = await fetch(`${METADATA_API_URL}?${params.toString()}`);
    if (!response.ok) {
      throw new Error('Metadata request failed');
    }
    const data = await response.json();
    if (data && data.Response === 'True') {
      const normalized = normalizeMetadataResponse(data, movie);
      const value = { status: 'success', data: normalized };
      metadataCache.set(key, value);
      return value;
    }
    const notFound = { status: 'not-found', data: null };
    metadataCache.set(key, notFound);
    return notFound;
  } catch (error) {
    const failure = { status: 'error', data: null };
    metadataCache.set(key, failure);
    return failure;
  }
}

function normalizeMetadataResponse(raw, movie) {
  return {
    title: raw.Title || movie.name,
    year: raw.Year && raw.Year !== 'N/A' ? raw.Year : movie.year || '',
    runtime: raw.Runtime && raw.Runtime !== 'N/A' ? raw.Runtime : '',
    plot: raw.Plot && raw.Plot !== 'N/A' ? raw.Plot : '',
    poster: raw.Poster && raw.Poster !== 'N/A' ? raw.Poster : ''
  };
}

function buildTrailerSearchUrl(name, year) {
  const terms = [name, year, 'trailer'].filter(Boolean).join(' ');
  const query = terms || 'movie trailer';
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
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

function addCustomEntry() {
  if (!customEntryInput) return;
  const name = customEntryInput.value.trim();
  if (!name) {
    customEntryInput.focus();
    return;
  }

  const id = `custom-${customEntryCounter}`;
  customEntryCounter += 1;
  const customMovie = {
    id,
    initialIndex: allMovies.length,
    name,
    year: '',
    date: '',
    uri: '',
    isCustom: true,
    weight: 1,
    color: getDefaultColorForIndex(allMovies.length)
  };

  allMovies = [...allMovies, customMovie];
  selectedIds.add(id);
  if (customEntryForm) {
    customEntryForm.reset();
  }
  customEntryInput.focus();
  statusMessage.textContent = `Added “${name}” to the wheel.`;
  updateMovieList();
}

function removeCustomEntry(id) {
  const movie = allMovies.find((item) => item.id === id && item.isCustom);
  if (!movie) return;

  allMovies = allMovies.filter((item) => item.id !== id);
  knockoutResults.delete(id);
  selectedIds.delete(id);
  statusMessage.textContent = `Removed “${movie.name}” from the wheel.`;
  updateMovieList();
}

function handleVeto() {
  if (!winnerId || isSpinning) {
    return;
  }

  const vetoedMovie = allMovies.find((movie) => movie.id === winnerId);
  if (!vetoedMovie) {
    return;
  }

  selectedIds.delete(winnerId);
  statusMessage.textContent = `Vetoed “${vetoedMovie.name}”.`;
  updateMovieList();

  const remaining = getFilteredSelectedMovies();
  if (!remaining.length) {
    statusMessage.textContent += ' No more entries remain to spin with the current filters.';
    return;
  }

  spinWheel();
}

function updateVetoButtonState() {
  if (!vetoButton) return;
  vetoButton.disabled = !winnerId || isSpinning || isLastStandingInProgress;
}

function setWheelFmStatus(message) {
  if (!wheelFmStatus) return;
  wheelFmStatus.textContent = message;
}

function setWheelFmControlsDisabled(disabled) {
  [wheelFmPlayBtn, wheelFmNextBtn, wheelFmPrevBtn, wheelFmSeek]
    .filter(Boolean)
    .forEach((el) => {
      el.disabled = Boolean(disabled);
    });
}

function normalizeWheelFmTrack(entry, index) {
  if (!entry || typeof entry.file !== 'string') {
    return null;
  }
  const file = entry.file.trim();
  if (!file) {
    return null;
  }
  const title = (entry.title || '').trim();
  const artist = (entry.artist || '').trim();
  const fallbackName = file.split('/').pop() || `Track ${index + 1}`;
  return {
    file,
    title: title || fallbackName,
    artist: artist || 'Wheel.FM'
  };
}

function updateWheelFmTrackDisplay(track) {
  if (wheelFmTrackTitle) {
    wheelFmTrackTitle.textContent = track?.title || 'Wheel.FM';
  }
  if (wheelFmTrackArtist) {
    wheelFmTrackArtist.textContent = track?.artist || '';
  }
}

function formatWheelFmTime(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) {
    return '0:00';
  }
  const rounded = Math.floor(seconds);
  const minutes = Math.floor(rounded / 60);
  const remaining = String(rounded % 60).padStart(2, '0');
  return `${minutes}:${remaining}`;
}

function updateWheelFmProgress() {
  if (!wheelFmAudio || !wheelFmSeek || !wheelFmCurrentTime) {
    return;
  }
  if (!Number.isFinite(wheelFmAudio.duration) || wheelFmAudio.duration <= 0) {
    wheelFmSeek.value = 0;
    wheelFmCurrentTime.textContent = '0:00';
    return;
  }
  if (!wheelFmState.isSeeking) {
    const percent = (wheelFmAudio.currentTime / wheelFmAudio.duration) * 100;
    wheelFmSeek.value = percent;
  }
  wheelFmCurrentTime.textContent = formatWheelFmTime(wheelFmAudio.currentTime);
}

function handleWheelFmLoadedMetadata() {
  if (!wheelFmAudio || !wheelFmSeek || !wheelFmDuration) {
    return;
  }
  wheelFmSeek.disabled = false;
  wheelFmDuration.textContent = formatWheelFmTime(wheelFmAudio.duration);
  updateWheelFmProgress();
}

function handleWheelFmSeekInput(event) {
  if (!wheelFmAudio || !wheelFmSeek || !wheelFmDuration) {
    return;
  }
  wheelFmState.isSeeking = true;
  const value = Number(event.target.value);
  if (!Number.isFinite(value) || !Number.isFinite(wheelFmAudio.duration)) {
    return;
  }
  const seconds = (value / 100) * wheelFmAudio.duration;
  if (wheelFmCurrentTime) {
    wheelFmCurrentTime.textContent = formatWheelFmTime(seconds);
  }
}

function handleWheelFmSeekChange(event) {
  if (!wheelFmAudio || !Number.isFinite(wheelFmAudio.duration)) {
    wheelFmState.isSeeking = false;
    return;
  }
  const value = Number(event.target.value);
  const seconds = (value / 100) * wheelFmAudio.duration;
  wheelFmAudio.currentTime = seconds;
  wheelFmState.isSeeking = false;
}

function loadWheelFmTrack(index) {
  if (!wheelFmAudio || !wheelFmState.playlist.length) {
    return;
  }
  const safeIndex = ((index % wheelFmState.playlist.length) + wheelFmState.playlist.length) % wheelFmState.playlist.length;
  const track = wheelFmState.playlist[safeIndex];
  wheelFmState.currentIndex = safeIndex;
  wheelFmAudio.pause();
  wheelFmAudio.src = track.file;
  wheelFmAudio.currentTime = 0;
  if (wheelFmSeek) {
    wheelFmSeek.value = 0;
    wheelFmSeek.disabled = true;
  }
  if (wheelFmCurrentTime) {
    wheelFmCurrentTime.textContent = '0:00';
  }
  if (wheelFmDuration) {
    wheelFmDuration.textContent = '0:00';
  }
  updateWheelFmTrackDisplay(track);
  setWheelFmStatus(`Ready to play “${track.title}”.`);
}

async function handleWheelFmPlayToggle() {
  if (!wheelFmAudio || !wheelFmState.playlist.length) {
    return;
  }
  if (wheelFmAudio.paused) {
    try {
      await wheelFmAudio.play();
      setWheelFmStatus(`Now playing “${wheelFmState.playlist[wheelFmState.currentIndex].title}”.`);
    } catch (error) {
      setWheelFmStatus('Unable to start Wheel.FM — browser blocked playback.');
    }
  } else {
    wheelFmAudio.pause();
    setWheelFmStatus('Paused Wheel.FM.');
  }
}

function handleWheelFmNext() {
  if (!wheelFmState.playlist.length) {
    return;
  }
  const nextIndex = (wheelFmState.currentIndex + 1) % wheelFmState.playlist.length;
  loadWheelFmTrack(nextIndex);
  if (wheelFmAudio && !wheelFmAudio.paused) {
    wheelFmAudio.play().catch(() => {
      /* ignored */
    });
  }
}

function handleWheelFmPrevious() {
  if (!wheelFmState.playlist.length) {
    return;
  }
  const prevIndex = (wheelFmState.currentIndex - 1 + wheelFmState.playlist.length) % wheelFmState.playlist.length;
  loadWheelFmTrack(prevIndex);
  if (wheelFmAudio && !wheelFmAudio.paused) {
    wheelFmAudio.play().catch(() => {
      /* ignored */
    });
  }
}

async function initWheelFm() {
  if (!wheelFmAudio || !wheelFmPlayBtn || !wheelFmSeek) {
    return;
  }

  wheelFmPlayBtn.addEventListener('click', handleWheelFmPlayToggle);
  if (wheelFmNextBtn) {
    wheelFmNextBtn.addEventListener('click', handleWheelFmNext);
  }
  if (wheelFmPrevBtn) {
    wheelFmPrevBtn.addEventListener('click', handleWheelFmPrevious);
  }
  wheelFmSeek.addEventListener('input', handleWheelFmSeekInput);
  wheelFmSeek.addEventListener('change', handleWheelFmSeekChange);

  wheelFmAudio.addEventListener('timeupdate', updateWheelFmProgress);
  wheelFmAudio.addEventListener('loadedmetadata', handleWheelFmLoadedMetadata);
  wheelFmAudio.addEventListener('ended', handleWheelFmNext);
  wheelFmAudio.addEventListener('error', () => {
    setWheelFmStatus('Could not load the current Wheel.FM track.');
  });
  wheelFmAudio.addEventListener('play', () => {
    wheelFmPlayBtn.classList.add('is-playing');
  });
  wheelFmAudio.addEventListener('pause', () => {
    wheelFmPlayBtn.classList.remove('is-playing');
  });

  setWheelFmControlsDisabled(true);
  setWheelFmStatus('Looking for Wheel.FM tracks…');

  try {
    const response = await fetch(WHEEL_FM_PLAYLIST_PATH, { cache: 'no-store' });
    if (!response.ok) {
      throw new Error('Playlist unavailable');
    }
    const data = await response.json();
    const normalized = Array.isArray(data)
      ? data
          .map((entry, index) => normalizeWheelFmTrack(entry, index))
          .filter(Boolean)
      : [];

    if (!normalized.length) {
      setWheelFmStatus('Add MP3 files to wheel-fm/ and list them in playlist.json to start broadcasting.');
      return;
    }

    wheelFmState.playlist = normalized;
    setWheelFmControlsDisabled(false);
    loadWheelFmTrack(0);
  } catch (error) {
    setWheelFmStatus('Wheel.FM playlist missing or invalid.');
  }
}

if (wheelFmAudio && wheelFmPlayBtn) {
  initWheelFm();
}

window.addEventListener('beforeunload', () => {
  if (audioContext) {
    audioContext.close();
  }
});

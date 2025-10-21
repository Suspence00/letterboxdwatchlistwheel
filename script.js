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
const winModalCloseBtn = document.getElementById('win-modal-close');
const lizardForm = document.getElementById('lizard-form');
const lizardInput = document.getElementById('lizard-input');
const lizardStatus = document.getElementById('lizard-status');
const importCard = document.getElementById('import-card');
const importCardBody = document.getElementById('import-body');
const importToggleBtn = document.getElementById('import-toggle');
const advancedOptionsToggle = document.getElementById('advanced-options-toggle');
const advancedOptionsHint = document.getElementById('advanced-options-hint');

const LIZARD_BASE_URL = 'https://lizard.streamlit.app';

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

if (lizardForm) {
  lizardForm.addEventListener('submit', handleLizardOpen);
}

if (importToggleBtn && importCard && importCardBody) {
  importToggleBtn.addEventListener('click', () => {
    const isCollapsed = importCard.classList.toggle('card--collapsed');
    importCardBody.hidden = isCollapsed;
    importToggleBtn.setAttribute('aria-expanded', String(!isCollapsed));
    importToggleBtn.textContent = isCollapsed ? 'Show steps' : 'Hide steps';
  });
}

if (advancedOptionsToggle) {
  if (advancedOptionsHint) {
    advancedOptionsHint.hidden = !advancedOptionsToggle.checked;
  }
  advancedOptionsToggle.addEventListener('change', () => {
    if (advancedOptionsHint) {
      advancedOptionsHint.hidden = !advancedOptionsToggle.checked;
    }
    updateMovieList();
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

function handleLizardOpen(event) {
  event.preventDefault();
  if (!lizardInput) {
    return;
  }

  const rawValue = lizardInput.value.trim();
  if (!rawValue) {
    setLizardStatus('Enter a Letterboxd profile or list to open the download helper.', { tone: 'error' });
    lizardInput.focus();
    return;
  }

  let query;
  try {
    query = buildLizardQuery(rawValue);
  } catch (error) {
    setLizardStatus(error.message || 'Please provide a valid value.', { tone: 'error' });
    lizardInput.focus();
    return;
  }

  const url = buildLizardManualUrl(query.mode, query.manualQuery);
  if (!url) {
    setLizardStatus('Unable to build a download helper link. Try again.', { tone: 'error' });
    return;
  }

  setLizardStatus('Opening the download helper in a new tab…');

  const openedWindow = window.open(url, '_blank', 'noopener,noreferrer');
  if (!openedWindow) {
    setLizardStatus('Pop-up blocked. Allow pop-ups for this site or open the helper manually.', { tone: 'error' });
    return;
  }

  setLizardStatus('Opened the helper. Download the CSV there and upload it above.', { tone: 'success' });
}

function buildLizardQuery(rawInput) {
  const trimmed = rawInput.trim();
  if (!trimmed) {
    throw new Error('Enter a Letterboxd profile or list to open the download helper.');
  }

  if (/^https?:\/\//i.test(trimmed) && !/^https?:\/\/(www\.)?letterboxd\.com\//i.test(trimmed)) {
    throw new Error('Only Letterboxd links are supported.');
  }

  const withoutDomain = trimmed.replace(/^https?:\/\/(www\.)?letterboxd\.com\//i, '');
  const withoutQuery = withoutDomain.split(/[?#]/)[0];
  const cleaned = withoutQuery
    .replace(/^@/, '')
    .replace(/^\/+/, '')
    .replace(/\/+$/, '');
  if (!cleaned) {
    throw new Error('Enter a valid Letterboxd username or list.');
  }

  const segments = cleaned.split('/').filter(Boolean);
  if (!segments.length) {
    throw new Error('Enter a valid Letterboxd username or list.');
  }

  if (segments.length === 1 || (segments.length === 2 && segments[1].toLowerCase() === 'watchlist')) {
    const username = segments[0];
    if (!username || username.toLowerCase() === 'watchlist' || username.toLowerCase() === 'list') {
      throw new Error('Enter a valid Letterboxd username.');
    }
    return {
      mode: 'watchlist',
      manualQuery: username
    };
  }

  return {
    mode: 'list',
    manualQuery: cleaned
  };
}

function buildLizardManualUrl(mode, manualQuery) {
  const safeQuery = manualQuery ? manualQuery.trim() : '';
  if (!safeQuery) {
    return '';
  }

  const params = new URLSearchParams();

  if (mode === 'watchlist') {
    params.set('username', safeQuery);
    params.set('tab', 'watchlist');
  }

  params.set('q', safeQuery);

  return `${LIZARD_BASE_URL}/?${params.toString()}`;
}

function setLizardStatus(message, { tone } = {}) {
  if (!lizardStatus) {
    return;
  }

  lizardStatus.textContent = message || '';
  lizardStatus.classList.remove('status--error', 'status--success');

  if (tone === 'error') {
    lizardStatus.classList.add('status--error');
  } else if (tone === 'success') {
    lizardStatus.classList.add('status--success');
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
            name: rawName,
            year: yearIndex >= 0 && row[yearIndex] ? row[yearIndex].trim() : '',
            date: dateIndex >= 0 && row[dateIndex] ? row[dateIndex].trim() : '',
            uri,
            fromLizard: isLikelyLizardExport,
            weight: 1
          };
        })
        .filter(Boolean);

      if (!allMovies.length) {
        statusMessage.textContent = 'No movies found in the CSV file.';
        return;
      }

      selectedIds = new Set(allMovies.map((movie) => movie.id));
      winnerId = null;
      resultEl.textContent = '';
      statusMessage.textContent = `${allMovies.length} movies imported. Ready to spin!`;
      updateMovieList();
      updateVetoButtonState();
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

function updateMovieList() {
  movieListEl.innerHTML = '';
  if (winnerId && !selectedIds.has(winnerId)) {
    winnerId = null;
    resultEl.textContent = '';
    closeWinnerPopup({ restoreFocus: false });
    updateVetoButtonState();
  }

  if (!allMovies.length) {
    movieListEl.innerHTML = '<li class="empty">Upload a CSV to see your movies here.</li>';
    spinButton.disabled = true;
    drawEmptyWheel();
    closeWinnerPopup({ restoreFocus: false });
    updateVetoButtonState();
    return;
  }

  const weightsEnabled = isAdvancedOptionsEnabled();

  allMovies.forEach((movie, index) => {
    const li = document.createElement('li');
    li.dataset.id = movie.id;
    if (winnerId === movie.id) {
      li.classList.add('highlight');
    }
    if (weightsEnabled) {
      li.classList.add('show-weights');
    }

    const sanitizedWeight = getStoredWeight(movie);
    if (movie.weight !== sanitizedWeight) {
      movie.weight = sanitizedWeight;
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
    if (movie.fromLizard) parts.push('Imported via download helper');
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
        const selectedMoviesSnapshot = allMovies.filter((item) => selectedIds.has(item.id));
        drawWheel(selectedMoviesSnapshot);
      });

      weightWrapper.appendChild(weightLabel);
      weightWrapper.appendChild(weightSelect);
      li.appendChild(weightWrapper);
    }

    if (movie.isCustom) {
      const removeButton = document.createElement('button');
      removeButton.type = 'button';
      removeButton.className = 'btn remove-custom';
      removeButton.textContent = 'Remove';
      removeButton.addEventListener('click', () => removeCustomEntry(movie.id));
      li.appendChild(removeButton);
    }

    movieListEl.appendChild(li);
  });

  const selectedMovies = allMovies.filter((movie) => selectedIds.has(movie.id));
  spinButton.disabled = selectedMovies.length === 0 || isSpinning;
  if (!selectedMovies.length) {
    closeWinnerPopup({ restoreFocus: false });
  }
  drawWheel(selectedMovies);
  updateVetoButtonState();
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

function isAdvancedOptionsEnabled() {
  return Boolean(advancedOptionsToggle && advancedOptionsToggle.checked);
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
    ctx.fillStyle = palette[index % palette.length];
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
  updateVetoButtonState();
  lastTickIndex = null;
  ensureAudioContext();

  const { segments, totalWeight } = computeWheelModel(selectedMovies);
  if (!segments.length || totalWeight <= 0) {
    drawWheel(selectedMovies);
    isSpinning = false;
    spinButton.disabled = selectedMovies.length === 0;
    updateVetoButtonState();
    return;
  }

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
  const spins = 6 + Math.random() * 3;
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
    tick(segments);

    if (progress < 1) {
      animationFrameId = requestAnimationFrame(animate);
    } else {
      finishSpin(selectedMovies, segments);
    }
  };

  animationFrameId = requestAnimationFrame(animate);
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

function finishSpin(selectedMovies, segments) {
  cancelAnimationFrame(animationFrameId);
  isSpinning = false;
  spinButton.disabled = selectedMovies.length === 0;

  const pointerAngle = getPointerAngle();
  const winningIndex = findSegmentIndexForAngle(segments, pointerAngle);
  const winningSegment = winningIndex >= 0 ? segments[winningIndex] : null;
  const winningMovie = winningSegment ? winningSegment.movie : selectedMovies[0];
  winnerId = winningMovie.id;
  highlightWinner();
  resultEl.innerHTML = `🎉 Next up: <strong>${winningMovie.name}</strong>${winningMovie.year ? ` (${winningMovie.year})` : ''}`;
  playWinSound();
  drawWheel(selectedMovies);
  triggerConfetti();
  showWinnerPopup(winningMovie);
  updateVetoButtonState();
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
    name,
    year: '',
    date: '',
    uri: '',
    isCustom: true,
    weight: 1
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

  const remaining = allMovies.filter((movie) => selectedIds.has(movie.id));
  if (!remaining.length) {
    statusMessage.textContent += ' No more entries remain to spin.';
    return;
  }

  spinWheel();
}

function updateVetoButtonState() {
  if (!vetoButton) return;
  vetoButton.disabled = !winnerId || isSpinning;
}

window.addEventListener('beforeunload', () => {
  if (audioContext) {
    audioContext.close();
  }
});

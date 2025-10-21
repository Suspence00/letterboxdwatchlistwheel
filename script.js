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
const lizardButtons = document.querySelectorAll('[data-lizard-action]');

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
  lizardForm.addEventListener('submit', (event) => {
    event.preventDefault();
  });
}

if (lizardButtons && lizardButtons.length) {
  lizardButtons.forEach((button) => {
    button.addEventListener('click', handleLizardAction);
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

function handleLizardAction(event) {
  event.preventDefault();
  if (!lizardInput) {
    return;
  }

  const mode = event.currentTarget?.getAttribute('data-lizard-action');
  if (!mode) {
    return;
  }

  const rawValue = lizardInput.value.trim();
  if (!rawValue) {
    setLizardStatus('Enter a username or list link to open in Lizard.', { tone: 'error' });
    lizardInput.focus();
    return;
  }

  let queries;
  try {
    queries = buildLizardQueries(rawValue, mode);
  } catch (error) {
    setLizardStatus(error.message || 'Please provide a valid value.', { tone: 'error' });
    lizardInput.focus();
    return;
  }

  const url = buildLizardManualUrl(mode, queries.manualQuery);
  if (!url) {
    setLizardStatus('Unable to build a Lizard link. Try again.', { tone: 'error' });
    return;
  }

  setLizardStatus('Opening Lizard in a new tab…');

  const openedWindow = window.open(url, '_blank', 'noopener,noreferrer');
  if (!openedWindow) {
    setLizardStatus('Pop-up blocked. Allow pop-ups for this site or open Lizard manually.', { tone: 'error' });
    return;
  }

  setLizardStatus('Opened Lizard. Download the CSV there and upload it on the right.', { tone: 'success' });
}

function buildLizardQueries(rawInput, mode) {
  const trimmed = rawInput.trim();
  if (!trimmed) {
    throw new Error('Enter a username or list link to open in Lizard.');
  }

  if (mode === 'watchlist') {
    let username = trimmed
      .replace(/^https?:\/\/(www\.)?letterboxd\.com\//i, '')
      .replace(/\/?watchlist\/?$/i, '')
      .replace(/\/$/, '')
      .replace(/^@/, '');
    if (!username) {
      throw new Error('Enter a valid Letterboxd username.');
    }
    username = username.split('/')[0];
    return {
      apiQuery: username,
      manualQuery: username,
      label: `${username}'s watchlist`
    };
  }

  const manualQuery = trimmed.replace(/^@/, '');
  const labelMatch = manualQuery.match(/letterboxd\.com\/([^?#]+)/i);
  const fallbackLabel = labelMatch ? labelMatch[1].replace(/\/$/, '') : manualQuery;

  return {
    apiQuery: manualQuery,
    manualQuery,
    label: fallbackLabel
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

      customEntryCounter = 0;

      allMovies = rows.slice(1).map((row, index) => {
        return {
          id: `${index}-${row[nameIndex]}`,
          name: row[nameIndex] ? row[nameIndex].trim() : 'Unknown title',
          year: yearIndex >= 0 && row[yearIndex] ? row[yearIndex].trim() : '',
          date: dateIndex >= 0 && row[dateIndex] ? row[dateIndex].trim() : '',
          uri: uriIndex >= 0 && row[uriIndex] ? row[uriIndex].trim() : ''
        };
      }).filter((movie) => movie.name);

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
    if (movie.fromLizard) parts.push('Imported via Lizard');
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
    isCustom: true
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

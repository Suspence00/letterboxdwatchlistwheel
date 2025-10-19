const csvInput = document.getElementById('csv-input');
const statusMessage = document.getElementById('status-message');
const movieListEl = document.getElementById('movie-list');
const spinButton = document.getElementById('spin-button');
const selectAllBtn = document.getElementById('select-all');
const clearSelectionBtn = document.getElementById('clear-selection');
const resultEl = document.getElementById('result');
const canvas = document.getElementById('wheel');
const ctx = canvas.getContext('2d');

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

drawEmptyWheel();

function handleFileUpload(event) {
  const file = event.target.files && event.target.files[0];
  if (!file) {
    return;
  }

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
  }

  if (!allMovies.length) {
    movieListEl.innerHTML = '<li class="empty">Upload a CSV to see your movies here.</li>';
    spinButton.disabled = true;
    drawEmptyWheel();
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
  ctx.save();
  ctx.translate(canvas.width / 2, canvas.height / 2);
  ctx.rotate(rotationAngle);

  selectedMovies.forEach((movie, index) => {
    const angle = index * arc;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.fillStyle = palette[index % palette.length];
    ctx.arc(0, 0, radius, angle, angle + arc);
    ctx.fill();

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
  const currentPointerAngle = (2 * Math.PI - ((rotationAngle % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI)) % (2 * Math.PI);
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
  const winningIndex = Math.floor(pointerAngle / arc) % selectedMovies.length;
  const winningMovie = selectedMovies[winningIndex];
  winnerId = winningMovie.id;
  highlightWinner();
  resultEl.innerHTML = `🎉 Next up: <strong>${winningMovie.name}</strong>${winningMovie.year ? ` (${winningMovie.year})` : ''}`;
  playWinSound();
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
  return (2 * Math.PI - normalized) % (2 * Math.PI);
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

window.addEventListener('beforeunload', () => {
  if (audioContext) {
    audioContext.close();
  }
});

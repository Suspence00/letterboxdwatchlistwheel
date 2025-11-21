/**
 * Import functionality for Letterboxd Watchlist Wheel
 */

import { appState, saveState } from './state.js';
import { getDefaultColorForIndex } from './utils.js';
import { updateMovieList, updateVetoButtonState, closeWinnerPopup } from './ui.js';

let elements = {};

export function initImport(domElements) {
    elements = domElements;

    if (elements.letterboxdProxyForm) {
        console.log('Attaching submit listener to letterboxdProxyForm');
        elements.letterboxdProxyForm.addEventListener('submit', handleLetterboxdProxyImport);
    }

    if (elements.csvInput) {
        elements.csvInput.addEventListener('change', handleFileUpload);
    }

    if (elements.importToggleBtn && elements.importCard && elements.importCardBody) {
        elements.importToggleBtn.addEventListener('click', () => {
            const willCollapse = !elements.importCard.classList.contains('card--collapsed');
            setImportCardCollapsed(willCollapse);
        });
    }
}

export function setImportCardCollapsed(collapsed) {
    if (!elements.importToggleBtn || !elements.importCard || !elements.importCardBody) {
        return;
    }

    elements.importCard.classList.toggle('card--collapsed', collapsed);
    elements.importCardBody.hidden = collapsed;
    elements.importToggleBtn.setAttribute('aria-expanded', String(!collapsed));
    elements.importToggleBtn.textContent = collapsed ? 'Show steps' : 'Hide steps';
}

async function handleLetterboxdProxyImport(event) {
    console.log('handleLetterboxdProxyImport triggered');
    event.preventDefault();

    const input = elements.letterboxdProxyInput;
    const status = elements.letterboxdProxyStatus;
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
        appState.movies = rows.slice(1).map((row, i) => {
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

        appState.selectedIds = new Set(appState.movies.map((m) => m.id));
        updateMovieList();
        updateVetoButtonState();
        setImportCardCollapsed(true);
        saveState();

        status.textContent = `Imported ${appState.movies.length} movies successfully!`;
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
        if (elements.statusMessage) elements.statusMessage.textContent = 'Please choose a CSV file exported from Letterboxd.';
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
                if (elements.statusMessage) elements.statusMessage.textContent = 'The CSV appears to be empty.';
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
                if (elements.statusMessage) elements.statusMessage.textContent = 'Could not find a title column in this CSV.';
                return;
            }

            const isLikelyLizardExport = header.some((h) => h.includes('letterboxduri'));

            appState.movies = rows
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

            if (!appState.movies.length) {
                if (elements.statusMessage) elements.statusMessage.textContent = 'No movies found in the CSV file.';
                return;
            }

            appState.knockoutResults.clear();
            appState.selectedIds = new Set(appState.movies.map((movie) => movie.id));

            if (elements.resultEl) elements.resultEl.textContent = '';
            if (elements.statusMessage) elements.statusMessage.textContent = `${appState.movies.length} movies imported. Ready to spin!`;
            updateMovieList();
            updateVetoButtonState();
            setImportCardCollapsed(true);
            saveState();
        } catch (error) {
            console.error(error);
            if (elements.statusMessage) elements.statusMessage.textContent = 'Something went wrong while reading the CSV.';
        }
    };
    reader.onerror = () => {
        if (elements.statusMessage) elements.statusMessage.textContent = 'Failed to read the file. Please try again.';
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
    let cells = [];

    const addCell = () => {
        current = current.replace(/\r/g, '');
        cells.push(current);
        current = '';
    };

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

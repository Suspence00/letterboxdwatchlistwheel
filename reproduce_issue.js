
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

const input = `Date,Name,Year,Letterboxd URI
2025-10-20,"A"" Nightmare on Elm Street Part 2: Freddy&#039;s Revenge",1985,https://boxd.it/1234`;

const rows = parseCSV(input);
console.log('Parsed Rows:', JSON.stringify(rows, null, 2));

const title = rows[1][1];
console.log('Title:', title);

if (title.includes('&#039;')) {
    console.log('FAIL: HTML entity not decoded');
} else {
    console.log('PASS: HTML entity decoded');
}

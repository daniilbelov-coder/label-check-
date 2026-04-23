import * as XLSX from 'xlsx';

const FILENAME_ROW_MARKER = 'название файла';

export function normalizeFileName(s) {
  if (s == null) return '';
  return String(s)
    .trim()
    .replace(/\.pdf$/i, '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ');
}

function normalizeLabel(s) {
  return String(s ?? '').trim().toLowerCase();
}

export function parseBrandSpec(bufferLike) {
  const wb = XLSX.read(bufferLike, { type: 'array' });
  const sheets = wb.SheetNames.map((name) => {
    const ws = wb.Sheets[name];
    if (!ws['!ref']) return { name, skipped: true, columns: [] };
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

    // Each "Название файла" row terminates a section. A sheet can have 1..N
    // such rows — one per packaging type (RL/GB/TB). Each (section, column)
    // pair produces one PDF spec.
    const filenameRowIdxs = rows
      .map((r, i) => (normalizeLabel(r[0]) === FILENAME_ROW_MARKER ? i : -1))
      .filter((i) => i >= 0);
    if (filenameRowIdxs.length === 0) return { name, skipped: true, columns: [] };

    const maxCol = Math.max(...rows.map((r) => r.length)) - 1;
    const columns = [];

    let sectionStart = 0;
    for (const fnRowIdx of filenameRowIdxs) {
      const filenameRow = rows[fnRowIdx];
      // Section attrs live in [sectionStart .. fnRowIdx - 1].
      for (let c = 2; c <= maxCol; c++) {
        const fileName = String(filenameRow[c] ?? '').trim();
        if (!fileName) continue;
        const attrs = [];
        for (let r = sectionStart; r < fnRowIdx; r++) {
          const label = String(rows[r][0] ?? '').trim();
          const value = String(rows[r][c] ?? '').trim();
          if (!label || !value) continue;
          attrs.push({ label, value });
        }
        columns.push({
          sheet: name,
          colIndex: c,
          fileName,
          fileNameNormalized: normalizeFileName(fileName),
          attrs,
        });
      }
      sectionStart = fnRowIdx + 1;
    }
    return { name, skipped: false, columns };
  });

  return { sheets };
}

export function matchPdfsToColumns(pdfNames, sheets) {
  const columnsByNormalized = new Map();
  const allColumns = [];
  for (const sheet of sheets) {
    for (const col of sheet.columns) {
      columnsByNormalized.set(col.fileNameNormalized, col);
      allColumns.push(col);
    }
  }
  const matches = new Map();
  const matchedCols = new Set();
  const unmatchedPdfs = [];
  for (const pdf of pdfNames) {
    const key = normalizeFileName(pdf);
    const col = columnsByNormalized.get(key);
    if (col) {
      matches.set(pdf, col);
      matchedCols.add(col);
    } else {
      unmatchedPdfs.push(pdf);
    }
  }
  const unmatchedColumns = allColumns.filter((c) => !matchedCols.has(c));
  return { matches, unmatchedColumns, unmatchedPdfs };
}

export function buildSpecText(col) {
  const header = `## Спека для ${col.fileName}\nSheet: ${col.sheet}\n`;
  const body = col.attrs.map((a) => `- ${a.label}: ${a.value}`).join('\n');
  return `${header}\n${body}\n`;
}

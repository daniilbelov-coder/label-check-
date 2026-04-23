import { describe, it, expect } from 'vitest';
import * as XLSX from 'xlsx';
import {
  normalizeFileName,
  parseBrandSpec,
  matchPdfsToColumns,
  buildSpecText,
} from '../services/xlsxSpecParser.js';

function makeWorkbook(sheetName: string, rows: (string | number)[][]): ArrayBuffer {
  const ws = XLSX.utils.aoa_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  return XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
}

describe('normalizeFileName', () => {
  it('strips .pdf suffix, lowercases, collapses whitespace', () => {
    expect(normalizeFileName('  Tuvio Blender THB05MPM  TB-01.PDF ')).toBe(
      'tuvio blender thb05mpm tb-01'
    );
  });
  it('handles names without extension', () => {
    expect(normalizeFileName('Foo Bar')).toBe('foo bar');
  });
});

describe('parseBrandSpec', () => {
  it('extracts columns using last-row filename detection', () => {
    const buf = makeWorkbook('Блендеры', [
      ['RL', '', '', ''],
      ['', 'МОДЕЛЬ', 'THB05MPM', 'THB06MFP'],
      ['Название', 'Название', 'Блендер', 'Блендер 2'],
      ['Мощность', '___ Вт', '1800 Вт', '1900 Вт'],
      ['Название файла', 'Tuvio NN01 TB-01', 'Tuvio THB05MPM TB-01', 'Tuvio THB06MFP TB-01'],
    ]);
    const result = parseBrandSpec(new Uint8Array(buf));
    expect(result.sheets).toHaveLength(1);
    const sheet = result.sheets[0];
    expect(sheet.name).toBe('Блендеры');
    expect(sheet.columns).toHaveLength(2);
    expect(sheet.columns[0].fileName).toBe('Tuvio THB05MPM TB-01');
    expect(sheet.columns[0].attrs).toEqual(
      expect.arrayContaining([
        { label: 'Название', value: 'Блендер' },
        { label: 'Мощность', value: '1800 Вт' },
      ])
    );
  });

  it('skips sheets without filename row', () => {
    const buf = makeWorkbook('Sheet2', [
      ['a', 'b'],
      ['c', 'd'],
    ]);
    const result = parseBrandSpec(new Uint8Array(buf));
    expect(result.sheets[0].columns).toHaveLength(0);
    expect(result.sheets[0].skipped).toBe(true);
  });

  it('ignores columns with empty filename cell', () => {
    const buf = makeWorkbook('X', [
      ['Название', '', 'A', 'B'],
      ['Название файла', '', 'Tuvio A RL-01', ''],
    ]);
    const result = parseBrandSpec(new Uint8Array(buf));
    expect(result.sheets[0].columns).toHaveLength(1);
    expect(result.sheets[0].columns[0].fileName).toBe('Tuvio A RL-01');
  });

  it('emits one column per (section, model) when sheet has multiple Название файла rows', () => {
    const buf = makeWorkbook('Пылесосы', [
      ['Мощность', '___ Вт', '350 Вт', '650 Вт'],
      ['Название файла', 'RL tmpl', 'Tuvio Vacuum TVC08S RL-01', 'Tuvio Vacuum TVC13S RL-01'],
      ['Страна', 'Сделано в Китае', 'Сделано в Китае', 'Сделано в Китае'],
      ['Название файла', 'GB tmpl', 'Tuvio Vacuum TVC08S GB-01', 'Tuvio Vacuum TVC13S GB-01'],
      ['Вес', '___ кг', '3 кг', '4 кг'],
      ['Название файла', 'TB tmpl', 'Tuvio Vacuum TVC08S TB-01', 'Tuvio Vacuum TVC13S TB-01'],
    ]);
    const result = parseBrandSpec(new Uint8Array(buf));
    const cols = result.sheets[0].columns;
    expect(cols).toHaveLength(6);
    const byName = new Map(cols.map((c) => [c.fileName, c]));
    expect(byName.get('Tuvio Vacuum TVC08S RL-01')?.attrs).toEqual([
      { label: 'Мощность', value: '350 Вт' },
    ]);
    expect(byName.get('Tuvio Vacuum TVC08S GB-01')?.attrs).toEqual([
      { label: 'Страна', value: 'Сделано в Китае' },
    ]);
    expect(byName.get('Tuvio Vacuum TVC08S TB-01')?.attrs).toEqual([
      { label: 'Вес', value: '3 кг' },
    ]);
  });
});

describe('matchPdfsToColumns', () => {
  const sheets = [{
    name: 'X',
    skipped: false,
    columns: [
      {
        sheet: 'X', colIndex: 2,
        fileName: 'Tuvio Blender THB05MPM TB-01',
        fileNameNormalized: 'tuvio blender thb05mpm tb-01',
        attrs: [{ label: 'Название', value: 'Блендер' }],
      },
      {
        sheet: 'X', colIndex: 3,
        fileName: 'Tuvio Blender THB06MFP TB-01',
        fileNameNormalized: 'tuvio blender thb06mfp tb-01',
        attrs: [{ label: 'Название', value: 'Блендер 2' }],
      },
    ],
  }];

  it('matches case-insensitively with whitespace normalization', () => {
    const { matches, unmatchedColumns, unmatchedPdfs } = matchPdfsToColumns(
      ['tuvio   blender  THB05MPM tb-01.pdf', 'unknown.pdf'],
      sheets,
    );
    expect(matches.get('tuvio   blender  THB05MPM tb-01.pdf')?.colIndex).toBe(2);
    expect(matches.has('unknown.pdf')).toBe(false);
    expect(unmatchedPdfs).toContain('unknown.pdf');
    expect(unmatchedColumns.map(c => c.colIndex)).toEqual([3]);
  });
});

describe('buildSpecText', () => {
  it('produces markdown with sheet + attr list', () => {
    const col = {
      sheet: 'Блендеры', colIndex: 2,
      fileName: 'Tuvio THB05MPM TB-01',
      fileNameNormalized: 'tuvio thb05mpm tb-01',
      attrs: [
        { label: 'Название', value: 'Блендер' },
        { label: 'Мощность', value: '1800 Вт' },
      ],
    };
    const text = buildSpecText(col);
    expect(text).toContain('Sheet: Блендеры');
    expect(text).toContain('- Название: Блендер');
    expect(text).toContain('- Мощность: 1800 Вт');
  });
});

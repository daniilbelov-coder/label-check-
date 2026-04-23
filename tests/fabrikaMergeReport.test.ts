import { describe, it, expect } from 'vitest';
import { fabrikaMergeReport, parseSignRaw } from '../utils/fabrikaMergeReport';

describe('parseSignRaw', () => {
  it('parses a clean JSON payload', () => {
    const raw = '{"found": true, "confidence": "high", "location": "стр. 2", "notes": null}';
    expect(parseSignRaw(raw)).toEqual({
      signName: null,
      found: true,
      confidence: 'high',
      location: 'стр. 2',
      notes: null,
    });
  });

  it('parses signName when model returns it', () => {
    const raw = '{"signName": "знак EAC", "found": true, "confidence": "high", "location": "стр. 1", "notes": null}';
    expect(parseSignRaw(raw).signName).toBe('знак EAC');
  });

  it('parses JSON wrapped in markdown code fence', () => {
    const raw = '```json\n{"found": false, "confidence": "medium", "location": null, "notes": "не видно"}\n```';
    expect(parseSignRaw(raw)).toEqual({
      signName: null,
      found: false,
      confidence: 'medium',
      location: null,
      notes: 'не видно',
    });
  });

  it('returns an unparsed fallback when JSON is missing', () => {
    const result = parseSignRaw('модель ничего не вернула');
    expect(result.found).toBe(false);
    expect(result.confidence).toBe('low');
    expect(result.notes).toContain('модель ничего не вернула');
  });
});

describe('fabrikaMergeReport', () => {
  it('appends a signs section at the end of the main report', () => {
    const mainMd = '## Проверенный макет\n\nОшибок не найдено.';
    const signs = [
      { name: 'image4.png', raw: '{"found": true, "confidence": "high", "location": "стр. 1", "notes": null}' },
      { name: 'image6.png', raw: '{"found": false, "confidence": "medium", "location": null, "notes": "не найден"}' },
    ];

    const merged = fabrikaMergeReport(mainMd, signs);

    expect(merged).toContain('## Проверенный макет');
    expect(merged).toContain('## Знаки манипуляции (детальная сверка)');
    expect(merged).toContain('✅ image4.png');
    expect(merged).toContain('❌ image6.png');
    expect(merged).toContain('стр. 1');
    expect(merged).toContain('не найден');
  });

  it('prefers signName over the raw filename when present', () => {
    const signs = [
      { name: 'image4.png', raw: '{"signName": "знак EAC", "found": true, "confidence": "high", "location": "стр. 1", "notes": null}' },
    ];
    const merged = fabrikaMergeReport('# Отчёт', signs);
    expect(merged).toContain('✅ знак EAC');
    expect(merged).not.toMatch(/✅ image4\.png/);
  });

  it('uses the warning marker for low confidence', () => {
    const signs = [
      { name: 'image9.png', raw: '{"found": true, "confidence": "low", "location": "возможно стр. 3", "notes": "силуэт размыт"}' },
    ];
    const merged = fabrikaMergeReport('# Отчёт', signs);
    expect(merged).toContain('⚠️ image9.png');
    expect(merged).toContain('силуэт размыт');
  });

  it('returns the main report unchanged when signs array is empty', () => {
    const main = '# Отчёт';
    expect(fabrikaMergeReport(main, [])).toBe(main);
  });
});

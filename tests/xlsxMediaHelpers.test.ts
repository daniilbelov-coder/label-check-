import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { extractXlsxMediaFromBuffer } from '../utils/xlsxMediaHelpers';

const sampleXlsx = '/Users/dmi4er4/project_graveyard/label-check-/некорректная маркировка примеры/SDA+Beauty/15.xlsx';

describe('extractXlsxMediaFromBuffer', () => {
  it('returns all images from xl/media when no filter is passed', async () => {
    const buf = readFileSync(sampleXlsx);
    const media = await extractXlsxMediaFromBuffer(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));

    expect(media.length).toBeGreaterThan(10);
    expect(media.every(m => m.name.startsWith('image'))).toBe(true);
    expect(media.every(m => m.dataUrl.startsWith('data:image/'))).toBe(true);
  });

  it('filters out images larger than the maxSizeBytes threshold', async () => {
    const buf = readFileSync(sampleXlsx);
    const media = await extractXlsxMediaFromBuffer(
      buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength),
      { maxSizeBytes: 10_000 }
    );

    expect(media.every(m => m.sizeBytes <= 10_000)).toBe(true);
    expect(media.length).toBeGreaterThan(0);
    expect(media.length).toBeLessThan(15);
  });
});

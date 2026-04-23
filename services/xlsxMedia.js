import JSZip from 'jszip';

const EXT_MIME = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  bmp: 'image/bmp',
};

/**
 * Extract all embedded images from an XLSX buffer.
 *
 * @param {Buffer | Uint8Array | ArrayBuffer} data
 * @param {{ maxSizeBytes?: number, minSizeBytes?: number }} options
 * @returns {Promise<Array<{ name: string, dataUrl: string, sizeBytes: number, mime: string }>>}
 */
export async function extractXlsxMediaFromBuffer(data, options = {}) {
  const { maxSizeBytes = Infinity, minSizeBytes = 0 } = options;
  const zip = await JSZip.loadAsync(data);
  const items = [];
  for (const fullPath of Object.keys(zip.files)) {
    if (!fullPath.startsWith('xl/media/')) continue;
    const entry = zip.files[fullPath];
    if (entry.dir) continue;
    const raw = await entry.async('uint8array');
    const sizeBytes = raw.byteLength;
    if (sizeBytes < minSizeBytes || sizeBytes > maxSizeBytes) continue;
    const name = fullPath.substring('xl/media/'.length);
    const ext = (name.split('.').pop() ?? '').toLowerCase();
    const mime = EXT_MIME[ext];
    if (!mime) continue;
    const b64 = Buffer.from(raw).toString('base64');
    items.push({ name, dataUrl: `data:${mime};base64,${b64}`, sizeBytes, mime });
  }
  items.sort((a, b) => a.name.localeCompare(b.name, 'en', { numeric: true }));
  return items;
}

/**
 * Fabrika-specific sign extraction — small pictograms live in the
 * 200..10000 byte range; everything else is photos/logos, ignore.
 */
export async function extractFabrikaSigns(data) {
  return extractXlsxMediaFromBuffer(data, { minSizeBytes: 200, maxSizeBytes: 10000 });
}

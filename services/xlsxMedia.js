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

// ---------- Per-cell sign anchoring ----------

function basename(p) { return p.replace(/\\/g, '/').split('/').pop() || ''; }
function joinXlsxPath(from, target) {
  // from is the rels-file container (xl/worksheets/_rels/sheet1.xml.rels),
  // target is relative to the file the rels describe (xl/worksheets/sheet1.xml).
  const base = from.replace(/\/_rels\/[^/]+\.rels$/, '');
  const parts = base.split('/');
  for (const seg of target.split('/')) {
    if (seg === '..') parts.pop();
    else if (seg !== '.') parts.push(seg);
  }
  return parts.join('/');
}
function parseRels(xml) {
  const rels = new Map();
  for (const m of xml.matchAll(/<Relationship\b[^>]*Id="([^"]+)"[^>]*Target="([^"]+)"/g)) {
    rels.set(m[1], m[2]);
  }
  return rels;
}

/**
 * Read image anchors out of an XLSX and return per-sheet, per-cell locations.
 *
 * Each returned item has the zero-indexed anchor column + row, the
 * image filename (matches an entry in xl/media/), and the image data URL.
 * Anchors without a resolvable image are skipped.
 *
 * @param {Buffer | Uint8Array | ArrayBuffer} data
 * @param {{ minSizeBytes?: number, maxSizeBytes?: number }} opts
 * @returns {Promise<Map<string, Array<{ col: number, row: number, imageName: string, dataUrl: string, sizeBytes: number }>>>}
 */
export async function extractSignsByCell(data, opts = {}) {
  const { minSizeBytes = 200, maxSizeBytes = 10000 } = opts;
  const zip = await JSZip.loadAsync(data);
  const read = async (p) => {
    const f = zip.file(p);
    return f ? f.async('string') : null;
  };

  // 1. Load image bytes once into a map by media filename.
  const mediaByName = new Map();
  for (const fullPath of Object.keys(zip.files)) {
    if (!fullPath.startsWith('xl/media/')) continue;
    const entry = zip.files[fullPath];
    if (entry.dir) continue;
    const raw = await entry.async('uint8array');
    const size = raw.byteLength;
    if (size < minSizeBytes || size > maxSizeBytes) continue;
    const name = basename(fullPath);
    const ext = (name.split('.').pop() || '').toLowerCase();
    const mime = EXT_MIME[ext];
    if (!mime) continue;
    mediaByName.set(name, {
      dataUrl: `data:${mime};base64,${Buffer.from(raw).toString('base64')}`,
      sizeBytes: size,
    });
  }

  // 2. Map sheet display name → sheet XML path.
  const workbookXml = await read('xl/workbook.xml');
  const workbookRels = await read('xl/_rels/workbook.xml.rels');
  if (!workbookXml || !workbookRels) return new Map();
  const wbRels = parseRels(workbookRels);
  const sheetNameToPath = new Map();
  for (const m of workbookXml.matchAll(/<sheet\b[^>]*name="([^"]+)"[^>]*r:id="([^"]+)"/g)) {
    const target = wbRels.get(m[2]);
    if (!target) continue;
    sheetNameToPath.set(m[1], joinXlsxPath('xl/_rels/workbook.xml.rels', target));
  }

  const result = new Map();
  for (const [sheetName, sheetPath] of sheetNameToPath) {
    const sheetXml = await read(sheetPath);
    if (!sheetXml) continue;
    const drawingRef = /<drawing\b[^>]*r:id="([^"]+)"/.exec(sheetXml);
    if (!drawingRef) { result.set(sheetName, []); continue; }

    const sheetRelsPath = sheetPath.replace(/([^/]+)$/, '_rels/$1.rels');
    const sheetRelsXml = await read(sheetRelsPath);
    if (!sheetRelsXml) { result.set(sheetName, []); continue; }
    const drawingTarget = parseRels(sheetRelsXml).get(drawingRef[1]);
    if (!drawingTarget) { result.set(sheetName, []); continue; }
    const drawingPath = joinXlsxPath(sheetRelsPath, drawingTarget);
    const drawingXml = await read(drawingPath);
    const drawingRelsXml = await read(drawingPath.replace(/([^/]+)$/, '_rels/$1.rels'));
    if (!drawingXml || !drawingRelsXml) { result.set(sheetName, []); continue; }
    const drawingRels = parseRels(drawingRelsXml);

    const items = [];
    for (const m of drawingXml.matchAll(
      /<xdr:(one|two)CellAnchor\b[\s\S]*?<\/xdr:\1CellAnchor>/g
    )) {
      const anchor = m[0];
      const from = /<xdr:from>[\s\S]*?<xdr:col>(\d+)<\/xdr:col>[\s\S]*?<xdr:row>(\d+)<\/xdr:row>/.exec(anchor);
      const embed = /<a:blip\b[^>]*r:embed="([^"]+)"/.exec(anchor);
      if (!from || !embed) continue;
      const col = +from[1]; // 0-indexed
      const row = +from[2]; // 0-indexed
      const imageTarget = drawingRels.get(embed[1]);
      if (!imageTarget) continue;
      const imageName = basename(imageTarget);
      const media = mediaByName.get(imageName);
      if (!media) continue;
      items.push({ col, row, imageName, dataUrl: media.dataUrl, sizeBytes: media.sizeBytes });
    }
    items.sort((a, b) => a.row - b.row || a.col - b.col);
    result.set(sheetName, items);
  }
  return result;
}

import { createCanvas } from '@napi-rs/canvas';

// pdfjs-dist 4.x legacy build ships as ESM (.mjs) — require() is not usable.
// Use a lazily-resolved dynamic import cached at module level so the heavy
// pdfjs bundle is only loaded once per process.
let _pdfjsPromise = null;
function getPdfjs() {
  if (!_pdfjsPromise) {
    _pdfjsPromise = import('pdfjs-dist/legacy/build/pdf.mjs').then((mod) => {
      // pdfjs 4.x detects isNodeJS automatically and sets #isWorkerDisabled=true.
      // No workerSrc assignment needed (it only accepts strings and Node doesn't
      // use the web worker path anyway).
      return mod.default ?? mod;
    });
  }
  return _pdfjsPromise;
}

/**
 * Rasterise every page of a PDF buffer to a data URI.
 *
 * @param {Uint8Array | Buffer} pdfBuffer
 * @param {{ dpi?: number, maxPages?: number, format?: 'png' | 'jpeg', quality?: number }} opts
 * @returns {Promise<string[]>}  per-page data URIs
 */
export async function rasterizePdfBuffer(pdfBuffer, opts = {}) {
  const dpi = opts.dpi ?? 150;
  const maxPages = opts.maxPages ?? 10;
  const format = opts.format ?? 'jpeg';
  const quality = opts.quality ?? 0.85;
  const scale = dpi / 72;

  const pdfjs = await getPdfjs();

  // pdfjs 4.x rejects Node Buffer instances (even though Buffer extends Uint8Array).
  // Copy into a plain Uint8Array so the instanceof Buffer check in pdfjs passes cleanly.
  const data = new Uint8Array(
    pdfBuffer.buffer,
    pdfBuffer.byteOffset,
    pdfBuffer.byteLength,
  );

  const loadingTask = pdfjs.getDocument({
    data,
    useWorkerFetch: false,
    isEvalSupported: false,
  });
  const doc = await loadingTask.promise;

  const pageCount = Math.min(doc.numPages, maxPages);
  const pages = [];

  for (let i = 1; i <= pageCount; i++) {
    const page = await doc.getPage(i);
    const viewport = page.getViewport({ scale });
    const canvas = createCanvas(
      Math.ceil(viewport.width),
      Math.ceil(viewport.height),
    );
    const ctx = canvas.getContext('2d');
    // White background so JPEG doesn't render PDF transparency as black.
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    // @napi-rs/canvas exposes a DOM-compatible 2d context that pdfjs accepts.
    await page.render({ canvasContext: ctx, viewport, canvasFactory: null })
      .promise;
    const buf = format === 'jpeg'
      ? canvas.toBuffer('image/jpeg', Math.round(quality * 100))
      : canvas.toBuffer('image/png');
    const mime = format === 'jpeg' ? 'image/jpeg' : 'image/png';
    pages.push(`data:${mime};base64,${buf.toString('base64')}`);
    page.cleanup();
  }

  await doc.cleanup();
  await doc.destroy();

  return pages;
}

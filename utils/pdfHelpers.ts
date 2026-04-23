import * as pdfjsLib from 'pdfjs-dist';
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

export interface RasterizeOptions {
  dpi?: number;
  maxPages?: number;
  format?: 'png' | 'jpeg';
  quality?: number;
}

export async function rasterizePdf(
  file: File,
  options: RasterizeOptions = {}
): Promise<string[]> {
  const { dpi = 150, maxPages = 10, format = 'png', quality = 0.92 } = options;
  const scale = dpi / 72;

  const buf = await file.arrayBuffer();
  const loadingTask = pdfjsLib.getDocument({ data: buf });
  const pdf = await loadingTask.promise;

  const pageCount = Math.min(pdf.numPages, maxPages);
  const pages: string[] = [];

  try {
    for (let i = 1; i <= pageCount; i++) {
      const page = await pdf.getPage(i);
      const viewport = page.getViewport({ scale });
      const canvas = document.createElement('canvas');
      canvas.width = Math.ceil(viewport.width);
      canvas.height = Math.ceil(viewport.height);
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Canvas 2D context unavailable');

      await page.render({ canvasContext: ctx, viewport }).promise;

      const mime = format === 'jpeg' ? 'image/jpeg' : 'image/png';
      const dataUrl = format === 'jpeg' ? canvas.toDataURL(mime, quality) : canvas.toDataURL(mime);
      pages.push(dataUrl);

      page.cleanup();
      canvas.width = 0;
      canvas.height = 0;
    }
  } finally {
    await pdf.destroy();
  }

  return pages;
}

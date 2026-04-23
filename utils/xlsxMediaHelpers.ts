import JSZip from 'jszip';

export interface XlsxMediaItem {
  name: string;
  dataUrl: string;
  sizeBytes: number;
  mime: string;
}

export interface ExtractOptions {
  maxSizeBytes?: number;
  minSizeBytes?: number;
}

const EXT_MIME: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  bmp: 'image/bmp',
};

function arrayBufferToBase64(buf: Uint8Array): string {
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < buf.length; i += chunk) {
    binary += String.fromCharCode(...buf.subarray(i, i + chunk));
  }
  return btoa(binary);
}

export async function extractXlsxMediaFromBuffer(
  data: ArrayBuffer,
  options: ExtractOptions = {}
): Promise<XlsxMediaItem[]> {
  const { maxSizeBytes = Infinity, minSizeBytes = 0 } = options;

  const zip = await JSZip.loadAsync(data);
  const items: XlsxMediaItem[] = [];

  const fileNames = Object.keys(zip.files).filter(n => n.startsWith('xl/media/'));
  for (const fullPath of fileNames) {
    const entry = zip.files[fullPath];
    if (entry.dir) continue;

    const raw = await entry.async('uint8array');
    const sizeBytes = raw.byteLength;
    if (sizeBytes < minSizeBytes || sizeBytes > maxSizeBytes) continue;

    const name = fullPath.substring('xl/media/'.length);
    const ext = name.split('.').pop()?.toLowerCase() ?? '';
    const mime = EXT_MIME[ext];
    if (!mime) continue;

    const b64 = arrayBufferToBase64(raw);
    items.push({
      name,
      dataUrl: `data:${mime};base64,${b64}`,
      sizeBytes,
      mime,
    });
  }

  items.sort((a, b) => a.name.localeCompare(b.name, 'en', { numeric: true }));
  return items;
}

export async function extractXlsxMedia(
  file: File,
  options: ExtractOptions = {}
): Promise<XlsxMediaItem[]> {
  const buf = await file.arrayBuffer();
  return extractXlsxMediaFromBuffer(buf, options);
}

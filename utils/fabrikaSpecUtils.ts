import type { FabrikaSpecColumn, FabrikaSpecGroup } from '../types';

// Dynamically import parseBrandSpec to avoid bundling issues with server-only code paths.
// In practice Vite bundles the whole xlsxSpecParser (xlsx is already in deps).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _parseBrandSpec: ((buf: Uint8Array) => { sheets: any[] }) | null = null;
async function getParseBrandSpec() {
  if (!_parseBrandSpec) {
    const mod = await import('../services/xlsxSpecParser.js');
    _parseBrandSpec = mod.parseBrandSpec;
  }
  return _parseBrandSpec;
}

const PKG_TYPE_RE = /\b(RL|GB|MB|TB)\b/i;

function extractPkgType(fileName: string): string {
  const m = fileName.match(PKG_TYPE_RE);
  return m ? m[1].toUpperCase() : '?';
}

function extractModelName(attrs: Array<{ label: string; value: string }>, fileName: string): string {
  // Try common Russian/English label variants for the model field
  const modelAttr = attrs.find((a) =>
    /^(модель|model|артикул|article|sku)$/i.test(a.label.trim()),
  );
  if (modelAttr?.value?.trim()) return modelAttr.value.trim();

  // Fallback: grab an uppercase+digits token from the filename (e.g. TAF06)
  const m = fileName.match(/[A-Z]{2,}\d+/);
  return m ? m[0] : fileName.replace(/\.pdf$/i, '');
}

export async function parseXlsxForPreview(file: File): Promise<FabrikaSpecGroup[]> {
  const parseBrandSpec = await getParseBrandSpec();
  const buffer = await file.arrayBuffer();
  const { sheets } = parseBrandSpec(new Uint8Array(buffer));

  const columns: FabrikaSpecColumn[] = [];
  for (const sheet of sheets) {
    if (sheet.skipped) continue;
    for (const col of sheet.columns) {
      columns.push({
        sheet: col.sheet,
        colIndex: col.colIndex,
        fileName: col.fileName,
        fileNameNormalized: col.fileNameNormalized,
        modelName: extractModelName(col.attrs, col.fileName),
        pkgType: extractPkgType(col.fileName),
        key: `${col.sheet}::${col.colIndex}`,
      });
    }
  }

  // Group by modelName, preserving insertion order
  const groupMap = new Map<string, FabrikaSpecGroup>();
  for (const col of columns) {
    if (!groupMap.has(col.modelName)) {
      groupMap.set(col.modelName, { modelName: col.modelName, columns: [] });
    }
    groupMap.get(col.modelName)!.columns.push(col);
  }

  return Array.from(groupMap.values());
}

export async function bundlePdfsAsZip(files: File[]): Promise<File> {
  const JSZip = (await import('jszip')).default;
  const zip = new JSZip();
  for (const f of files) {
    zip.file(f.name, await f.arrayBuffer());
  }
  const blob = await zip.generateAsync({ type: 'blob', compression: 'STORE' });
  return new File([blob], 'upload.zip', { type: 'application/zip' });
}

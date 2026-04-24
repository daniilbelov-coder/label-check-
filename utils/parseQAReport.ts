export interface DiscrepancyItem {
  title: string;
  description: string;
  inLayout?: string;
  inSpec?: string;
}

export interface ParsedQAReport {
  model: string;
  packageType: string;
  specColumn: string;
  critical: DiscrepancyItem[];
  significant: DiscrepancyItem[];
  minor: DiscrepancyItem[];
  signs: string[];
  missingInLayout: string[];
  extraInLayout: string[];
  verdict: string;
  criticalCount: number;
  significantCount: number;
  minorCount: number;
}

function collectSection(lines: string[], heading: RegExp): string[] {
  let inside = false;
  const out: string[] = [];
  for (const l of lines) {
    if (/^##\s/.test(l)) {
      inside = heading.test(l);
      continue;
    }
    if (inside) out.push(l);
  }
  return out;
}

function parseBullets(lines: string[]): DiscrepancyItem[] {
  const items: DiscrepancyItem[] = [];
  for (const l of lines) {
    const raw = l.replace(/^[-*•]\s*/, '').trim();
    if (!raw) continue;
    if (/расхождений не обнаружено|не обнаружены|отсутствуют расхождения/i.test(raw)) continue;

    const boldMatch = raw.match(/^\*\*(.+?)\*\*\s*[:：]\s*([\s\S]+)/);
    const title = boldMatch ? boldMatch[1].trim() : '';
    const description = boldMatch ? boldMatch[2].trim() : raw;

    // Extract «в макете X, в ТЗ Y» — handles backticks, guillemets, plain
    const comp = description.match(
      /в макете\s*[`«"']?([^`»"'\n,;]+?)[`»"']?\s*[,;]\s*в ТЗ\s*[`«"']?([^`»"'\n(]+?)[`»"']?(?:\s*[([\n]|$)/i
    );

    items.push({
      title,
      description,
      inLayout: comp?.[1]?.trim(),
      inSpec: comp?.[2]?.trim(),
    });
  }
  return items;
}

function metaValue(lines: string[], ...labels: string[]): string {
  for (const lbl of labels) {
    const l = lines.find(x => x.trim().toLowerCase().startsWith(lbl.toLowerCase() + ':'));
    if (l) return l.slice(l.indexOf(':') + 1).trim().replace(/^\[|\]$/g, '');
  }
  return '';
}

export function parseQAReport(md: string): ParsedQAReport | null {
  if (!md?.trim()) return null;

  const clean = md.split(/\n##\s+Знаки манипуляции/)[0];
  const lines = clean.split('\n');

  const metaLines = collectSection(lines, /Проверенный макет/i);
  const model = metaValue(metaLines, 'Модель', 'Model');
  const packageType = metaValue(metaLines, 'Тип упаковки', 'Package type');
  const specColumn = metaValue(
    metaLines,
    'Сверено со столбцом ТЗ',
    'Сверено со спецификацией',
    'Сверено',
  );

  const critical = parseBullets(collectSection(lines, /Критические расхождения/i));
  const significant = parseBullets(collectSection(lines, /Значимые расхождения/i));
  const minor = parseBullets(collectSection(lines, /Незначительные расхождения/i));

  const toList = (sLines: string[]) =>
    sLines.map(l => l.replace(/^[-*•]\s*/, '').trim()).filter(Boolean);

  const signs = toList(collectSection(lines, /Знаки и изображения/i));

  const missingRaw = toList(collectSection(lines, /Поля, отсутствующие в макете/i));
  const missingInLayout = missingRaw.filter(l => !/^все.*поля.*присутствуют/i.test(l));

  const extraInLayout = toList(collectSection(lines, /Поля на макете, отсутствующие в ТЗ/i));

  const итогLines = collectSection(lines, /^##\s+Итог\s*$/i);
  const итог = итогLines.join('\n');
  const verdict = (итог.match(/Вердикт[:\s]+\[?(.+?)\]?\s*$/im)?.[1] ?? '').trim();
  const criticalCount =
    parseInt(итог.match(/критических ошибок[:\s]+(\d+)/i)?.[1] ?? '', 10) || critical.length;
  const significantCount =
    parseInt(итог.match(/значимых[:\s]+(\d+)/i)?.[1] ?? '', 10) || significant.length;
  const minorCount =
    parseInt(итог.match(/незначительных[:\s]+(\d+)/i)?.[1] ?? '', 10) || minor.length;

  return {
    model, packageType, specColumn,
    critical, significant, minor,
    signs, missingInLayout, extraInLayout,
    verdict, criticalCount, significantCount, minorCount,
  };
}

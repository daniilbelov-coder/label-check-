export interface SignResult {
  found: boolean;
  confidence: 'high' | 'medium' | 'low';
  location: string | null;
  notes: string | null;
}

export interface SignRawResult {
  name: string;
  raw: string;
}

const CONFIDENCE_VALUES: ReadonlyArray<SignResult['confidence']> = ['high', 'medium', 'low'];

function normalizeConfidence(value: unknown): SignResult['confidence'] {
  return CONFIDENCE_VALUES.includes(value as SignResult['confidence'])
    ? (value as SignResult['confidence'])
    : 'low';
}

export function parseSignRaw(raw: string): SignResult {
  const fenceMatch = raw.match(/```json\s*([\s\S]*?)\s*```/);
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  const candidate = fenceMatch ? fenceMatch[1] : jsonMatch ? jsonMatch[0] : null;

  if (candidate) {
    try {
      const parsed = JSON.parse(candidate);
      return {
        found: Boolean(parsed.found),
        confidence: normalizeConfidence(parsed.confidence),
        location: parsed.location ?? null,
        notes: parsed.notes ?? null,
      };
    } catch {
      // fall through to fallback
    }
  }

  return {
    found: false,
    confidence: 'low',
    location: null,
    notes: `Не удалось распарсить ответ модели: ${raw.slice(0, 200)}`,
  };
}

function markerFor(res: SignResult): string {
  if (!res.found) return '❌';
  if (res.confidence === 'low') return '⚠️';
  return '✅';
}

function renderLine(name: string, res: SignResult): string {
  const bits: string[] = [`${markerFor(res)} ${name}`];
  if (res.found) {
    bits.push(res.location ? `найден (${res.location})` : 'найден');
  } else {
    bits.push('не найден');
  }
  const tailParts: string[] = [];
  if (res.confidence === 'low') tailParts.push(`confidence: ${res.confidence}`);
  if (res.notes) tailParts.push(res.notes);
  if (tailParts.length > 0) bits.push(tailParts.join(' — '));
  return `- ${bits.join(' — ')}`;
}

export function fabrikaMergeReport(mainMd: string, signs: SignRawResult[]): string {
  if (signs.length === 0) return mainMd;

  const lines = signs.map(s => renderLine(s.name, parseSignRaw(s.raw)));
  const section = ['', '## Знаки манипуляции (детальная сверка)', '', ...lines, ''].join('\n');

  return `${mainMd.trimEnd()}\n${section}`;
}

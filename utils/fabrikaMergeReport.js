function normalizeConfidence(value) {
  return value === 'high' || value === 'medium' || value === 'low' ? value : 'low';
}

export function parseSignRaw(raw) {
  const fenceMatch = String(raw).match(/```json\s*([\s\S]*?)\s*```/);
  const jsonMatch = String(raw).match(/\{[\s\S]*\}/);
  const candidate = fenceMatch ? fenceMatch[1] : jsonMatch ? jsonMatch[0] : null;
  if (candidate) {
    try {
      const parsed = JSON.parse(candidate);
      return {
        signName: typeof parsed.signName === 'string' && parsed.signName.trim() ? parsed.signName.trim() : null,
        found: Boolean(parsed.found),
        confidence: normalizeConfidence(parsed.confidence),
        location: parsed.location ?? null,
        notes: parsed.notes ?? null,
      };
    } catch { /* fall through */ }
  }
  return {
    signName: null,
    found: false,
    confidence: 'low',
    location: null,
    notes: `Не удалось распарсить ответ модели: ${String(raw).slice(0, 200)}`,
  };
}

export function fabrikaMergeReport(mainMd, signs) {
  if (!signs || signs.length === 0) return mainMd;
  const lines = signs.map(({ name, raw }) => {
    const r = parseSignRaw(raw);
    const marker = !r.found ? '❌' : r.confidence === 'low' ? '⚠️' : '✅';
    const label = r.signName || name;
    const base = r.found ? (r.location ? `найден (${r.location})` : 'найден') : 'не найден';
    const tailParts = [];
    if (r.confidence === 'low') tailParts.push(`confidence: ${r.confidence}`);
    if (r.notes) tailParts.push(r.notes);
    const tail = tailParts.length ? ' — ' + tailParts.join(' — ') : '';
    return `- ${marker} ${label} — ${base}${tail}`;
  });
  return `${mainMd.trimEnd()}\n\n## Знаки манипуляции (детальная сверка)\n\n${lines.join('\n')}\n`;
}

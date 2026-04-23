import type { FabrikaJobSettings } from '../types';

const KEY = 'fabrika:settings';

export function loadSettings(): FabrikaJobSettings {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    const out: FabrikaJobSettings = {};
    if (typeof parsed.modelId === 'string') out.modelId = parsed.modelId;
    if (typeof parsed.qaSystemPrompt === 'string') out.qaSystemPrompt = parsed.qaSystemPrompt;
    if (typeof parsed.signCheckPrompt === 'string') out.signCheckPrompt = parsed.signCheckPrompt;
    return out;
  } catch {
    return {};
  }
}

export function saveSettings(s: FabrikaJobSettings): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(KEY, JSON.stringify(s));
}

export function resetSettings(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(KEY);
}

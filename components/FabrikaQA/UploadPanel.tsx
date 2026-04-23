import React, { useEffect, useState } from 'react';
import type { FabrikaJobSettings, FabrikaPromptDefaults } from '../../types';
import { getPromptDefaults } from '../../services/fabrikaClient';
import { loadSettings, saveSettings, resetSettings } from '../../utils/fabrikaSettings';

// Vision-capable model IDs — keep in sync with config/modelConfig.js.
const VISION_MODELS: { id: string; label: string }[] = [
  { id: 'gemini-3-flash', label: 'Google Gemini 3 Flash (default)' },
  { id: 'gemini-2.5-flash', label: 'Google Gemini 2.5 Flash' },
  { id: 'gpt-5-structured', label: 'OpenAI GPT-5 Structured' },
];

type Props = {
  onSubmit: (xlsx: File, zip: File, settings: FabrikaJobSettings) => void;
  disabled?: boolean;
};

export function UploadPanel({ onSubmit, disabled }: Props) {
  const [xlsx, setXlsx] = useState<File | null>(null);
  const [zip, setZip] = useState<File | null>(null);
  const [settings, setSettings] = useState<FabrikaJobSettings>({});
  const [defaults, setDefaults] = useState<FabrikaPromptDefaults | null>(null);
  const [advancedOpen, setAdvancedOpen] = useState(false);

  useEffect(() => { setSettings(loadSettings()); }, []);
  useEffect(() => { getPromptDefaults().then(setDefaults).catch(() => { /* auth may fail during dev; ignore */ }); }, []);

  const update = (patch: Partial<FabrikaJobSettings>) => {
    const next = { ...settings, ...patch };
    setSettings(next);
    saveSettings(next);
  };

  const canSubmit = !!xlsx && !!zip && !disabled;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <Dropzone label="XLSX со спекой бренда" accept=".xlsx" file={xlsx} onFile={setXlsx} />
        <Dropzone label="ZIP с PDF-макетами" accept=".zip" file={zip} onFile={setZip} />
      </div>

      <details open={advancedOpen} onToggle={(e) => setAdvancedOpen((e.target as HTMLDetailsElement).open)}>
        <summary className="cursor-pointer select-none text-sm text-neutral-600">Advanced</summary>
        <div className="mt-3 space-y-3">
          <label className="block text-sm">
            Модель
            <select
              className="mt-1 block w-full rounded border p-2"
              value={settings.modelId || VISION_MODELS[0].id}
              onChange={(e) => update({ modelId: e.target.value })}
            >
              {VISION_MODELS.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
            </select>
          </label>

          <PromptField
            label="QA system prompt"
            value={settings.qaSystemPrompt ?? defaults?.qaSystemPrompt ?? ''}
            defaultValue={defaults?.qaSystemPrompt ?? ''}
            onChange={(v) => update({ qaSystemPrompt: v })}
            onReset={() => update({ qaSystemPrompt: undefined })}
          />
          <PromptField
            label="Sign-check prompt"
            value={settings.signCheckPrompt ?? defaults?.signCheckPrompt ?? ''}
            defaultValue={defaults?.signCheckPrompt ?? ''}
            onChange={(v) => update({ signCheckPrompt: v })}
            onReset={() => update({ signCheckPrompt: undefined })}
          />

          <button
            type="button"
            className="text-xs text-neutral-500 underline"
            onClick={() => { resetSettings(); setSettings({}); }}
          >Сбросить все override'ы</button>
        </div>
      </details>

      <button
        type="button"
        disabled={!canSubmit}
        className="rounded bg-black px-4 py-2 text-white disabled:opacity-50"
        onClick={() => xlsx && zip && onSubmit(xlsx, zip, settings)}
      >Запустить проверку</button>
    </div>
  );
}

function Dropzone({ label, accept, file, onFile }: {
  label: string; accept: string; file: File | null; onFile: (f: File) => void;
}) {
  return (
    <label className="block cursor-pointer rounded border-2 border-dashed p-6 text-center hover:bg-neutral-50">
      <div className="text-sm font-medium">{label}</div>
      <div className="text-xs text-neutral-500">{file?.name || 'выберите файл'}</div>
      <input
        type="file" accept={accept} className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); }}
      />
    </label>
  );
}

function PromptField({ label, value, defaultValue, onChange, onReset }: {
  label: string; value: string; defaultValue: string;
  onChange: (v: string) => void; onReset: () => void;
}) {
  const isOverridden = value !== defaultValue && value !== '';
  return (
    <div>
      <div className="flex items-center justify-between">
        <span className="text-sm">{label}</span>
        {isOverridden && (
          <button type="button" className="text-xs text-blue-600 underline" onClick={onReset}>Reset to default</button>
        )}
      </div>
      <textarea
        rows={6}
        className="mt-1 w-full rounded border p-2 font-mono text-xs"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

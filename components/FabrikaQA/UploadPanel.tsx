import React, { useEffect, useState } from 'react';
import { Sparkles, Cpu, ChevronDown } from 'lucide-react';
import type { FabrikaJobSettings, FabrikaPromptDefaults, FileData } from '../../types';
import Dropzone from '../Dropzone';
import { getPromptDefaults } from '../../services/fabrikaClient';
import { loadSettings, saveSettings, resetSettings } from '../../utils/fabrikaSettings';

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
  const [promptsOpen, setPromptsOpen] = useState(false);

  useEffect(() => { setSettings(loadSettings()); }, []);
  useEffect(() => { getPromptDefaults().then(setDefaults).catch(() => {}); }, []);

  const update = (patch: Partial<FabrikaJobSettings>) => {
    const next = { ...settings, ...patch };
    setSettings(next);
    saveSettings(next);
  };

  const canSubmit = !!xlsx && !!zip && !disabled;

  const xlsxFileData: FileData | null = xlsx ? { file: xlsx, type: 'excel' } : null;
  const zipFileData: FileData | null = zip ? { file: zip, type: 'excel' } : null;

  return (
    <div className="space-y-6">

      {/* Dropzones */}
      <div className="w-full grid md:grid-cols-2 gap-6 max-w-5xl mx-auto">
        <Dropzone
          type="excel"
          accept=".xlsx"
          fileData={xlsxFileData}
          onFileSelect={setXlsx}
          onClear={() => setXlsx(null)}
          title="1. XLSX СО СПЕКОЙ БРЕНДА"
          description="Перетащите файл .xlsx сюда"
        />
        <Dropzone
          type="excel"
          accept=".zip"
          fileData={zipFileData}
          onFileSelect={setZip}
          onClear={() => setZip(null)}
          title="2. ZIP С PDF-МАКЕТАМИ"
          description="Перетащите архив .zip с PDF-файлами"
        />
      </div>

      {/* Settings row */}
      <div className="max-w-5xl mx-auto space-y-3">

        {/* Model selector */}
        <div className="glass-card rounded-2xl p-1">
          <div className="bg-white dark:bg-slate-900 rounded-[20px] p-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-6 h-6 bg-brand-50 dark:bg-brand-900/30 rounded-lg flex items-center justify-center">
                <Cpu size={14} className="text-brand-600 dark:text-brand-400" />
              </div>
              <h3 className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                AI Модель
              </h3>
            </div>
            <select
              value={settings.modelId || VISION_MODELS[0].id}
              onChange={(e) => update({ modelId: e.target.value })}
              className="w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-medium text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 transition-all cursor-pointer"
            >
              {VISION_MODELS.map((m) => (
                <option key={m.id} value={m.id}>{m.label}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Prompts (collapsible) */}
        <div className="glass-card rounded-2xl p-1">
          <div className="bg-white dark:bg-slate-900 rounded-[20px] overflow-hidden">
            <button
              type="button"
              onClick={() => setPromptsOpen((v) => !v)}
              className="w-full px-5 py-4 flex items-center justify-between text-sm font-semibold text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
            >
              <span>Настройки промптов</span>
              <ChevronDown
                size={16}
                className={`transition-transform duration-200 ${promptsOpen ? 'rotate-180' : ''}`}
              />
            </button>

            {promptsOpen && (
              <div className="px-5 pb-5 space-y-4 border-t border-slate-100 dark:border-slate-800 pt-4">
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
                  className="text-xs text-slate-400 dark:text-slate-500 underline hover:text-slate-700 dark:hover:text-slate-300 transition-colors"
                  onClick={() => { resetSettings(); setSettings({}); }}
                >
                  Сбросить все настройки
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Submit */}
      <div className="flex justify-center pb-4">
        <button
          type="button"
          disabled={!canSubmit}
          onClick={() => xlsx && zip && onSubmit(xlsx, zip, settings)}
          className={`
            group relative px-10 py-5 rounded-full font-bold text-base flex items-center gap-3 shadow-xl transition-all duration-300
            ${!canSubmit
              ? 'bg-slate-200 dark:bg-slate-800 text-slate-400 dark:text-slate-600 cursor-not-allowed shadow-none'
              : 'bg-slate-900 dark:bg-brand-600 text-white hover:bg-brand-600 dark:hover:bg-brand-500 hover:scale-[1.02] active:scale-[0.98]'
            }
          `}
        >
          <Sparkles size={20} className={canSubmit ? 'group-hover:animate-pulse' : ''} />
          <span>Запустить проверку</span>
        </button>
      </div>
    </div>
  );
}

function PromptField({ label, value, defaultValue, onChange, onReset }: {
  label: string;
  value: string;
  defaultValue: string;
  onChange: (v: string) => void;
  onReset: () => void;
}) {
  const isOverridden = value !== defaultValue && value !== '';
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-sm font-medium text-slate-600 dark:text-slate-400">{label}</span>
        {isOverridden && (
          <button
            type="button"
            className="text-xs text-brand-600 dark:text-brand-400 underline hover:no-underline transition-all"
            onClick={onReset}
          >
            Сбросить
          </button>
        )}
      </div>
      <textarea
        rows={5}
        className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 p-3 font-mono text-xs focus:outline-none focus:ring-2 focus:ring-brand-500 transition-all"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

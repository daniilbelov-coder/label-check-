import React, { useEffect, useState } from 'react';
import { X, Cpu } from 'lucide-react';
import type { FabrikaJobSettings, FabrikaPromptDefaults } from '../types';
import { getPromptDefaults } from '../services/fabrikaClient';
import { loadSettings, saveSettings, resetSettings } from '../utils/fabrikaSettings';

interface Props {
  onClose: () => void;
}

const VISION_MODELS: { id: string; label: string }[] = [
  { id: 'gemini-3-flash', label: 'Google Gemini 3 Flash (default)' },
  { id: 'gemini-2.5-flash', label: 'Google Gemini 2.5 Flash' },
  { id: 'gpt-5-structured', label: 'OpenAI GPT-5 Structured' },
];

const FabrikaSettingsModal: React.FC<Props> = ({ onClose }) => {
  const [settings, setSettings] = useState<FabrikaJobSettings>(() => loadSettings());
  const [defaults, setDefaults] = useState<FabrikaPromptDefaults | null>(null);

  useEffect(() => {
    getPromptDefaults().then(setDefaults).catch(() => {});
  }, []);

  const update = (patch: Partial<FabrikaJobSettings>) => {
    const next = { ...settings, ...patch };
    setSettings(next);
    saveSettings(next);
  };

  const handleReset = () => {
    resetSettings();
    setSettings({});
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-2xl w-full max-h-[90vh] overflow-hidden shadow-2xl border border-slate-200 dark:border-slate-700 flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-200 dark:border-slate-700 shrink-0">
          <h2 className="text-xl font-bold text-slate-800 dark:text-white">
            Настройки Фабрики
          </h2>
          <button
            onClick={onClose}
            className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X size={20} className="text-slate-500 dark:text-slate-400" />
          </button>
        </div>

        {/* Scrollable content */}
        <div className="overflow-y-auto px-6 py-5 space-y-6 flex-1">

          {/* Model */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-6 h-6 bg-brand-50 dark:bg-brand-900/30 rounded-lg flex items-center justify-center">
                <Cpu size={14} className="text-brand-600 dark:text-brand-400" />
              </div>
              <span className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                AI Модель
              </span>
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

          {/* QA system prompt */}
          <PromptField
            label="QA system prompt"
            value={settings.qaSystemPrompt ?? defaults?.qaSystemPrompt ?? ''}
            defaultValue={defaults?.qaSystemPrompt ?? ''}
            onChange={(v) => update({ qaSystemPrompt: v })}
            onReset={() => update({ qaSystemPrompt: undefined })}
          />

          {/* Sign-check prompt */}
          <PromptField
            label="Sign-check prompt"
            value={settings.signCheckPrompt ?? defaults?.signCheckPrompt ?? ''}
            defaultValue={defaults?.signCheckPrompt ?? ''}
            onChange={(v) => update({ signCheckPrompt: v })}
            onReset={() => update({ signCheckPrompt: undefined })}
          />

          {/* Reset all */}
          <button
            type="button"
            onClick={handleReset}
            className="text-sm text-slate-400 dark:text-slate-500 underline hover:text-red-500 dark:hover:text-red-400 transition-colors"
          >
            Сбросить все настройки
          </button>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-800 shrink-0 flex justify-end">
          <button
            onClick={onClose}
            className="px-6 py-2.5 rounded-full bg-slate-900 dark:bg-brand-600 text-white font-semibold text-sm hover:bg-brand-600 dark:hover:bg-brand-500 transition-all"
          >
            Готово
          </button>
        </div>
      </div>
    </div>
  );
};

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
      <div className="flex items-center justify-between mb-2">
        <span className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">
          {label}
        </span>
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
        rows={8}
        className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 p-3 font-mono text-xs focus:outline-none focus:ring-2 focus:ring-brand-500 transition-all resize-none"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

export default FabrikaSettingsModal;

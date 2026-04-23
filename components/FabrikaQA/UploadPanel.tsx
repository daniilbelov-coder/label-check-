import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Sparkles, Cpu, ChevronDown, FileSpreadsheet, Upload, X, RefreshCw } from 'lucide-react';
import type { FabrikaJobSettings, FabrikaPromptDefaults, FabrikaSpecGroup } from '../../types';
import { getPromptDefaults } from '../../services/fabrikaClient';
import { loadSettings, saveSettings, resetSettings } from '../../utils/fabrikaSettings';
import { parseXlsxForPreview, bundlePdfsAsZip } from '../../utils/fabrikaSpecUtils';

const VISION_MODELS: { id: string; label: string }[] = [
  { id: 'gemini-3-flash', label: 'Google Gemini 3 Flash (default)' },
  { id: 'gemini-2.5-flash', label: 'Google Gemini 2.5 Flash' },
  { id: 'gpt-5-structured', label: 'OpenAI GPT-5 Structured' },
];

const PKG_ORDER = ['RL', 'GB', 'MB', 'TB'];

type PdfMode = 'zip' | 'files';

type Props = {
  onSubmit: (xlsx: File, zip: File, settings: FabrikaJobSettings, selectedKeys: string[]) => void;
  disabled?: boolean;
};

export function UploadPanel({ onSubmit, disabled }: Props) {
  const [xlsx, setXlsx] = useState<File | null>(null);
  const [parsing, setParsing] = useState(false);
  const [groups, setGroups] = useState<FabrikaSpecGroup[] | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);

  const [selected, setSelected] = useState<Set<string>>(new Set());

  const [pdfMode, setPdfMode] = useState<PdfMode>('zip');
  const [zip, setZip] = useState<File | null>(null);
  const [pdfFiles, setPdfFiles] = useState<File[]>([]);

  const [settings, setSettings] = useState<FabrikaJobSettings>({});
  const [defaults, setDefaults] = useState<FabrikaPromptDefaults | null>(null);
  const [promptsOpen, setPromptsOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => { setSettings(loadSettings()); }, []);
  useEffect(() => { getPromptDefaults().then(setDefaults).catch(() => {}); }, []);

  const update = (patch: Partial<FabrikaJobSettings>) => {
    const next = { ...settings, ...patch };
    setSettings(next);
    saveSettings(next);
  };

  // ── Excel upload & parse ──────────────────────────────────────────────────
  const handleXlsx = useCallback(async (file: File) => {
    setXlsx(file);
    setGroups(null);
    setSelected(new Set());
    setParseError(null);
    setParsing(true);
    try {
      const g = await parseXlsxForPreview(file);
      if (g.length === 0) throw new Error('Не найдено ни одной колонки с «Название файла»');
      setGroups(g);
      // Select all by default
      const allKeys = g.flatMap((gr) => gr.columns.map((c) => c.key));
      setSelected(new Set(allKeys));
    } catch (e: any) {
      setParseError(e.message || 'Ошибка разбора Excel');
    } finally {
      setParsing(false);
    }
  }, []);

  const resetXlsx = () => {
    setXlsx(null);
    setGroups(null);
    setSelected(new Set());
    setParseError(null);
  };

  // ── Selection helpers ─────────────────────────────────────────────────────
  const allKeys = groups?.flatMap((g) => g.columns.map((c) => c.key)) ?? [];
  const allSelected = allKeys.length > 0 && allKeys.every((k) => selected.has(k));
  const noneSelected = allKeys.every((k) => !selected.has(k));

  const toggleKey = (key: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  const toggleGroup = (group: FabrikaSpecGroup) => {
    const keys = group.columns.map((c) => c.key);
    const groupAllSelected = keys.every((k) => selected.has(k));
    setSelected((prev) => {
      const next = new Set(prev);
      if (groupAllSelected) keys.forEach((k) => next.delete(k));
      else keys.forEach((k) => next.add(k));
      return next;
    });
  };

  const selectAll = () => setSelected(new Set(allKeys));
  const deselectAll = () => setSelected(new Set());

  // ── Submit ────────────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (!xlsx) return;
    let zipFile = zip;

    if (pdfMode === 'files') {
      if (pdfFiles.length === 0) return;
      setSubmitting(true);
      try { zipFile = await bundlePdfsAsZip(pdfFiles); }
      catch (e: any) { setSubmitting(false); return; }
    }

    if (!zipFile) return;
    setSubmitting(false);
    onSubmit(xlsx, zipFile, settings, [...selected]);
  };

  const hasPdfs = pdfMode === 'zip' ? !!zip : pdfFiles.length > 0;
  const canSubmit = !!xlsx && !!groups && selected.size > 0 && hasPdfs && !disabled && !submitting;

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5 max-w-5xl mx-auto">

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

      {/* ── Step 1: XLSX upload ─────────────────────────────────────────── */}
      <div className="glass-card rounded-2xl p-1">
        <div className="bg-white dark:bg-slate-900 rounded-[20px] p-5">
          <h3 className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-4">
            Шаг 1 — XLSX со спецификацией
          </h3>

          {!xlsx ? (
            <XlsxDropzone onFile={handleXlsx} />
          ) : (
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-emerald-50 dark:bg-emerald-900/30 rounded-xl flex items-center justify-center shrink-0">
                <FileSpreadsheet size={20} className="text-emerald-600 dark:text-emerald-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">{xlsx.name}</p>
                {parsing && (
                  <p className="text-xs text-slate-400 dark:text-slate-500 flex items-center gap-1 mt-0.5">
                    <RefreshCw size={11} className="animate-spin" /> Анализируем файл…
                  </p>
                )}
                {parseError && <p className="text-xs text-red-500 mt-0.5">{parseError}</p>}
                {groups && (
                  <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-0.5">
                    Найдено {groups.length} {groups.length === 1 ? 'модель' : 'моделей'},{' '}
                    {allKeys.length} спек
                  </p>
                )}
              </div>
              <button
                onClick={resetXlsx}
                className="p-2 rounded-xl text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
              >
                <X size={16} />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── Step 2: Checkboxes ──────────────────────────────────────────── */}
      {groups && groups.length > 0 && (
        <div className="glass-card rounded-2xl p-1">
          <div className="bg-white dark:bg-slate-900 rounded-[20px] p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                Шаг 2 — Выберите модели и типы упаковок
              </h3>
              <div className="flex gap-2">
                <button
                  onClick={selectAll}
                  disabled={allSelected}
                  className="text-xs text-brand-600 dark:text-brand-400 font-semibold underline hover:no-underline disabled:opacity-40 disabled:cursor-default transition-all"
                >
                  Выбрать всё
                </button>
                <span className="text-slate-200 dark:text-slate-700">|</span>
                <button
                  onClick={deselectAll}
                  disabled={noneSelected}
                  className="text-xs text-slate-400 dark:text-slate-500 underline hover:no-underline disabled:opacity-40 disabled:cursor-default transition-all"
                >
                  Снять всё
                </button>
              </div>
            </div>

            <div className="space-y-2">
              {groups.map((group) => {
                const groupKeys = group.columns.map((c) => c.key);
                const groupAllSelected = groupKeys.every((k) => selected.has(k));
                const groupSomeSelected = groupKeys.some((k) => selected.has(k));
                // Sort columns by known package type order
                const sortedCols = [...group.columns].sort(
                  (a, b) => (PKG_ORDER.indexOf(a.pkgType) + 1 || 99) - (PKG_ORDER.indexOf(b.pkgType) + 1 || 99),
                );
                return (
                  <div
                    key={group.modelName}
                    className="flex items-center gap-3 rounded-xl px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                  >
                    {/* Model checkbox */}
                    <input
                      type="checkbox"
                      checked={groupAllSelected}
                      ref={(el) => { if (el) el.indeterminate = groupSomeSelected && !groupAllSelected; }}
                      onChange={() => toggleGroup(group)}
                      className="w-4 h-4 rounded accent-brand-500 cursor-pointer shrink-0"
                    />

                    {/* Model name */}
                    <span
                      className="text-sm font-semibold text-slate-800 dark:text-slate-200 cursor-pointer select-none min-w-[80px]"
                      onClick={() => toggleGroup(group)}
                    >
                      {group.modelName}
                    </span>

                    {/* Package type badges */}
                    <div className="flex flex-wrap gap-2">
                      {sortedCols.map((col) => {
                        const isOn = selected.has(col.key);
                        return (
                          <button
                            key={col.key}
                            onClick={() => toggleKey(col.key)}
                            className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                              isOn
                                ? 'bg-brand-500 text-white shadow-sm'
                                : 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700'
                            }`}
                          >
                            {col.pkgType}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Selection summary */}
            <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800 text-xs text-slate-500 dark:text-slate-400">
              Выбрано: <span className="font-semibold text-slate-700 dark:text-slate-300">{selected.size}</span> из {allKeys.length} спек
            </div>
          </div>
        </div>
      )}

      {/* ── Step 3: PDF upload ──────────────────────────────────────────── */}
      {groups && (
        <div className="glass-card rounded-2xl p-1">
          <div className="bg-white dark:bg-slate-900 rounded-[20px] p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                Шаг 3 — PDF-макеты
              </h3>
              {/* Mode toggle */}
              <div className="flex rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 text-xs font-semibold">
                <button
                  onClick={() => { setPdfMode('zip'); setPdfFiles([]); }}
                  className={`px-3 py-1.5 transition-colors ${pdfMode === 'zip' ? 'bg-slate-900 dark:bg-brand-600 text-white' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'}`}
                >
                  ZIP-архив
                </button>
                <button
                  onClick={() => { setPdfMode('files'); setZip(null); }}
                  className={`px-3 py-1.5 transition-colors ${pdfMode === 'files' ? 'bg-slate-900 dark:bg-brand-600 text-white' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'}`}
                >
                  Отдельные PDF
                </button>
              </div>
            </div>

            {pdfMode === 'zip' ? (
              <ZipDropzone file={zip} onFile={setZip} onClear={() => setZip(null)} />
            ) : (
              <PdfFilesDropzone files={pdfFiles} onFiles={setPdfFiles} />
            )}
          </div>
        </div>
      )}

      {/* ── Prompts ─────────────────────────────────────────────────────── */}
      <div className="glass-card rounded-2xl p-1">
        <div className="bg-white dark:bg-slate-900 rounded-[20px] overflow-hidden">
          <button
            type="button"
            onClick={() => setPromptsOpen((v) => !v)}
            className="w-full px-5 py-4 flex items-center justify-between text-sm font-semibold text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
          >
            <span>Настройки промптов</span>
            <ChevronDown size={16} className={`transition-transform duration-200 ${promptsOpen ? 'rotate-180' : ''}`} />
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

      {/* ── Submit ──────────────────────────────────────────────────────── */}
      <div className="flex justify-center pb-4">
        <button
          type="button"
          disabled={!canSubmit}
          onClick={handleSubmit}
          className={`
            group relative px-10 py-5 rounded-full font-bold text-base flex items-center gap-3 shadow-xl transition-all duration-300
            ${!canSubmit
              ? 'bg-slate-200 dark:bg-slate-800 text-slate-400 dark:text-slate-600 cursor-not-allowed shadow-none'
              : 'bg-slate-900 dark:bg-brand-600 text-white hover:bg-brand-600 dark:hover:bg-brand-500 hover:scale-[1.02] active:scale-[0.98]'
            }
          `}
        >
          {submitting
            ? <><RefreshCw size={20} className="animate-spin" /><span>Подготовка…</span></>
            : <><Sparkles size={20} className={canSubmit ? 'group-hover:animate-pulse' : ''} /><span>Запустить проверку</span></>
          }
        </button>
      </div>
    </div>
  );
}

// ── Sub-components ──────────────────────────────────────────────────────────

function XlsxDropzone({ onFile }: { onFile: (f: File) => void }) {
  const ref = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);
  const accept = (f: File) => { if (f) onFile(f); };
  return (
    <label
      onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
      onDragLeave={() => setDrag(false)}
      onDrop={(e) => { e.preventDefault(); setDrag(false); const f = e.dataTransfer.files[0]; if (f) accept(f); }}
      className={`flex flex-col items-center justify-center gap-3 h-36 rounded-2xl border-2 border-dashed cursor-pointer transition-all ${drag ? 'border-brand-500 bg-brand-50/50 dark:bg-brand-900/10' : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-800/50'}`}
    >
      <input ref={ref} type="file" accept=".xlsx" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) accept(f); }} />
      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-colors ${drag ? 'bg-brand-500 text-white' : 'bg-slate-50 dark:bg-slate-800 text-slate-300 dark:text-slate-600'}`}>
        <FileSpreadsheet size={24} />
      </div>
      <div className="text-center">
        <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">Загрузите XLSX</p>
        <p className="text-xs text-slate-400 dark:text-slate-500">Перетащите файл или нажмите</p>
      </div>
    </label>
  );
}

function ZipDropzone({ file, onFile, onClear }: { file: File | null; onFile: (f: File) => void; onClear: () => void }) {
  const ref = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);
  if (file) {
    return (
      <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-800">
        <div className="w-9 h-9 bg-emerald-50 dark:bg-emerald-900/30 rounded-xl flex items-center justify-center shrink-0">
          <Upload size={16} className="text-emerald-600 dark:text-emerald-400" />
        </div>
        <span className="text-sm font-medium text-slate-700 dark:text-slate-300 flex-1 truncate">{file.name}</span>
        <button onClick={onClear} className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 transition-colors"><X size={14} /></button>
      </div>
    );
  }
  return (
    <label
      onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
      onDragLeave={() => setDrag(false)}
      onDrop={(e) => { e.preventDefault(); setDrag(false); const f = e.dataTransfer.files[0]; if (f) onFile(f); }}
      className={`flex flex-col items-center justify-center gap-3 h-36 rounded-2xl border-2 border-dashed cursor-pointer transition-all ${drag ? 'border-brand-500 bg-brand-50/50 dark:bg-brand-900/10' : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-800/50'}`}
    >
      <input ref={ref} type="file" accept=".zip" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); }} />
      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-colors ${drag ? 'bg-brand-500 text-white' : 'bg-slate-50 dark:bg-slate-800 text-slate-300 dark:text-slate-600'}`}>
        <Upload size={24} />
      </div>
      <div className="text-center">
        <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">Загрузите ZIP-архив</p>
        <p className="text-xs text-slate-400 dark:text-slate-500">Перетащите .zip с PDF-файлами</p>
      </div>
    </label>
  );
}

function PdfFilesDropzone({ files, onFiles }: { files: File[]; onFiles: (f: File[]) => void }) {
  const ref = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);

  const addFiles = (newFiles: FileList | File[]) => {
    const pdfs = Array.from(newFiles).filter((f) => /\.pdf$/i.test(f.name));
    if (pdfs.length === 0) return;
    onFiles((prev) => {
      const existing = new Set(prev.map((f) => f.name));
      return [...prev, ...pdfs.filter((f) => !existing.has(f.name))];
    });
  };

  return (
    <div className="space-y-3">
      <label
        onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => { e.preventDefault(); setDrag(false); addFiles(e.dataTransfer.files); }}
        className={`flex flex-col items-center justify-center gap-3 h-36 rounded-2xl border-2 border-dashed cursor-pointer transition-all ${drag ? 'border-brand-500 bg-brand-50/50 dark:bg-brand-900/10' : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-800/50'}`}
      >
        <input ref={ref} type="file" accept=".pdf" multiple className="hidden" onChange={(e) => { if (e.target.files) addFiles(e.target.files); }} />
        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-colors ${drag ? 'bg-brand-500 text-white' : 'bg-slate-50 dark:bg-slate-800 text-slate-300 dark:text-slate-600'}`}>
          <Upload size={24} />
        </div>
        <div className="text-center">
          <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">Загрузите PDF-файлы</p>
          <p className="text-xs text-slate-400 dark:text-slate-500">Можно перетащить несколько сразу</p>
        </div>
      </label>

      {files.length > 0 && (
        <div className="space-y-1.5">
          {files.map((f, i) => (
            <div key={f.name} className="flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 text-xs">
              <span className="w-4 h-4 rounded-md bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 flex items-center justify-center shrink-0 font-bold text-[9px]">PDF</span>
              <span className="flex-1 font-mono text-slate-600 dark:text-slate-400 truncate">{f.name}</span>
              <button
                onClick={() => onFiles(files.filter((_, j) => j !== i))}
                className="text-slate-300 dark:text-slate-600 hover:text-red-500 transition-colors"
              >
                <X size={12} />
              </button>
            </div>
          ))}
          <p className="text-xs text-slate-400 dark:text-slate-500 pl-1">
            {files.length} {files.length === 1 ? 'файл' : 'файлов'} добавлено
          </p>
        </div>
      )}
    </div>
  );
}

function PromptField({ label, value, defaultValue, onChange, onReset }: {
  label: string; value: string; defaultValue: string;
  onChange: (v: string) => void; onReset: () => void;
}) {
  const isOverridden = value !== defaultValue && value !== '';
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-sm font-medium text-slate-600 dark:text-slate-400">{label}</span>
        {isOverridden && (
          <button type="button" className="text-xs text-brand-600 dark:text-brand-400 underline hover:no-underline" onClick={onReset}>
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

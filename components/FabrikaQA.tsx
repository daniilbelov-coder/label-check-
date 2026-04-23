import React, { useState } from 'react';
import { ArrowLeft, RefreshCw, Sparkles, AlertTriangle } from 'lucide-react';
import Dropzone from './Dropzone';
import AnalysisResult from './AnalysisResult';
import { FileData, AnalysisResultData } from '../types';
import { parseExcelFile } from '../utils/fileHelpers';
import { extractXlsxMedia } from '../utils/xlsxMediaHelpers';
import { rasterizePdf } from '../utils/pdfHelpers';
import { analyzeFabrikaMacket } from '../services/geminiService';

interface Props {
  onBack: () => void;
}

type Stage = 'idle' | 'unpacking' | 'rasterizing' | 'analyzing' | 'done';

const STAGE_LABEL: Record<Stage, string> = {
  idle: 'Готов к проверке',
  unpacking: 'Распаковка Excel и знаков…',
  rasterizing: 'Рендер страниц PDF…',
  analyzing: 'Анализ VLM (main + знаки)…',
  done: 'Готово',
};

const SIGN_MAX_BYTES = 10_000;
const SIGN_MIN_BYTES = 200;

const FabrikaQA: React.FC<Props> = ({ onBack }) => {
  const [xlsxFile, setXlsxFile] = useState<FileData | null>(null);
  const [pdfFile, setPdfFile] = useState<FileData | null>(null);
  const [stage, setStage] = useState<Stage>('idle');
  const [result, setResult] = useState<AnalysisResultData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [signCount, setSignCount] = useState(0);
  const [pageCount, setPageCount] = useState(0);

  const busy = stage !== 'idle' && stage !== 'done';

  const handleXlsxSelect = async (file: File) => {
    try {
      const text = await parseExcelFile(file);
      setXlsxFile({ file, content: text, type: 'excel' });
      setError(null);
    } catch {
      setError('Ошибка чтения Excel файла.');
    }
  };

  const handlePdfSelect = (file: File) => {
    if (file.type !== 'application/pdf') {
      setError('Только PDF принимается как макет.');
      return;
    }
    if (pdfFile?.previewUrl) URL.revokeObjectURL(pdfFile.previewUrl);
    setPdfFile({ file, previewUrl: URL.createObjectURL(file), type: 'label' });
    setError(null);
  };

  const reset = () => {
    if (pdfFile?.previewUrl) URL.revokeObjectURL(pdfFile.previewUrl);
    setXlsxFile(null);
    setPdfFile(null);
    setResult(null);
    setError(null);
    setStage('idle');
    setSignCount(0);
    setPageCount(0);
  };

  const handleAnalyze = async () => {
    if (!xlsxFile || !pdfFile) return;
    setError(null);
    setResult(null);
    setSignCount(0);
    setPageCount(0);

    try {
      setStage('unpacking');
      const [signs, excelText] = await Promise.all([
        extractXlsxMedia(xlsxFile.file, { maxSizeBytes: SIGN_MAX_BYTES, minSizeBytes: SIGN_MIN_BYTES }),
        xlsxFile.content ? Promise.resolve(xlsxFile.content) : parseExcelFile(xlsxFile.file),
      ]);
      setSignCount(signs.length);

      setStage('rasterizing');
      const pdfPages = await rasterizePdf(pdfFile.file, { dpi: 150, maxPages: 10, format: 'jpeg', quality: 0.9 });
      setPageCount(pdfPages.length);

      setStage('analyzing');
      const resp = await analyzeFabrikaMacket({
        excelText,
        pdfPages,
        signs: signs.map(s => ({ name: s.name, dataUrl: s.dataUrl })),
      });

      setResult({ markdown: resp.result });
      setStage('done');
    } catch (e: any) {
      setError(e?.message || 'Ошибка при анализе');
      setStage('idle');
    }
  };

  return (
    <div className="max-w-6xl mx-auto w-full px-4 animate-fade-up">
      <div className="max-w-6xl mx-auto mb-8">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-2 text-slate-500 dark:text-slate-400 hover:text-brand-500 dark:hover:text-brand-400 font-semibold text-sm transition-colors"
        >
          <ArrowLeft size={16} />
          Все сервисы
        </button>
      </div>

      <div className="text-center mb-10">
        <h1 className="text-3xl md:text-4xl font-bold text-slate-900 dark:text-white mb-3">
          Фабрика · QA макетов
        </h1>
        <p className="text-slate-500 dark:text-slate-400 max-w-2xl mx-auto leading-relaxed">
          Загрузите ТЗ (Excel) и макет упаковки (PDF). ИИ сравнит каждое поле по символам и отдельно проверит наличие манипуляционных знаков.
        </p>
      </div>

      {error && (
        <div className="max-w-2xl mx-auto bg-red-50 dark:bg-red-900/10 border border-red-100 dark:border-red-900/30 p-4 rounded-2xl text-red-600 dark:text-red-400 flex gap-3 mb-8 animate-fade-in">
          <AlertTriangle className="shrink-0" /> <span className="text-sm font-medium">{error}</span>
        </div>
      )}

      {!result ? (
        <div className="flex flex-col items-center">
          <div className="w-full grid md:grid-cols-2 gap-6 max-w-4xl mx-auto mb-10">
            <Dropzone
              type="excel"
              accept=".xlsx"
              fileData={xlsxFile}
              onFileSelect={handleXlsxSelect}
              onClear={() => setXlsxFile(null)}
              title="1. ТЗ (EXCEL)"
              description="Загрузите .xlsx — из него извлекутся текст и знаки"
            />
            <Dropzone
              type="label"
              accept="application/pdf"
              fileData={pdfFile}
              onFileSelect={handlePdfSelect}
              onClear={() => {
                if (pdfFile?.previewUrl) URL.revokeObjectURL(pdfFile.previewUrl);
                setPdfFile(null);
              }}
              title="2. МАКЕТ (PDF)"
              description="Многостраничный PDF макета упаковки"
            />
          </div>

          {busy && (
            <div className="mb-8 flex items-center gap-3 text-slate-600 dark:text-slate-300 text-sm">
              <RefreshCw className="animate-spin" size={18} />
              <span>{STAGE_LABEL[stage]}</span>
              {signCount > 0 && <span className="text-slate-400">· знаков: {signCount}</span>}
              {pageCount > 0 && <span className="text-slate-400">· страниц: {pageCount}</span>}
            </div>
          )}

          <button
            onClick={handleAnalyze}
            disabled={!xlsxFile || !pdfFile || busy}
            className={`px-10 py-5 rounded-full font-bold text-base flex items-center gap-3 shadow-xl transition-all duration-300 ${
              !xlsxFile || !pdfFile || busy
                ? 'bg-slate-200 dark:bg-slate-800 text-slate-400 dark:text-slate-600 cursor-not-allowed shadow-none'
                : 'bg-slate-900 dark:bg-brand-600 text-white hover:bg-brand-600 dark:hover:bg-brand-500 hover:scale-[1.02] active:scale-[0.98]'
            }`}
          >
            {busy ? (
              <>
                <RefreshCw className="animate-spin" size={20} />
                <span>{STAGE_LABEL[stage]}</span>
              </>
            ) : (
              <>
                <Sparkles size={20} />
                <span>Проверить макет</span>
              </>
            )}
          </button>

          <p className="mt-6 text-xs text-slate-400 dark:text-slate-500 max-w-lg text-center">
            Анализ занимает 1–3 минуты (main QA + {signCount || 'N'} знак-запросов параллельно).
          </p>
        </div>
      ) : (
        <div className="space-y-8 animate-fade-in pb-20">
          <AnalysisResult data={result} />
          <div className="flex justify-center gap-4">
            <button
              onClick={reset}
              className="px-8 py-3 rounded-full border border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white transition-all flex items-center gap-2"
            >
              <RefreshCw size={18} /> Новая проверка
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default FabrikaQA;

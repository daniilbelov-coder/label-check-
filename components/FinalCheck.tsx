import React, { useState } from 'react';
import { ArrowLeft, RefreshCw, ScanEye, AlertTriangle, Scan } from 'lucide-react';
import Dropzone from './Dropzone';
import AnalysisResult from './AnalysisResult';
import { FileData, AnalysisResultData, AppView } from '../types';
import { fileToBase64, createPreviewUrl } from '../utils/fileHelpers';
import { proofreadLabel } from '../services/geminiService';

interface Props {
  onBack: () => void;
  onNavigate: (view: AppView) => void;
}

const FinalCheck: React.FC<Props> = ({ onBack, onNavigate }) => {
  const [file, setFile] = useState<FileData | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState<AnalysisResultData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFileSelect = (selectedFile: File) => {
    try {
      const previewUrl = createPreviewUrl(selectedFile);
      setFile({ file: selectedFile, previewUrl, type: 'label' });
      setError(null);
    } catch { setError("Ошибка файла."); }
  };

  const handleAnalyze = async () => {
    if (!file) return;
    setIsProcessing(true);
    setResult(null);
    try {
      const base64 = await fileToBase64(file.file);
      const text = await proofreadLabel(base64, file.file.type);
      setResult({ markdown: text });
    } catch (err: any) {
      setError(err.message || "Ошибка проверки");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto w-full px-4 animate-fade-up">
      <div className="flex flex-col items-center mb-12 relative">
        <button 
          onClick={onBack} 
          className="absolute left-0 top-1/2 -translate-y-1/2 hidden lg:flex items-center text-slate-400 dark:text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors font-medium text-sm"
        >
          <ArrowLeft size={18} className="mr-2" /> Назад
        </button>

        <div className="flex items-center justify-center gap-2 mb-8 glass-card px-4 py-2 rounded-2xl">
          <div className="w-8 h-8 bg-brand-500 rounded-lg flex items-center justify-center text-white">
            <Scan size={18} />
          </div>
          <span className="text-sm font-bold tracking-tight dark:text-white">Этикетка <span className="text-brand-500">AI</span></span>
        </div>

        <h1 className="text-3xl md:text-4xl font-bold text-slate-900 dark:text-white mb-4 text-center">
          Финальная проверка
        </h1>
        <p className="text-slate-500 dark:text-slate-400 text-center max-w-2xl leading-relaxed">
          Поиск орфографических, пунктуационных и оформительских ошибок на готовой этикетке без сравнения с исходником.
        </p>
      </div>

      {error && (
        <div className="max-w-2xl mx-auto bg-red-50 dark:bg-red-900/10 border border-red-100 dark:border-red-900/30 p-4 rounded-2xl text-red-600 dark:text-red-400 flex gap-3 mb-8 animate-fade-in">
          <AlertTriangle className="shrink-0" /> <span className="text-sm font-medium">{error}</span>
        </div>
      )}

      {!result ? (
        <div className="flex flex-col items-center">
          <div className="w-full max-w-2xl mx-auto mb-12">
            <Dropzone
              type="label"
              accept="image/*, application/pdf"
              fileData={file}
              onFileSelect={handleFileSelect}
              onClear={() => setFile(null)}
              title="МАКЕТ ЭТИКЕТКИ ДЛЯ ВЫЧИТКИ"
              description="Перетащите PNG, JPG или PDF файл сюда"
            />
          </div>
          
          <div className="flex justify-center pb-20">
             <button
              onClick={handleAnalyze}
              disabled={!file || isProcessing}
              className={`
                group relative px-10 py-5 rounded-full font-bold text-base flex items-center gap-3 shadow-xl transition-all duration-300
                ${!file || isProcessing
                  ? 'bg-slate-200 dark:bg-slate-800 text-slate-400 dark:text-slate-600 cursor-not-allowed shadow-none' 
                  : 'bg-slate-900 dark:bg-brand-600 text-white hover:bg-brand-600 dark:hover:bg-brand-500 hover:scale-[1.02] active:scale-[0.98]'
                }
              `}
            >
              {isProcessing ? (
                <>
                  <RefreshCw className="animate-spin" size={20} />
                  <span>Вычитка...</span>
                </>
              ) : (
                <>
                  <ScanEye size={20} className="group-hover:animate-pulse" />
                  <span>Начать проверку</span>
                </>
              )}
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-8 animate-fade-in pb-20">
           <AnalysisResult data={result} />
           <div className="flex justify-center">
              <button 
                onClick={() => { setFile(null); setResult(null); }} 
                className="px-8 py-3 rounded-full border border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white transition-all flex items-center gap-2"
              >
                 <RefreshCw size={18} /> Проверить другой макет
              </button>
           </div>
        </div>
      )}
    </div>
  );
};

export default FinalCheck;

import React, { useState } from 'react';
import { ArrowLeft, RefreshCw, FileSpreadsheet, Download, CheckCircle2, Scan, Wand2 } from 'lucide-react';
import Dropzone from './Dropzone';
import { FileData, AppView } from '../types';
import { parseExcelFile, generateAndDownloadExcel } from '../utils/fileHelpers';
import { processBrief, BRIEF_SYSTEM_PROMPT } from '../services/geminiService';

interface Props {
  onBack: () => void;
  onNavigate: (view: AppView) => void;
}

const BriefProcessor: React.FC<Props> = ({ onBack, onNavigate }) => {
  const [file, setFile] = useState<FileData | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState<Record<string, string> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [systemPrompt, setSystemPrompt] = useState<string>("");

  const handleFileSelect = async (selectedFile: File) => {
    try {
      const text = await parseExcelFile(selectedFile);
      setFile({
        file: selectedFile,
        content: text,
        type: 'excel'
      });
      setError(null);
    } catch (err) {
      setError("Ошибка при чтении файла.");
    }
  };

  const handleProcess = async () => {
    if (!file || !file.content) return;
    setIsProcessing(true);
    setError(null);
    try {
      const data = await processBrief(file.content, systemPrompt || undefined);
      setResult(data);
    } catch (err: any) {
      setError(err.message || "Ошибка обработки");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDownload = () => {
    if (result) {
      generateAndDownloadExcel(result);
    }
  };

  const useDefaultPrompt = () => {
    setSystemPrompt(BRIEF_SYSTEM_PROMPT.trim());
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
          Работа с брифом
        </h1>
        <p className="text-slate-500 dark:text-slate-400 text-center max-w-2xl leading-relaxed">
          Загрузите Excel файл с исходным текстом. ИИ автоматически скорректирует кавычки, тире, регистр и исправит ошибки.
        </p>
      </div>

      {!result ? (
        <div className="flex flex-col items-center">
          <div className="w-full grid lg:grid-cols-[1fr,1.2fr] gap-8 max-w-6xl mx-auto mb-12">
            
            {/* System Prompt Section */}
            <div className="flex flex-col h-full animate-fade-in">
                <h3 className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-4 ml-1">
                  СИСТЕМНЫЙ ПРОМПТ
                </h3>
                <div className="flex-grow bg-white dark:bg-slate-900 rounded-[32px] shadow-sm ring-1 ring-slate-200 dark:ring-slate-800 p-6 overflow-hidden min-h-[320px] mb-4">
                  <textarea
                    value={systemPrompt}
                    onChange={(e) => setSystemPrompt(e.target.value)}
                    placeholder="Введите правила обработки или используйте стандартные..."
                    className="w-full h-full resize-none bg-transparent text-slate-700 dark:text-slate-300 text-sm leading-relaxed focus:outline-none scrollbar-thin"
                  />
                </div>
                <div className="flex justify-start">
                  <button
                    onClick={useDefaultPrompt}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-white dark:bg-slate-900 text-brand-600 dark:text-brand-400 font-bold text-xs hover:bg-brand-50 dark:hover:bg-brand-900/20 transition-all border border-slate-200 dark:border-slate-800 shadow-sm"
                  >
                    <Wand2 size={14} />
                    Использовать стандартные правила
                  </button>
                </div>
            </div>

            {/* File Upload Section */}
            <Dropzone
              type="excel"
              accept=".xlsx, .xls"
              fileData={file}
              onFileSelect={handleFileSelect}
              onClear={() => setFile(null)}
              title="ИСХОДНЫЙ EXCEL БРИФ"
              description="Перетащите файл .xlsx сюда"
            />
          </div>
          
          <div className="flex justify-center pb-20">
            <button
              onClick={handleProcess}
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
                  <span>Обработка...</span>
                </>
              ) : (
                <>
                  <FileSpreadsheet size={20} className="group-hover:animate-pulse" />
                  <span>Обработать бриф</span>
                </>
              )}
            </button>
          </div>
          {error && <div className="text-red-500 dark:text-red-400 text-center bg-red-50 dark:bg-red-900/10 px-6 py-3 rounded-xl mb-8">{error}</div>}
        </div>
      ) : (
        <div className="space-y-8 animate-fade-in pb-20 max-w-4xl mx-auto">
          <div className="bg-white dark:bg-slate-900 rounded-[32px] shadow-sm ring-1 ring-slate-100 dark:ring-slate-800 overflow-hidden">
             <div className="p-6 border-b border-slate-50 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50 flex justify-between items-center">
                <div className="flex items-center gap-3">
                   <div className="w-10 h-10 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 rounded-xl flex items-center justify-center">
                      <CheckCircle2 size={20} />
                   </div>
                   <span className="font-bold text-slate-900 dark:text-white">Результат обработки</span>
                </div>
                <button 
                  onClick={handleDownload} 
                  className="flex items-center gap-2 px-6 py-2.5 bg-slate-900 dark:bg-brand-600 text-white rounded-full hover:bg-brand-600 dark:hover:bg-brand-500 transition-all font-bold text-sm shadow-md"
                >
                   <Download size={16} /> Скачать Excel
                </button>
             </div>
             <div className="p-8 space-y-6">
               {Object.entries(result).map(([key, value]) => (
                 <div key={key} className="border-b border-slate-50 dark:border-slate-800 pb-6 last:border-0 last:pb-0">
                    <h4 className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-2">{key}</h4>
                    <p className="text-slate-900 dark:text-slate-100 font-medium whitespace-pre-wrap leading-relaxed">{value}</p>
                 </div>
               ))}
             </div>
          </div>
          <div className="flex justify-center">
             <button 
               onClick={() => { setFile(null); setResult(null); }} 
               className="px-8 py-3 rounded-full border border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white transition-all flex items-center gap-2"
             >
                <RefreshCw size={18} /> Загрузить другой бриф
             </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default BriefProcessor;

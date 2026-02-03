import React, { useState, useEffect } from 'react';
import { ArrowLeft, RefreshCw, FileSpreadsheet, Download, CheckCircle2, Scan, Cpu } from 'lucide-react';
import Dropzone from './Dropzone';
import { FileData, AppView, BriefType } from '../types';
import { parseExcelFile, addCorrectionColumnToExcel } from '../utils/fileHelpers';
import { processBrief, BRIEF_PROMPTS } from '../services/geminiService';
import { ALL_MODELS, DEFAULT_MODEL } from '../config/modelConfig';

interface ModelConfig {
  id: string;
  name?: string;
  displayName: string;
  provider: string;
  description?: string;
}

interface Props {
  onBack: () => void;
  onNavigate: (view: AppView) => void;
}

// Конфигурация типов брифов
const BRIEF_TYPES: { id: BriefType; label: string }[] = [
  { id: 'food', label: 'Фуд' },
  { id: 'nonfood', label: 'Нон-фуд' },
  { id: 'inter', label: 'Межнар' },
  { id: 'ge', label: 'ГЕ' },
];

const BriefProcessor: React.FC<Props> = ({ onBack, onNavigate }) => {
  const [file, setFile] = useState<FileData | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState<Record<string, string> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedBriefType, setSelectedBriefType] = useState<BriefType | null>(null);
  const [availableModels, setAvailableModels] = useState<ModelConfig[]>(ALL_MODELS as unknown as ModelConfig[]);
  const [selectedModel, setSelectedModel] = useState<string>(DEFAULT_MODEL);

  // Load available models from server
  useEffect(() => {
    const fetchAvailableModels = async () => {
      try {
        const response = await fetch('/api/available-models');
        if (response.ok) {
          const data = await response.json();
          setAvailableModels(data.models || []);
          if (data.defaultModel) {
            setSelectedModel(data.defaultModel);
          }
        }
      } catch (err) {
        console.error('Failed to load available models:', err);
        // Fallback to Gemini if API fails
        setAvailableModels([{
          id: 'gemini-2.5-flash',
          name: 'gemini-2.5-flash',
          displayName: 'Google Gemini 2.5 Flash',
          provider: 'replicate',
          description: 'Быстрая модель (через Replicate)'
        }]);
      }
    };
    fetchAvailableModels();
  }, []);

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
    if (!file || !file.content || !selectedBriefType) return;
    setIsProcessing(true);
    setError(null);
    try {
      const prompt = BRIEF_PROMPTS[selectedBriefType];
      const data = await processBrief(file.content, prompt, selectedModel);
      setResult(data);
    } catch (err: any) {
      setError(err.message || "Ошибка обработки");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDownload = async () => {
    if (result && file) {
      try {
        // Use the new function that adds column G to original file
        await addCorrectionColumnToExcel(file.file, result);
      } catch (err) {
        console.error('Error generating Excel:', err);
        setError('Ошибка при создании файла Excel');
      }
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
          Работа с брифом
        </h1>
        <p className="text-slate-500 dark:text-slate-400 text-center max-w-2xl leading-relaxed">
          Загрузите Excel файл с исходным текстом. ИИ автоматически скорректирует кавычки, тире, регистр и исправит ошибки.
        </p>
      </div>

      {/* Brief Type & Model Selection Row */}
      <div className="max-w-4xl mx-auto mb-8">
        <div className="flex flex-col md:flex-row gap-4 items-stretch">
          {/* Brief Type Buttons */}
          <div className="shrink-0 glass-card rounded-2xl p-1">
            <div className="bg-white dark:bg-slate-900 rounded-[20px] p-4 h-full">
              <h3 className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-3">
                Тип брифа
              </h3>
              <div className="flex flex-wrap gap-2">
                {BRIEF_TYPES.map((type) => (
                  <button
                    key={type.id}
                    onClick={() => setSelectedBriefType(type.id)}
                    className={`
                      px-5 py-2.5 rounded-xl font-semibold text-sm transition-all duration-200
                      ${selectedBriefType === type.id
                        ? 'bg-brand-500 text-white shadow-md'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 hover:text-slate-900 dark:hover:text-white'
                      }
                    `}
                  >
                    {type.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Model Selection Dropdown */}
          {availableModels.length > 1 && (
            <div className="flex-1 min-w-0 glass-card rounded-2xl p-1">
              <div className="bg-white dark:bg-slate-900 rounded-[20px] p-4 h-full">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-6 h-6 bg-brand-50 dark:bg-brand-900/30 rounded-lg flex items-center justify-center">
                    <Cpu size={14} className="text-brand-600 dark:text-brand-400" />
                  </div>
                  <h3 className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                    AI Модель
                  </h3>
                </div>

                <select
                  value={selectedModel}
                  onChange={(e) => setSelectedModel(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-medium text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 transition-all cursor-pointer"
                >
                  {availableModels.map((model) => (
                    <option key={model.id} value={model.id}>
                      {model.displayName}
                      {model.description && ` — ${model.description}`}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}
        </div>
      </div>

      {!result ? (
        <div className="flex flex-col items-center">
          {/* File Upload Section - Centered */}
          <div className="w-full max-w-4xl mx-auto mb-12">
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
              disabled={!file || !selectedBriefType || isProcessing}
              className={`
                group relative px-10 py-5 rounded-full font-bold text-base flex items-center gap-3 shadow-xl transition-all duration-300
                ${!file || !selectedBriefType || isProcessing
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

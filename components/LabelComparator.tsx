import React, { useState, useEffect } from 'react';
import { ArrowLeft, RefreshCw, Sparkles, ArrowRight, AlertTriangle, Scan, FileSpreadsheet, CheckCheck, Cpu } from 'lucide-react';
import Dropzone from './Dropzone';
import AnalysisResult from './AnalysisResult';
import { FileData, AnalysisResultData, AppView } from '../types';
import { fileToBase64, parseExcelFile, createPreviewUrl } from '../utils/fileHelpers';
import { analyzeLabel } from '../services/geminiService';

interface ModelConfig {
  id: string;
  model: string;
  displayName: string;
  provider: string;
  description?: string;
  capabilities?: { images?: boolean; systemPrompt?: boolean };
}

interface Props {
  onBack: () => void;
  onNavigate: (view: AppView) => void;
}

const LabelComparator: React.FC<Props> = ({ onBack, onNavigate }) => {
  const [labelFile, setLabelFile] = useState<FileData | null>(null);
  const [excelFile, setExcelFile] = useState<FileData | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [result, setResult] = useState<AnalysisResultData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [availableModels, setAvailableModels] = useState<ModelConfig[]>([]);
  const [selectedModel, setSelectedModel] = useState<string>('gemini-2.5-flash');

  // Load available models that support images
  useEffect(() => {
    const fetchAvailableModels = async () => {
      try {
        const response = await fetch('/api/available-models?filter=images');
        if (response.ok) {
          const data = await response.json();
          setAvailableModels(data.models || []);
          if (data.defaultModel) {
            setSelectedModel(data.defaultModel);
          }
        }
      } catch (err) {
        console.error('Failed to load available models:', err);
      }
    };
    fetchAvailableModels();
  }, []);

  const handleLabelSelect = (file: File) => {
    try {
      const previewUrl = createPreviewUrl(file);
      setLabelFile({ file, previewUrl, type: 'label' });
      setError(null);
    } catch { setError("Ошибка при обработке файла."); }
  };

  const handleExcelSelect = async (file: File) => {
    try {
      const text = await parseExcelFile(file);
      setExcelFile({ file, content: text, type: 'excel' });
      setError(null);
    } catch { setError("Ошибка Excel файла."); }
  };

  const handleAnalyze = async () => {
    if (!labelFile || !excelFile) return;
    setIsAnalyzing(true);
    setResult(null);
    try {
      const labelBase64 = await fileToBase64(labelFile.file);
      const analysisText = await analyzeLabel(labelBase64, labelFile.file.type, excelFile.content || "", selectedModel);
      setResult({ markdown: analysisText });
    } catch (err: any) {
      setError(err.message || "Ошибка анализа");
    } finally {
      setIsAnalyzing(false);
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
          Умная проверка этикеток
        </h1>
        <p className="text-slate-500 dark:text-slate-400 text-center max-w-2xl leading-relaxed">
          Автоматически сравнивайте макет этикетки с исходными данными Excel. <br />
          Находите опечатки, несоответствия и ошибки в составе за секунды.
        </p>
      </div>
      
      {/* Model Selection Dropdown */}
      {availableModels.length > 1 && (
        <div className="max-w-md mx-auto mb-8">
          <div className="glass-card rounded-2xl p-1">
            <div className="bg-white dark:bg-slate-900 rounded-[20px] p-4">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-8 h-8 bg-brand-50 dark:bg-brand-900/30 rounded-lg flex items-center justify-center">
                  <Cpu size={16} className="text-brand-600 dark:text-brand-400" />
                </div>
                <h3 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  AI Модель
                </h3>
              </div>

              <select
                value={selectedModel}
                onChange={(e) => setSelectedModel(e.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-medium text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 transition-all cursor-pointer"
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
        </div>
      )}

      {error && (
        <div className="max-w-2xl mx-auto bg-red-50 dark:bg-red-900/10 border border-red-100 dark:border-red-900/30 p-4 rounded-2xl text-red-600 dark:text-red-400 flex gap-3 mb-8 animate-fade-in">
          <AlertTriangle className="shrink-0" /> <span className="text-sm font-medium">{error}</span>
        </div>
      )}

      {!result ? (
        <div className="flex flex-col items-center">
          <div className="w-full grid md:grid-cols-[1fr,auto,1fr] gap-4 md:gap-8 items-center max-w-5xl mx-auto mb-12">
            <Dropzone
              type="label"
              accept="image/*, application/pdf"
              fileData={labelFile}
              onFileSelect={handleLabelSelect}
              onClear={() => setLabelFile(null)}
              title="1. ИЗОБРАЖЕНИЕ ЭТИКЕТКИ"
              description="Загрузите png или jpg файл этикетки"
            />
            
            <div className="flex justify-center py-4 md:py-0">
              <div className="w-12 h-12 bg-white dark:bg-slate-900 rounded-full flex items-center justify-center border border-slate-100 dark:border-slate-800 shadow-sm">
                <ArrowRight className="text-slate-300 dark:text-slate-600" size={20} />
              </div>
            </div>

            <Dropzone
              type="excel"
              accept=".xlsx, .xls"
              fileData={excelFile}
              onFileSelect={handleExcelSelect}
              onClear={() => setExcelFile(null)}
              title="2. ДАННЫЕ EXCEL"
              description="Перетащите файл .xlsx с исходным текстом"
            />
          </div>

          <div className="flex justify-center pb-20">
            <button
              onClick={handleAnalyze}
              disabled={!labelFile || !excelFile || isAnalyzing}
              className={`
                group relative px-10 py-5 rounded-full font-bold text-base flex items-center gap-3 shadow-xl transition-all duration-300
                ${!labelFile || !excelFile || isAnalyzing
                  ? 'bg-slate-200 dark:bg-slate-800 text-slate-400 dark:text-slate-600 cursor-not-allowed shadow-none' 
                  : 'bg-slate-900 dark:bg-brand-600 text-white hover:bg-brand-600 dark:hover:bg-brand-500 hover:scale-[1.02] active:scale-[0.98]'
                }
              `}
            >
              {isAnalyzing ? (
                <>
                  <RefreshCw className="animate-spin" size={20} />
                  <span>Проверяю...</span>
                </>
              ) : (
                <>
                  <Sparkles size={20} className={!labelFile || !excelFile ? '' : 'group-hover:animate-pulse'} />
                  <span>Проверить этикетку</span>
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
                onClick={() => { setLabelFile(null); setExcelFile(null); setResult(null); }} 
                className="px-8 py-3 rounded-full border border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white transition-all flex items-center gap-2"
              >
                 <RefreshCw size={18} /> Новая проверка
              </button>
           </div>
        </div>
      )}

      {/* Navigation Buttons to other functions */}
      <div className="max-w-xl mx-auto pt-10 border-t border-slate-200 dark:border-slate-800 flex justify-center gap-4 pb-20">
          <button 
            onClick={() => onNavigate('brief')}
            className="flex items-center gap-2 px-6 py-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 font-bold text-sm hover:border-brand-500 hover:text-brand-600 dark:hover:text-brand-400 transition-all shadow-sm"
          >
            <FileSpreadsheet size={16} />
            Работа с брифом
          </button>
          <button 
            onClick={() => onNavigate('final')}
            className="flex items-center gap-2 px-6 py-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 font-bold text-sm hover:border-brand-500 hover:text-brand-600 dark:hover:text-brand-400 transition-all shadow-sm"
          >
            <CheckCheck size={16} />
            Финальная вычитка
          </button>
      </div>
    </div>
  );
};

export default LabelComparator;

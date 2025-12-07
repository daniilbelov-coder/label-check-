import React, { useState } from 'react';
import { Scan, Sparkles, ArrowRight, RefreshCw, AlertTriangle, Settings, ChevronDown, ChevronUp } from 'lucide-react';
import Dropzone from './components/Dropzone';
import AnalysisResult from './components/AnalysisResult';
import { FileData, AnalysisResultData } from './types';
import { fileToBase64, parseExcelFile, createPreviewUrl } from './utils/fileHelpers';
import { analyzeLabel } from './services/geminiService';

const App: React.FC = () => {
  const [labelFile, setLabelFile] = useState<FileData | null>(null);
  const [excelFile, setExcelFile] = useState<FileData | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [loadingStage, setLoadingStage] = useState<string>("");
  const [result, setResult] = useState<AnalysisResultData | null>(null);
  const [error, setError] = useState<string | null>(null);

  // User Settings State
  const [showSettings, setShowSettings] = useState(false);
  const [userApiKey, setUserApiKey] = useState("");
  const [userBaseUrl, setUserBaseUrl] = useState("");

  const handleLabelSelect = async (file: File) => {
    try {
      const previewUrl = createPreviewUrl(file);
      setLabelFile({
        file,
        previewUrl,
        type: 'label'
      });
      setError(null);
    } catch (err) {
      console.error(err);
      setError("Ошибка при обработке файла этикетки.");
    }
  };

  const handleExcelSelect = async (file: File) => {
    try {
      const text = await parseExcelFile(file);
      setExcelFile({
        file,
        content: text,
        type: 'excel'
      });
      setError(null);
    } catch (err) {
      console.error(err);
      setError("Ошибка при чтении Excel файла. Убедитесь, что формат верный.");
    }
  };

  const handleAnalyze = async () => {
    if (!labelFile || !excelFile) return;

    setIsAnalyzing(true);
    setResult(null);
    setError(null);

    try {
      const labelBase64 = await fileToBase64(labelFile.file);
      
      // Stage 1: Text Analysis
      setLoadingStage("Сверяем текст с таблицей...");
      const analysisText = await analyzeLabel(
        labelBase64,
        labelFile.file.type,
        excelFile.content || "",
        userApiKey,
        userBaseUrl
      );

      setResult({
        markdown: analysisText
      });

    } catch (err: any) {
      setError(err.message || "Произошла ошибка при анализе.");
    } finally {
      setIsAnalyzing(false);
      setLoadingStage("");
    }
  };

  const handleReset = () => {
    setLabelFile(null);
    setExcelFile(null);
    setResult(null);
    setError(null);
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center py-12 px-4 sm:px-6 lg:px-8 font-sans">
      
      {/* Header */}
      <header className="max-w-4xl w-full text-center mb-12 relative">
        <div className="inline-flex items-center justify-center p-3 bg-white rounded-2xl shadow-sm border border-gray-100 mb-6">
          <Scan className="w-8 h-8 text-blue-600 mr-2" />
          <span className="text-2xl font-bold tracking-tight text-slate-900">LabelCheck <span className="text-blue-600">AI</span></span>
        </div>
        
        {/* Settings Toggle Button (Absolute positioned top right of header area) */}
        <div className="absolute top-0 right-0">
          <button 
            onClick={() => setShowSettings(!showSettings)}
            className="flex items-center gap-2 text-sm text-gray-500 hover:text-blue-600 transition-colors p-2 rounded-lg hover:bg-gray-100"
          >
            <Settings size={18} />
            <span>Настройки API</span>
          </button>
        </div>

        {/* Collapsible Settings Panel */}
        {showSettings && (
          <div className="absolute top-12 right-0 z-20 w-80 bg-white rounded-xl shadow-xl border border-gray-200 p-4 text-left animate-fade-in-up">
            <h3 className="text-sm font-semibold text-gray-900 mb-3">Настройки подключения</h3>
            
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  API Key (необязательно)
                </label>
                <input 
                  type="password"
                  value={userApiKey}
                  onChange={(e) => setUserApiKey(e.target.value)}
                  placeholder="sk-..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <p className="text-[10px] text-gray-400 mt-1">
                  Если не указан, используется системный ключ.
                </p>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Base URL (необязательно)
                </label>
                <input 
                  type="text"
                  value={userBaseUrl}
                  onChange={(e) => setUserBaseUrl(e.target.value)}
                  placeholder="https://api.artemox.com"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>
          </div>
        )}

        <h1 className="text-4xl font-extrabold text-slate-900 mb-4 tracking-tight">
          Умная проверка этикеток
        </h1>
        <p className="text-lg text-slate-600 max-w-2xl mx-auto">
          Автоматически сравнивайте макет этикетки с исходными данными Excel. Находите опечатки, несоответствия и ошибки в составе за секунды.
        </p>
      </header>

      {/* Main Content Area */}
      <main className="max-w-6xl w-full space-y-8">
        
        {/* Error Banner */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center gap-3 text-red-700 animate-fade-in max-w-3xl mx-auto">
            <AlertTriangle size={20} />
            <p>{error}</p>
          </div>
        )}

        {/* Upload Section */}
        {!result && (
        <div className="grid md:grid-cols-2 gap-6 relative max-w-5xl mx-auto">
          
          <div className="space-y-3">
            <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wider ml-1">1. Изображение этикетки</h2>
            <Dropzone
              type="label"
              accept="image/png, image/jpeg, image/webp, application/pdf"
              fileData={labelFile}
              onFileSelect={handleLabelSelect}
              onClear={() => setLabelFile(null)}
              title="Загрузите этикетку"
              description="Перетащите PNG, JPG или PDF файл сюда"
            />
          </div>

          <div className="space-y-3">
            <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wider ml-1">2. Данные Excel</h2>
            <Dropzone
              type="excel"
              accept=".xlsx, .xls"
              fileData={excelFile}
              onFileSelect={handleExcelSelect}
              onClear={() => setExcelFile(null)}
              title="Загрузите таблицу"
              description="Перетащите файл .xlsx с исходным текстом"
            />
          </div>

          {/* Connection Line (Desktop only) */}
          <div className="hidden md:flex absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-0 w-12 h-12 bg-white rounded-full items-center justify-center border border-gray-200 shadow-sm">
             <ArrowRight className="text-gray-400" size={20} />
          </div>
        </div>
        )}

        {/* Action Button */}
        {!result && (
        <div className="flex justify-center pt-4">
            <button
              onClick={handleAnalyze}
              disabled={!labelFile || !excelFile || isAnalyzing}
              className={`
                group relative px-8 py-4 rounded-full font-semibold text-lg flex items-center gap-3 shadow-lg transition-all duration-300
                ${(!labelFile || !excelFile) 
                  ? 'bg-gray-200 text-gray-400 cursor-not-allowed' 
                  : isAnalyzing 
                    ? 'bg-blue-600 text-white cursor-wait pr-6'
                    : 'bg-slate-900 text-white hover:bg-blue-600 hover:shadow-blue-200 hover:-translate-y-1'
                }
              `}
            >
              {isAnalyzing ? (
                <>
                  <RefreshCw className="animate-spin" size={20} />
                  {loadingStage || "Анализ..."}
                </>
              ) : (
                <>
                  <Sparkles size={20} className={(!labelFile || !excelFile) ? '' : 'text-blue-300 group-hover:text-white'} />
                  Проверить этикетку
                </>
              )}
            </button>
        </div>
        )}

        {/* Show Reset Button when result is visible */}
        {result && (
          <div className="flex justify-center mb-8">
            <button
              onClick={handleReset}
              className="px-6 py-3 rounded-full bg-white border border-gray-200 text-slate-600 font-medium hover:bg-gray-50 hover:text-slate-900 transition-colors shadow-sm flex items-center gap-2"
            >
              <RefreshCw size={18} />
              Загрузить новые файлы
            </button>
          </div>
        )}

        {/* Scanning Overlay Effect */}
        {isAnalyzing && labelFile && (
           <div className="fixed inset-0 bg-black/20 backdrop-blur-[2px] z-50 flex flex-col items-center justify-center">
             <div className="bg-white p-8 rounded-3xl shadow-2xl max-w-sm w-full text-center relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-1 bg-blue-500 animate-scan z-10 opacity-50 shadow-[0_0_15px_rgba(59,130,246,0.6)]"></div>
                <div className="mb-6 relative w-24 h-24 mx-auto bg-gray-100 rounded-xl overflow-hidden border border-gray-200">
                    {labelFile.previewUrl && (
                        <img src={labelFile.previewUrl} className="w-full h-full object-cover opacity-50" alt="" />
                    )}
                    <div className="absolute inset-0 bg-gradient-to-b from-transparent via-blue-500/20 to-transparent animate-scan h-full"></div>
                </div>
                <h3 className="text-xl font-bold text-slate-900 mb-2">Идет проверка</h3>
                <p className="text-gray-500 text-sm">{loadingStage}</p>
             </div>
           </div>
        )}

        {/* Results Section */}
        {result && (
          <div className="animate-fade-in pb-20">
            <AnalysisResult data={result} />
          </div>
        )}

      </main>
    </div>
  );
};

export default App;
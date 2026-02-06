import React, { useState, useEffect } from 'react';
import { ArrowLeft, RefreshCw, CheckCircle2, Cpu, FileText } from 'lucide-react';
import { AppView } from '../types';
import { checkText, getAvailableModels } from '../services/geminiService';
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

const TextCheck: React.FC<Props> = ({ onBack, onNavigate }) => {
  const [inputText, setInputText] = useState<string>('');
  const [result, setResult] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [availableModels, setAvailableModels] = useState<ModelConfig[]>(ALL_MODELS as unknown as ModelConfig[]);
  const [selectedModel, setSelectedModel] = useState<string>(DEFAULT_MODEL);

  // Load available models from server
  useEffect(() => {
    const fetchModels = async () => {
      try {
        const data = await getAvailableModels();
        setAvailableModels(data.models || []);
        if (data.defaultModel) {
          setSelectedModel(data.defaultModel);
        }
      } catch (err) {
        console.error('Failed to load available models:', err);
      }
    };
    fetchModels();
  }, []);

  const handleCheck = async () => {
    if (!inputText.trim()) {
      setError('Пожалуйста, введите текст для проверки');
      return;
    }

    setIsProcessing(true);
    setError(null);
    setResult(null);

    try {
      const checkResult = await checkText(inputText, selectedModel);
      setResult(checkResult);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Произошла ошибка при проверке текста';
      setError(errorMessage);
      console.error('Text check error:', err);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReset = () => {
    setInputText('');
    setResult(null);
    setError(null);
  };

  return (
    <div className="max-w-7xl mx-auto w-full animate-fade-up">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-slate-600 dark:text-slate-400 hover:text-brand-500 dark:hover:text-brand-400 transition-colors"
        >
          <ArrowLeft size={20} />
          <span className="font-medium">Назад</span>
        </button>

        {/* Model Selector */}
        {availableModels.length > 1 && (
          <div className="flex items-center gap-3 bg-white dark:bg-slate-900 px-4 py-2 rounded-2xl ring-1 ring-slate-200 dark:ring-slate-800">
            <Cpu size={18} className="text-brand-500" />
            <span className="text-sm font-medium text-slate-600 dark:text-slate-400">AI МОДЕЛЬ</span>
            <select
              value={selectedModel}
              onChange={(e) => setSelectedModel(e.target.value)}
              className="text-sm font-medium bg-transparent text-slate-900 dark:text-white border-none focus:outline-none focus:ring-0 cursor-pointer"
              disabled={isProcessing}
            >
              {availableModels.map((model) => (
                <option key={model.id} value={model.id}>
                  {model.displayName}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Main Content */}
      <div className="bg-white dark:bg-slate-900 rounded-[32px] shadow-sm ring-1 ring-slate-100 dark:ring-slate-800 p-8">
        <div className="grid md:grid-cols-2 gap-6">
          {/* Input Section */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                Текст для проверки
              </h3>
              {inputText && (
                <button
                  onClick={handleReset}
                  className="text-sm text-slate-500 hover:text-brand-500 transition-colors flex items-center gap-1"
                  disabled={isProcessing}
                >
                  <RefreshCw size={14} />
                  Очистить
                </button>
              )}
            </div>

            <textarea
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Введите или вставьте текст для проверки..."
              className="w-full h-96 p-4 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 transition-all resize-none text-slate-900 dark:text-white placeholder:text-slate-400"
              disabled={isProcessing}
            />

            <button
              onClick={handleCheck}
              disabled={!inputText.trim() || isProcessing}
              className="w-full bg-brand-500 hover:bg-brand-600 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-bold py-4 px-6 rounded-2xl transition-all flex items-center justify-center gap-2"
            >
              {isProcessing ? (
                <>
                  <RefreshCw size={20} className="animate-spin" />
                  Проверяю...
                </>
              ) : (
                <>
                  <CheckCircle2 size={20} />
                  Проверить и исправить
                </>
              )}
            </button>
          </div>

          {/* Result Section */}
          <div className="space-y-4">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">
              Результат проверки
            </h3>

            {error && (
              <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-2xl">
                <p className="text-red-600 dark:text-red-400 text-sm">{error}</p>
              </div>
            )}

            {result ? (
              <div className="h-96 p-4 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 overflow-auto">
                <div className="prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap text-slate-900 dark:text-white">
                  {result}
                </div>
              </div>
            ) : (
              <div className="h-96 p-4 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center">
                <p className="text-slate-400 dark:text-slate-500 text-center">
                  {isProcessing
                    ? 'Проверка текста...'
                    : 'Результат проверки появится здесь'
                  }
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default TextCheck;

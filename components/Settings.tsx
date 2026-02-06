import React, { useState, useEffect } from 'react';
import { X, Save, AlertCircle, Check } from 'lucide-react';

interface Props {
  onClose: () => void;
}

type PromptType = 'food' | 'nonfood' | 'inter' | 'ge' | 'textcheck';

interface Prompts {
  food: string;
  nonfood: string;
  inter: string;
  ge: string;
  textcheck: string;
}

const PROMPT_LABELS: Record<PromptType, string> = {
  food: 'Фуд',
  nonfood: 'Нон-фуд',
  inter: 'Межнар',
  ge: 'ГЕ',
  textcheck: 'Проверка текстов'
};

const Settings: React.FC<Props> = ({ onClose }) => {
  const [prompts, setPrompts] = useState<Prompts>({
    food: '',
    nonfood: '',
    inter: '',
    ge: '',
    textcheck: ''
  });
  const [activeTab, setActiveTab] = useState<PromptType>('food');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [originalPrompts, setOriginalPrompts] = useState<Prompts | null>(null);

  // 🔒 ETag для защиты от race conditions
  const [etag, setEtag] = useState<string | null>(null);
  const [conflictData, setConflictData] = useState<{
    serverPrompts: Prompts;
    serverETag: string;
    lastModified: string;
  } | null>(null);

  // Загрузка промптов при монтировании
  useEffect(() => {
    loadPrompts();
  }, []);

  const loadPrompts = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const apiSecret = localStorage.getItem('api_secret');
      if (!apiSecret) {
        throw new Error('API ключ не найден');
      }

      const response = await fetch('/api/prompts', {
        method: 'GET',
        headers: {
          'X-API-Key': apiSecret
        }
      });

      if (!response.ok) {
        throw new Error('Не удалось загрузить промпты');
      }

      const data = await response.json();

      // 🔒 Сохраняем ETag для последующей проверки
      setPrompts(data.prompts);
      setOriginalPrompts(data.prompts);
      setEtag(data.etag);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка загрузки');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    setError(null);
    setSuccess(false);
    setConflictData(null);

    try {
      const apiSecret = localStorage.getItem('api_secret');
      if (!apiSecret) {
        throw new Error('API ключ не найден');
      }

      const response = await fetch('/api/prompts', {
        method: 'POST',
        headers: {
          'X-API-Key': apiSecret,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          prompts,
          etag  // 🔒 Отправляем ETag для проверки
        })
      });

      const data = await response.json();

      // 🔒 Обработка конфликта (409)
      if (response.status === 409) {
        setConflictData({
          serverPrompts: data.currentPrompts,
          serverETag: data.currentETag,
          lastModified: data.lastModified
        });
        setError(data.message || 'Промпты были изменены другим пользователем');
        return;
      }

      if (!response.ok) {
        throw new Error(data.error || 'Не удалось сохранить промпты');
      }

      // Успешно сохранено
      setSuccess(true);
      setHasChanges(false);
      setOriginalPrompts(prompts);
      setEtag(data.etag);  // 🔒 Обновляем ETag

      // Скрыть сообщение об успехе через 3 секунды
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка сохранения');
    } finally {
      setIsSaving(false);
    }
  };

  const handlePromptChange = (type: PromptType, value: string) => {
    setPrompts(prev => ({ ...prev, [type]: value }));
    setHasChanges(true);
  };

  // 🔒 Обработчик конфликта - перезагрузить промпты с сервера
  const handleConflictReload = () => {
    loadPrompts();
    setConflictData(null);
    setError(null);
    setHasChanges(false);
  };

  const handleClose = () => {
    if (hasChanges) {
      if (confirm('У вас есть несохраненные изменения. Вы уверены, что хотите закрыть?')) {
        onClose();
      }
    } else {
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-6xl w-full max-h-[90vh] overflow-hidden shadow-2xl border border-slate-200 dark:border-slate-700">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-200 dark:border-slate-700 bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-slate-800 dark:to-slate-800">
          <h2 className="text-2xl font-bold text-slate-800 dark:text-white">
            Настройки Промптов
          </h2>
          <button
            onClick={handleClose}
            className="p-2 rounded-xl hover:bg-white/50 dark:hover:bg-slate-700/50 transition-colors"
            title="Закрыть"
          >
            <X size={24} className="text-slate-600 dark:text-slate-300" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 px-6 pt-4 border-b border-slate-200 dark:border-slate-700 overflow-x-auto">
          {(Object.keys(PROMPT_LABELS) as PromptType[]).map((type) => (
            <button
              key={type}
              onClick={() => setActiveTab(type)}
              className={`px-6 py-3 rounded-t-xl font-medium transition-all ${
                activeTab === type
                  ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 border-b-2 border-indigo-600 dark:border-indigo-400'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              {PROMPT_LABELS[type]}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto" style={{ maxHeight: 'calc(90vh - 240px)' }}>
          {isLoading ? (
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin rounded-full h-12 w-12 border-4 border-indigo-500 border-t-transparent"></div>
            </div>
          ) : error ? (
            <div className="flex items-center justify-center h-64">
              <div className="text-center">
                <AlertCircle size={48} className="text-red-500 mx-auto mb-4" />
                <p className="text-red-600 dark:text-red-400">{error}</p>
                <button
                  onClick={loadPrompts}
                  className="mt-4 px-4 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors"
                >
                  Попробовать снова
                </button>
              </div>
            </div>
          ) : (
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                Промпт для типа "{PROMPT_LABELS[activeTab]}"
              </label>
              <textarea
                value={prompts[activeTab]}
                onChange={(e) => handlePromptChange(activeTab, e.target.value)}
                className="w-full h-96 px-4 py-3 font-mono text-sm rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none"
                placeholder="Введите промпт..."
                disabled={isSaving}
              />
              <div className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                Символов: {prompts[activeTab].length} / 100,000
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800">
          <div className="flex items-center gap-2">
            {success && (
              <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
                <Check size={20} />
                <span className="font-medium">Промпты успешно сохранены</span>
              </div>
            )}
            {error && !isLoading && (
              <div className="flex items-center gap-2 text-red-600 dark:text-red-400">
                <AlertCircle size={20} />
                <span className="font-medium">{error}</span>
              </div>
            )}
          </div>
          <div className="flex gap-3">
            <button
              onClick={handleClose}
              className="px-6 py-3 rounded-xl font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
              disabled={isSaving}
            >
              Отмена
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving || !hasChanges || isLoading}
              className="px-6 py-3 rounded-xl font-medium bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
            >
              {isSaving ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                  <span>Сохранение...</span>
                </>
              ) : (
                <>
                  <Save size={20} />
                  <span>Сохранить</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* 🔒 Conflict Modal - показывается при обнаружении конфликта */}
      {conflictData && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[60]">
          <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 max-w-md shadow-2xl">
            <div className="flex items-center gap-3 mb-4">
              <AlertCircle size={24} className="text-orange-500" />
              <h3 className="text-xl font-bold text-slate-800 dark:text-white">Конфликт изменений</h3>
            </div>

            <p className="text-slate-600 dark:text-slate-300 mb-2">
              Промпты были изменены другим пользователем во время вашего редактирования.
            </p>
            <p className="text-slate-600 dark:text-slate-300 mb-6">
              Ваши изменения не сохранены. Пожалуйста, обновите страницу и повторите редактирование.
            </p>

            <div className="flex gap-3">
              <button
                onClick={handleConflictReload}
                className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors"
              >
                Обновить и начать заново
              </button>
              <button
                onClick={() => setConflictData(null)}
                className="px-4 py-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl transition-colors"
              >
                Отмена
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Settings;

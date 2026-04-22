import React, { useState, useEffect } from 'react';
import {
  Scan,
  FileText,
  CheckCheck,
  FileSpreadsheet,
  ChevronRight,
  Sun,
  Moon,
  LogOut,
  Settings,
  ArrowLeft,
} from 'lucide-react';
import BriefProcessor from './components/BriefProcessor';
import LabelComparator from './components/LabelComparator';
import FinalCheck from './components/FinalCheck';
import TextCheck from './components/TextCheck';
import Login from './components/Login';
import SettingsModal from './components/Settings';
import BrandSelector from './components/BrandSelector';
import FabrikaQA from './components/FabrikaQA';
import { AppView } from './types';

const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<AppView>('brand-select');
  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    return !!localStorage.getItem('api_secret');
  });
  const [isDarkMode, setIsDarkMode] = useState(() => {
    if (typeof window !== 'undefined') {
      return (
        localStorage.getItem('theme') === 'dark' ||
        (!localStorage.getItem('theme') &&
          window.matchMedia('(prefers-color-scheme: dark)').matches)
      );
    }
    return false;
  });
  const [showSettings, setShowSettings] = useState(false);

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [isDarkMode]);

  const toggleDarkMode = () => setIsDarkMode(!isDarkMode);

  const handleLogin = (apiSecret: string) => {
    localStorage.setItem('api_secret', apiSecret);
    setIsAuthenticated(true);
  };

  const handleLogout = () => {
    localStorage.removeItem('api_secret');
    setIsAuthenticated(false);
    setCurrentView('brand-select');
  };

  if (!isAuthenticated) {
    return <Login onLogin={handleLogin} />;
  }

  const isTopLevel =
    currentView === 'brand-select' ||
    currentView === 'lavka' ||
    currentView === 'fabrika';

  const renderContent = () => {
    switch (currentView) {
      case 'brand-select':
        return (
          <BrandSelector
            onSelectLavka={() => setCurrentView('lavka')}
            onSelectFabrika={() => setCurrentView('fabrika')}
          />
        );

      case 'lavka':
        return (
          <div className="w-full">
            <div className="max-w-6xl mx-auto mb-8">
              <button
                onClick={() => setCurrentView('brand-select')}
                className="inline-flex items-center gap-2 text-slate-500 dark:text-slate-400 hover:text-brand-500 dark:hover:text-brand-400 font-semibold text-sm transition-colors"
              >
                <ArrowLeft size={16} />
                Все сервисы
              </button>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-6xl mx-auto w-full animate-fade-up">
              <button
                onClick={() => setCurrentView('brief')}
                className="group bg-white dark:bg-slate-900 p-10 rounded-[40px] shadow-sm ring-1 ring-slate-100 dark:ring-slate-800 hover:shadow-2xl hover:ring-brand-100 dark:hover:ring-brand-900 transition-all text-left flex flex-col h-full"
              >
                <div className="w-16 h-16 bg-brand-50 dark:bg-brand-900/30 text-brand-500 rounded-[24px] flex items-center justify-center mb-8 group-hover:scale-110 group-hover:bg-brand-500 group-hover:text-white transition-all duration-500">
                  <FileSpreadsheet size={32} />
                </div>
                <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-4">Работа с брифом</h3>
                <p className="text-slate-500 dark:text-slate-400 text-[15px] leading-relaxed mb-8 flex-grow">
                  Загрузите "сырой" Excel бриф. ИИ структурирует данные, исправит кавычки, тире и регистр согласно строгим правилам Яндекса.
                </p>
                <div className="inline-flex items-center gap-1 text-brand-600 dark:text-brand-400 font-bold text-sm tracking-wide group-hover:gap-2 transition-all">
                  НАЧАТЬ ОБРАБОТКУ <ChevronRight size={16} />
                </div>
              </button>

              <button
                onClick={() => setCurrentView('compare')}
                className="group bg-white dark:bg-slate-900 p-10 rounded-[40px] shadow-sm ring-1 ring-slate-100 dark:ring-slate-800 hover:shadow-2xl hover:ring-brand-100 dark:hover:ring-brand-900 transition-all text-left flex flex-col h-full"
              >
                <div className="w-16 h-16 bg-brand-50 dark:bg-brand-900/30 text-brand-500 rounded-[24px] flex items-center justify-center mb-8 group-hover:scale-110 group-hover:bg-brand-500 group-hover:text-white transition-all duration-500">
                  <Scan size={32} />
                </div>
                <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-4">Сверка с брифом</h3>
                <p className="text-slate-500 dark:text-slate-400 text-[15px] leading-relaxed mb-8 flex-grow">
                  Сравнение готовой этикетки с эталоном. ИИ найдет любые расхождения в составе, орфографии и даже регистре букв.
                </p>
                <div className="inline-flex items-center gap-1 text-brand-600 dark:text-brand-400 font-bold text-sm tracking-wide group-hover:gap-2 transition-all">
                  ПЕРЕЙТИ К СВЕРКЕ <ChevronRight size={16} />
                </div>
              </button>

              <button
                onClick={() => setCurrentView('final')}
                className="group bg-white dark:bg-slate-900 p-10 rounded-[40px] shadow-sm ring-1 ring-slate-100 dark:ring-slate-800 hover:shadow-2xl hover:ring-brand-100 dark:hover:ring-brand-900 transition-all text-left flex flex-col h-full"
              >
                <div className="w-16 h-16 bg-brand-50 dark:bg-brand-900/30 text-brand-500 rounded-[24px] flex items-center justify-center mb-8 group-hover:scale-110 group-hover:bg-brand-500 group-hover:text-white transition-all duration-500">
                  <CheckCheck size={32} />
                </div>
                <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-4">Финальная вычитка</h3>
                <p className="text-slate-500 dark:text-slate-400 text-[15px] leading-relaxed mb-8 flex-grow">
                  Проверка макета без сравнения с исходником. Поиск опечаток и контроль правил оформления текста.
                </p>
                <div className="inline-flex items-center gap-1 text-brand-600 dark:text-brand-400 font-bold text-sm tracking-wide group-hover:gap-2 transition-all">
                  НАЧАТЬ ПРОВЕРКУ <ChevronRight size={16} />
                </div>
              </button>

              <button
                onClick={() => setCurrentView('textcheck')}
                className="group bg-white dark:bg-slate-900 p-10 rounded-[40px] shadow-sm ring-1 ring-slate-100 dark:ring-slate-800 hover:shadow-2xl hover:ring-brand-100 dark:hover:ring-brand-900 transition-all text-left flex flex-col h-full"
              >
                <div className="w-16 h-16 bg-brand-50 dark:bg-brand-900/30 text-brand-500 rounded-[24px] flex items-center justify-center mb-8 group-hover:scale-110 group-hover:bg-brand-500 group-hover:text-white transition-all duration-500">
                  <FileText size={32} />
                </div>
                <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-4">Проверка текстов</h3>
                <p className="text-slate-500 dark:text-slate-400 text-[15px] leading-relaxed mb-8 flex-grow">
                  Проверьте произвольный текст на орфографию, пунктуацию и стилистику. ИИ исправит кавычки, тире и укажет на ошибки.
                </p>
                <div className="inline-flex items-center gap-1 text-brand-600 dark:text-brand-400 font-bold text-sm tracking-wide group-hover:gap-2 transition-all">
                  ПРОВЕРИТЬ ТЕКСТ <ChevronRight size={16} />
                </div>
              </button>
            </div>
          </div>
        );

      case 'fabrika':
        return <FabrikaQA onBack={() => setCurrentView('brand-select')} />;

      case 'brief':
        return <BriefProcessor onBack={() => setCurrentView('lavka')} onNavigate={setCurrentView} />;
      case 'compare':
        return <LabelComparator onBack={() => setCurrentView('lavka')} onNavigate={setCurrentView} />;
      case 'final':
        return <FinalCheck onBack={() => setCurrentView('lavka')} onNavigate={setCurrentView} />;
      case 'textcheck':
        return <TextCheck onBack={() => setCurrentView('lavka')} onNavigate={setCurrentView} />;
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center py-16 px-6 sm:px-10 lg:px-12 transition-colors duration-300">

      <div className="max-w-6xl w-full flex justify-end gap-2 mb-4">
        <button
          onClick={toggleDarkMode}
          className="p-3 rounded-2xl glass-card text-slate-500 dark:text-slate-400 hover:text-brand-500 dark:hover:text-brand-400 transition-all shadow-sm"
          aria-label="Toggle theme"
        >
          {isDarkMode ? <Sun size={20} /> : <Moon size={20} />}
        </button>
        <button
          onClick={() => setShowSettings(true)}
          className="p-3 rounded-2xl glass-card text-slate-500 dark:text-slate-400 hover:text-brand-500 dark:hover:text-brand-400 transition-all shadow-sm"
          aria-label="Settings"
          title="Настройки"
        >
          <Settings size={20} />
        </button>
        <button
          onClick={handleLogout}
          className="p-3 rounded-2xl glass-card text-slate-500 dark:text-slate-400 hover:text-red-500 dark:hover:text-red-400 transition-all shadow-sm"
          aria-label="Logout"
          title="Выйти"
        >
          <LogOut size={20} />
        </button>
      </div>

      {isTopLevel && (
        <header className={`max-w-4xl w-full text-center transition-all duration-500 ${currentView === 'brand-select' ? 'mb-16' : 'mb-10'}`}>
          <div className="animate-fade-in">
            <div className="inline-flex items-center justify-center gap-2 mb-8 glass-card px-5 py-2.5 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800">
              <div className="w-8 h-8 bg-brand-500 rounded-lg flex items-center justify-center text-white">
                <Scan size={18} />
              </div>
              <span className="text-lg font-bold tracking-tight text-slate-900 dark:text-white">
                Этикетка <span className="text-brand-500">AI</span>
              </span>
            </div>

            {currentView === 'brand-select' && (
              <>
                <h1 className="text-4xl md:text-5xl lg:text-6xl font-black text-slate-900 dark:text-white mb-6 tracking-tight">
                  Выберите{' '}
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-600 to-indigo-600 dark:from-brand-400 dark:to-indigo-400">
                    сервис
                  </span>
                </h1>
                <p className="text-lg md:text-xl text-slate-500 dark:text-slate-400 max-w-2xl mx-auto leading-relaxed">
                  Автоматизированная система вычитки, сверки и структурирования данных для макетов упаковки продукции.
                </p>
              </>
            )}

            {currentView === 'lavka' && (
              <h1 className="text-3xl md:text-4xl font-black text-slate-900 dark:text-white tracking-tight">
                Лавка
              </h1>
            )}
          </div>
        </header>
      )}

      <main className="w-full flex-grow flex flex-col">
        {renderContent()}
      </main>

      {currentView === 'brand-select' && (
        <footer className="mt-20 text-slate-400 dark:text-slate-600 text-sm font-medium tracking-wide animate-fade-in">
          Made by D.Belov
        </footer>
      )}

      {showSettings && (
        <SettingsModal onClose={() => setShowSettings(false)} />
      )}
    </div>
  );
};

export default App;

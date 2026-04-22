import React from 'react';
import { ArrowLeft, Zap } from 'lucide-react';

interface Props {
  onBack: () => void;
}

const FabrikaHome: React.FC<Props> = ({ onBack }) => {
  return (
    <div className="flex flex-col items-center justify-center flex-grow w-full animate-fade-up">
      <div className="max-w-lg w-full text-center">

        {/* Иконка */}
        <div className="inline-flex items-center justify-center w-24 h-24 bg-amber-100 dark:bg-amber-900/30 rounded-[32px] mb-8 animate-pulse-soft">
          <Zap size={44} className="text-amber-500 dark:text-amber-400" />
        </div>

        {/* Заголовок */}
        <h2 className="text-3xl md:text-4xl font-black text-slate-900 dark:text-white mb-4 tracking-tight">
          Скоро здесь всё заработает
        </h2>

        {/* Подзаголовок */}
        <div className="inline-flex items-center gap-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-400 text-sm font-bold px-4 py-2 rounded-2xl mb-6">
          <span className="w-2 h-2 bg-amber-500 rounded-full animate-ping inline-block" />
          Мы на Хакатоне
        </div>

        <p className="text-slate-500 dark:text-slate-400 text-[16px] leading-relaxed mb-10 max-w-sm mx-auto">
          Команда сейчас в боевом режиме — пишем код, пьём кофе и готовим инструменты для Фабрики. Заходите позже!
        </p>

        {/* Кнопка назад */}
        <button
          onClick={onBack}
          className="inline-flex items-center gap-2 text-slate-500 dark:text-slate-400 hover:text-brand-500 dark:hover:text-brand-400 font-semibold text-sm transition-colors"
        >
          <ArrowLeft size={16} />
          Вернуться к выбору сервиса
        </button>

      </div>
    </div>
  );
};

export default FabrikaHome;

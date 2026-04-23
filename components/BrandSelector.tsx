import React from 'react';
import { ChevronRight } from 'lucide-react';

interface Props {
  onSelectLavka: () => void;
  onSelectFabrika: () => void;
}

const BrandSelector: React.FC<Props> = ({ onSelectLavka, onSelectFabrika }) => {
  return (
    <div className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto w-full animate-fade-up">

      {/* ── Лавка ── */}
      <button
        onClick={onSelectLavka}
        className="group bg-white dark:bg-slate-900 p-12 rounded-[40px] shadow-sm ring-1 ring-slate-100 dark:ring-slate-800 hover:shadow-2xl hover:ring-brand-100 dark:hover:ring-brand-900 transition-all text-left flex flex-col h-full min-h-[380px]"
      >
        <div className="mb-8 h-10 flex items-center">
          <img
            src="/logos/lavka.svg"
            alt="Лавка"
            className="h-10 object-contain dark:invert"
          />
        </div>

        <h3 className="text-2xl font-black text-slate-900 dark:text-white mb-4 tracking-tight">
          Лавка
        </h3>
        <p className="text-slate-500 dark:text-slate-400 text-[15px] leading-relaxed mb-8 flex-grow">
          Инструменты для разработки этикеток: обработка брифов, сверка макета с&nbsp;эталоном и финальная вычитка.
        </p>
        <div className="inline-flex items-center gap-1 text-brand-600 dark:text-brand-400 font-bold text-sm tracking-wide group-hover:gap-2 transition-all">
          ОТКРЫТЬ <ChevronRight size={16} />
        </div>
      </button>

      {/* ── Фабрика ── */}
      <button
        onClick={onSelectFabrika}
        className="group bg-white dark:bg-slate-900 p-12 rounded-[40px] shadow-sm ring-1 ring-slate-100 dark:ring-slate-800 hover:shadow-2xl hover:ring-brand-100 dark:hover:ring-brand-900 transition-all text-left flex flex-col h-full min-h-[380px]"
      >
        <div className="mb-8 h-10 flex items-center">
          {/* Белая подложка в dark mode — у логотипа тёмный текст + цветной иконка */}
          <div className="dark:bg-white dark:rounded-lg dark:px-2 dark:py-1.5">
            <img
              src="/logos/fabrika.svg"
              alt="Фабрика"
              className="h-8 object-contain"
            />
          </div>
        </div>

        <h3 className="text-2xl font-black text-slate-900 dark:text-white mb-4 tracking-tight">
          Фабрика
        </h3>
        <p className="text-slate-500 dark:text-slate-400 text-[15px] leading-relaxed mb-8 flex-grow">
          Batch-проверка PDF-макетов упаковки по бренд-спеке XLSX: сверка текста и знаков манипуляции.
        </p>
        <div className="inline-flex items-center gap-1 text-brand-600 dark:text-brand-400 font-bold text-sm tracking-wide group-hover:gap-2 transition-all">
          ОТКРЫТЬ <ChevronRight size={16} />
        </div>
      </button>

    </div>
  );
};

export default BrandSelector;

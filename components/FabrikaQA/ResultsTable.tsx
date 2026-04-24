import React, { useState } from 'react';
import type { FabrikaJob, FabrikaRowStatus } from '../../types';
import { RowDetail } from './RowDetail';

const STATUS_BADGE: Record<FabrikaRowStatus, { label: string; css: string }> = {
  pending:   { label: '…',         css: 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400' },
  analyzing: { label: 'идёт',      css: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300' },
  done:      { label: 'готово',    css: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300' },
  error:     { label: 'ошибка',    css: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300' },
  'no-spec': { label: 'нет спеки', css: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300' },
};

export function ResultsTable({ job, jobId, onRetry }: {
  job: FabrikaJob;
  jobId: string;
  onRetry: (rowId: string) => void;
}) {
  const [expanded, setExpanded] = useState<string | null>(null);

  return (
    <div className="bg-white dark:bg-slate-900 rounded-[32px] shadow-sm ring-1 ring-slate-100 dark:ring-slate-800 overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-100 dark:border-slate-800 text-left">
            <th className="px-6 py-4 text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">
              PDF
            </th>
            <th className="px-2 py-4 text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">
              Статус
            </th>
            <th className="px-2 py-4 text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">
              Категория
            </th>
            <th className="px-2 py-4 text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">
              Время
            </th>
            <th className="px-6 py-4" />
          </tr>
        </thead>
        <tbody>
          {job.rows.map((row) => (
            <React.Fragment key={row.id}>
              <tr
                className="cursor-pointer border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                onClick={() => setExpanded((id) => (id === row.id ? null : row.id))}
              >
                <td className="px-6 py-3 font-mono text-xs text-slate-700 dark:text-slate-300">
                  {row.pdfName}
                </td>
                <td className="px-2 py-3">
                  <span className={`rounded-lg px-2.5 py-1 text-xs font-semibold ${STATUS_BADGE[row.status].css}`}>
                    {STATUS_BADGE[row.status].label}
                  </span>
                </td>
                <td className="px-2 py-3 text-xs text-slate-500 dark:text-slate-400">
                  {row.matchedColumn?.sheet ?? '—'}
                </td>
                <td className="px-2 py-3 text-xs text-slate-500 dark:text-slate-400">
                  {row.durationMs ? `${(row.durationMs / 1000).toFixed(1)} с` : ''}
                </td>
                <td className="px-6 py-3">
                  {row.status === 'error' && (
                    <button
                      className="text-xs text-brand-600 dark:text-brand-400 font-semibold underline hover:no-underline transition-all"
                      onClick={(e) => { e.stopPropagation(); onRetry(row.id); }}
                    >
                      Повторить
                    </button>
                  )}
                </td>
              </tr>
              {expanded === row.id && (
                <tr>
                  <td colSpan={5} className="bg-slate-50 dark:bg-slate-800/60 px-6 py-5">
                    <RowDetail jobId={jobId} rowId={row.id} row={row} />
                  </td>
                </tr>
              )}
            </React.Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}

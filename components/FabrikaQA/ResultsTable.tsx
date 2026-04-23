import React, { useState } from 'react';
import type { FabrikaJob, FabrikaRow, FabrikaRowStatus } from '../../types';
import { RowDetail } from './RowDetail';

const STATUS_BADGE: Record<FabrikaRowStatus, { label: string; css: string }> = {
  pending:   { label: '…',         css: 'bg-neutral-100 text-neutral-600' },
  analyzing: { label: 'идёт',      css: 'bg-blue-100 text-blue-700' },
  done:      { label: 'готово',    css: 'bg-green-100 text-green-700' },
  error:     { label: 'ошибка',    css: 'bg-red-100 text-red-700' },
  'no-spec': { label: 'нет спеки', css: 'bg-amber-100 text-amber-700' },
};

export function ResultsTable({ job, jobId, onRetry }: {
  job: FabrikaJob;
  jobId: string;
  onRetry: (rowId: string) => void;
}) {
  const [expanded, setExpanded] = useState<string | null>(null);
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b text-left text-neutral-500">
          <th className="py-2">PDF</th>
          <th>Статус</th>
          <th>Категория</th>
          <th>Время, мс</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        {job.rows.map((row) => (
          <React.Fragment key={row.id}>
            <tr
              className="cursor-pointer border-b hover:bg-neutral-50"
              onClick={() => setExpanded((id) => (id === row.id ? null : row.id))}
            >
              <td className="py-2 font-mono text-xs">{row.pdfName}</td>
              <td>
                <span className={`rounded px-2 py-0.5 text-xs ${STATUS_BADGE[row.status].css}`}>
                  {STATUS_BADGE[row.status].label}
                </span>
              </td>
              <td className="text-xs text-neutral-500">{row.matchedColumn?.sheet ?? '—'}</td>
              <td className="text-xs">{row.durationMs ?? ''}</td>
              <td>
                {row.status === 'error' && (
                  <button
                    className="text-xs text-blue-600 underline"
                    onClick={(e) => { e.stopPropagation(); onRetry(row.id); }}
                  >retry</button>
                )}
              </td>
            </tr>
            {expanded === row.id && (
              <tr><td colSpan={5} className="bg-neutral-50 p-4">
                <RowDetail jobId={jobId} rowId={row.id} row={row} />
              </td></tr>
            )}
          </React.Fragment>
        ))}
      </tbody>
    </table>
  );
}

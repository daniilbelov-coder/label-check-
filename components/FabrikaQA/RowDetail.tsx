import React, { useEffect, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import type { FabrikaRow } from '../../types';
import { getRowDetail } from '../../services/fabrikaClient';

export function RowDetail({ jobId, rowId, row }: { jobId: string; rowId: string; row: FabrikaRow }) {
  const [full, setFull] = useState<FabrikaRow>(row);
  useEffect(() => {
    if (row.status === 'done' && !row.mainMd) {
      getRowDetail(jobId, rowId).then(setFull).catch(() => { /* keep current row */ });
    } else {
      setFull(row);
    }
  }, [jobId, rowId, row]);

  if (full.status === 'error') return <div className="text-red-700 dark:text-red-400">Ошибка: {full.error}</div>;
  if (full.status === 'no-spec') return <div className="text-amber-700 dark:text-amber-400">Нет подходящей колонки в XLSX для этого PDF.</div>;
  if (!full.mainMd) return <div className="text-slate-500 dark:text-slate-400">Загрузка…</div>;

  return (
    <div className="space-y-4">
      <div className="prose prose-sm max-w-none dark:prose-invert">
        <ReactMarkdown>{full.mainMd}</ReactMarkdown>
      </div>
      {full.signResults && full.signResults.length > 0 && (
        <details>
          <summary className="cursor-pointer text-sm">Знаки ({full.signResults.length})</summary>
          <ul className="mt-2 space-y-2">
            {full.signResults.map((s, i) => (
              <li key={i} className="rounded bg-white dark:bg-slate-900 p-2 text-xs">
                <div className="font-mono">{s.name}</div>
                {s.error ? <div className="text-red-700 dark:text-red-400">{s.error}</div> : <pre className="whitespace-pre-wrap">{s.raw}</pre>}
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

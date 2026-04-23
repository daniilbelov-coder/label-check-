import React, { useEffect, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import type { FabrikaRow } from '../../types';
import { getRowDetail } from '../../services/fabrikaClient';

function extractSignName(raw: string): string | null {
  const fence = raw.match(/```json\s*([\s\S]*?)\s*```/);
  const obj = raw.match(/\{[\s\S]*\}/);
  const candidate = fence ? fence[1] : obj ? obj[0] : null;
  if (!candidate) return null;
  try {
    const p = JSON.parse(candidate);
    return typeof p.signName === 'string' && p.signName.trim() ? p.signName.trim() : null;
  } catch { return null; }
}

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
            {full.signResults.map((s, i) => {
              const niceName = s.error ? null : extractSignName(s.raw);
              return (
                <li key={i} className="rounded bg-white dark:bg-slate-900 p-2 text-xs">
                  <div>
                    {niceName ? <span className="font-semibold">{niceName}</span> : null}
                    <span className="ml-2 font-mono text-slate-400 dark:text-slate-500">{s.name}</span>
                  </div>
                  {s.error ? <div className="text-red-700 dark:text-red-400">{s.error}</div> : <pre className="whitespace-pre-wrap">{s.raw}</pre>}
                </li>
              );
            })}
          </ul>
        </details>
      )}
    </div>
  );
}

import React, { useEffect, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import type { FabrikaRow } from '../../types';
import { getRowDetail } from '../../services/fabrikaClient';

interface ParsedSign {
  signName: string | null;
  found: boolean;
  confidence: 'high' | 'medium' | 'low';
  location: string | null;
  notes: string | null;
}

function parseSignRaw(raw: string): ParsedSign {
  const fence = raw.match(/```json\s*([\s\S]*?)\s*```/);
  const obj = raw.match(/\{[\s\S]*\}/);
  const candidate = fence?.[1] ?? obj?.[0] ?? null;
  if (candidate) {
    try {
      const p = JSON.parse(candidate);
      return {
        signName: typeof p.signName === 'string' && p.signName.trim() ? p.signName.trim() : null,
        found: Boolean(p.found),
        confidence: p.confidence === 'high' || p.confidence === 'medium' ? p.confidence : 'low',
        location: p.location ?? null,
        notes: p.notes ?? null,
      };
    } catch { /* fall through */ }
  }
  return { signName: null, found: false, confidence: 'low', location: null, notes: String(raw).slice(0, 300) };
}

function stripSignSection(mainMd: string): string {
  return mainMd.split(/\n##\s+Знаки манипуляции/)[0].trim();
}

export function RowDetail({ jobId, rowId, row }: { jobId: string; rowId: string; row: FabrikaRow }) {
  const [full, setFull] = useState<FabrikaRow>(row);

  useEffect(() => {
    if (row.status === 'done' && !row.mainMd) {
      getRowDetail(jobId, rowId).then(setFull).catch(() => {});
    } else {
      setFull(row);
    }
  }, [jobId, rowId, row]);

  if (full.status === 'error') {
    return (
      <div className="flex items-start gap-2 text-sm text-red-600 dark:text-red-400 font-medium">
        <span className="shrink-0 mt-0.5">⚠</span>
        <span>{full.error}</span>
      </div>
    );
  }

  if (full.status === 'no-spec') {
    return (
      <div className="text-sm text-amber-600 dark:text-amber-400 font-medium">
        Нет подходящей колонки в XLSX для этого PDF.
      </div>
    );
  }

  if (!full.mainMd) {
    return <div className="text-sm text-slate-400">Загрузка…</div>;
  }

  const mainReport = stripSignSection(full.mainMd);
  const signs = full.signResults ?? [];

  return (
    <div className="space-y-3 py-1">

      {/* Main QA report */}
      <div className="bg-white dark:bg-slate-900 rounded-[20px] ring-1 ring-slate-100 dark:ring-slate-800 p-5">
        <p className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-4">
          Основной отчёт
        </p>
        <div className="prose prose-sm max-w-none dark:prose-invert
          prose-headings:font-bold
          prose-headings:text-slate-800 dark:prose-headings:text-slate-200
          prose-h2:text-[15px] prose-h2:mt-5 prose-h2:mb-2 prose-h2:first:mt-0
          prose-p:text-slate-600 dark:prose-p:text-slate-300 prose-p:my-1 prose-p:leading-relaxed
          prose-li:text-slate-600 dark:prose-li:text-slate-300 prose-li:my-0.5
          prose-strong:text-slate-800 dark:prose-strong:text-slate-200
          prose-ul:my-1 prose-ol:my-1
        ">
          <ReactMarkdown>{mainReport}</ReactMarkdown>
        </div>
      </div>

      {/* Detailed sign checks */}
      {signs.length > 0 && (
        <div className="bg-white dark:bg-slate-900 rounded-[20px] ring-1 ring-slate-100 dark:ring-slate-800 p-5">
          <p className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-4">
            Детальная сверка знаков · {signs.length} шт.
          </p>
          <div className="space-y-2">
            {signs.map((s, i) => {
              const p = s.error
                ? { found: false, confidence: 'low' as const, signName: null, location: null, notes: s.error }
                : parseSignRaw(s.raw);
              const icon = !p.found ? '❌' : p.confidence === 'low' ? '⚠️' : '✅';
              const label = p.signName || s.name;
              const statusText = p.found
                ? (p.location ? `Найден — ${p.location}` : 'Найден')
                : 'Не найден';
              return (
                <div
                  key={i}
                  className={`flex gap-3 items-start rounded-xl p-3 ${
                    !p.found
                      ? 'bg-red-50 dark:bg-red-950/30 ring-1 ring-red-100 dark:ring-red-900/30'
                      : p.confidence === 'low'
                      ? 'bg-amber-50 dark:bg-amber-950/30 ring-1 ring-amber-100 dark:ring-amber-900/30'
                      : 'bg-green-50 dark:bg-green-950/30 ring-1 ring-green-100 dark:ring-green-900/30'
                  }`}
                >
                  <span className="text-base leading-none mt-0.5 shrink-0">{icon}</span>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold text-slate-800 dark:text-slate-200 leading-snug">{label}</div>
                    <div className={`text-xs mt-0.5 font-medium ${
                      !p.found
                        ? 'text-red-600 dark:text-red-400'
                        : p.confidence === 'low'
                        ? 'text-amber-600 dark:text-amber-400'
                        : 'text-green-600 dark:text-green-400'
                    }`}>
                      {statusText}
                    </div>
                    {p.notes && (
                      <div className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">{p.notes}</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

    </div>
  );
}

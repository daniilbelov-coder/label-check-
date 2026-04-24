import React, { useEffect, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { Download, CheckCircle2, AlertCircle } from 'lucide-react';
import type { FabrikaRow } from '../../types';
import { getRowDetail } from '../../services/fabrikaClient';
import { parseQAReport, type DiscrepancyItem, type ParsedQAReport } from '../../utils/parseQAReport';

// ── Sign result parser ───────────────────────────────────────────────────────

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
  return { signName: null, found: false, confidence: 'low', location: null, notes: String(raw).slice(0, 200) };
}

// ── Utils ────────────────────────────────────────────────────────────────────

function doDownload(mainMd: string, pdfName: string) {
  const blob = new Blob([mainMd], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `QA_${pdfName.replace(/\.pdf$/i, '')}.txt`;
  a.click();
  URL.revokeObjectURL(url);
}

// ── Sub-components ───────────────────────────────────────────────────────────

function StatCard({
  count, label, sub, numCls, cardCls,
}: {
  count: number; label: string; sub?: string; numCls: string; cardCls: string;
}) {
  return (
    <div className={`flex-1 min-w-0 rounded-2xl p-4 ${cardCls}`}>
      <div className={`text-2xl font-bold leading-none mb-1 ${numCls}`}>{count}</div>
      <div className="text-sm font-semibold text-slate-700 dark:text-slate-200 leading-tight">{label}</div>
      {sub && <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 leading-snug">{sub}</div>}
    </div>
  );
}

function Item({ item }: { item: DiscrepancyItem }) {
  const [open, setOpen] = useState(false);
  const hasComp = !!(item.inLayout || item.inSpec);

  return (
    <div className="py-3 border-b border-slate-100 dark:border-slate-800/70 last:border-0">
      <div className="flex items-start gap-3">
        <span className="text-slate-300 dark:text-slate-600 mt-0.5 shrink-0">•</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              {item.title && (
                <span className="text-sm font-semibold text-slate-800 dark:text-slate-200 block">
                  {item.title}
                </span>
              )}
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">
                {item.description}
              </p>
            </div>
            {hasComp && (
              <button
                onClick={() => setOpen(o => !o)}
                className="shrink-0 text-xs font-semibold text-brand-600 dark:text-brand-400
                  px-2.5 py-1 rounded-lg bg-brand-50 dark:bg-brand-900/20
                  hover:bg-brand-100 dark:hover:bg-brand-900/40 transition-colors whitespace-nowrap"
              >
                {open ? 'Свернуть' : 'Сравнить'}
              </button>
            )}
          </div>

          {open && hasComp && (
            <div className="mt-2 grid grid-cols-2 gap-2">
              <div className="rounded-xl bg-red-50 dark:bg-red-950/30 ring-1 ring-red-100 dark:ring-red-900/30 p-3">
                <div className="text-[10px] font-bold uppercase tracking-widest text-red-400 mb-1">В макете</div>
                <div className="text-sm font-mono text-red-700 dark:text-red-300 break-all">
                  {item.inLayout ?? '—'}
                </div>
              </div>
              <div className="rounded-xl bg-green-50 dark:bg-green-950/30 ring-1 ring-green-100 dark:ring-green-900/30 p-3">
                <div className="text-[10px] font-bold uppercase tracking-widest text-green-400 mb-1">В ТЗ (эталон)</div>
                <div className="text-sm font-mono text-green-700 dark:text-green-300 break-all">
                  {item.inSpec ?? '—'}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Section({
  emoji, title, items, emptyText,
}: {
  emoji: string; title: string; items: DiscrepancyItem[]; emptyText: string;
}) {
  return (
    <div className="bg-white dark:bg-slate-900 rounded-[20px] ring-1 ring-slate-100 dark:ring-slate-800 overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100 dark:border-slate-800">
        <div className="flex items-center gap-2">
          <span className="text-sm">{emoji}</span>
          <span className="text-sm font-bold text-slate-800 dark:text-slate-200">{title}</span>
        </div>
        <span className="text-sm font-bold tabular-nums text-slate-400 dark:text-slate-500">
          {items.length}
        </span>
      </div>
      <div className="px-5">
        {items.length === 0 ? (
          <div className="py-3.5 flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
            <CheckCircle2 size={14} className="shrink-0" />
            <span>{emptyText}</span>
          </div>
        ) : (
          items.map((item, i) => <Item key={i} item={item} />)
        )}
      </div>
    </div>
  );
}

// ── Main export ──────────────────────────────────────────────────────────────

export function RowDetail({
  jobId, rowId, row,
}: {
  jobId: string; rowId: string; row: FabrikaRow;
}) {
  const [full, setFull] = useState<FabrikaRow>(row);
  const [rawMode, setRawMode] = useState(false);

  useEffect(() => {
    if (row.status === 'done' && !row.mainMd) {
      getRowDetail(jobId, rowId).then(setFull).catch(() => {});
    } else {
      setFull(row);
    }
  }, [jobId, rowId, row]);

  if (full.status === 'error') {
    return (
      <div className="flex items-start gap-2 text-sm text-red-600 dark:text-red-400 font-medium py-1">
        <AlertCircle size={14} className="shrink-0 mt-0.5" />
        <span>{full.error}</span>
      </div>
    );
  }
  if (full.status === 'no-spec') {
    return (
      <div className="text-sm text-amber-600 dark:text-amber-400 font-medium py-1">
        Нет подходящей колонки в XLSX для этого PDF.
      </div>
    );
  }
  if (!full.mainMd) {
    return <div className="text-sm text-slate-400 py-1">Загрузка…</div>;
  }

  const report = parseQAReport(full.mainMd);
  const signResults = full.signResults ?? [];
  const total = report
    ? report.criticalCount + report.significantCount + report.minorCount
    : 0;
  const isApproved = report ? /допустить|принято|approved/i.test(report.verdict) : false;

  // View toggle — shown at the top of every expanded row
  const ViewToggle = () => (
    <div className="flex items-center gap-1 rounded-xl bg-slate-100 dark:bg-slate-800 p-1 self-start">
      <button
        onClick={() => setRawMode(false)}
        className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
          !rawMode
            ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
            : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
        }`}
      >
        Структурированный
      </button>
      <button
        onClick={() => setRawMode(true)}
        className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
          rawMode
            ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
            : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
        }`}
      >
        Исходный текст
      </button>
    </div>
  );

  // Raw (old) view
  if (rawMode) {
    return (
      <div className="space-y-3 py-2">
        <ViewToggle />
        <div className="bg-white dark:bg-slate-900 rounded-[20px] ring-1 ring-slate-100 dark:ring-slate-800 p-5">
          <div className="prose prose-sm max-w-none dark:prose-invert
            prose-headings:font-bold prose-headings:text-slate-800 dark:prose-headings:text-slate-200
            prose-h2:text-[15px] prose-h2:mt-5 prose-h2:mb-2 prose-h2:first:mt-0
            prose-p:text-slate-600 dark:prose-p:text-slate-300 prose-p:my-1 prose-p:leading-relaxed
            prose-li:text-slate-600 dark:prose-li:text-slate-300 prose-li:my-0.5
            prose-strong:text-slate-800 dark:prose-strong:text-slate-200
            prose-ul:my-1 prose-ol:my-1">
            <ReactMarkdown>{full.mainMd}</ReactMarkdown>
          </div>
        </div>
        {signResults.length > 0 && (
          <div className="bg-white dark:bg-slate-900 rounded-[20px] ring-1 ring-slate-100 dark:ring-slate-800 p-5">
            <p className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-4">
              Детальная сверка знаков · {signResults.length} шт.
            </p>
            <div className="space-y-2">
              {signResults.map((s, i) => {
                const p = s.error
                  ? { found: false, confidence: 'low' as const, signName: null, location: null, notes: s.error }
                  : parseSignRaw(s.raw);
                const icon = !p.found ? '❌' : p.confidence === 'low' ? '⚠️' : '✅';
                return (
                  <div key={i} className={`flex gap-3 items-start rounded-xl p-3 ${
                    !p.found
                      ? 'bg-red-50 dark:bg-red-950/30 ring-1 ring-red-100 dark:ring-red-900/30'
                      : p.confidence === 'low'
                      ? 'bg-amber-50 dark:bg-amber-950/30 ring-1 ring-amber-100 dark:ring-amber-900/30'
                      : 'bg-green-50 dark:bg-green-950/30 ring-1 ring-green-100 dark:ring-green-900/30'
                  }`}>
                    <span className="text-base leading-none mt-0.5 shrink-0">{icon}</span>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                        {p.signName || s.name}
                      </div>
                      <div className={`text-xs mt-0.5 font-medium ${
                        !p.found ? 'text-red-600 dark:text-red-400'
                        : p.confidence === 'low' ? 'text-amber-600 dark:text-amber-400'
                        : 'text-green-600 dark:text-green-400'
                      }`}>
                        {p.found ? (p.location ? `Найден — ${p.location}` : 'Найден') : 'Не найден'}
                      </div>
                      {p.notes && (
                        <div className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                          {p.notes}
                        </div>
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

  // Structured view — fallback to raw if parsing failed
  if (!report) {
    return (
      <div className="space-y-3 py-2">
        <ViewToggle />
        <pre className="text-xs text-slate-600 dark:text-slate-300 whitespace-pre-wrap leading-relaxed">
          {full.mainMd}
        </pre>
      </div>
    );
  }

  return (
    <div className="space-y-3 py-2">

      {/* Section title + meta */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h3 className="text-[15px] font-bold text-slate-800 dark:text-slate-200">
            Результаты проверки
          </h3>
          {(report.model || report.packageType) && (
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
              {[report.model, report.packageType, report.specColumn && `Спека: ${report.specColumn}`]
                .filter(Boolean)
                .join(' · ')}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <ViewToggle />
          <button
            onClick={() => doDownload(full.mainMd!, full.pdfName)}
            className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 dark:text-slate-400
              hover:text-slate-900 dark:hover:text-white transition-colors
              px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800
              hover:bg-slate-200 dark:hover:bg-slate-700"
          >
            <Download size={13} /> Скачать
          </button>
        </div>
      </div>

      {/* Summary stats */}
      <div className="flex gap-2">
        <StatCard
          count={report.criticalCount}
          label="Критические"
          sub="Ошибки, блокирующие выпуск"
          numCls={report.criticalCount > 0 ? 'text-red-500 dark:text-red-400' : 'text-slate-400'}
          cardCls={report.criticalCount > 0
            ? 'bg-red-50 dark:bg-red-950/30 ring-1 ring-red-100 dark:ring-red-900/30'
            : 'bg-slate-50 dark:bg-slate-800/50 ring-1 ring-slate-100 dark:ring-slate-800'}
        />
        <StatCard
          count={report.significantCount}
          label="Значимые"
          sub="Существенные расхождения"
          numCls={report.significantCount > 0 ? 'text-amber-500 dark:text-amber-400' : 'text-slate-400'}
          cardCls={report.significantCount > 0
            ? 'bg-amber-50 dark:bg-amber-950/30 ring-1 ring-amber-100 dark:ring-amber-900/30'
            : 'bg-slate-50 dark:bg-slate-800/50 ring-1 ring-slate-100 dark:ring-slate-800'}
        />
        <StatCard
          count={report.minorCount}
          label="Незначительные"
          sub="Замечания и рекомендации"
          numCls={report.minorCount > 0 ? 'text-blue-500 dark:text-blue-400' : 'text-slate-400'}
          cardCls={report.minorCount > 0
            ? 'bg-blue-50 dark:bg-blue-950/30 ring-1 ring-blue-100 dark:ring-blue-900/30'
            : 'bg-slate-50 dark:bg-slate-800/50 ring-1 ring-slate-100 dark:ring-slate-800'}
        />
        <StatCard
          count={total}
          label="Всего расхождений"
          numCls="text-slate-600 dark:text-slate-300"
          cardCls="bg-slate-100 dark:bg-slate-800 ring-1 ring-slate-200 dark:ring-slate-700"
        />
      </div>

      {/* Discrepancy sections */}
      <Section
        emoji="🔴"
        title="Критические расхождения"
        items={report.critical}
        emptyText="Критических расхождений не обнаружено"
      />
      <Section
        emoji="🟡"
        title="Значимые расхождения"
        items={report.significant}
        emptyText="Значимых расхождений не обнаружено"
      />
      <Section
        emoji="🟢"
        title="Незначительные расхождения / замечания"
        items={report.minor}
        emptyText="Незначительных расхождений не обнаружено"
      />

      {/* Signs + Fields — two columns */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">

        {/* Signs */}
        <div className="bg-white dark:bg-slate-900 rounded-[20px] ring-1 ring-slate-100 dark:ring-slate-800 p-5">
          <p className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-3">
            Знаки и изображения
          </p>

          {/* Prefer structured signResults; fall back to text lines from main report */}
          {signResults.length > 0 ? (
            <div className="space-y-2">
              {signResults.map((s, i) => {
                const p = s.error
                  ? { found: false, confidence: 'low' as const, signName: null, location: null, notes: s.error }
                  : parseSignRaw(s.raw);
                const icon = !p.found ? '❌' : p.confidence === 'low' ? '⚠️' : '✅';
                const label = p.signName || s.name;
                return (
                  <div key={i} className="flex items-start gap-2">
                    <span className="shrink-0 text-sm leading-none mt-0.5">{icon}</span>
                    <div className="min-w-0">
                      <div className="text-sm text-slate-700 dark:text-slate-300 font-medium leading-snug">
                        {label}
                      </div>
                      {p.found && p.location && (
                        <div className="text-xs text-slate-400 mt-0.5">{p.location}</div>
                      )}
                      {!p.found && p.notes && (
                        <div className="text-xs text-red-500 dark:text-red-400 mt-0.5 leading-relaxed">
                          {p.notes}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : report.signs.length > 0 ? (
            <div className="space-y-1.5">
              {report.signs.map((s, i) => {
                const fail = /отсутствует/i.test(s) && !/присутствует/i.test(s);
                return (
                  <div key={i} className="flex items-start gap-2 text-sm">
                    <span className="shrink-0 mt-0.5">{fail ? '❌' : '✅'}</span>
                    <span className="text-slate-600 dark:text-slate-300 leading-snug">{s}</span>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-xs text-slate-400">Нет данных о знаках</p>
          )}
        </div>

        {/* Fields */}
        <div className="bg-white dark:bg-slate-900 rounded-[20px] ring-1 ring-slate-100 dark:ring-slate-800 p-5 space-y-4">
          <div>
            <p className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-2">
              Поля, отсутствующие в макете
            </p>
            {report.missingInLayout.length === 0 ? (
              <div className="flex items-center gap-1.5 text-xs text-green-600 dark:text-green-400">
                <CheckCircle2 size={13} className="shrink-0" />
                Все обязательные поля из ТЗ присутствуют.
              </div>
            ) : (
              <ul className="space-y-1">
                {report.missingInLayout.map((f, i) => (
                  <li key={i} className="flex items-start gap-1.5 text-xs text-red-600 dark:text-red-400">
                    <span className="shrink-0 mt-0.5">✗</span>
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div>
            <p className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-2">
              Поля на макете, отсутствующие в ТЗ
            </p>
            {report.extraInLayout.length === 0 ? (
              <div className="text-xs text-slate-400">Нет лишних полей</div>
            ) : (
              <ul className="space-y-1">
                {report.extraInLayout.map((f, i) => (
                  <li key={i} className="flex items-start gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                    <span className="shrink-0 mt-0.5">!</span>
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>

      {/* Verdict bar */}
      {report.verdict && (
        <div className={`rounded-[20px] p-4 flex flex-wrap items-center gap-4 ${
          isApproved
            ? 'bg-green-50 dark:bg-green-950/30 ring-1 ring-green-100 dark:ring-green-900/30'
            : 'bg-amber-50 dark:bg-amber-950/30 ring-1 ring-amber-100 dark:ring-amber-900/30'
        }`}>
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <span className="text-2xl shrink-0">{isApproved ? '✅' : '⚠️'}</span>
            <div className="min-w-0">
              <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-0.5">
                Итоговый вердикт
              </div>
              <div className={`text-base font-bold leading-tight ${
                isApproved ? 'text-green-700 dark:text-green-300' : 'text-amber-700 dark:text-amber-300'
              }`}>
                {report.verdict}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4 text-xs shrink-0">
            <div className="text-center">
              <div className="text-base font-bold text-red-500 dark:text-red-400 leading-none">
                {report.criticalCount}
              </div>
              <div className="text-slate-400 mt-0.5">Критических</div>
            </div>
            <div className="text-center">
              <div className="text-base font-bold text-amber-500 dark:text-amber-400 leading-none">
                {report.significantCount}
              </div>
              <div className="text-slate-400 mt-0.5">Значимых</div>
            </div>
            <div className="text-center">
              <div className="text-base font-bold text-blue-500 dark:text-blue-400 leading-none">
                {report.minorCount}
              </div>
              <div className="text-slate-400 mt-0.5">Незначит.</div>
            </div>
          </div>

          <button
            onClick={() => doDownload(full.mainMd!, full.pdfName)}
            className="flex items-center gap-2 px-4 py-2 rounded-full bg-brand-600 hover:bg-brand-700
              text-white text-sm font-semibold transition-colors shrink-0"
          >
            <Download size={14} /> Скачать отчёт
          </button>
        </div>
      )}

    </div>
  );
}

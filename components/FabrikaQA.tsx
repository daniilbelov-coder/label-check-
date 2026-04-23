import React, { useEffect, useRef, useState } from 'react';
import { ArrowLeft, RefreshCw, Scan, AlertTriangle } from 'lucide-react';
import type { FabrikaJob, FabrikaJobSettings } from '../types';
import { UploadPanel } from './FabrikaQA/UploadPanel';
import { ResultsTable } from './FabrikaQA/ResultsTable';
import { createJob, pollJob, retryRow } from '../services/fabrikaClient';

type Stage = 'upload' | 'running' | 'done';

export default function FabrikaQA({ onBack }: { onBack?: () => void }) {
  const [stage, setStage] = useState<Stage>('upload');
  const [jobId, setJobId] = useState<string | null>(null);
  const [job, setJob] = useState<FabrikaJob | null>(null);
  const [error, setError] = useState<string | null>(null);
  const pollRef = useRef<number | null>(null);

  useEffect(() => () => { if (pollRef.current) window.clearInterval(pollRef.current); }, []);

  const handleSubmit = async (xlsx: File, zip: File, settings: FabrikaJobSettings, selectedKeys: string[]) => {
    setError(null);
    try {
      const { jobId } = await createJob(xlsx, zip, settings, selectedKeys);
      setJobId(jobId);
      setStage('running');
      pollRef.current = window.setInterval(async () => {
        try {
          const j = await pollJob(jobId);
          setJob(j);
          if (j.status === 'done' || j.status === 'error') {
            if (pollRef.current) { window.clearInterval(pollRef.current); pollRef.current = null; }
            setStage('done');
          }
        } catch (e: any) { setError(e.message); }
      }, 1500);
    } catch (e: any) { setError(e.message); }
  };

  const handleRetry = async (rowId: string) => {
    if (!jobId) return;
    try { await retryRow(jobId, rowId); } catch (e: any) { setError(e.message); }
  };

  const reset = () => {
    if (pollRef.current) window.clearInterval(pollRef.current);
    setJobId(null); setJob(null); setStage('upload'); setError(null);
  };

  return (
    <div className="max-w-6xl mx-auto w-full px-4 animate-fade-up">

      {/* Header */}
      <div className="flex flex-col items-center mb-12 relative">
        <button
          onClick={onBack}
          className="absolute left-0 top-1/2 -translate-y-1/2 hidden lg:flex items-center text-slate-400 dark:text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors font-medium text-sm"
        >
          <ArrowLeft size={18} className="mr-2" /> Назад
        </button>

        <div className="flex items-center justify-center gap-2 mb-8 glass-card px-4 py-2 rounded-2xl">
          <div className="w-8 h-8 bg-brand-500 rounded-lg flex items-center justify-center text-white">
            <Scan size={18} />
          </div>
          <span className="text-sm font-bold tracking-tight dark:text-white">
            Этикетка <span className="text-brand-500">AI</span>
          </span>
        </div>

        <h1 className="text-3xl md:text-4xl font-bold text-slate-900 dark:text-white mb-4 text-center">
          Фабрика QA — пакетная проверка
        </h1>
        <p className="text-slate-500 dark:text-slate-400 text-center max-w-2xl leading-relaxed">
          Загрузите XLSX со спецификацией товаров и ZIP-архив с PDF-макетами.<br />
          ИИ проверит каждый макет и выявит расхождения.
        </p>
      </div>

      {/* Error */}
      {error && (
        <div className="max-w-2xl mx-auto bg-red-50 dark:bg-red-900/10 border border-red-100 dark:border-red-900/30 p-4 rounded-2xl text-red-600 dark:text-red-400 flex gap-3 mb-8 animate-fade-in">
          <AlertTriangle className="shrink-0" size={18} />
          <span className="text-sm font-medium">{error}</span>
        </div>
      )}

      {/* Upload stage */}
      {stage === 'upload' && <UploadPanel onSubmit={handleSubmit} />}

      {/* Running / done stage */}
      {(stage === 'running' || stage === 'done') && (
        <div className="space-y-6">
          {!job && (
            <div className="text-center text-slate-500 dark:text-slate-400 py-8">Загрузка…</div>
          )}
          {job && <ProgressBar job={job} />}
          {job && <ResultsTable job={job} jobId={jobId!} onRetry={handleRetry} />}

          <div className="flex justify-center pb-20">
            <button
              onClick={reset}
              className="px-8 py-3 rounded-full border border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white transition-all flex items-center gap-2"
            >
              <RefreshCw size={18} /> Новый батч
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function ProgressBar({ job }: { job: FabrikaJob }) {
  const pct = job.totalPdfs ? Math.round((job.completedPdfs / job.totalPdfs) * 100) : 0;
  const isDone = job.status === 'done' || job.status === 'error';
  return (
    <div className="glass-card rounded-2xl p-1">
      <div className="bg-white dark:bg-slate-900 rounded-[20px] p-5">
        <div className="mb-3 flex justify-between text-xs font-semibold text-slate-500 dark:text-slate-400">
          <span>{job.completedPdfs} / {job.totalPdfs} PDF проверено</span>
          <span className={job.errorCount > 0 ? 'text-red-500 dark:text-red-400' : ''}>
            {job.errorCount > 0
              ? `ошибок: ${job.errorCount}`
              : isDone ? 'Завершено ✓' : 'В работе…'}
          </span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
          <div
            className="h-full bg-brand-500 transition-all duration-500 rounded-full"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
    </div>
  );
}

import React, { useEffect, useRef, useState } from 'react';
import type { FabrikaJob, FabrikaJobSettings } from '../types';
import { UploadPanel } from './FabrikaQA/UploadPanel';
import { ResultsTable } from './FabrikaQA/ResultsTable';
import { createJob, pollJob, retryRow } from '../services/fabrikaClient';

type Stage = 'upload' | 'running' | 'done';

export default function FabrikaQA(_props: { onBack?: () => void }) {
  const [stage, setStage] = useState<Stage>('upload');
  const [jobId, setJobId] = useState<string | null>(null);
  const [job, setJob] = useState<FabrikaJob | null>(null);
  const [error, setError] = useState<string | null>(null);
  const pollRef = useRef<number | null>(null);

  useEffect(() => () => { if (pollRef.current) window.clearInterval(pollRef.current); }, []);

  const handleSubmit = async (xlsx: File, zip: File, settings: FabrikaJobSettings) => {
    setError(null);
    try {
      const { jobId } = await createJob(xlsx, zip, settings);
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
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      <header className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Fabrika QA — batch</h1>
        {stage !== 'upload' && (
          <button className="text-sm text-slate-600 dark:text-slate-400 underline" onClick={reset}>Новый батч</button>
        )}
      </header>
      {error && <div className="rounded bg-red-100 dark:bg-red-900/30 p-2 text-sm text-red-700 dark:text-red-300">{error}</div>}
      {stage === 'upload' && <UploadPanel onSubmit={handleSubmit} />}
      {(stage === 'running' || stage === 'done') && job && (
        <>
          <ProgressHeader job={job} />
          <ResultsTable job={job} jobId={jobId!} onRetry={handleRetry} />
        </>
      )}
      {(stage === 'running' || stage === 'done') && !job && <div>Загрузка…</div>}
    </div>
  );
}

function ProgressHeader({ job }: { job: FabrikaJob }) {
  const pct = job.totalPdfs ? Math.round((job.completedPdfs / job.totalPdfs) * 100) : 0;
  return (
    <div>
      <div className="mb-1 flex justify-between text-xs text-slate-600 dark:text-slate-400">
        <span>{job.completedPdfs} / {job.totalPdfs} PDF</span>
        <span>ошибок: {job.errorCount}</span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded bg-slate-200 dark:bg-slate-800">
        <div className="h-full bg-slate-900 dark:bg-slate-100 transition-all" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

import { EventEmitter } from 'events';
import { randomBytes } from 'crypto';

function uid(prefix) {
  return `${prefix}-${randomBytes(6).toString('hex')}`;
}

const DEFAULT_TTL_MS = 30 * 60 * 1000;

export function createJobStore({ ttlMs = DEFAULT_TTL_MS } = {}) {
  const jobs = new Map();
  const emitters = new Map();

  function emit(jobId) {
    const em = emitters.get(jobId);
    if (em) em.emit('update', jobs.get(jobId));
  }

  function scheduleExpiry(jobId) {
    setTimeout(() => {
      jobs.delete(jobId);
      const em = emitters.get(jobId);
      if (em) { em.removeAllListeners(); emitters.delete(jobId); }
    }, ttlMs).unref?.();
  }

  return {
    create({ pdfs, unmatchedColumns, settings }) {
      const id = uid('fabrika');
      const rows = pdfs.map((p) => ({
        id: uid('row'),
        pdfName: p.name,
        status: p.column === null ? 'no-spec' : 'pending',
        matchedColumn: p.column
          ? { sheet: p.column.sheet, colIndex: p.column.colIndex, fileName: p.column.fileName }
          : null,
        specText: p.specText ?? null,
        mainMd: null,
        signResults: null,
        error: null,
        durationMs: null,
      }));
      const job = {
        id,
        status: 'running',
        createdAt: Date.now(),
        totalPdfs: pdfs.length,
        completedPdfs: rows.filter((r) => r.status === 'no-spec').length,
        errorCount: 0,
        rows,
        unmatchedColumns,
        settings,
      };
      jobs.set(id, job);
      emitters.set(id, new EventEmitter());
      return job;
    },
    get(id) {
      return jobs.get(id) || null;
    },
    updateRow(jobId, rowId, patch) {
      const job = jobs.get(jobId);
      if (!job) return;
      const row = job.rows.find((r) => r.id === rowId);
      if (!row) return;
      const prevStatus = row.status;
      Object.assign(row, patch);
      if (patch.status && patch.status !== prevStatus) {
        if (['done', 'error', 'no-spec'].includes(patch.status)) {
          job.completedPdfs = job.rows.filter((r) =>
            ['done', 'error', 'no-spec'].includes(r.status)
          ).length;
        }
        if (patch.status === 'error') {
          job.errorCount = job.rows.filter((r) => r.status === 'error').length;
        }
      }
      if (job.completedPdfs >= job.totalPdfs && job.status === 'running') {
        job.status = job.errorCount === job.totalPdfs ? 'error' : 'done';
        scheduleExpiry(jobId);
      }
      emit(jobId);
    },
    subscribe(jobId, cb) {
      const em = emitters.get(jobId);
      if (!em) return () => {};
      em.on('update', cb);
      return () => em.off('update', cb);
    },
    listActive() {
      return Array.from(jobs.values()).filter((j) => j.status === 'running');
    },
  };
}

import { analyzePdfRow } from './fabrikaAnalyze.js';

// Replicate free-tier accounts (< $10 credit) have burst cap of 5 requests.
// Serialize rows to stay under the cap; override via env for paid tier.
const ROW_CONCURRENCY = Number(process.env.FABRIKA_ROW_CONCURRENCY) || 1;

/**
 * Run every pending row of the job to completion. Non-blocking — returns
 * immediately while workers drain the queue in the background.
 *
 * @param {object} store         fabrikaJobStore instance
 * @param {string} jobId
 * @param {Map<string, Buffer>} pdfBuffers   pdfName -> buffer
 * @param {Array<{name: string, dataUrl: string}>} signs
 */
export function runJob(store, jobId, pdfBuffers, signs) {
  const job = store.get(jobId);
  if (!job) return;
  const queue = job.rows.filter((r) => r.status === 'pending').map((r) => r.id);
  let cursor = 0;

  const runOne = async () => {
    while (cursor < queue.length) {
      const rowId = queue[cursor++];
      const current = store.get(jobId);
      if (!current) return;
      const row = current.rows.find((r) => r.id === rowId);
      if (!row || row.status !== 'pending') continue;

      store.updateRow(jobId, rowId, { status: 'analyzing' });
      const start = Date.now();
      try {
        const column = restoreColumn(row, current);
        const buf = pdfBuffers.get(row.pdfName);
        if (!buf) throw new Error('PDF buffer missing');
        const { signResults, merged } = await analyzePdfRow({
          pdfBuffer: buf,
          column,
          signs,
          settings: current.settings || {},
        });
        store.updateRow(jobId, rowId, {
          status: 'done',
          mainMd: merged,
          signResults,
          durationMs: Date.now() - start,
        });
      } catch (err) {
        console.error(`[fabrika] row ${row.pdfName} failed:`, err.message);
        store.updateRow(jobId, rowId, {
          status: 'error',
          error: err.message,
          durationMs: Date.now() - start,
        });
      }
    }
  };

  const workerCount = Math.min(ROW_CONCURRENCY, queue.length);
  Promise.all(Array.from({ length: workerCount }, runOne)).catch((e) =>
    console.error('[fabrika] job worker crashed:', e),
  );
}

/**
 * The PdfRow stores only a lightweight `matchedColumn`; the full column
 * (with `attrs`) is stashed by the server on `job.settings._columns[rowId]`
 * at create time.
 */
function restoreColumn(row, job) {
  const full = job.settings?._columns?.[row.id];
  return full || null;
}

/**
 * Reset a row to `pending` and relaunch the worker pool.
 */
export async function retryRow(store, jobId, rowId, pdfBuffers, signs) {
  const job = store.get(jobId);
  if (!job) throw new Error('job not found');
  const row = job.rows.find((r) => r.id === rowId);
  if (!row) throw new Error('row not found');
  if (row.status === 'analyzing') throw new Error('already running');
  store.updateRow(jobId, rowId, {
    status: 'pending',
    error: null,
    mainMd: null,
    signResults: null,
    durationMs: null,
  });
  runJob(store, jobId, pdfBuffers, signs);
}

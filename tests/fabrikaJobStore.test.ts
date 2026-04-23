import { describe, it, expect, vi } from 'vitest';
import { createJobStore } from '../services/fabrikaJobStore.js';

describe('fabrikaJobStore', () => {
  it('assigns id, stores job, returns snapshot on get', () => {
    const store = createJobStore();
    const job = store.create({
      pdfs: [{ name: 'a.pdf' }, { name: 'b.pdf' }],
      unmatchedColumns: [],
      settings: {},
    });
    expect(job.id).toMatch(/^fabrika-/);
    expect(store.get(job.id)?.totalPdfs).toBe(2);
    expect(store.get(job.id)?.rows).toHaveLength(2);
    expect(store.get(job.id)?.rows[0].status).toBe('pending');
  });

  it('emits update events on row transitions', () => {
    const store = createJobStore();
    const job = store.create({ pdfs: [{ name: 'a.pdf' }], unmatchedColumns: [], settings: {} });
    const cb = vi.fn();
    const unsub = store.subscribe(job.id, cb);
    store.updateRow(job.id, job.rows[0].id, { status: 'analyzing' });
    expect(cb).toHaveBeenCalledTimes(1);
    store.updateRow(job.id, job.rows[0].id, { status: 'done', mainMd: '# ok' });
    expect(cb).toHaveBeenCalledTimes(2);
    unsub();
    store.updateRow(job.id, job.rows[0].id, { durationMs: 100 });
    expect(cb).toHaveBeenCalledTimes(2);
  });

  it('marks no-spec rows on create when column is null', () => {
    const store = createJobStore();
    const job = store.create({
      pdfs: [{ name: 'a.pdf', column: null }],
      unmatchedColumns: [],
      settings: {},
    });
    expect(job.rows[0].status).toBe('no-spec');
  });
});

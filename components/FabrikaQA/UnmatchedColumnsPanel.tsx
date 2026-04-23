import React from 'react';

export function UnmatchedColumnsPanel({
  columns,
}: { columns: Array<{ sheet: string; fileName: string }> }) {
  if (!columns.length) return null;
  return (
    <aside className="rounded border bg-amber-50 p-3 text-xs">
      <div className="mb-1 font-semibold text-amber-900">
        Колонки XLSX без соответствующих PDF ({columns.length})
      </div>
      <ul className="list-disc space-y-1 pl-4 font-mono">
        {columns.map((c, i) => <li key={i}>[{c.sheet}] {c.fileName}</li>)}
      </ul>
    </aside>
  );
}

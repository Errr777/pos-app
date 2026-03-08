import React from 'react';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';

export type PaginationMeta = {
  current_page: number;
  last_page: number;
  per_page?: number;
  total?: number;
  from?: number | null;
  to?: number | null;
};

type Props = {
  meta?: PaginationMeta | null;
  onPageChange: (page: number) => void;
  siblingCount?: number;
  /** Extra summary text shown on the left (e.g. "Total qty: 320") */
  summary?: React.ReactNode;
};

function range(start: number, end: number) {
  const res: number[] = [];
  for (let i = start; i <= end; i++) res.push(i);
  return res;
}

const Pagination: React.FC<Props> = ({ meta, onPageChange, siblingCount = 1, summary }) => {
  if (!meta) return null;

  const { current_page: cur = 1, last_page: total = 1, from, to, total: count } = meta;

  const goto = (p: number) => {
    if (p < 1 || p > total || p === cur) return;
    onPageChange(p);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Build page number list with ellipsis
  const pages: (number | 'ellipsis-left' | 'ellipsis-right')[] = [];
  if (total <= 7) {
    pages.push(...range(1, total));
  } else {
    const left  = Math.max(2, cur - siblingCount);
    const right = Math.min(total - 1, cur + siblingCount);
    pages.push(1);
    if (left > 2)           pages.push('ellipsis-left');
    pages.push(...range(left, right));
    if (right < total - 1)  pages.push('ellipsis-right');
    pages.push(total);
  }

  const btnBase =
    'inline-flex items-center justify-center h-8 min-w-[2rem] px-2 rounded border text-sm transition-colors select-none';
  const btnActive   = 'bg-primary text-primary-foreground border-primary font-semibold';
  const btnInactive = 'border-border bg-background hover:bg-muted text-foreground';
  const btnDisabled = 'border-border bg-muted text-muted-foreground cursor-not-allowed opacity-50';

  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mt-4 pt-3 border-t">
      {/* Left: info text */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
        {typeof from === 'number' && typeof to === 'number' && typeof count === 'number' && (
          <span>
            Menampilkan <span className="font-medium text-foreground">{from}–{to}</span> dari{' '}
            <span className="font-medium text-foreground">{count}</span> data
          </span>
        )}
        {summary && <span>{summary}</span>}
      </div>

      {/* Right: page controls */}
      {total > 1 && (
        <nav className="flex items-center gap-1" aria-label="Pagination">
          {/* First */}
          <button
            onClick={() => goto(1)}
            disabled={cur <= 1}
            className={`${btnBase} ${cur <= 1 ? btnDisabled : btnInactive}`}
            title="Halaman pertama"
          >
            <ChevronsLeft size={14} />
          </button>

          {/* Prev */}
          <button
            onClick={() => goto(cur - 1)}
            disabled={cur <= 1}
            className={`${btnBase} ${cur <= 1 ? btnDisabled : btnInactive}`}
            title="Halaman sebelumnya"
          >
            <ChevronLeft size={14} />
          </button>

          {/* Page numbers */}
          {pages.map((p, idx) =>
            p === 'ellipsis-left' || p === 'ellipsis-right' ? (
              <span key={p} className="inline-flex items-center justify-center h-8 w-8 text-sm text-muted-foreground">
                …
              </span>
            ) : (
              <button
                key={p}
                onClick={() => goto(p)}
                className={`${btnBase} ${p === cur ? btnActive : btnInactive}`}
                aria-current={p === cur ? 'page' : undefined}
              >
                {p}
              </button>
            )
          )}

          {/* Next */}
          <button
            onClick={() => goto(cur + 1)}
            disabled={cur >= total}
            className={`${btnBase} ${cur >= total ? btnDisabled : btnInactive}`}
            title="Halaman berikutnya"
          >
            <ChevronRight size={14} />
          </button>

          {/* Last */}
          <button
            onClick={() => goto(total)}
            disabled={cur >= total}
            className={`${btnBase} ${cur >= total ? btnDisabled : btnInactive}`}
            title="Halaman terakhir"
          >
            <ChevronsRight size={14} />
          </button>
        </nav>
      )}
    </div>
  );
};

export default Pagination;

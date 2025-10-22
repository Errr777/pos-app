import React from 'react';

export type PaginationMeta = {
  current_page: number;
  last_page: number;
  per_page?: number;
  total?: number;
};

type Props = {
  meta?: PaginationMeta | null;
  onPageChange: (page: number) => void;
  siblingCount?: number;
};

function range(start: number, end: number) {
  const res: number[] = [];
  for (let i = start; i <= end; i++) res.push(i);
  return res;
}

const Pagination: React.FC<Props> = ({ meta, onPageChange, siblingCount = 1 }) => {
  if (!meta) return null;

  const { current_page: currentPage = 1, last_page: totalPages = 1 } = meta;

  if (totalPages <= 1) return null;

  const pages: (number | 'ellipsis')[] = [];

  const left = Math.max(2, currentPage - siblingCount);
  const right = Math.min(totalPages - 1, currentPage + siblingCount);

  pages.push(1);
  if (left > 2) pages.push('ellipsis');
  pages.push(...range(left, right));
  if (right < totalPages - 1) pages.push('ellipsis');
  if (totalPages > 1) pages.push(totalPages);

  const goto = (p: number) => {
    if (p < 1 || p > totalPages || p === currentPage) return;
    onPageChange(p);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <nav className="flex items-center justify-center gap-2 mt-4" aria-label="Pagination">
      <button
        onClick={() => goto(currentPage - 1)}
        disabled={currentPage <= 1}
        className="px-3 py-1 border rounded disabled:opacity-50"
      >
        Prev
      </button>

      {pages.map((p, idx) =>
        p === 'ellipsis' ? (
          <span key={`ell-${idx}`} className="px-3 py-1 text-muted-foreground">
            …
          </span>
        ) : (
          <button
            key={p}
            onClick={() => goto(p as number)}
            className={`px-3 py-1 border rounded ${
              p === currentPage ? 'bg-primary text-white' : ''
            }`}
          >
            {p}
          </button>
        )
      )}

      <button
        onClick={() => goto(currentPage + 1)}
        disabled={currentPage >= totalPages}
        className="px-3 py-1 border rounded disabled:opacity-50"
      >
        Next
      </button>
    </nav>
  );
};

export default Pagination;
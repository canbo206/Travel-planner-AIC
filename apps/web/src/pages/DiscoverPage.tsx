/** Figma: "Screen 1 · Discover" — search, filter chips, trip card grid. */
import type { DiscoverQuery } from '@roadtrip/shared';
import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { TripCard } from '../components/TripCard';
import { useDiscover } from '../lib/queries';
import '../styles/discover.css';

const LENGTH_CHIPS: { label: string; min?: number; max?: number }[] = [
  { label: 'Any length' },
  { label: '1–3 days', min: 1, max: 3 },
  { label: '4–7 days', min: 4, max: 7 },
  { label: '1 week+', min: 8 },
];

/** Quick searches. Each one fills the search box with a term that matches trip titles and stops. */
const THEME_CHIPS: { label: string; q: string }[] = [
  { label: 'Coastal', q: 'coast' },
  { label: 'National parks', q: 'national park' },
  { label: 'From Seattle', q: 'seattle' },
  { label: 'Utah', q: 'utah' },
];

const PAGE_SIZE = 12;

export function DiscoverPage() {
  const [params, setParams] = useSearchParams();
  const q = params.get('q') ?? '';
  const length = Number(params.get('len') ?? 0);
  const sort = (params.get('sort') as DiscoverQuery['sort']) ?? 'new';
  const page = Number(params.get('page') ?? 1);
  const chip = LENGTH_CHIPS[length] ?? LENGTH_CHIPS[0]!;
  const hasFilters = Boolean(q) || length > 0 || sort !== 'new';

  const [search, setSearch] = useState(q);
  useEffect(() => setSearch(q), [q]);
  const resultsTop = useRef<HTMLDivElement>(null);

  function update(next: Record<string, string | number | null>) {
    const p = new URLSearchParams(params);
    for (const [k, v] of Object.entries(next)) {
      if (v === null || v === '' || v === 0) p.delete(k);
      else p.set(k, String(v));
    }
    if (!('page' in next)) p.delete('page');
    setParams(p, { replace: true });
  }

  function clearFilters() {
    setSearch('');
    setParams(new URLSearchParams(), { replace: true });
  }

  function goToPage(n: number) {
    update({ page: n });
    resultsTop.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  // Debounced search-as-you-type.
  useEffect(() => {
    const t = setTimeout(() => {
      if (search.trim() !== q) update({ q: search.trim() });
    }, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  const { data, isLoading, isError, error, isFetching, refetch } = useDiscover({
    q: q || undefined,
    minDays: chip.min,
    maxDays: chip.max,
    sort,
    page,
    pageSize: PAGE_SIZE,
  });
  const pages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1;

  return (
    <main className="discover page">
      <h1>Find your next road trip</h1>
      <p className="subtitle">Real routes from real travelers. Recreate any trip in one click.</p>

      <div className="search-row">
        <input
          className="search"
          type="search"
          placeholder="Search a place or route — e.g. Oregon Coast"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => e.key === 'Escape' && setSearch('')}
          aria-label="Search trips"
        />
      </div>

      <div className="discover-controls">
        <div className="chips" role="group" aria-label="Filters">
          {LENGTH_CHIPS.map((c, i) => (
            <button
              key={c.label}
              className={`chip${i === length ? ' active' : ''}`}
              onClick={() => update({ len: i })}
              aria-pressed={i === length}
            >
              {c.label}
            </button>
          ))}
          <span className="chip-divider" aria-hidden />
          {THEME_CHIPS.map((c) => {
            const active = q.toLowerCase() === c.q;
            return (
              <button
                key={c.label}
                className={`chip${active ? ' active' : ''}`}
                onClick={() => {
                  const next = active ? '' : c.q;
                  setSearch(next);
                  update({ q: next });
                }}
                aria-pressed={active}
              >
                {c.label}
              </button>
            );
          })}
        </div>
        <label className="sort">
          Sort
          <select value={sort} onChange={(e) => update({ sort: e.target.value === 'new' ? null : e.target.value })}>
            <option value="new">Newest</option>
            <option value="popular">Most recreated</option>
          </select>
        </label>
      </div>

      <div ref={resultsTop} className="results-bar" aria-live="polite">
        {data && (
          <span className="muted">
            {data.total === 0
              ? 'No trips found'
              : `${data.total} trip${data.total === 1 ? '' : 's'}${q ? ` matching “${q}”` : ''}`}
            {isFetching && ' · updating…'}
          </span>
        )}
        {hasFilters && (
          <button className="btn-link" onClick={clearFilters}>
            Clear filters
          </button>
        )}
      </div>

      {isError && (
        <div className="empty-state">
          <p className="error-text">Couldn't load trips: {(error as Error).message}</p>
          <button className="btn btn-secondary" onClick={() => refetch()}>
            Try again
          </button>
        </div>
      )}

      {isLoading && (
        <div className="trip-grid">
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="trip-card skeleton" />
          ))}
        </div>
      )}

      {data && data.items.length === 0 && (
        <div className="empty-state">
          {hasFilters ? (
            <>
              <p>No trips match those filters yet.</p>
              <button className="btn btn-secondary" onClick={clearFilters}>
                Show all trips
              </button>
            </>
          ) : (
            <>
              <p>No one has shared a trip yet.</p>
              <Link className="btn btn-primary" to="/trips/new">
                Share the first one
              </Link>
            </>
          )}
        </div>
      )}

      {data && data.items.length > 0 && (
        <section className="trip-grid" style={{ opacity: isFetching ? 0.6 : 1 }}>
          {data.items.map((t) => (
            <TripCard key={t.id} trip={t} />
          ))}
        </section>
      )}

      {pages > 1 && (
        <nav className="pagination" aria-label="Pages">
          <button className="btn btn-secondary" disabled={page <= 1} onClick={() => goToPage(page - 1)}>
            ← Previous
          </button>
          <span className="muted">
            Page {page} of {pages}
          </span>
          <button className="btn btn-secondary" disabled={page >= pages} onClick={() => goToPage(page + 1)}>
            Next →
          </button>
        </nav>
      )}
    </main>
  );
}

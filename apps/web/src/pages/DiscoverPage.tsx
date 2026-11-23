/** Figma: "Screen 1 · Discover" — search, filter chips, trip card grid. */
import type { DiscoverQuery } from '@roadtrip/shared';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router';
import { TripCard } from '../components/TripCard';
import { useDiscover } from '../lib/queries';
import '../styles/discover.css';

const LENGTH_CHIPS: { label: string; min?: number; max?: number }[] = [
  { label: 'Any length' },
  { label: '1–3 days', min: 1, max: 3 },
  { label: '4–7 days', min: 4, max: 7 },
  { label: '1 week+', min: 8 },
];

const PAGE_SIZE = 12;

export function DiscoverPage() {
  const [params, setParams] = useSearchParams();
  const q = params.get('q') ?? '';
  const length = Number(params.get('len') ?? 0);
  const sort = (params.get('sort') as DiscoverQuery['sort']) ?? 'new';
  const page = Number(params.get('page') ?? 1);
  const chip = LENGTH_CHIPS[length] ?? LENGTH_CHIPS[0]!;

  const [search, setSearch] = useState(q);
  useEffect(() => setSearch(q), [q]);

  function update(next: Record<string, string | number | null>) {
    const p = new URLSearchParams(params);
    for (const [k, v] of Object.entries(next)) {
      if (v === null || v === '' || v === 0) p.delete(k);
      else p.set(k, String(v));
    }
    if (!('page' in next)) p.delete('page');
    setParams(p, { replace: true });
  }

  // Debounced search-as-you-type.
  useEffect(() => {
    const t = setTimeout(() => {
      if (search.trim() !== q) update({ q: search.trim() });
    }, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  const { data, isLoading, isError, error, isFetching } = useDiscover({
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

      <input
        className="search"
        type="search"
        placeholder="Search a place or route — e.g. Oregon Coast"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        aria-label="Search trips"
      />

      <div className="discover-controls">
        <div className="chips" role="group" aria-label="Trip length">
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
        </div>
        <label className="sort">
          Sort
          <select value={sort} onChange={(e) => update({ sort: e.target.value === 'new' ? null : e.target.value })}>
            <option value="new">Newest</option>
            <option value="popular">Most recreated</option>
          </select>
        </label>
      </div>

      {isError && <p className="error-text">Couldn't load trips: {(error as Error).message}</p>}
      {isLoading && <div className="trip-grid">{Array.from({ length: 6 }, (_, i) => <div key={i} className="trip-card skeleton" />)}</div>}

      {data && data.items.length === 0 && (
        <div className="empty-state">
          No trips match that yet. Try another search, or be the first to share one.
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
          <button className="btn btn-secondary" disabled={page <= 1} onClick={() => update({ page: page - 1 })}>
            ← Previous
          </button>
          <span className="muted">
            Page {page} of {pages}
          </span>
          <button className="btn btn-secondary" disabled={page >= pages} onClick={() => update({ page: page + 1 })}>
            Next →
          </button>
        </nav>
      )}
    </main>
  );
}

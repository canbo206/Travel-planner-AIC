import type { TripSummary } from '@roadtrip/shared';
import { useState } from 'react';
import { Link } from 'react-router';
import { TripCard } from '../components/TripCard';
import { useMyTrips, useSavedTrips } from '../lib/queries';
import '../styles/discover.css';

type Filter = 'all' | 'drafts' | 'shared';

const FILTERS: { key: Filter; label: string; match: (t: TripSummary) => boolean }[] = [
  { key: 'all', label: 'All', match: () => true },
  { key: 'drafts', label: 'Drafts', match: (t) => t.visibility === 'PRIVATE' },
  { key: 'shared', label: 'Shared', match: (t) => t.visibility !== 'PRIVATE' },
];

function SkeletonGrid({ count = 3 }: { count?: number }) {
  return (
    <div className="trip-grid">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="trip-card skeleton" />
      ))}
    </div>
  );
}

export function MyTripsPage() {
  const { data, isLoading, error, refetch } = useMyTrips();
  const [filter, setFilter] = useState<Filter>('all');

  const trips = data ?? [];
  const shared = trips.filter((t) => t.visibility !== 'PRIVATE');
  const recreations = shared.reduce((n, t) => n + t.recreateCount, 0);
  const active = FILTERS.find((f) => f.key === filter)!;
  const visible = trips.filter(active.match);

  return (
    <main className="page">
      <div className="page-header">
        <div>
          <h1>My Trips</h1>
          <p className="subtitle">Your drafts, shared trips and recreations.</p>
        </div>
        <Link className="btn btn-primary" to="/trips/new">
          + New trip
        </Link>
      </div>

      {trips.length > 0 && (
        <ul className="summary-stats">
          <li>
            <strong>{trips.length}</strong>
            <span>trip{trips.length === 1 ? '' : 's'}</span>
          </li>
          <li>
            <strong>{shared.length}</strong>
            <span>shared</span>
          </li>
          <li>
            <strong>{recreations}</strong>
            <span>time{recreations === 1 ? '' : 's'} others recreated yours</span>
          </li>
        </ul>
      )}

      {trips.length > 0 && (
        <div className="chips" role="group" aria-label="Show">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              className={`chip${f.key === filter ? ' active' : ''}`}
              onClick={() => setFilter(f.key)}
              aria-pressed={f.key === filter}
            >
              {f.label}
              <span className="count">{trips.filter(f.match).length}</span>
            </button>
          ))}
        </div>
      )}

      {isLoading && <SkeletonGrid />}
      {error && (
        <div className="empty-state">
          <p className="error-text">Couldn't load your trips: {(error as Error).message}</p>
          <button className="btn btn-secondary" onClick={() => refetch()}>
            Try again
          </button>
        </div>
      )}

      {data && trips.length === 0 && (
        <div className="empty-state">
          <p>You haven't made any trips yet.</p>
          <p>
            <Link to="/trips/new">Share a trip you took</Link> or{' '}
            <Link to="/">recreate one from Discover</Link>.
          </p>
        </div>
      )}

      {trips.length > 0 && visible.length === 0 && (
        <div className="empty-state">
          {filter === 'drafts' ? 'No drafts — every trip is shared.' : 'Nothing shared yet. Open a trip and set it to Public to share it.'}
        </div>
      )}

      {visible.length > 0 && (
        <section className="trip-grid">
          {visible.map((t) => (
            <TripCard key={t.id} trip={t} showVisibility />
          ))}
        </section>
      )}
    </main>
  );
}

export function SavedPage() {
  const { data, isLoading, error, refetch } = useSavedTrips();
  return (
    <main className="page">
      <div className="page-header">
        <div>
          <h1>Saved</h1>
          <p className="subtitle">
            {data?.length ? `${data.length} trip${data.length === 1 ? '' : 's'} saved for later.` : 'Trips you bookmarked for later.'}
          </p>
        </div>
      </div>

      {isLoading && <SkeletonGrid />}
      {error && (
        <div className="empty-state">
          <p className="error-text">Couldn't load saved trips: {(error as Error).message}</p>
          <button className="btn btn-secondary" onClick={() => refetch()}>
            Try again
          </button>
        </div>
      )}
      {data?.length === 0 && (
        <div className="empty-state">
          <p>Nothing saved yet.</p>
          <p>
            Tap ♡ Save on any trip in <Link to="/">Discover</Link>.
          </p>
        </div>
      )}
      {data && data.length > 0 && (
        <section className="trip-grid">
          {data.map((t) => (
            <TripCard key={t.id} trip={t} />
          ))}
        </section>
      )}
    </main>
  );
}

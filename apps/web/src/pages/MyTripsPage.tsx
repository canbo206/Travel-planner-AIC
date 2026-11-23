import { Link } from 'react-router';
import { TripCard } from '../components/TripCard';
import { useMyTrips, useSavedTrips } from '../lib/queries';
import '../styles/discover.css';

export function MyTripsPage() {
  const { data, isLoading, error } = useMyTrips();
  return (
    <main className="page">
      <h1>My Trips</h1>
      <p className="subtitle">Your drafts, published trips and recreations.</p>
      {isLoading && <p className="muted">Loading…</p>}
      {error && <p className="error-text">{(error as Error).message}</p>}
      {data?.length === 0 && (
        <div className="empty-state">
          No trips yet. <Link to="/trips/new">Share a trip you took</Link> or{' '}
          <Link to="/">recreate one from Discover</Link>.
        </div>
      )}
      <section className="trip-grid">
        {data?.map((t) => <TripCard key={t.id} trip={t} showVisibility />)}
      </section>
    </main>
  );
}

export function SavedPage() {
  const { data, isLoading, error } = useSavedTrips();
  return (
    <main className="page">
      <h1>Saved</h1>
      <p className="subtitle">Trips you bookmarked for later.</p>
      {isLoading && <p className="muted">Loading…</p>}
      {error && <p className="error-text">{(error as Error).message}</p>}
      {data?.length === 0 && (
        <div className="empty-state">
          Nothing saved yet. Tap ♡ Save on any trip in <Link to="/">Discover</Link>.
        </div>
      )}
      <section className="trip-grid">{data?.map((t) => <TripCard key={t.id} trip={t} />)}</section>
    </main>
  );
}

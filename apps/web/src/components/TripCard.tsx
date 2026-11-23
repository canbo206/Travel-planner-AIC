/** Figma: "Screen 1 · Discover" → article.trip-card */
import { formatMiles, type TripSummary } from '@roadtrip/shared';
import { Link } from 'react-router';
import { CoverArt } from './CoverArt';

export function tripMeta(t: Pick<TripSummary, 'durationDays' | 'totalDistanceM' | 'stopCount'>) {
  return [
    t.durationDays ? `${t.durationDays} day${t.durationDays === 1 ? '' : 's'}` : null,
    t.totalDistanceM != null ? formatMiles(t.totalDistanceM) : null,
    `${t.stopCount} stop${t.stopCount === 1 ? '' : 's'}`,
  ]
    .filter(Boolean)
    .join(' · ');
}

export function TripCard({ trip, showVisibility }: { trip: TripSummary; showVisibility?: boolean }) {
  return (
    <article className="trip-card">
      <Link to={`/trips/${trip.id}`} className="trip-card-link">
        {trip.coverImageUrl ? (
          <img className="cover" src={trip.coverImageUrl} alt="" loading="lazy" />
        ) : (
          <CoverArt className="cover" seed={trip.id} />
        )}
        <div className="card-body">
          <h3>{trip.title}</h3>
          <p className="meta">{tripMeta(trip)}</p>
          <footer>
            <span className="author">by @{trip.owner.username}</span>
            {showVisibility ? (
              <span className={`visibility-badge ${trip.visibility.toLowerCase()}`}>
                {trip.visibility.toLowerCase()}
              </span>
            ) : (
              <span className="recreations">↻ {trip.recreateCount} recreations</span>
            )}
          </footer>
        </div>
      </Link>
    </article>
  );
}

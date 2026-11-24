/** Figma: "Screen 2 · Trip Detail" — map + side panel with day tabs and stops. */
import { formatDuration, formatMiles, type Photo, type TripDetail } from '@roadtrip/shared';
import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { RecreateDialog } from '../components/RecreateDialog';
import { TripMap } from '../components/map/TripMap';
import { useAuth } from '../lib/auth';
import { useDeleteTrip, useToggleSave, useTrip, useUpdateTrip } from '../lib/queries';
import '../styles/trip.css';

export function TripDetailPage() {
  const { id } = useParams();
  const { data: trip, isLoading, error } = useTrip(id);

  if (isLoading) return <main className="page muted">Loading trip…</main>;
  if (error || !trip) {
    return (
      <main className="page">
        <h1>Trip not found</h1>
        <p className="subtitle">
          It may be private or deleted. <Link to="/">Back to Discover</Link>
        </p>
      </main>
    );
  }
  return <TripDetailView trip={trip} />;
}

function TripDetailView({ trip }: { trip: TripDetail }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [day, setDay] = useState<number | 'all'>('all');
  const [hovered, setHovered] = useState<string | null>(null);
  const [recreateOpen, setRecreateOpen] = useState(false);
  const toggleSave = useToggleSave(trip);
  const update = useUpdateTrip(trip.id);
  const del = useDeleteTrip();

  const days = useMemo(
    () => [...new Set(trip.stops.map((s) => s.dayNumber).filter((d): d is number => d != null))].sort((a, b) => a - b),
    [trip.stops],
  );
  const visibleStops = trip.stops
    .map((s, i) => ({ ...s, number: i + 1 }))
    .filter((s) => day === 'all' || s.dayNumber === day);

  function requireSignIn(action: () => void) {
    if (!user) navigate(`/sign-in?next=${encodeURIComponent(`/trips/${trip.id}`)}`);
    else action();
  }

  const stats = [
    trip.durationDays ? `${trip.durationDays} day${trip.durationDays === 1 ? '' : 's'}` : null,
    trip.totalDistanceM != null ? formatMiles(trip.totalDistanceM) : null,
    `${trip.stopCount} stops`,
    trip.totalDurationS != null ? `${formatDuration(trip.totalDurationS)} driving` : null,
  ].filter(Boolean);
  const hasEstimates = trip.segments.some((s) => s.isEstimate);

  return (
    <main className="trip-detail">
      <TripMap
        stops={trip.stops}
        segments={trip.segments}
        activeStopId={hovered}
        onStopClick={(i) => {
          const s = trip.stops[i];
          if (s) {
            setDay(s.dayNumber ?? 'all');
            document.getElementById(`stop-${s.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        }}
      />

      <aside className="trip-panel">
        <nav className="breadcrumb">
          <Link to="/">Discover</Link> / {trip.title}
        </nav>
        <h1>{trip.title}</h1>
        <div className="byline">
          <span className="avatar small">{trip.owner.username.slice(0, 1).toUpperCase()}</span>
          <span>
            by <strong>@{trip.owner.username}</strong> ·{' '}
            {trip.recreateCount === 0
              ? 'not recreated yet'
              : `recreated ${trip.recreateCount} time${trip.recreateCount === 1 ? '' : 's'}`}
          </span>
        </div>
        {trip.sourceTrip && (
          <div className="source-credit">
            ↻ Based on{' '}
            <Link to={`/trips/${trip.sourceTrip.id}`}>
              @{trip.sourceTrip.owner.username}'s “{trip.sourceTrip.title}”
            </Link>
          </div>
        )}
        {trip.description && <p className="description">{trip.description}</p>}

        <ul className="stats">
          {stats.map((s) => (
            <li className="stat" key={s}>
              {s}
            </li>
          ))}
        </ul>
        {hasEstimates && (
          <p className="hint">Dashed legs are straight-line estimates until a routing key is configured.</p>
        )}

        {trip.isOwner ? (
          <div className="actions">
            <Link className="btn btn-primary grow" to={`/trips/${trip.id}/edit`}>
              Edit trip
            </Link>
            <select
              className="visibility-select"
              value={trip.visibility}
              disabled={update.isPending}
              onChange={(e) => update.mutate({ visibility: e.target.value as TripDetail['visibility'] })}
              aria-label="Who can see this trip"
            >
              <option value="PRIVATE">Private</option>
              <option value="UNLISTED">Unlisted (link only)</option>
              <option value="PUBLIC">Public</option>
            </select>
            <button
              className="btn btn-secondary"
              onClick={async () => {
                if (!confirm(`Delete “${trip.title}”? This can't be undone.`)) return;
                await del.mutateAsync(trip.id);
                navigate('/me/trips');
              }}
            >
              Delete
            </button>
          </div>
        ) : (
          <div className="actions">
            <button
              className="btn btn-accent grow"
              onClick={() => requireSignIn(() => setRecreateOpen(true))}
              disabled={trip.stopCount === 0}
            >
              ↻ Recreate this trip
            </button>
            <button
              className="btn btn-secondary"
              onClick={() => requireSignIn(() => toggleSave.mutate())}
              disabled={toggleSave.isPending}
            >
              {trip.isSaved ? 'Saved' : 'Save'}
            </button>
          </div>
        )}
        {update.isError && <p className="error-text">{(update.error as Error).message}</p>}

        {days.length > 1 && (
          <div className="day-tabs" role="tablist">
            <button className={`tab${day === 'all' ? ' active' : ''}`} onClick={() => setDay('all')}>
              All
            </button>
            {days.map((d) => (
              <button key={d} className={`tab${day === d ? ' active' : ''}`} onClick={() => setDay(d)}>
                Day {d}
              </button>
            ))}
          </div>
        )}

        {trip.stops.length === 0 ? (
          <div className="empty-state">
            No stops yet.{' '}
            {trip.isOwner && <Link to={`/trips/${trip.id}/edit`}>Add the first one</Link>}
          </div>
        ) : (
          <ol className="stop-list">
            {visibleStops.map((s) => (
              <li
                key={s.id}
                id={`stop-${s.id}`}
                className="stop"
                onMouseEnter={() => setHovered(s.id)}
                onMouseLeave={() => setHovered(null)}
              >
                <span className="stop-number">{s.number}</span>
                <div className="stop-text">
                  <h4>{s.name}</h4>
                  {s.notes && <p className="note">{s.notes}</p>}
                  {s.activities.length > 0 && (
                    <ul className="activities">
                      {s.activities.map((a) => (
                        <li key={a}>{a}</li>
                      ))}
                    </ul>
                  )}
                  <PhotoStrip photos={s.photos} />
                  <PhotoStrip photos={s.originalPhotos} credit />
                </div>
              </li>
            ))}
          </ol>
        )}
      </aside>

      <RecreateDialog trip={trip} open={recreateOpen} onClose={() => setRecreateOpen(false)} />
    </main>
  );
}

function PhotoStrip({ photos, credit }: { photos: Photo[]; credit?: boolean }) {
  if (!photos.length) return null;
  return (
    <div className="photo-strip">
      {photos.map((p) => (
        <figure key={p.id}>
          <img className="stop-photo" src={p.url} alt={p.caption ?? ''} loading="lazy" />
          {credit && <figcaption>by @{p.uploadedBy.username}</figcaption>}
        </figure>
      ))}
    </div>
  );
}

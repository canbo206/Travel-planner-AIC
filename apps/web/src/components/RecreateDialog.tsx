/** Figma: "Screen 4 · Recreate Trip dialog" → dialog.recreate-dialog */
import type { TripDetail } from '@roadtrip/shared';
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { useRecreateTrip } from '../lib/queries';
import '../styles/dialog.css';

interface Props {
  trip: TripDetail;
  open: boolean;
  onClose: () => void;
}

export function RecreateDialog({ trip, open, onClose }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const navigate = useNavigate();
  const recreate = useRecreateTrip(trip.id);
  const [startDate, setStartDate] = useState('');

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  const photoCount = trip.stops.reduce((n, s) => n + s.photos.length, 0);

  async function onConfirm() {
    const copy = await recreate.mutateAsync(startDate ? { startDate } : {});
    onClose();
    navigate(`/trips/${copy.id}/edit`);
  }

  return (
    <dialog ref={ref} className="recreate-dialog" onClose={onClose} aria-labelledby="recreate-title">
      <span className="dialog-icon" aria-hidden>
        ↻
      </span>
      <h2 id="recreate-title">Recreate this trip?</h2>
      <p>
        We'll copy “{trip.title}” into My Trips as a private draft. You can add, remove and reorder
        stops — the original stays untouched.
      </p>

      <ul className="copy-list">
        <li>
          <span className="ok">✓</span> All {trip.stopCount} stops, in order, with the driving route
        </li>
        <li>
          <span className="ok">✓</span> Notes, activities and tips for each stop
        </li>
        <li>
          <span className="ok">✓</span> Credit: “Based on @{trip.owner.username}'s trip” stays on your copy
        </li>
        {photoCount > 0 && (
          <li>
            <span className="no">–</span> Photos stay with @{trip.owner.username} — add your own on the road
          </li>
        )}
      </ul>

      <label className="start-date">
        Start date (optional)
        <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
      </label>

      {recreate.isError && <p className="error-text">{(recreate.error as Error).message}</p>}

      <footer className="dialog-actions">
        <button className="btn btn-secondary" onClick={onClose} disabled={recreate.isPending}>
          Cancel
        </button>
        <button className="btn btn-accent" onClick={onConfirm} disabled={recreate.isPending}>
          {recreate.isPending ? 'Copying…' : '↻ Recreate & edit'}
        </button>
      </footer>
    </dialog>
  );
}

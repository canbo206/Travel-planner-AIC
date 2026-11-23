import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router';
import { useCreateTrip } from '../lib/queries';
import '../styles/forms.css';

export function NewTripPage() {
  const navigate = useNavigate();
  const create = useCreateTrip();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const trip = await create.mutateAsync({
      title: title.trim(),
      description: description.trim() || undefined,
      travelType: 'ROAD_TRIP',
    });
    navigate(`/trips/${trip.id}/edit`, { replace: true });
  }

  return (
    <main className="page auth-page">
      <form className="card form" onSubmit={onSubmit}>
        <h1>Share a road trip</h1>
        <p className="muted">Give it a name — you'll add stops on the map next. It stays private until you publish it.</p>
        <label className="field">
          Trip name
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Seattle → Oregon Coast"
            required
            maxLength={120}
            autoFocus
          />
        </label>
        <label className="field">
          Description (optional)
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            placeholder="Best season, who it's for, must-dos…"
          />
        </label>
        {create.isError && <p className="error-text">{(create.error as Error).message}</p>}
        <button className="btn btn-primary" disabled={create.isPending}>
          {create.isPending ? 'Creating…' : 'Create & add stops'}
        </button>
      </form>
    </main>
  );
}

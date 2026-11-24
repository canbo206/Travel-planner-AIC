/**
 * Figma: "Screen 3 · Trip Editor (your recreated copy)".
 *
 * Stops are edited locally and autosaved (debounced) with PUT /trips/:id/stops.
 * The server re-routes only the legs that changed and returns the new route,
 * which the map shows with a "Route updated" toast.
 */
import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { formatDuration, formatMiles, type PlaceResult, type TripDetail } from '@roadtrip/shared';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { CloseIcon } from '../components/CloseIcon';
import { TripMap } from '../components/map/TripMap';
import { usePlaceSearch, usePutStops, useTrip, useUpdateTrip, useUploadPhoto } from '../lib/queries';
import '../styles/editor.css';
import '../styles/forms.css';
import '../styles/trip.css';

interface DraftStop {
  key: string;
  id?: string;
  name: string;
  lat: number;
  lng: number;
  dayNumber: number | null;
  notes: string;
  activities: string[];
  placeId: string | null;
}

let tempKey = 0;
const toDraft = (trip: TripDetail): DraftStop[] =>
  trip.stops.map((s) => ({
    key: s.id,
    id: s.id,
    name: s.name,
    lat: s.lat,
    lng: s.lng,
    dayNumber: s.dayNumber,
    notes: s.notes ?? '',
    activities: s.activities,
    placeId: s.placeId,
  }));

const coordsKey = (stops: { lat: number; lng: number }[]) => stops.map((s) => `${s.lat},${s.lng}`).join('|');

export function TripEditorPage() {
  const { id } = useParams();
  const { data: trip, isLoading, error } = useTrip(id);
  if (isLoading) return <main className="page muted">Loading…</main>;
  if (error || !trip) return <main className="page">Trip not found.</main>;
  if (!trip.isOwner) {
    return (
      <main className="page">
        <h1>This isn't your trip</h1>
        <p className="subtitle">
          Recreate it to get your own editable copy. <Link to={`/trips/${trip.id}`}>Back to the trip</Link>
        </p>
      </main>
    );
  }
  return <Editor trip={trip} />;
}

function Editor({ trip }: { trip: TripDetail }) {
  const navigate = useNavigate();
  const putStops = usePutStops(trip.id);
  const updateTrip = useUpdateTrip(trip.id);

  const [stops, setStops] = useState<DraftStop[]>(() => toDraft(trip));
  const [title, setTitle] = useState(trip.title);
  const [description, setDescription] = useState(trip.description ?? '');
  const [dirty, setDirty] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const version = useRef(0);

  function change(next: DraftStop[]) {
    version.current++;
    setStops(next);
    setDirty(true);
  }

  // Debounced autosave of the stop list. Saves run one at a time (queued on
  // `inflight`) so two PUTs never race and duplicate a new stop.
  const inflight = useRef<Promise<unknown>>(Promise.resolve());
  useEffect(() => {
    if (!dirty) return;
    const t = setTimeout(() => {
      inflight.current = inflight.current.then(() => save()).catch(() => undefined);
    }, 800);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stops, dirty]);

  const latest = useRef(stops);
  latest.current = stops;

  async function save() {
    const v = version.current;
    const snapshot = latest.current;
    const prevDistance = trip.totalDistanceM;
    const saved = await putStops.mutateAsync({
      stops: snapshot.map((s) => ({
          id: s.id,
          name: s.name,
          lat: s.lat,
          lng: s.lng,
          dayNumber: s.dayNumber,
          notes: s.notes || null,
          activities: s.activities,
          placeId: s.placeId,
      })),
    });
    if (version.current === v) {
      // Nothing changed while saving: adopt the server's version.
      setStops(toDraft(saved));
      setDirty(false);
    } else {
      // More edits happened meanwhile: just give newly created stops their ids
      // (the server returns stops in the order we sent them).
      const idByKey = new Map(snapshot.map((s, i) => [s.key, saved.stops[i]?.id]));
      setStops((cur) => cur.map((s) => (s.id ? s : { ...s, id: idByKey.get(s.key) })));
    }
    if (saved.totalDistanceM !== prevDistance && saved.segments.length) {
      setToast(
        `Route updated · ${formatMiles(saved.totalDistanceM)} · ${formatDuration(saved.totalDurationS)} driving`,
      );
    }
  }

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(t);
  }, [toast]);

  // Show the server's routed segments only while they match the draft order.
  const segments = coordsKey(stops) === coordsKey(trip.stops) ? trip.segments : [];
  const dayCount = Math.max(1, ...stops.map((s) => s.dayNumber ?? 1));

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function onDragEnd(e: DragEndEvent) {
    if (!e.over || e.active.id === e.over.id) return;
    const from = stops.findIndex((s) => s.key === e.active.id);
    const to = stops.findIndex((s) => s.key === e.over!.id);
    const moved = arrayMove(stops, from, to);
    // A stop dropped among another day's stops joins that day.
    const neighbor = moved[to - 1] ?? moved[to + 1];
    if (neighbor?.dayNumber != null) moved[to] = { ...moved[to]!, dayNumber: neighbor.dayNumber };
    change(moved);
  }

  function addPlace(p: PlaceResult) {
    const last = stops[stops.length - 1];
    change([
      ...stops,
      {
        key: `new-${++tempKey}`,
        name: p.name,
        lat: p.lat,
        lng: p.lng,
        dayNumber: last?.dayNumber ?? 1,
        notes: '',
        activities: [],
        placeId: p.placeId,
      },
    ]);
  }

  function patchStop(key: string, patch: Partial<DraftStop>) {
    change(stops.map((s) => (s.key === key ? { ...s, ...patch } : s)));
  }

  const saveState = putStops.isError
    ? 'Couldn’t save. Retrying on your next change'
    : dirty || putStops.isPending
      ? 'Saving…'
      : 'All changes saved';

  return (
    <>
      {trip.sourceTrip && (
        <div className="source-banner">
          <span aria-hidden>↻</span>
          Based on @{trip.sourceTrip.owner.username}'s trip “{trip.sourceTrip.title}”. This is your
          {trip.visibility === 'PRIVATE' ? ' private' : ''} copy, so change anything.
        </div>
      )}
      <main className={`trip-editor${trip.sourceTrip ? ' with-banner' : ''}`}>
        <section className="editor-panel">
          <div className="editor-header">
            <input
              className="trip-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onBlur={() => title.trim() && title !== trip.title && updateTrip.mutate({ title: title.trim() })}
              aria-label="Trip title"
            />
            <select
              className="visibility"
              value={trip.visibility}
              onChange={(e) => updateTrip.mutate({ visibility: e.target.value as TripDetail['visibility'] })}
              aria-label="Who can see this trip"
            >
              <option value="PRIVATE">Private</option>
              <option value="UNLISTED">Unlisted</option>
              <option value="PUBLIC">Public</option>
            </select>
          </div>
          <textarea
            className="input description-input"
            placeholder="What's this trip about? Best season, who it's for, must-dos…"
            value={description}
            rows={2}
            onChange={(e) => setDescription(e.target.value)}
            onBlur={() => description !== (trip.description ?? '') && updateTrip.mutate({ description })}
          />
          {updateTrip.isError && <p className="error-text">{(updateTrip.error as Error).message}</p>}

          {stops.length === 0 && (
            <div className="empty-state">Search for your first stop below to start the route.</div>
          )}

          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
            <SortableContext items={stops.map((s) => s.key)} strategy={verticalListSortingStrategy}>
              <ol className="stop-list editor-stops">
                {stops.map((s, i) => {
                  const prevDay = i > 0 ? stops[i - 1]!.dayNumber : null;
                  return (
                    <SortableStop
                      key={s.key}
                      stop={s}
                      number={i + 1}
                      dayLabel={s.dayNumber && s.dayNumber !== prevDay ? `DAY ${s.dayNumber}` : null}
                      dayCount={dayCount}
                      expanded={expanded === s.key}
                      onToggle={() => setExpanded(expanded === s.key ? null : s.key)}
                      onChange={(patch) => patchStop(s.key, patch)}
                      onRemove={() => change(stops.filter((x) => x.key !== s.key))}
                      trip={trip}
                    />
                  );
                })}
              </ol>
            </SortableContext>
          </DndContext>

          <AddStop onAdd={addPlace} near={stops[stops.length - 1]} />

          <footer className="editor-actions">
            <span className="save-state muted" role="status">
              {saveState}
            </span>
            <button className="btn btn-primary" onClick={() => navigate(`/trips/${trip.id}`)} disabled={dirty}>
              Done
            </button>
          </footer>
        </section>

        <TripMap stops={stops} segments={segments}>
          {toast && <div className="route-toast">{toast}</div>}
        </TripMap>
      </main>
    </>
  );
}

interface SortableStopProps {
  stop: DraftStop;
  number: number;
  dayLabel: string | null;
  dayCount: number;
  expanded: boolean;
  onToggle: () => void;
  onChange: (patch: Partial<DraftStop>) => void;
  onRemove: () => void;
  trip: TripDetail;
}

function SortableStop({ stop, number, dayLabel, dayCount, expanded, onToggle, onChange, onRemove, trip }: SortableStopProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: stop.key });
  const [activity, setActivity] = useState('');
  const isNew = !stop.id;

  return (
    <>
      {dayLabel && <h5 className="day-label">{dayLabel}</h5>}
      <li
        ref={setNodeRef}
        className={`stop-row${isDragging ? ' dragging' : ''}`}
        style={{ transform: CSS.Transform.toString(transform), transition }}
      >
        <div className="stop-row-main">
          <button className="drag-handle" aria-label={`Drag to reorder ${stop.name}`} {...attributes} {...listeners}>
            ⋮⋮
          </button>
          <span className={`stop-number${isNew ? ' new' : ''}`}>{number}</span>
          <button className="stop-name" onClick={onToggle} aria-expanded={expanded}>
            {stop.name}
          </button>
          {isNew && <span className="badge-new">Added</span>}
          <select
            className="day-select"
            value={stop.dayNumber ?? 1}
            onChange={(e) => onChange({ dayNumber: Number(e.target.value) })}
            aria-label="Day"
          >
            {Array.from({ length: dayCount + 1 }, (_, i) => (
              <option key={i + 1} value={i + 1}>
                Day {i + 1}
              </option>
            ))}
          </select>
          <button className="remove" onClick={onRemove} aria-label={`Remove ${stop.name}`}>
            <CloseIcon />
          </button>
        </div>

        {expanded && (
          <div className="stop-details">
            <label className="field">
              Notes & tips
              <textarea
                value={stop.notes}
                rows={3}
                placeholder="Parking, best time to go, what to order…"
                onChange={(e) => onChange({ notes: e.target.value })}
              />
            </label>
            <div className="field">
              Activities
              <ul className="activity-chips">
                {stop.activities.map((a) => (
                  <li key={a}>
                    {a}
                    <button
                      aria-label={`Remove ${a}`}
                      onClick={() => onChange({ activities: stop.activities.filter((x) => x !== a) })}
                    >
            <CloseIcon />
          </button>
                  </li>
                ))}
              </ul>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const v = activity.trim();
                  if (v && !stop.activities.includes(v)) onChange({ activities: [...stop.activities, v] });
                  setActivity('');
                }}
              >
                <input
                  className="input"
                  value={activity}
                  onChange={(e) => setActivity(e.target.value)}
                  placeholder="Add an activity and press Enter"
                />
              </form>
            </div>
            {stop.id ? (
              <PhotoUpload tripId={trip.id} stopId={stop.id} trip={trip} />
            ) : (
              <p className="muted small">Photos can be added once this stop is saved.</p>
            )}
          </div>
        )}
      </li>
    </>
  );
}

function PhotoUpload({ tripId, stopId, trip }: { tripId: string; stopId: string; trip: TripDetail }) {
  const upload = useUploadPhoto(tripId);
  const photos = trip.stops.find((s) => s.id === stopId)?.photos ?? [];
  return (
    <div className="field">
      Photos
      <div className="photo-strip">
        {photos.map((p) => (
          <img key={p.id} className="stop-photo" src={p.url} alt={p.caption ?? ''} />
        ))}
        <label className="photo-add">
          {upload.isPending ? '…' : '+ Photo'}
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            hidden
            disabled={upload.isPending}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) upload.mutate({ stopId, file });
              e.target.value = '';
            }}
          />
        </label>
      </div>
      {upload.isError && <p className="error-text small">{(upload.error as Error).message}</p>}
    </div>
  );
}

function AddStop({ onAdd, near }: { onAdd: (p: PlaceResult) => void; near?: { lat: number; lng: number } }) {
  const [text, setText] = useState('');
  const [q, setQ] = useState('');
  const [highlight, setHighlight] = useState(0);
  useEffect(() => {
    const t = setTimeout(() => setQ(text), 250);
    return () => clearTimeout(t);
  }, [text]);
  const nearPoint = useMemo(() => (near ? { lat: near.lat, lng: near.lng } : undefined), [near?.lat, near?.lng]);
  const { data: results = [], isFetching, isError } = usePlaceSearch(q, nearPoint);
  const open = text.trim().length >= 2;

  function pick(p: PlaceResult) {
    onAdd(p);
    setText('');
    setQ('');
    setHighlight(0);
  }

  return (
    <div className={`add-stop${open ? ' open' : ''}`}>
      <input
        className="add-stop-search"
        placeholder="+ Add a stop: search a place"
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          setHighlight(0);
        }}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') setHighlight((h) => Math.min(h + 1, results.length - 1));
          if (e.key === 'ArrowUp') setHighlight((h) => Math.max(h - 1, 0));
          if (e.key === 'Enter' && results[highlight]) {
            e.preventDefault();
            pick(results[highlight]);
          }
          if (e.key === 'Escape') setText('');
        }}
        aria-label="Search for a place to add"
      />
      {open && (
        <ul className="search-results" role="listbox">
          {isError && <li className="search-empty error-text">Place search failed</li>}
          {!isError && results.length === 0 && (
            <li className="search-empty muted">{isFetching ? 'Searching…' : 'No places found'}</li>
          )}
          {results.map((p, i) => (
            <li key={`${p.label}-${i}`} role="option" aria-selected={i === highlight}>
              <button
                className={`search-result${i === highlight ? ' highlighted' : ''}`}
                onMouseEnter={() => setHighlight(i)}
                onClick={() => pick(p)}
              >
                <strong>{p.name}</strong>
                <small>{p.label}</small>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

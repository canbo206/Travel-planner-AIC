/**
 * A trip's cover when it has no photo: a mileage sign drawn from the trip's own
 * data. The real shape of the route (start to end, scaled to fit), the first
 * and last stop as the sign's two lines, and the total miles.
 */
import { METERS_PER_MILE, type TripSummary } from '@roadtrip/shared';

type Props = {
  trip: Pick<TripSummary, 'startStop' | 'endStop' | 'totalDistanceM' | 'stopCount'>;
  className?: string;
};

const shortName = (name: string) => name.split(/[,—–-]/)[0]!.trim();
/** Fit a place name on the sign: cut at a word, never mid-word. */
const fit = (name: string, max: number) => {
  if (name.length <= max) return name;
  const cut = name.slice(0, max + 1).replace(/\s+\S*$/, '');
  return `${cut || name.slice(0, max)}…`;
};

export function CoverArt({ trip, className }: Props) {
  const { startStop: a, endStop: b } = trip;
  const isLoop = Boolean(a && b && shortName(a.name) === shortName(b.name));
  const miles = trip.totalDistanceM != null ? Math.round(trip.totalDistanceM / METERS_PER_MILE) : null;

  // Place start and end in the right-hand third, keeping their real compass direction.
  let line: { x1: number; y1: number; x2: number; y2: number } | null = null;
  if (a && b && !isLoop) {
    const dx = b.lng - a.lng;
    const dy = -(b.lat - a.lat); // north is up
    const len = Math.hypot(dx, dy) || 1;
    const cx = 318;
    const cy = 100;
    const r = 62;
    line = { x1: cx - (dx / len) * r, y1: cy - (dy / len) * r, x2: cx + (dx / len) * r, y2: cy + (dy / len) * r };
  }

  return (
    <svg className={className} viewBox="0 0 400 200" preserveAspectRatio="xMidYMid slice" role="img"
      aria-label={a && b ? `${shortName(a.name)} to ${isLoop ? 'a loop' : shortName(b.name)}${miles ? `, ${miles} miles` : ''}` : 'Trip'}>
      <rect width="400" height="200" fill="#0b0b0b" />
      {line && (
        <g>
          <line {...line} stroke="#e1ac10" strokeWidth="6" strokeDasharray="14 10" strokeLinecap="butt" />
          <rect x={line.x1 - 8} y={line.y1 - 8} width="16" height="16" fill="#f2f2f0" />
          <rect x={line.x2 - 9} y={line.y2 - 9} width="18" height="18" fill="#e1ac10" />
        </g>
      )}
      {a && (
        <text x="22" y="48" fill="#f2f2f0" fontFamily="Chivo, sans-serif" fontWeight="700" fontSize="19">
          {isLoop ? `Loop from ${fit(shortName(a.name), 13)}` : fit(shortName(a.name), 20)}
        </text>
      )}
      {b && !isLoop && (
        <text x="22" y="76" fill="#f2f2f0" fontFamily="Chivo, sans-serif" fontWeight="700" fontSize="19">
          → {fit(shortName(b.name), 18)}
        </text>
      )}
      <text x="22" y="174" fill="#e1ac10" fontFamily="Chivo, sans-serif" fontWeight="900" fontSize="54" letterSpacing="-2">
        {miles != null ? miles.toLocaleString('en-US') : trip.stopCount}
        <tspan fontSize="22" fontWeight="700" letterSpacing="0" dx="6">
          {miles != null ? 'MI' : 'STOPS'}
        </tspan>
      </text>
    </svg>
  );
}

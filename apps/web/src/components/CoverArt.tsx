/**
 * Placeholder cover for trips without photos: the landscape illustration from
 * the Figma Discover cards, with colors picked from the trip id.
 */
const PALETTES = [
  ['#BFDCE8', '#7FA79A', '#4F7F6B'], // coast
  ['#F6D9B8', '#D9A47E', '#8FA36B'], // golden hills
  ['#F3D2B3', '#D07A4E', '#B5603A'], // desert
  ['#CFE2EE', '#6F8F99', '#3F6B57'], // alpine
  ['#DDE6F2', '#8C9DB8', '#5D7F5A'], // ridges
  ['#F7E3B5', '#C9A46A', '#9B7A47'], // prairie
] as const;

function hash(s: string) {
  let h = 0;
  for (const c of s) h = (h * 31 + c.charCodeAt(0)) | 0;
  return Math.abs(h);
}

export function CoverArt({ seed, className }: { seed: string; className?: string }) {
  const [sky, far, near] = PALETTES[hash(seed) % PALETTES.length]!;
  return (
    <svg className={className} viewBox="0 0 400 200" preserveAspectRatio="xMidYMid slice" aria-hidden>
      <rect width="400" height="200" fill={sky} />
      <circle cx="312" cy="56" r="20" fill="#FFF4D6" />
      <path d="M0 124 L88 60 L160 110 L240 50 L400 120 L400 200 L0 200 Z" fill={far} />
      <path d="M0 150 C120 120 240 170 400 140 L400 200 L0 200 Z" fill={near} />
      <path d="M176 200 L224 200 L202 140 L198 140 Z" fill="#3B403D" />
    </svg>
  );
}

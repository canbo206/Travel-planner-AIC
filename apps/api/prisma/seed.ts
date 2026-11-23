/**
 * Sample public trips so Discover isn't empty. Safe to re-run: it removes
 * the seed users' trips first. Routes use OpenRouteService when ORS_API_KEY
 * is set, otherwise straight-line estimates.
 *
 *   npm run db:seed
 */
import type { StopInput } from '@roadtrip/shared';
import { prisma } from '../src/lib/db.js';
import { createTrip, putStops, updateTrip } from '../src/services/trips.js';

interface SeedTrip {
  owner: string;
  title: string;
  description: string;
  stops: StopInput[];
}

const TRIPS: SeedTrip[] = [
  {
    owner: 'alex',
    title: 'Seattle → Oregon Coast',
    description: 'Five easy days from Pike Place to the Oregon dunes, with the best chowder and tide pools on the way.',
    stops: [
      { name: 'Pike Place Market, Seattle', lat: 47.6097, lng: -122.3422, dayNumber: 1, notes: 'Get there before 10am — chowder at Pike Place Chowder.', activities: ['Gum Wall', 'Original Starbucks'] },
      { name: 'Olympia — Budd Bay', lat: 47.0517, lng: -122.9036, dayNumber: 1, notes: 'Quick stretch stop by the water, about an hour.' },
      { name: 'Astoria Column, Astoria', lat: 46.1813, lng: -123.8176, dayNumber: 1, notes: 'Climb the 164 steps at sunset. Fish & chips at Bowpicker.' },
      { name: 'Cannon Beach — Haystack Rock', lat: 45.8843, lng: -123.9687, dayNumber: 2, notes: 'Check the tide tables; puffins nest here in spring.', activities: ['Tide pools at low tide'] },
      { name: 'Tillamook Creamery', lat: 45.4826, lng: -123.8437, dayNumber: 2, notes: 'Free cheese samples. Get the marionberry ice cream.' },
      { name: 'Cape Kiwanda, Pacific City', lat: 45.2154, lng: -123.9718, dayNumber: 3, notes: 'Climb the big dune for the view, then the brewpub on the beach.' },
      { name: 'Newport — Yaquina Head', lat: 44.6767, lng: -124.0786, dayNumber: 4, notes: 'Lighthouse plus the best tide pools on the coast.' },
      { name: 'Oregon Dunes, Florence', lat: 43.9654, lng: -124.1093, dayNumber: 5, notes: 'Rent a sandboard in town.' },
    ],
  },
  {
    owner: 'mira',
    title: 'Pacific Coast Highway: SF → LA',
    description: 'Highway 1 the slow way: cliffs, elephant seals and too many stops for tacos.',
    stops: [
      { name: 'Golden Gate Bridge, San Francisco', lat: 37.8199, lng: -122.4783, dayNumber: 1 },
      { name: 'Santa Cruz Boardwalk', lat: 36.9643, lng: -122.0177, dayNumber: 1, notes: 'Ride the Giant Dipper.' },
      { name: 'Monterey Bay Aquarium', lat: 36.6182, lng: -121.9018, dayNumber: 2, notes: 'Book tickets ahead on weekends.' },
      { name: 'Bixby Creek Bridge, Big Sur', lat: 36.3715, lng: -121.9016, dayNumber: 2, notes: 'Pull-out on the north side for the classic photo.' },
      { name: 'Elephant Seal Vista Point, San Simeon', lat: 35.6631, lng: -121.2585, dayNumber: 3 },
      { name: 'Santa Barbara Funk Zone', lat: 34.4149, lng: -119.6905, dayNumber: 4, notes: 'Tasting rooms and Lucky Penny pizza.' },
      { name: 'Santa Monica Pier, Los Angeles', lat: 34.0092, lng: -118.4976, dayNumber: 4 },
    ],
  },
  {
    owner: 'jordan',
    title: "Utah's Mighty 5",
    description: 'All five national parks in a week, starting and ending in Las Vegas.',
    stops: [
      { name: 'Las Vegas', lat: 36.1699, lng: -115.1398, dayNumber: 1 },
      { name: 'Zion National Park', lat: 37.2982, lng: -113.0263, dayNumber: 1, notes: 'Angels Landing needs a permit — enter the lottery early.', activities: ['The Narrows', 'Angels Landing'] },
      { name: 'Bryce Canyon National Park', lat: 37.593, lng: -112.1871, dayNumber: 3, notes: 'Sunrise at Sunrise Point, then the Navajo Loop.' },
      { name: 'Capitol Reef National Park', lat: 38.367, lng: -111.2615, dayNumber: 4, notes: 'Fresh pie at the Gifford Homestead.' },
      { name: 'Arches National Park', lat: 38.7331, lng: -109.5925, dayNumber: 5, notes: 'Timed entry reservation required in season.' },
      { name: 'Canyonlands — Mesa Arch', lat: 38.3891, lng: -109.8678, dayNumber: 6, notes: 'Sunrise through the arch is worth the 5am alarm.' },
    ],
  },
  {
    owner: 'sam',
    title: 'North Cascades Loop',
    description: 'A three-day loop through the "American Alps", Leavenworth and back over Stevens Pass.',
    stops: [
      { name: 'Seattle', lat: 47.6062, lng: -122.3321, dayNumber: 1 },
      { name: 'Diablo Lake Overlook', lat: 48.7096, lng: -121.0975, dayNumber: 1, notes: 'That turquoise color is glacial flour.' },
      { name: 'Washington Pass Overlook', lat: 48.5249, lng: -120.6509, dayNumber: 1 },
      { name: 'Winthrop', lat: 48.4779, lng: -120.1862, dayNumber: 2, notes: 'Old-west main street; stay at the Sun Mountain Lodge if you can.' },
      { name: 'Leavenworth', lat: 47.5962, lng: -120.6615, dayNumber: 3, notes: 'Bavarian village. Pretzels at Munchen Haus.' },
      { name: 'Seattle', lat: 47.6062, lng: -122.3321, dayNumber: 3 },
    ],
  },
];

async function main() {
  const owners = [...new Set(TRIPS.map((t) => t.owner))];
  for (const username of owners) {
    await prisma.user.upsert({
      where: { id: `seed:${username}` },
      update: {},
      create: { id: `seed:${username}`, username, displayName: username },
    });
  }
  await prisma.trip.deleteMany({ where: { ownerId: { in: owners.map((u) => `seed:${u}`) } } });

  for (const t of TRIPS) {
    const userId = `seed:${t.owner}`;
    const trip = await createTrip(userId, { title: t.title, description: t.description, travelType: 'ROAD_TRIP' });
    await putStops(trip.id, userId, { stops: t.stops });
    await updateTrip(trip.id, userId, { visibility: 'PUBLIC' });
    console.log(`Seeded "${t.title}" by @${t.owner}`);
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

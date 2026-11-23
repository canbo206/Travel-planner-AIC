# Roadtrip

**Discover a trip. Follow the route. Make it your own.**

Roadtrip is a website where people share road trips they've taken. You can look at someone's trip on a map, see their stops and tips, and copy it into your own account with one click (we call this **Recreate Trip**). Then you can change it however you want.

Design: [Figma file](https://www.figma.com/design/fX7ksWs9fgRN2cOkmcq6vE) (page 1 is the roadmap, page 2 is the screens).

## What you can do right now

- Make a trip and add stops by searching for places
- See the driving route on a map
- Drag stops to change the order (it saves by itself)
- Keep a trip private, or share it with everyone
- Browse and search other people's trips on the Discover page
- **Recreate** someone's trip and edit your own copy
- Save trips you like for later

## Folders

```
apps/
  api/        the server (Express + Prisma + PostgreSQL)
  web/        the website (React + Vite + MapLibre map)
packages/
  shared/     rules for what data the server and website send each other
```

## Who works on what

| Lane | Folder to work in |
| --- | --- |
| 1 · Maps & Trip Editor | `apps/web/src/components/map`, `apps/web/src/pages/TripEditorPage.tsx` |
| 2 · App Shell & Browsing | the other files in `apps/web/src/pages` and `components` |
| 3 · Core API & Database | `apps/api/src/routes`, `apps/api/src/services/trips.ts`, `apps/api/prisma` |
| 4 · Integrations & Deploy | `apps/api/src/services`, `apps/api/src/middleware`, GitHub Actions |
| Everyone | `packages/shared` (talk to the team before changing it) |

## How to run it on your computer

You need **Node 22** and **Docker** installed.

1. Install everything:
   ```bash
   npm install
   ```
2. Start the database:
   ```bash
   docker compose up -d
   ```
3. Copy the settings files:
   ```bash
   cp apps/api/.env.example apps/api/.env
   cp apps/web/.env.example apps/web/.env
   ```
4. Set up the database and add some example trips:
   ```bash
   npm run db:migrate
   npm run db:seed
   ```
5. Start the app:
   ```bash
   npm run dev
   ```
6. Open **http://localhost:5173** in your browser.

To sign in, just type any username. You don't need a password while testing on your own computer. Tip: sign in with two different names to try recreating someone else's trip.

## Turning on extra features (optional)

The app works without these, but some things are simplified:

| What you add | What you get | Without it |
| --- | --- | --- |
| `ORS_API_KEY` in `apps/api/.env` ([get a free key](https://openrouteservice.org/dev/#/signup)) | Real driving routes and search for any place | Routes are straight dashed lines, and place search only knows a few places |
| Supabase keys (see the `.env.example` files) | Real accounts with email and password | You sign in with just a username |
| Supabase storage key + a `trip-photos` bucket | Uploading photos | The photo button says "not set up yet" |

## Useful commands

| Command | What it does |
| --- | --- |
| `npm run dev` | Starts the server and the website |
| `npm test` | Runs the tests |
| `npm run typecheck` | Checks the code for type mistakes |
| `npm run build` | Builds the website for going live |
| `npm run db:migrate` | Updates the database after you change `schema.prisma` |
| `npm run db:seed` | Adds the example trips again |

The tests use their own database, so make it once first:

```bash
docker compose exec db createdb -U roadtrip roadtrip_test
DATABASE_URL=postgresql://roadtrip:roadtrip@localhost:5432/roadtrip_test npx -w apps/api prisma migrate deploy
```

## Server routes (API)

| Method | Route | What it does |
| --- | --- | --- |
| GET | `/trips` | List public trips (Discover) |
| POST | `/trips` | Make a new trip |
| GET | `/trips/:id` | Get one trip |
| PATCH | `/trips/:id` | Change a trip's name, description or who can see it |
| DELETE | `/trips/:id` | Delete a trip |
| PUT | `/trips/:id/stops` | Save the list of stops |
| POST | `/trips/:id/recreate` | Copy a trip into your account |
| POST / DELETE | `/trips/:id/save` | Save or unsave a trip |
| GET | `/me/trips`, `/me/saved` | Your trips and your saved trips |
| GET | `/geo/search?q=` | Search for a place |

## Putting it online

- **Database, accounts and photos:** make a free Supabase project.
- **Server:** deploy `apps/api` to Render.
- **Website:** deploy `apps/web` to Vercel and set `VITE_API_URL` to your Render link.

Note: Render's free plan goes to sleep when nobody is using it, so the first page load can take a few seconds.

## Later (Phase 2)

Right now it's only road trips. Later we want to add flights, trains, hotels and trips with lots of cities. The database is already set up so we can add these without starting over.

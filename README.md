# Roadtrip

**Discover a trip. Follow the route. Make it your own.**

Roadtrip is a website where people share road trips they've taken. You can look at someone's trip on a map, see their stops and tips, and copy it into your own account with one click. Then you can change it however you want.



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

## Before you start: install these once

You need two things on your computer: **Node.js** (runs the app) and **PostgreSQL** (the database where trips, stops and users are saved).

### 1. Node.js 22

1. Go to [nodejs.org](https://nodejs.org), download version **22**, and run the installer.
2. Check it worked. Open Terminal and type `node -v`. It should print something starting with `v22`.

### 2. A database: pick one option

**Option A: Docker Desktop (recommended, what the team uses)**

1. Download Docker Desktop from [docker.com/products/docker-desktop](https://www.docker.com/products/docker-desktop/).
   - Mac: pick **Apple chip** or **Intel chip** (Apple menu → About This Mac shows which one you have).
   - Windows: say yes if it asks to install or turn on **WSL 2**, then restart.
2. Open Docker Desktop and finish the welcome screens (you can skip signing in). Wait until it says **Engine running**.
3. In Terminal, from the project folder, start the database:
   ```bash
   docker compose up -d
   ```
   Check it's running with `docker ps`. You should see a line with `postgres`.

Docker Desktop needs to be open whenever you work on the app. If it's closed, run `docker compose up -d` again after opening it.

**Option B: Postgres.app (Mac only, no Docker)**

1. Download it from [postgresapp.com](https://postgresapp.com), drag it into Applications, and open it.
2. Click **Initialize**. You'll see an elephant icon in the menu bar while it's running. No password needed.

**Already have Postgres?** If you installed it before (for example from postgresql.org with pgAdmin), you can use that instead. `npm run setup` will ask for the password you chose back then. Only run one Postgres at a time. If Docker says port 5432 is already in use, quit your other Postgres first.

## How to run it on your computer

Make sure your database is running (Docker Desktop open, or Postgres.app running). Then:

```bash
npm install
npm run setup
npm run dev
```

Open **http://localhost:5173** in your browser.

`npm run setup` does the boring parts for you: it copies the settings files, creates the database, sets up the tables and adds some example trips. If it asks for a **Postgres admin password**, type the one you picked when you installed Postgres (letters won't show while you type). You only run setup once; after that it's just `npm run dev`.

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
| `npm run setup` | First-time setup: settings, database, tables, example trips |
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


## Later (Phase 2)

Right now it's only road trips. Later we want to add flights, trains, hotels and trips with lots of cities. The database is already set up so we can add these without starting over.

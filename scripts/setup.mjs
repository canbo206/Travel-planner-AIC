#!/usr/bin/env node
/**
 * One-command local setup:  npm run setup
 *
 * 1. Copies the .env.example settings files (if you don't have them yet)
 * 2. Creates the database user + database from DATABASE_URL (if missing),
 *    asking for your Postgres admin password only if it has to
 * 3. Creates the tables and adds the sample trips
 *
 * Safe to run again: it skips anything that's already done.
 */
import { execSync } from 'node:child_process';
import { copyFileSync, existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { createInterface } from 'node:readline';

const require = createRequire(import.meta.url);
const root = new URL('..', import.meta.url).pathname;
const say = (msg) => console.log(`\n▸ ${msg}`);
const ok = (msg) => console.log(`  ✓ ${msg}`);
const fail = (msg) => {
  console.error(`\n✗ ${msg}\n`);
  process.exit(1);
};

// ---------- 1. Settings files ----------
say('Settings files');
for (const app of ['api', 'web']) {
  const env = `${root}apps/${app}/.env`;
  if (existsSync(env)) ok(`apps/${app}/.env already exists`);
  else {
    copyFileSync(`${root}apps/${app}/.env.example`, env);
    ok(`created apps/${app}/.env`);
  }
}

// ---------- 2. Database user + database ----------
let pg;
try {
  pg = require('pg');
} catch {
  fail('Run `npm install` first, then `npm run setup`.');
}

const envText = readFileSync(`${root}apps/api/.env`, 'utf8');
const urlMatch = envText.match(/^DATABASE_URL\s*=\s*"?([^"\n]+)"?/m);
if (!urlMatch) fail('DATABASE_URL is missing from apps/api/.env');
const dbUrl = new URL(urlMatch[1]);
const target = {
  host: dbUrl.hostname,
  port: Number(dbUrl.port || 5432),
  user: decodeURIComponent(dbUrl.username),
  password: decodeURIComponent(dbUrl.password),
  database: dbUrl.pathname.slice(1),
};

async function tryConnect(config) {
  const client = new pg.Client({ ...config, connectionTimeoutMillis: 5000 });
  try {
    await client.connect();
    return { client };
  } catch (error) {
    await client.end().catch(() => {});
    return { error };
  }
}

// One reader for every prompt. Typed characters are hidden; lines are queued
// so it also works when input is piped in.
let rl;
const lines = [];
const waiting = [];
let inputClosed = false;
function askHidden(question) {
  if (!rl) {
    rl = createInterface({ input: process.stdin, terminal: Boolean(process.stdin.isTTY) });
    rl.on('line', (line) => (waiting.length ? waiting.shift()(line) : lines.push(line)));
    rl.on('close', () => {
      inputClosed = true;
      while (waiting.length) waiting.shift()(null);
    });
  }
  process.stdout.write(question);
  return new Promise((resolve) => {
    const done = (answer) => {
      process.stdout.write('\n');
      resolve(answer);
    };
    if (lines.length) done(lines.shift());
    else if (inputClosed) done(null);
    else waiting.push(done);
  });
}

const notRunning = `Can't reach Postgres at ${target.host}:${target.port}. Start it first:
  • Docker:          open Docker Desktop, then run  docker compose up -d
  • Postgres app / installer:  make sure the server is running (pgAdmin or Postgres.app)
  • Homebrew:        brew services start postgresql@16`;

say(`Database "${target.database}" for user "${target.user}"`);
const first = await tryConnect(target);
if (first.client) {
  await first.client.end();
  ok('already set up');
} else {
  if (first.error.code === 'ECONNREFUSED' || first.error.code === 'ENOTFOUND') fail(notRunning);

  // Connect as an admin who can create users and databases.
  const base = { host: target.host, port: target.port, database: 'postgres' };
  const candidates = [
    { ...base, user: process.env.USER }, // Homebrew / Postgres.app default
    { ...base, user: 'postgres' }, // official installer / Docker default (no password)
  ];
  let admin;
  for (const c of candidates) {
    const r = await tryConnect(c);
    if (r.client) {
      admin = r.client;
      break;
    }
    if (r.error.code === 'ECONNREFUSED') fail(notRunning);
  }
  for (let attempt = 1; !admin && attempt <= 3; attempt++) {
    const password = await askHidden(
      attempt === 1
        ? '  Postgres admin password (user "postgres", the one you chose when installing Postgres): '
        : '  That didn\'t work, try again: ',
    );
    if (password === null) break; // no more input
    const r = await tryConnect({ ...base, user: 'postgres', password });
    if (r.client) admin = r.client;
  }
  rl?.close();
  if (!admin) {
    fail(`Couldn't sign in to Postgres as an admin.
  If you don't remember the "postgres" password, open pgAdmin → Query Tool and run:
    CREATE USER ${target.user} WITH PASSWORD '${target.password}' CREATEDB;
    CREATE DATABASE ${target.database} OWNER ${target.user};
  then run  npm run setup  again.`);
  }

  const ident = (s) => `"${s.replace(/"/g, '""')}"`;
  const literal = (s) => `'${s.replace(/'/g, "''")}'`;
  const role = await admin.query('SELECT 1 FROM pg_roles WHERE rolname = $1', [target.user]);
  if (role.rowCount) {
    await admin.query(`ALTER ROLE ${ident(target.user)} WITH LOGIN CREATEDB PASSWORD ${literal(target.password)}`);
    ok(`user "${target.user}" already existed (password reset to match .env)`);
  } else {
    await admin.query(`CREATE ROLE ${ident(target.user)} WITH LOGIN CREATEDB PASSWORD ${literal(target.password)}`);
    ok(`created user "${target.user}"`);
  }
  const db = await admin.query('SELECT 1 FROM pg_database WHERE datname = $1', [target.database]);
  if (db.rowCount) ok(`database "${target.database}" already existed`);
  else {
    await admin.query(`CREATE DATABASE ${ident(target.database)} OWNER ${ident(target.user)}`);
    ok(`created database "${target.database}"`);
  }
  await admin.end();

  const check = await tryConnect(target);
  if (!check.client) fail(`Created the database but still can't connect: ${check.error.message}`);
  await check.client.end();
}

// ---------- 3. Tables + sample trips ----------
const run = (cmd) => execSync(cmd, { cwd: `${root}apps/api`, stdio: 'inherit' });

say('Creating tables');
try {
  run('npx prisma migrate deploy');
} catch {
  fail('Setting up the tables failed (see the error above).');
}

say('Adding sample trips');
try {
  run('npx tsx prisma/seed.ts');
} catch {
  fail('Adding sample trips failed (see the error above).');
}

console.log('\n✅ All set! Start the app with:\n\n   npm run dev\n\nthen open http://localhost:5173\n');

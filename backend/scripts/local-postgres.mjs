#!/usr/bin/env node

/**
 * AMIRLab local PostgreSQL controller.
 *
 * Creates a private PostgreSQL cluster under backend/.postgres so local
 * development does not depend on Docker or the system PostgreSQL service.
 * No npm packages are required by this script.
 */

import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const backendDir = resolve(scriptDir, '..');
const stateDir = join(backendDir, '.postgres');
const dataDir = join(stateDir, 'data');
const logFile = join(stateDir, 'postgres.log');
const envFile = join(backendDir, '.env');

function loadEnvFile(path) {
  if (!existsSync(path)) return {};
  const result = {};
  for (const raw of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq < 1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    result[key] = value;
  }
  return result;
}

const fileEnv = loadEnvFile(envFile);
const databaseUrl =
  process.env.DATABASE_URL ||
  fileEnv.DATABASE_URL ||
  'postgresql://amirl:amirl-local-2026@127.0.0.1:5433/amirl';
let dbUrl;
try {
  dbUrl = new URL(databaseUrl);
} catch {
  fail(`DATABASE_URL is invalid: ${databaseUrl}`);
}

if (!['postgres:', 'postgresql:'].includes(dbUrl.protocol)) {
  fail(
    `DATABASE_URL must use postgresql:// or postgres://, got ${dbUrl.protocol}`,
  );
}

const host = dbUrl.hostname || '127.0.0.1';
if (!['127.0.0.1', 'localhost', '::1'].includes(host)) {
  fail(
    `Refusing to manage a non-local PostgreSQL host (${host}). db:start only manages the private local development database.`,
  );
}

const port = Number(dbUrl.port || 5432);
const socketDir = join(
  tmpdir(),
  `amirlab-pg-${process.getuid?.() ?? 'user'}-${port}`,
);
const appUser = decodeURIComponent(dbUrl.username || 'amirl');
const appPassword = decodeURIComponent(dbUrl.password || 'amirl-local-2026');
const appDatabase = decodeURIComponent(
  dbUrl.pathname.replace(/^\//, '') || 'amirl',
);
const initSuperuser = process.env.AMIRL_PG_SUPERUSER || 'amirl_local_admin';

function fail(message, code = 1) {
  console.error(`\n[db] ${message}\n`);
  process.exit(code);
}

function commandExists(command) {
  return (
    spawnSync('sh', ['-c', `command -v ${shellQuote(command)} >/dev/null 2>&1`])
      .status === 0
  );
}

function shellQuote(value) {
  return `'${String(value).replaceAll("'", `'\\''`)}'`;
}

function requirePostgresTools() {
  const required = ['pg_ctl', 'initdb', 'psql', 'createdb'];
  const missing = required.filter((cmd) => !commandExists(cmd));
  if (!missing.length) return;

  console.error(
    `[db] Missing PostgreSQL command${missing.length > 1 ? 's' : ''}: ${missing.join(', ')}`,
  );
  console.error(
    '[db] Install the PostgreSQL server/client tools, then run pnpm run db:start again.',
  );
  console.error('[db] Fedora: sudo dnf install postgresql-server postgresql');
  console.error(
    '[db] Ubuntu/Debian: sudo apt install postgresql postgresql-client',
  );
  console.error(
    '[db] Or use Docker instead from the project root: pnpm run db:start:docker',
  );
  process.exit(1);
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: backendDir,
    encoding: 'utf8',
    stdio: options.capture ? ['ignore', 'pipe', 'pipe'] : 'inherit',
    env: { ...process.env, ...options.env },
  });
  if (result.error) throw result.error;
  if (options.allowFailure) return result;
  if (result.status !== 0) {
    if (options.capture) {
      if (result.stdout) process.stdout.write(result.stdout);
      if (result.stderr) process.stderr.write(result.stderr);
    }
    process.exit(result.status ?? 1);
  }
  return result;
}

function isInitialized() {
  return existsSync(join(dataDir, 'PG_VERSION'));
}

function isRunning() {
  if (!isInitialized()) return false;
  const result = run('pg_ctl', ['-D', dataDir, 'status'], {
    capture: true,
    allowFailure: true,
  });
  return result.status === 0;
}

function ensureDirectories() {
  mkdirSync(dataDir, { recursive: true });
  mkdirSync(socketDir, { recursive: true });
}

function initializeCluster() {
  if (isInitialized()) return;
  console.log(`[db] Initializing private PostgreSQL cluster in ${dataDir}`);
  ensureDirectories();
  run('initdb', [
    '-D',
    dataDir,
    '--username',
    initSuperuser,
    '--auth-local=trust',
    '--auth-host=trust',
    '--encoding=UTF8',
    '--no-locale',
  ]);
}

function tcpPortIsOccupied() {
  if (!commandExists('pg_isready')) return false;
  const result = run(
    'pg_isready',
    ['-h', '127.0.0.1', '-p', String(port), '-t', '1'],
    { capture: true, allowFailure: true },
  );
  return result.status === 0;
}

function startServer() {
  ensureDirectories();
  if (isRunning()) {
    console.log(`[db] PostgreSQL is already running on ${host}:${port}`);
    return;
  }
  if (tcpPortIsOccupied()) {
    fail(
      `Port ${port} is already occupied by another PostgreSQL server. Stop the other AMIRLab checkout or change DATABASE_URL to a free local port.`,
    );
  }
  console.log(`[db] Starting PostgreSQL on ${host}:${port}`);
  const postgresOptions = `-h 127.0.0.1 -k ${socketDir} -p ${port}`;
  run('pg_ctl', [
    '-D',
    dataDir,
    '-l',
    logFile,
    '-o',
    postgresOptions,
    '-w',
    'start',
  ]);
}

function sqlLiteral(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

function sqlIdentifier(value) {
  return `"${String(value).replaceAll('"', '""')}"`;
}

function psql(sql, database = 'postgres', allowFailure = false) {
  return run(
    'psql',
    [
      '-h',
      '127.0.0.1',
      '-p',
      String(port),
      '-U',
      initSuperuser,
      '-d',
      database,
      '-v',
      'ON_ERROR_STOP=1',
      '-Atqc',
      sql,
    ],
    { capture: true, allowFailure },
  );
}

function ensureAppRoleAndDatabase() {
  const roleExists =
    psql(
      `SELECT 1 FROM pg_roles WHERE rolname = ${sqlLiteral(appUser)}`,
    ).stdout.trim() === '1';
  if (!roleExists) {
    console.log(`[db] Creating role ${appUser}`);
    psql(
      `CREATE ROLE ${sqlIdentifier(appUser)} LOGIN PASSWORD ${sqlLiteral(appPassword)}`,
    );
  } else {
    // Keep the private local role aligned with DATABASE_URL after env changes.
    psql(
      `ALTER ROLE ${sqlIdentifier(appUser)} WITH LOGIN PASSWORD ${sqlLiteral(appPassword)}`,
    );
  }

  const dbExists =
    psql(
      `SELECT 1 FROM pg_database WHERE datname = ${sqlLiteral(appDatabase)}`,
    ).stdout.trim() === '1';
  if (!dbExists) {
    console.log(`[db] Creating database ${appDatabase}`);
    run('createdb', [
      '-h',
      '127.0.0.1',
      '-p',
      String(port),
      '-U',
      initSuperuser,
      '-O',
      appUser,
      appDatabase,
    ]);
  }
}

function printReady() {
  console.log(
    `[db] Ready: postgresql://${appUser}:***@${host}:${port}/${appDatabase}`,
  );
  console.log(
    '[db] Next: pnpm run db:rebuild  (destructive rebuild from seed/amirl-site.json)',
  );
}

function start() {
  requirePostgresTools();
  initializeCluster();
  startServer();
  ensureAppRoleAndDatabase();
  printReady();
}

function stop() {
  requirePostgresTools();
  if (!isInitialized()) {
    console.log('[db] Local database has not been initialized.');
    return;
  }
  if (!isRunning()) {
    console.log('[db] PostgreSQL is not running.');
    return;
  }
  run('pg_ctl', ['-D', dataDir, '-w', 'stop', '-m', 'fast']);
  console.log('[db] PostgreSQL stopped.');
}

function status() {
  requirePostgresTools();
  if (!isInitialized()) {
    console.log('[db] Not initialized. Run pnpm run db:start.');
    process.exitCode = 1;
    return;
  }
  const result = run('pg_ctl', ['-D', dataDir, 'status'], {
    capture: true,
    allowFailure: true,
  });
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  if (result.status !== 0) process.exitCode = result.status ?? 1;
}

function reset() {
  requirePostgresTools();
  if (isRunning()) {
    run('pg_ctl', ['-D', dataDir, '-w', 'stop', '-m', 'fast']);
  }
  if (existsSync(stateDir)) {
    console.log(`[db] Removing local cluster ${stateDir}`);
    rmSync(stateDir, { recursive: true, force: true });
  }
  start();
}

const action = process.argv[2] || 'start';
switch (action) {
  case 'start':
    start();
    break;
  case 'stop':
    stop();
    break;
  case 'status':
    status();
    break;
  case 'reset':
    reset();
    break;
  default:
    fail(`Unknown action "${action}". Use start, stop, status, or reset.`);
}

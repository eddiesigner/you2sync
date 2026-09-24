import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import { DatabaseSync } from 'node:sqlite'

// Each entry runs once, in order. Append only; never edit a shipped entry.
const MIGRATIONS = [
  `
  CREATE TABLE accounts (
    service TEXT PRIMARY KEY,
    external_id TEXT NOT NULL,
    name TEXT NOT NULL,
    avatar TEXT,
    credentials TEXT NOT NULL,
    updated_at INTEGER NOT NULL
  );

  -- A pair of playlists kept in sync. Linked by id, never by name.
  CREATE TABLE links (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    kind TEXT NOT NULL,
    spotify_id TEXT NOT NULL UNIQUE,
    ytmusic_id TEXT NOT NULL UNIQUE,
    last_synced_at INTEGER
  );

  -- Track ids present on each side after the last sync, used to detect
  -- removals made on the source since then.
  CREATE TABLE snapshots (
    link_id INTEGER NOT NULL REFERENCES links(id) ON DELETE CASCADE,
    service TEXT NOT NULL,
    track_id TEXT NOT NULL,
    PRIMARY KEY (link_id, service, track_id)
  );

  -- Cache of resolved Spotify <-> YouTube Music track pairs.
  CREATE TABLE matches (
    spotify_id TEXT NOT NULL,
    ytmusic_id TEXT NOT NULL,
    score REAL NOT NULL,
    manual INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (spotify_id, ytmusic_id)
  );
  CREATE INDEX matches_ytmusic ON matches(ytmusic_id);

  -- Songs that could not be matched with enough confidence.
  CREATE TABLE reviews (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    source TEXT NOT NULL,
    source_playlist_id TEXT NOT NULL,
    target_playlist_id TEXT NOT NULL,
    playlist_name TEXT NOT NULL,
    track_id TEXT NOT NULL,
    track TEXT NOT NULL,
    best_guess TEXT,
    status TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    UNIQUE (source, target_playlist_id, track_id)
  );
  `,
]

let db: DatabaseSync | undefined

export function useDb(): DatabaseSync {
  if (db) {
    return db
  }

  const { databasePath } = useRuntimeConfig()
  mkdirSync(dirname(databasePath), { recursive: true })

  db = new DatabaseSync(databasePath)
  db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;')
  migrate(db)

  return db
}

function migrate(database: DatabaseSync) {
  const { user_version: version } = database.prepare('PRAGMA user_version').get() as { user_version: number }

  for (let i = version; i < MIGRATIONS.length; i++) {
    database.exec('BEGIN')
    try {
      database.exec(MIGRATIONS[i]!)
      database.exec(`PRAGMA user_version = ${i + 1}`)
      database.exec('COMMIT')
    }
    catch (error) {
      database.exec('ROLLBACK')
      throw error
    }
  }
}

export function transaction<T>(fn: () => T): T {
  const database = useDb()
  database.exec('BEGIN')
  try {
    const result = fn()
    database.exec('COMMIT')
    return result
  }
  catch (error) {
    database.exec('ROLLBACK')
    throw error
  }
}

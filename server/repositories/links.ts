import { type PlaylistKind, Service } from '#shared/types'
import { transaction, useDb } from '../db'

export interface LinkRow {
  id: number
  kind: PlaylistKind
  spotify_id: string
  ytmusic_id: string
  last_synced_at: number | null
}

const COLUMN: Record<Service, 'spotify_id' | 'ytmusic_id'> = {
  [Service.Spotify]: 'spotify_id',
  [Service.YTMusic]: 'ytmusic_id',
}

export function listLinks(): LinkRow[] {
  return useDb().prepare('SELECT * FROM links').all() as unknown as LinkRow[]
}

export function findLinkBy(service: Service, playlistId: string): LinkRow | undefined {
  return useDb().prepare(`SELECT * FROM links WHERE ${COLUMN[service]} = ?`).get(playlistId) as LinkRow | undefined
}

export function linkedId(link: LinkRow, service: Service): string {
  return link[COLUMN[service]]
}

export function createLink(kind: PlaylistKind, spotifyId: string, ytmusicId: string): LinkRow {
  const db = useDb()
  const { lastInsertRowid } = db.prepare('INSERT INTO links (kind, spotify_id, ytmusic_id) VALUES (?, ?, ?)').run(kind, spotifyId, ytmusicId)
  return db.prepare('SELECT * FROM links WHERE id = ?').get(lastInsertRowid) as unknown as LinkRow
}

export function deleteLink(id: number) {
  useDb().prepare('DELETE FROM links WHERE id = ?').run(id)
}

export function deleteAllLinks() {
  useDb().exec('DELETE FROM links')
}

export function readSnapshot(linkId: number, service: Service): Set<string> {
  const rows = useDb().prepare('SELECT track_id FROM snapshots WHERE link_id = ? AND service = ?').all(linkId, service) as { track_id: string }[]
  return new Set(rows.map(row => row.track_id))
}

export function addToSnapshot(linkId: number, service: Service, trackIds: string[]) {
  const insert = useDb().prepare('INSERT OR IGNORE INTO snapshots (link_id, service, track_id) VALUES (?, ?, ?)')
  for (const trackId of trackIds) {
    insert.run(linkId, service, trackId)
  }
}

// Replaces both sides' snapshots and stamps the sync time atomically.
export function saveSnapshots(linkId: number, sides: Record<Service, Iterable<string>>) {
  const db = useDb()
  transaction(() => {
    db.prepare('DELETE FROM snapshots WHERE link_id = ?').run(linkId)
    const insert = db.prepare('INSERT OR IGNORE INTO snapshots (link_id, service, track_id) VALUES (?, ?, ?)')
    for (const service of Object.values(Service)) {
      for (const trackId of sides[service]) {
        insert.run(linkId, service, trackId)
      }
    }
    db.prepare('UPDATE links SET last_synced_at = ? WHERE id = ?').run(Date.now(), linkId)
  })
}

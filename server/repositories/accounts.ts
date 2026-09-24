import type { Service } from '#shared/types'
import { useDb } from '../db'

export interface AccountRow {
  service: Service
  external_id: string
  name: string
  avatar: string | null
  // Encrypted JSON; only the auth service decrypts it.
  credentials: string
  updated_at: number
}

export function findAccount(service: Service): AccountRow | undefined {
  return useDb().prepare('SELECT * FROM accounts WHERE service = ?').get(service) as AccountRow | undefined
}

export function listAccounts(): AccountRow[] {
  return useDb().prepare('SELECT * FROM accounts').all() as unknown as AccountRow[]
}

export function saveAccount(row: Omit<AccountRow, 'updated_at'>) {
  useDb().prepare(`
    INSERT INTO accounts (service, external_id, name, avatar, credentials, updated_at)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT (service) DO UPDATE SET
      external_id = excluded.external_id,
      name = excluded.name,
      avatar = excluded.avatar,
      credentials = excluded.credentials,
      updated_at = excluded.updated_at
  `).run(row.service, row.external_id, row.name, row.avatar, row.credentials, Date.now())
}

export function updateCredentials(service: Service, credentials: string) {
  useDb().prepare('UPDATE accounts SET credentials = ?, updated_at = ? WHERE service = ?').run(credentials, Date.now(), service)
}

export function deleteAccount(service: Service) {
  useDb().prepare('DELETE FROM accounts WHERE service = ?').run(service)
}

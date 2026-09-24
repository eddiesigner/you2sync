import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { YTNodes } from 'youtubei.js'
import type { ApiResponse } from 'youtubei.js'
import { parseLibraryPage } from '../server/providers/ytmusic/library'

const fixture = JSON.parse(readFileSync(new URL('./fixtures/ytmusic-library.json', import.meta.url), 'utf8'))
const response = { success: true, status_code: 200, data: fixture } as ApiResponse

describe('parseLibraryPage', () => {
  it('reads playlists when the page also contains an ItemSection', () => {
    const page = parseLibraryPage(response)
    const playlists = page.nodes.filter(node => node.is(YTNodes.MusicTwoRowItem))
    const titles = playlists.map(node => node.as(YTNodes.MusicTwoRowItem).title.toString())
    expect(titles).toEqual(['Focus', 'Road Trip'])
  })

  it('returns the continuation token of the grid', () => {
    expect(parseLibraryPage(response).continuation).toBe('NEXT_TOKEN')
  })
})

import { GridContinuation, type Helpers, MusicShelfContinuation, Parser, YTNodes } from 'youtubei.js'
import type { ApiResponse } from 'youtubei.js'

export interface LibraryPage {
  nodes: Helpers.YTNode[]
  continuation?: string
}

/*
 * youtubei.js's Library parser only accepts Grid and MusicShelf sections and
 * throws on anything else (YouTube Music now adds an ItemSection). Walk the
 * sections ourselves and skip what is not a list of items:
 *
 *   SectionList ─┬─ ItemSection ─── (Grid | MusicShelf | item | other)…
 *                ├─ Grid ────────── items + continuation
 *                └─ MusicShelf ──── contents + continuation
 */
function collect(sections: Iterable<Helpers.YTNode>, page: LibraryPage) {
  for (const section of sections) {
    if (section.is(YTNodes.Grid)) {
      page.nodes.push(...section.items)
      page.continuation ??= section.continuation ?? undefined
      continue
    }
    if (section.is(YTNodes.MusicShelf)) {
      page.nodes.push(...section.contents)
      page.continuation ??= section.continuation
      continue
    }
    if (section.is(YTNodes.ItemSection)) {
      collect(section.contents, page)
      continue
    }
    // Items may also sit directly inside an ItemSection.
    if (section.is(YTNodes.MusicTwoRowItem, YTNodes.MusicResponsiveListItem)) {
      page.nodes.push(section)
    }
  }
}

// Items and continuation token of the first library playlists page.
export function parseLibraryPage(response: ApiResponse): LibraryPage {
  const parsed = Parser.parseResponse(response.data)
  const sectionList = parsed.contents_memo?.getType(YTNodes.SectionList)[0]
  const page: LibraryPage = { nodes: [] }
  collect(sectionList?.contents ?? [], page)
  return page
}

// Items and next token of a follow-up page fetched with a continuation.
export function parseLibraryContinuation(response: ApiResponse): LibraryPage {
  const contents = Parser.parseResponse(response.data).continuation_contents

  if (contents?.is(GridContinuation)) {
    return { nodes: [...(contents.items ?? [])], continuation: contents.continuation || undefined }
  }
  if (contents?.is(MusicShelfContinuation)) {
    return { nodes: [...contents.contents], continuation: contents.continuation || undefined }
  }
  return { nodes: [] }
}

<script setup lang="ts">
import { ArrowLeftRight, ArrowRight, Loader2, RefreshCw, Search } from '@lucide/vue'
import { toast } from 'vue-sonner'
import { type JobState, SERVICE_LABEL, Service, SyncMode, otherService } from '#shared/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'

useHead({ title: 'Library · You2Sync' })

const SKELETON_CARDS = 12
const HERO_COVERS = 5

const { data: library, status, refresh, error } = useLibrary()

const source = useState('sync-source', () => Service.Spotify)
const mode = useState('sync-mode', () => SyncMode.Changes)
const target = computed(() => otherService(source.value))

const query = ref('')
const selected = ref(new Set<string>())
const starting = ref(false)

const playlists = computed(() => library.value?.playlists[source.value] ?? [])
const editable = computed(() => playlists.value.filter(p => p.editable))
const visible = computed(() => {
  const needle = query.value.trim().toLowerCase()
  return needle ? playlists.value.filter(p => p.name.toLowerCase().includes(needle)) : playlists.value
})

// Hero artwork: the selection if any, otherwise the first covers available.
const heroCovers = computed(() => {
  const withCover = playlists.value.filter(p => p.image)
  const picked = withCover.filter(p => selected.value.has(p.id))
  return (picked.length ? picked : withCover).slice(0, HERO_COVERS)
})

const allSelected = computed(() => editable.value.length > 0 && editable.value.every(p => selected.value.has(p.id)))

watch(source, () => {
  selected.value = new Set()
})

function toggle(id: string) {
  const next = new Set(selected.value)
  if (!next.delete(id)) {
    next.add(id)
  }
  selected.value = next
}

function toggleAll() {
  selected.value = allSelected.value ? new Set() : new Set(editable.value.map(p => p.id))
}

// A single toggle group can be emptied; keep the current mode instead.
function setMode(value: unknown) {
  if (value) {
    mode.value = value as SyncMode
  }
}

function swap() {
  source.value = target.value
}

// An empty id list means "every editable playlist".
async function startSync(playlistIds: string[]) {
  starting.value = true
  try {
    const job = await api<JobState>('/api/sync/plan', {
      method: 'POST',
      body: { source: source.value, mode: mode.value, playlistIds },
    })
    await navigateTo(`/sync/${job.id}`)
  }
  catch (err) {
    toast.error(errorText(err))
  }
  finally {
    starting.value = false
  }
}
</script>

<template>
  <div>
    <!-- Hero: blurred artwork, direction and mode controls. -->
    <section class="relative isolate overflow-hidden border-b border-white/5">
      <AmbientBackdrop :src="heroCovers[0]?.image" />
      <div class="relative z-10 mx-auto flex max-w-7xl flex-col gap-8 px-4 pt-10 pb-8 sm:px-6 lg:flex-row lg:items-end lg:justify-between">
        <div class="flex items-end gap-5">
          <div class="relative hidden h-36 w-52 shrink-0 sm:block" aria-hidden="true">
            <CoverImage
              v-for="(playlist, index) in heroCovers.slice(0, 3)"
              :key="playlist.id"
              :src="playlist.image"
              eager
              class="absolute size-32 rounded-lg shadow-2xl shadow-black/60 ring-1 ring-white/10 transition-all duration-500"
              :style="{ left: `${index * 2.5}rem`, top: `${index * 0.25}rem`, zIndex: 3 - index, rotate: `${(index - 1) * 4}deg` }"
            />
          </div>
          <div>
            <p class="text-xs font-semibold tracking-widest text-muted-foreground uppercase">
              Your library
            </p>
            <h1 class="mt-1 text-3xl font-bold tracking-tight sm:text-5xl">
              Sync playlists
            </h1>
            <p class="mt-2 text-sm text-muted-foreground">
              {{ editable.length }} syncable playlists on {{ SERVICE_LABEL[source] }}
            </p>
          </div>
        </div>

        <div class="flex flex-col gap-4 sm:flex-row sm:items-end">
          <div>
            <p id="direction-label" class="mb-2 text-xs font-medium text-muted-foreground">
              Direction
            </p>
            <div class="flex items-center gap-2 rounded-full border border-white/10 bg-black/30 p-1.5 backdrop-blur" role="group" aria-labelledby="direction-label">
              <span class="flex items-center gap-2 rounded-full bg-white/10 py-1.5 pr-3 pl-2 text-sm font-medium">
                <BrandIcon :service="source" class="size-5" /> {{ SERVICE_LABEL[source] }}
              </span>
              <ArrowRight class="size-4 text-muted-foreground" aria-label="to" />
              <span class="flex items-center gap-2 py-1.5 pr-2 text-sm font-medium">
                <BrandIcon :service="target" class="size-5" /> {{ SERVICE_LABEL[target] }}
              </span>
              <ButtonTooltip label="Swap direction">
                <Button variant="ghost" size="icon-sm" class="rounded-full" :aria-label="`Swap direction: sync from ${SERVICE_LABEL[target]} to ${SERVICE_LABEL[source]}`" @click="swap">
                  <ArrowLeftRight />
                </Button>
              </ButtonTooltip>
            </div>
          </div>

          <div>
            <p id="mode-label" class="mb-2 text-xs font-medium text-muted-foreground">
              What to sync
            </p>
            <!-- The tooltip trigger overwrites data-state on the items; style by aria-pressed. -->
            <ToggleGroup :model-value="mode" type="single" :spacing="1" aria-labelledby="mode-label" @update:model-value="setMode" class="rounded-full border border-white/10 bg-black/30 p-1.5 backdrop-blur">
              <ButtonTooltip label="Add and remove only what changed since the last sync">
                <ToggleGroupItem :value="SyncMode.Changes" class="rounded-full px-4 aria-pressed:bg-white/15">
                  Only changes
                </ToggleGroupItem>
              </ButtonTooltip>
              <ButtonTooltip label="Make the target an exact copy of the source">
                <ToggleGroupItem :value="SyncMode.Mirror" class="rounded-full px-4 aria-pressed:bg-white/15">
                  Full mirror
                </ToggleGroupItem>
              </ButtonTooltip>
            </ToggleGroup>
          </div>
        </div>
      </div>
    </section>

    <!-- Toolbar -->
    <div class="mx-auto flex max-w-7xl flex-wrap items-center gap-3 px-4 pt-6 sm:px-6">
      <div class="relative min-w-0 flex-1 sm:max-w-xs">
        <Search class="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
        <Input v-model="query" type="search" placeholder="Filter playlists" aria-label="Filter playlists" class="rounded-full pl-9" />
      </div>
      <Button variant="ghost" class="rounded-full" :disabled="!editable.length" @click="toggleAll">
        {{ allSelected ? 'Clear selection' : 'Select all' }}
      </Button>
      <ButtonTooltip label="Reload library">
        <Button variant="ghost" size="icon" class="ml-auto rounded-full" aria-label="Reload library" :disabled="status === 'pending'" @click="refresh()">
          <RefreshCw :class="{ 'animate-spin': status === 'pending' }" />
        </Button>
      </ButtonTooltip>
    </div>

    <!-- Playlist grid -->
    <section aria-label="Playlists" class="mx-auto max-w-7xl px-2 pt-4 sm:px-4">
      <p v-if="error" class="px-2 py-10 text-center text-muted-foreground" role="alert">
        Could not load your library. {{ errorText(error) }}
      </p>

      <div v-else-if="status === 'pending' && !library" class="grid grid-cols-2 gap-1 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6" aria-busy="true" aria-label="Loading playlists">
        <div v-for="n in SKELETON_CARDS" :key="n" class="p-3">
          <Skeleton class="aspect-square rounded-lg" />
          <Skeleton class="mt-3 h-4 w-3/4" />
          <Skeleton class="mt-2 h-3 w-1/2" />
        </div>
      </div>

      <p v-else-if="!visible.length" class="px-2 py-16 text-center text-muted-foreground">
        {{ query ? 'No playlists match your filter.' : 'No playlists found.' }}
      </p>

      <div v-else class="grid grid-cols-2 gap-1 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
        <PlaylistCard
          v-for="playlist in visible"
          :key="playlist.id"
          :playlist="playlist"
          :selected="selected.has(playlist.id)"
          @toggle="toggle(playlist.id)"
          @sync-now="startSync([playlist.id])"
        />
      </div>
    </section>

    <!-- Sticky action bar. Sits above the mobile tab bar. -->
    <div class="pointer-events-none fixed inset-x-0 bottom-[calc(4.25rem+env(safe-area-inset-bottom))] z-30 px-4 md:bottom-6">
      <div class="pointer-events-auto mx-auto flex max-w-2xl items-center gap-3 rounded-full border border-white/10 bg-popover/90 p-2 pl-5 shadow-2xl shadow-black/60 backdrop-blur-xl">
        <p class="min-w-0 flex-1 truncate text-sm" aria-live="polite">
          <template v-if="selected.size">
            <strong>{{ selected.size }}</strong> selected
          </template>
          <span v-else class="text-muted-foreground">Select playlists or sync everything</span>
        </p>
        <Button
          v-if="selected.size"
          class="rounded-full"
          :disabled="starting"
          @click="startSync([...selected])"
        >
          <Loader2 v-if="starting" class="animate-spin" />
          Sync selected
        </Button>
        <Button
          variant="secondary"
          class="rounded-full"
          :disabled="starting || !editable.length"
          @click="startSync([])"
        >
          <Loader2 v-if="starting && !selected.size" class="animate-spin" />
          Sync all
        </Button>
      </div>
    </div>
  </div>
</template>
